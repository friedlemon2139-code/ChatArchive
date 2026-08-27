// 빌드 (README §11) — Node 22 ESM + esbuild JS API
//
//   node build.mjs            전체 빌드
//   node build.mjs --only=probe   프로브만 빌드(다른 모듈이 아직 없을 때 점검용)
//
// 산출물
//   generated/viewer.txt, generated/viewer.css.txt   북마클릿에 텍스트로 박히는 뷰어 번들
//   dist/geas-export.js                              북마클릿 번들 — API 버전
//   dist/geas-export-screen.js                       북마클릿 번들 — 화면 읽기 버전
//   dist/*.bookmarklet.txt                           코드 전체 인라인 북마클릿(위 둘 각각)
//   dist/paste-page-luna.js                          루나톡 붙여넣기 저장 페이지가 쓰는 스크립트
//   dist/paste-page-genit.js                         젠잇 붙여넣기 저장 페이지가 쓰는 스크립트
//   dist/luna-tool.html                              한 장짜리 붙여넣기 도구(코드 인라인·읽을 수 있는 형태)
//   dist/readable/*.js, dist/readable/viewer.css     압축하지 않은 같은 산출물(검증용, README §15)
//   dist/probe.js, dist/probe.bookmarklet.txt        개발용 조사 스크립트(사이트로 복사하지 않는다)
//   → dist/*.js · dist/*.bookmarklet.txt · dist/*-tool.html 을 ../../site/export/ 로 복사하고
//     site/export/genit.html(화면 읽기)·genit-api.html(API) 의 북마클릿 앵커 href와 코드 칸을,
//     site/export/luna.html 의 CSP·자기소개 칸을 갈아 끼운다.
//
// **단계마다 입력이 있을 때만 돈다.** 이 스크립트는 플랫폼 하나만 담은 공개 저장소
// (`ChatArchive` 루나톡 · `ChatArchiveG` 젠잇)에서도 그대로 돌아야 한다 — 그쪽에는 다른 플랫폼의
// 엔트리도, 안내 페이지도 없다. 없는 입력을 만나면 그 단계를 건너뛰고 나머지를 굽는다(§11).
//
// 산출물은 실행마다 바이트가 같아야 한다(README §15). 빌드 끝에 SHA-256을 찍는다 —
// 두 번 돌려 같은 값이 나오는지로 확인한다.

import * as esbuild from 'esbuild'
import { mkdir, writeFile, readFile, readdir, copyFile, access } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const SRC = join(root, 'src')
const GENERATED = join(root, 'generated')
const DIST = join(root, 'dist')
// 안내 페이지 폴더: 프로젝트 안에서는 ../../site/export, 공개 저장소에서는 ./docs (GitHub Pages 폴더)
//
// **`docs/`가 있으면 그쪽이 먼저다.** 공개 저장소에는 `docs/`가 함께 들어 있고 이 프로젝트에는
// 없다 — 그것이 둘을 가르는 표시다. `../../site/export`의 존재로만 갈랐더니 공개 저장소를
// 이 프로젝트 옆(`tools/ChatArchive`)에 두었을 때 두 계단 위가 같은 폴더로 잡혀,
// 저장소 빌드가 자기 `docs/`가 아니라 프로젝트의 배포 폴더에 썼다.
const LOCAL_DOCS = join(root, 'docs')
const PROJECT_SITE = resolve(root, '..', '..', 'site', 'export')
const IN_PROJECT = !existsSync(LOCAL_DOCS) && existsSync(PROJECT_SITE)
const SITE_EXPORT = IN_PROJECT ? PROJECT_SITE : LOCAL_DOCS
// 크기·해시 표에 찍는 이름. 실제 폴더를 따라간다 — 어느 저장소에서 구웠는지가 표에 남는다.
const SITE_LABEL = IN_PROJECT ? 'site/export' : 'docs'
const READABLE = join(DIST, 'readable')
// 아직 발행하지 않는 페이지의 원본. 사이트 폴더 밖에 둔다 — 그래야 배포에 딸려 나가지 않는다.
const UNPUBLISHED = join(root, 'unpublished')

// 배포 사이트 주소. 잠정값 — Cloudflare Pages 도메인이 확정되면 여기만 고친다.

// 공개 저장소 주소. **미확정** — 저장소를 만들면 여기만 고친다(README §14·§15).
// 자기소개 칸에 그대로 찍히므로 `<`·`>`가 들어 있어도 escape를 거쳐 나간다.
const REPO_URL = 'https://github.com/friedlemon2139-code/ChatArchive'

// 그림을 내려받도록 허용하는 호스트. **이 배열이 유일한 출처다** — CSP의 img-src·connect-src와
// 자기소개 칸의 "접근하는 주소"가 모두 여기서 나온다. 호스트를 늘리려면 여기만 고치고 다시 빌드한다.
//
//   facx.pages.dev  루나톡 대화 본문에 실려 오는 그림. 붙여넣기 도구가 실제로 받는 곳이다(픽스처 실측).
//   qvra.pages.dev  젠잇 어댑터의 GEAS_IMAGE_MIRROR. 북마클릿은 젠잇 페이지 위에서 돌아 이 CSP의
//                   지배를 받지 않지만, 같은 프로젝트의 그림 출처라 함께 밝혀 둔다.
const IMAGE_HOSTS = ['https://qvra.pages.dev', 'https://vqrn.pages.dev']

const READABLE_BANNER = '// 대화 저장 도구 — 빌드 산출물. 원본: src/'

const COMMON = {
  bundle: true,
  minify: true,
  target: 'es2020',
  format: 'iife',
  charset: 'utf8', // 한글 문자열을 \uXXXX로 escape하지 않아 읽기 쉽고 짧다
  legalComments: 'none',
  write: false
}

/**
 * 압축하지 않은 두 번째 빌드(README §15).
 * `keepNames`로 함수·클래스 이름을 남겨 읽는 사람이 src와 대조할 수 있게 한다.
 */
const COMMON_READABLE = {
  ...COMMON,
  minify: false,
  keepNames: true,
  banner: { js: READABLE_BANNER }
}

/**
 * 압축본은 압축한 뷰어를, 읽을 수 있는 본은 읽을 수 있는 뷰어를 품게 한다.
 * src의 import 경로(`../generated/viewer.txt`)는 그대로 두고 해석 단계에서만 바꿔치기한다 —
 * 그래야 한 소스에서 두 산출물이 나온다.
 */
const readableViewerText = {
  name: 'readable-viewer-text',
  setup (build) {
    build.onResolve({ filter: /generated\/viewer(\.css)?\.txt$/ }, (args) => ({
      path: resolve(args.resolveDir, args.path.replace(/\.txt$/, '.readable.txt'))
    }))
  }
}

const sizes = []

function record (label, text) {
  sizes.push({
    label,
    bytes: Buffer.byteLength(text, 'utf8'),
    sha256: createHash('sha256').update(text, 'utf8').digest('hex')
  })
}

/** 산출물 하나를 쓰고 크기·해시를 기록한다. */
async function emit (path, label, text) {
  await writeFile(path, text, 'utf8')
  record(label, text)
}

async function exists (path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/** esbuild 결과에서 첫 출력 파일의 텍스트를 꺼낸다. */
async function buildText (options) {
  const result = await esbuild.build(options)
  const file = result.outputFiles && result.outputFiles[0]
  if (!file) throw new Error('esbuild 출력이 비었습니다: ' + JSON.stringify(options.entryPoints))
  return file.text
}

/** README §11-3의 북마클릿 escape. */
function toBookmarklet (code) {
  return 'javascript:' + code
    .trim()
    .replace(/%/g, '%25')
    .replace(/#/g, '%23')
    .replace(/\r?\n/g, '%0A')
}

function escapeHtmlAttr (value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
}

/** textarea 안에 그대로 넣을 텍스트. `</textarea` 같은 조각이 태그로 읽히지 않게 한다. */
function escapeHtmlText (value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * 인라인 `<script>` 본문이 문서를 조기 종료시키지 못하게 한다(viewer-template.js와 같은 규칙).
 *
 * - `</script` → `<\/script` : JS 소스에서 `</script`는 문자열·정규식 리터럴 안에만 나올 수 있고
 *   거기서 `<\/script`는 동치다.
 * - `<!--` → `<\!--` : HTML 토크나이저를 script-data-escaped 상태로 넣지 않는다.
 *   JS 문자열에서 `\!`는 `!`로 읽히므로 값이 바뀌지 않는다(루나 파서의 `<!--StartFragment-->` 대비).
 */
function guardScriptBody (js) {
  return String(js == null ? '' : js)
    .replace(/<\/(script)/gi, (_m, tag) => '<\\/' + tag)
    .replace(/<!--/g, '<\\!--')
}

// ── 0. 신뢰 표면: CSP + 자기소개 칸 ──────────────────────────────────────
//
// 둘 다 IMAGE_HOSTS 하나에서 나온다. "이 도구가 어디에 접속하는가"를 사람이 읽는 문장과
// 브라우저가 강제하는 규칙이 어긋날 수 없게 하려는 것이다(README §15).

/**
 * 붙여넣기 도구용 CSP.
 * @param {{ externalScript?: boolean }} opts
 *   externalScript: `<script src="paste-page-{플랫폼}.js">`를 쓰는 사이트판인가.
 *   `'unsafe-inline'`만으로는 **외부 스크립트가 막힌다** — 사이트판에는 `'self'`가 함께 필요하다.
 *   한 장짜리 파일은 전부 인라인이라 `'unsafe-inline'`만 준다(file:에는 `'self'`가 의미도 없다).
 */
function toolCsp ({ externalScript = false } = {}) {
  const hosts = IMAGE_HOSTS.join(' ')
  return [
    "default-src 'none'",
    'script-src ' + (externalScript ? "'self' 'unsafe-inline'" : "'unsafe-inline'"),
    "style-src 'unsafe-inline'",
    // data: 는 완성된 파일 안의 그림, blob: 는 내장 과정의 디코드 폴백(images.js decodeBlob).
    'img-src data: blob: ' + hosts,
    'connect-src ' + hosts,
    "form-action 'none'",
    "base-uri 'none'",
    // meta로 준 frame-ancestors는 브라우저가 무시한다(헤더 전용). 의도를 남기는 뜻으로 적어 둔다.
    "frame-ancestors 'none'"
  ].join('; ')
}

// 완성된 기록 파일(뷰어)의 CSP는 src/viewer-template.js가 스스로 갖는다 — 그 모듈은 빌드에
// 기대지 않는 순수 함수여야 하기 때문이다(README §7).

function cspMeta (content) {
  return '<meta http-equiv="Content-Security-Policy" content="' + escapeHtmlAttr(content) + '">'
}

/**
 * `이 파일이 하는 일` 칸. 사람이 읽는 문장 쪽 절반이다.
 * @param {{ standalone: boolean, platform: string }} opts
 *   standalone: 한 장짜리 파일인가(아니면 사이트 페이지)
 *   platform: 어느 붙여넣기 페이지인가(`luna` · `genit`). 내려받기 링크 이름이 여기서 나온다.
 */
function selfDescription ({ standalone, platform }) {
  const toolFile = platform + '-tool.html'
  const hosts = IMAGE_HOSTS.map((h) => '<code>' + escapeHtmlText(h) + '</code>').join(' · ')
  const what = standalone
    ? '이 파일은 브라우저에서 여는 도구입니다.'
    : '이 페이지는 브라우저 안에서만 도는 도구입니다.'
  const howToRead = standalone
    ? '이 파일을 메모장으로 여시면 코드 전체를 읽으실 수 있습니다.'
    : '이 페이지에서 <kbd>Ctrl</kbd> + <kbd>U</kbd>(소스 보기)를 누르시면 코드 전체를 읽으실 수 있습니다.'
  const download = standalone
    ? ''
    : '\n  <p><b>파일로 내려받아 쓰기:</b> <a href="' + escapeHtmlAttr(toolFile) + '" download>' + escapeHtmlText(toolFile) + '</a>' +
      ' — 코드까지 한 장에 담긴 파일입니다. 내려받아 인터넷 없이 사용하실 수 있습니다.</p>'

  return `<div class="selfdesc-wrap">
<details class="selfdesc" open>
  <summary>이 파일이 하는 일</summary>
  <p>${what} 붙여 넣은 내용을 이 브라우저 안에서 정리해 HTML 파일로 저장합니다.</p>
  <p>붙여 넣은 내용을 어디로도 보내지 않으며, 일체의 데이터를 수집하지 않습니다.</p>
  <p><b>접근하는 주소:</b> 이미지를 내려받을 때만 ${hosts}. 그 외 주소로는 브라우저가 요청을 막도록 파일 안에 설정(Content-Security-Policy)되어 있습니다.</p>
  <p><b>확인 방법:</b> ${howToRead} 브라우저에서 <kbd>F12</kbd> → 네트워크 탭을 열면 실제 요청을 볼 수 있습니다.</p>
  <p><b>원본 코드:</b> <a href="${escapeHtmlAttr(REPO_URL)}">${escapeHtmlText(REPO_URL)}</a></p>
  <p><b>해시:</b> 배포 공지 참조</p>${download}
</details>
</div>`
}

/** `<!-- NAME:START -->`와 `<!-- NAME:END -->` 사이를 갈아 끼운다. 못 찾으면 던진다. */
function replaceMarker (html, name, body) {
  const open = '<!-- ' + name + ':START -->'
  const close = '<!-- ' + name + ':END -->'
  const from = html.indexOf(open)
  const to = from < 0 ? -1 : html.indexOf(close, from + open.length)
  if (from < 0 || to < 0) throw new Error(name + ' 마커를 찾지 못했습니다.')
  return html.slice(0, from) + open + '\n' + body + '\n' + html.slice(to)
}

// ── 1. 뷰어 번들 → generated/*.txt ────────────────────────────────────────

async function buildViewer () {
  const jsEntry = join(SRC, 'viewer', 'viewer.js')
  const cssEntry = join(SRC, 'viewer', 'viewer.css')
  for (const entry of [jsEntry, cssEntry]) {
    if (!await exists(entry)) {
      throw new Error('뷰어 소스가 없습니다: ' + entry)
    }
  }

  const cssOptions = {
    entryPoints: [cssEntry],
    bundle: true,
    minify: true,
    charset: 'utf8',
    legalComments: 'none',
    write: false,
    outfile: join(GENERATED, 'viewer.css')
  }

  const js = await buildText({ ...COMMON, entryPoints: [jsEntry], outfile: join(GENERATED, 'viewer.js') })
  const css = await buildText(cssOptions)

  // 압축하지 않은 짝. 한 장짜리 도구가 만드는 기록 파일은 이쪽을 품는다 —
  // 도구가 읽을 수 있으면 그 도구가 뱉은 파일도 읽을 수 있어야 말이 맞는다(README §15).
  const jsReadable = await buildText({
    ...COMMON_READABLE,
    entryPoints: [jsEntry],
    outfile: join(GENERATED, 'viewer.readable.js')
  })
  const cssReadable = await buildText({
    ...cssOptions,
    minify: false,
    banner: { css: '/* 대화 저장 도구 — 빌드 산출물. 원본: src/ */' },
    outfile: join(GENERATED, 'viewer.css.readable.css')
  })

  await writeFile(join(GENERATED, 'viewer.js'), js, 'utf8')
  await writeFile(join(GENERATED, 'viewer.css'), css, 'utf8')
  // 북마클릿 번들이 `.txt=text` 로더로 읽어 갈 사본.
  await writeFile(join(GENERATED, 'viewer.txt'), js, 'utf8')
  await writeFile(join(GENERATED, 'viewer.css.txt'), css, 'utf8')
  await writeFile(join(GENERATED, 'viewer.readable.txt'), jsReadable, 'utf8')
  await writeFile(join(GENERATED, 'viewer.css.readable.txt'), cssReadable, 'utf8')

  record('generated/viewer.txt', js)
  record('generated/viewer.css.txt', css)
  await emit(join(READABLE, 'viewer.js'), 'dist/readable/viewer.js', jsReadable)
  await emit(join(READABLE, 'viewer.css'), 'dist/readable/viewer.css', cssReadable)
}

// ── 2~4. 북마클릿 본체 ────────────────────────────────────────────────────
//
// 갈래가 둘이다(README §10). 엔트리만 다르고 굽는 방식은 같다.
//
//   geas-export         API 버전 — 젠잇 대화 읽기 API로 대화 전체를 가져온다
//   geas-export-screen  화면 읽기 버전 — 젠잇 서버에 요청하지 않고 화면만 읽는다

const BOOKMARKLET_VARIANTS = [
  { name: 'geas-export', entry: 'bookmarklet.js', label: 'API' },
  { name: 'geas-export-screen', entry: 'bookmarklet-screen.js', label: '화면 읽기' }
]

/** 북마클릿 한 갈래를 굽는다. → `javascript:` 문자열 */
async function buildBookmarklet ({ name, entry }) {
  const code = await buildText({
    ...COMMON,
    entryPoints: [join(SRC, entry)],
    outfile: join(DIST, name + '.js'),
    loader: { '.txt': 'text' }
  })
  await writeFile(join(DIST, name + '.js'), code, 'utf8')
  record('dist/' + name + '.js', code)

  const inline = toBookmarklet(code)
  await writeFile(join(DIST, name + '.bookmarklet.txt'), inline, 'utf8')
  record('dist/' + name + '.bookmarklet.txt', inline)

  const readable = await buildText({
    ...COMMON_READABLE,
    entryPoints: [join(SRC, entry)],
    outfile: join(READABLE, name + '.js'),
    loader: { '.txt': 'text' },
    plugins: [readableViewerText]
  })
  await emit(join(READABLE, name + '.js'), 'dist/readable/' + name + '.js', readable)

  return inline
}

// ── 5. 붙여넣기 저장 페이지 스크립트: 플랫폼마다 하나 ─────────────────────
//
// site/export/luna.html 이 <script src="paste-page-luna.js"> 로, 젠잇 붙여넣기 페이지가
// <script src="paste-page-genit.js"> 로 불러간다. 흐름은 `src/paste-page-core.js` 하나이고
// 엔트리는 **어느 파서를 싣는가**만 정한다(§5.1·§5.2).
//
// 플랫폼마다 번들을 가르는 이유는 공개 저장소다. 저장소는 플랫폼 하나씩만 담고 나가므로,
// 한 번들이 두 파서를 품으면 그 저장소에서 나온 산출물이 여기서 나온 것과 달라진다(§15).
//
// 북마클릿과 같은 뷰어 번들을 텍스트로 품는다(.txt 로더).

const PASTE_ENTRIES = [
  { id: 'luna', entry: 'paste-page-luna.js', out: 'paste-page-luna.js', label: '루나톡' },
  { id: 'genit', entry: 'paste-page-genit.js', out: 'paste-page-genit.js', label: '젠잇' }
]

/**
 * 있는 붙여넣기 엔트리를 모두 굽는다.
 * @returns {Promise<Record<string, string>>} 플랫폼 id → 압축하지 않은 번들(한 장짜리에 박을 코드)
 */
async function buildPastePages () {
  const readableByPlatform = {}
  for (const { id, entry, out, label } of PASTE_ENTRIES) {
    const entryPath = join(SRC, entry)
    if (!await exists(entryPath)) {
      console.log('  ' + label + ' 붙여넣기 엔트리 없음(src/' + entry + ') — 건너뜀')
      continue
    }

    const code = await buildText({
      ...COMMON,
      entryPoints: [entryPath],
      outfile: join(DIST, out),
      loader: { '.txt': 'text' }
    })
    await writeFile(join(DIST, out), code, 'utf8')
    record('dist/' + out, code)

    // 한 장짜리 도구(§5.2)에 그대로 박히는 본. 압축하지 않고 뷰어도 읽을 수 있는 쪽을 품는다.
    const readable = await buildText({
      ...COMMON_READABLE,
      entryPoints: [entryPath],
      outfile: join(READABLE, out),
      loader: { '.txt': 'text' },
      plugins: [readableViewerText]
    })
    await emit(join(READABLE, out), 'dist/readable/' + out, readable)

    readableByPlatform[id] = readable
  }
  return readableByPlatform
}

// ── 5.2. 붙여넣기 도구: 플랫폼마다 두 장 ──────────────────────────────────
//
// site/export/{플랫폼}.html 이 원본이다(소스 관리). 빌드는 그 안의 세 칸만 갈아 끼운다 —
// CSP, 자기소개, 스크립트. 한 원본에서 두 장이 나온다.
//
//   site/export/{플랫폼}.html   외부 스크립트를 불러 쓰는 사이트판(CSP에 'self'가 필요하다)
//   dist/{플랫폼}-tool.html     코드를 그대로 품은 한 장짜리 파일. file:로 열려야 하므로 전부 인라인이다.
//
// 한 장짜리에 박는 코드는 **압축하지 않은 쪽**이다. 메모장으로 열어 읽을 수 있어야
// "확인 방법: 메모장으로 열면 코드 전체를 읽을 수 있습니다"가 참이 된다.
//
// 플랫폼마다 자기 번들(`dist/readable/paste-page-{플랫폼}.js`)을 품는다. 그 번들이 없으면
// 그 플랫폼은 통째로 건너뛴다 — 공개 저장소에는 자기 플랫폼 엔트리 하나만 있기 때문이다.

/**
 * 붙여넣기 저장 페이지가 있는 플랫폼. 페이지가 없으면 건너뛴다.
 *
 * 젠잇 붙여넣기 페이지는 **발행하지 않는다**(`PUBLISH_GENIT_PASTE`). 완성돼 있지만 젠잇에는
 * 화면 읽기 북마클릿을 내보내기로 했다. 원본은 사이트 폴더 밖(`unpublished/`)에 두고, 발행
 * 스위치를 켰을 때만 굽는다. 이때 사이트판 이름은 `genit-paste.html`이다 — `genit.html`은
 * 화면 읽기 안내 페이지가 쓰고 있다.
 */
const PASTE_PLATFORMS = [
  { id: 'luna', dir: () => SITE_EXPORT, siteName: 'luna.html', publish: () => true },
  { id: 'genit', dir: () => UNPUBLISHED, siteName: 'genit-paste.html', publish: () => PUBLISH_GENIT_PASTE }
]

async function buildToolPages (readableByPlatform) {
  for (const platform of PASTE_PLATFORMS) {
    if (!platform.publish()) {
      console.log('  ' + platform.id + ' 붙여넣기 페이지: 발행 스위치 꺼짐 — 건너뜀')
      continue
    }
    const platformId = platform.id
    const readablePasteCode = readableByPlatform[platformId]
    if (!readablePasteCode) {
      console.log('  ' + platformId + ' 붙여넣기 번들이 없어 도구 빌드를 건너뜁니다.')
      continue
    }
    const sourcePath = join(platform.dir(), platformId + '.html')
    if (!await exists(sourcePath)) {
      console.warn('  ! ' + sourcePath + ' 이 없어 붙여넣기 도구 빌드를 건너뜁니다.')
      continue
    }
    const source = await readFile(sourcePath, 'utf8')

    // 1) 사이트판 — 스크립트 칸은 원본 그대로 둔다.
    let site = replaceMarker(source, 'CSP', cspMeta(toolCsp({ externalScript: true })))
    site = replaceMarker(site, 'SELFDESC', selfDescription({ standalone: false, platform: platformId }))
    await writeFile(join(SITE_EXPORT, platform.siteName), site, 'utf8')
    record(SITE_LABEL + '/' + platform.siteName, site)

    // 2) 한 장짜리 — 같은 원본에서 CSP·자기소개·스크립트 셋 다 갈아 끼운다.
    let tool = replaceMarker(source, 'CSP', cspMeta(toolCsp({ externalScript: false })))
    tool = replaceMarker(tool, 'SELFDESC', selfDescription({ standalone: true, platform: platformId }))
    tool = replaceMarker(tool, 'SCRIPT', '<script>\n' + guardScriptBody(readablePasteCode) + '\n</script>')
    await emit(join(DIST, platformId + '-tool.html'), 'dist/' + platformId + '-tool.html', tool)

    console.log('  ' + SITE_LABEL + '/' + platform.siteName + ' 갱신: CSP · 자기소개')
  }
}

// ── 6. 프로브 ─────────────────────────────────────────────────────────────

async function buildProbe () {
  const code = await buildText({
    ...COMMON,
    entryPoints: [join(SRC, 'probe.js')],
    outfile: join(DIST, 'probe.js')
  })
  await writeFile(join(DIST, 'probe.js'), code, 'utf8')
  record('dist/probe.js', code)

  const bookmarklet = toBookmarklet(code)
  await writeFile(join(DIST, 'probe.bookmarklet.txt'), bookmarklet, 'utf8')
  record('dist/probe.bookmarklet.txt', bookmarklet)
}

// ── 7. 사이트로 복사 + 안내 페이지 링크 치환 ──────────────────────────────

// 젠잇 북마클릿 발행 스위치. 켜져 있으면 북마클릿 **두 갈래**를 굽고 안내 페이지 두 장에 박는다.
// 끄려면 `PUBLISH_GENIT=0 node build.mjs`.
const PUBLISH_GENIT = process.env.PUBLISH_GENIT !== '0'

// 젠잇 붙여넣기 페이지 발행 스위치. **기본 꺼짐** — 젠잇에는 화면 읽기 북마클릿을 내보낸다.
// 켜려면 `PUBLISH_GENIT_PASTE=1 node build.mjs`. 루나톡 붙여넣기 페이지는 이 스위치와 무관하다.
const PUBLISH_GENIT_PASTE = process.env.PUBLISH_GENIT_PASTE === '1'

/**
 * 사이트로 복사하지 않을 산출물.
 * - `probe.*`        개발용 조사 스크립트
 * - `geas-export*`   젠잇 북마클릿(발행 스위치가 꺼져 있을 때)
 * - `genit-tool.html` · `paste-page-genit.js` 젠잇 붙여넣기 산출물(발행 스위치가 꺼져 있을 때).
 *   지난 빌드가 남긴 파일이 딸려 나가지 않도록, 굽지 않을 때도 이름으로 막는다.
 */
function siteSkip (name) {
  if (/^probe\./.test(name)) return true
  if (!PUBLISH_GENIT && /^geas-export/.test(name)) return true
  if (!PUBLISH_GENIT_PASTE && (name === 'genit-tool.html' || name === 'paste-page-genit.js')) return true
  return false
}

async function copyToSite (bookmarklets) {
  await mkdir(SITE_EXPORT, { recursive: true })
  // dist/readable/ 은 검증용이라 사이트에 올리지 않는다. 디렉터리 이름이 섞이지 않게 걸러 낸다.
  const files = (await readdir(DIST, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
  const copied = []
  for (const name of files) {
    if (!/\.js$/.test(name) && !/\.bookmarklet\.txt$/.test(name) && !/-tool\.html$/.test(name)) continue
    if (siteSkip(name)) continue
    await copyFile(join(DIST, name), join(SITE_EXPORT, name))
    copied.push(name)
  }
  console.log('  ' + SITE_LABEL + '/ 로 복사: ' + copied.join(', '))

  if (!bookmarklets) return

  // 안내 페이지는 갈래마다 한 장이다. 마커 이름은 두 장이 같고, **어느 파일이냐**가 어느
  // 북마클릿을 싣는지를 정한다(README §11-7).
  //   genit.html      화면 읽기 버전 — 북마크 이름 `젠잇 대화 저장`
  //   genit-api.html  API 버전       — 북마크 이름 `젠잇 대화 저장 (API)`
  // (index.html은 중립 안내, luna.html은 붙여넣기 방식이라 북마클릿이 없다.)
  await injectBookmarklet('genit.html', bookmarklets.screen, '젠잇 대화 저장', '화면 읽기')
  await injectBookmarklet('genit-api.html', bookmarklets.api, '젠잇 대화 저장 (API)', 'API')
}

/**
 * 안내 페이지 한 장의 북마클릿 두 자리를 갈아 끼운다.
 * @param {string} fileName site/export 안의 파일 이름
 * @param {string} href `javascript:` 문자열
 * @param {string} bookmarkName 앵커 텍스트 = 유저가 북마크바에서 보게 될 이름
 * @param {string} variant 로그에 찍을 갈래 이름
 */
async function injectBookmarklet (fileName, href, bookmarkName, variant) {
  if (!href) return
  const guidePath = join(SITE_EXPORT, fileName)
  if (!await exists(guidePath)) {
    console.warn('  ! ' + SITE_LABEL + '/' + fileName + ' 이 없어 북마클릿 치환을 건너뜁니다.')
    return
  }
  const html = await readFile(guidePath, 'utf8')

  // 1) 드래그용 앵커. 앵커의 텍스트가 그대로 북마크 이름이 되므로 손잡이 점(⠿)은
  //    빈 span에 CSS로 그린다 — 이름에 섞이지 않게 하려는 것이다.
  const anchorMarker = /(<!-- BOOKMARKLET:START -->)[\s\S]*?(<!-- BOOKMARKLET:END -->)/
  // 2) 드래그가 안 될 때 손으로 붙여 넣는 코드 칸.
  const codeMarker = /(<!-- BOOKMARKLET-CODE:START -->)[\s\S]*?(<!-- BOOKMARKLET-CODE:END -->)/

  const done = []
  let next = html

  if (anchorMarker.test(next)) {
    const anchor = '<a class="bookmarklet" href="' + escapeHtmlAttr(href) +
      '" onclick="return false"><span class="grip" aria-hidden="true"></span>' + escapeHtmlText(bookmarkName) + '</a>'
    next = next.replace(anchorMarker, (_m, start, end) => start + '\n' + anchor + '\n' + end)
    done.push('앵커')
  } else {
    console.warn('  ! ' + fileName + ': BOOKMARKLET 마커를 찾지 못해 앵커 치환을 건너뜁니다.')
  }

  if (codeMarker.test(next)) {
    const textarea = '<textarea readonly id="bm-code" spellcheck="false" aria-label="북마크 URL 칸에 넣을 내용">' +
      escapeHtmlText(href) + '</textarea>'
    next = next.replace(codeMarker, (_m, start, end) => start + '\n' + textarea + '\n' + end)
    done.push('코드')
  } else {
    console.warn('  ! ' + fileName + ': BOOKMARKLET-CODE 마커를 찾지 못해 코드 칸 치환을 건너뜁니다.')
  }

  if (!done.length) return
  await writeFile(guidePath, next, 'utf8')
  console.log('  ' + SITE_LABEL + '/' + fileName + ' 갱신(' + variant + '): ' + done.join(' · '))
}

// ── 실행 ──────────────────────────────────────────────────────────────────

async function main () {
  const onlyArg = process.argv.find((a) => a.startsWith('--only='))
  const only = onlyArg ? onlyArg.slice('--only='.length) : null

  await mkdir(GENERATED, { recursive: true })
  await mkdir(DIST, { recursive: true })
  await mkdir(READABLE, { recursive: true })

  let bookmarklets = null
  if (only === 'probe') {
    console.log('프로브만 빌드합니다.')
    await buildProbe()
  } else {
    console.log('뷰어 번들...')
    await buildViewer()
    if (PUBLISH_GENIT) {
      bookmarklets = { api: null, screen: null }
      for (const variant of BOOKMARKLET_VARIANTS) {
        if (!await exists(join(SRC, variant.entry))) {
          console.warn('  ! src/' + variant.entry + ' 이 없어 ' + variant.label + ' 북마클릿을 건너뜁니다.')
          continue
        }
        console.log('북마클릿 번들 (' + variant.label + ')...')
        const href = await buildBookmarklet(variant)
        if (variant.name === 'geas-export') bookmarklets.api = href
        else bookmarklets.screen = href
      }
    } else {
      console.log('젠잇 북마클릿: 발행 스위치 꺼짐 — 건너뜀')
    }
    console.log('붙여넣기 페이지 번들...')
    const readableByPlatform = await buildPastePages()
    console.log('붙여넣기 도구...')
    await buildToolPages(readableByPlatform)
    if (await exists(join(SRC, 'probe.js'))) {
      console.log('프로브 번들...')
      await buildProbe()
    }
  }

  await copyToSite(bookmarklets)

  console.log('\n산출물 크기')
  const width = Math.max(...sizes.map((s) => s.label.length))
  for (const { label, bytes } of sizes) {
    const kb = (bytes / 1024).toFixed(1)
    console.log('  ' + label.padEnd(width) + '  ' + String(bytes).padStart(8) + ' B  (' + kb + ' KB)')
  }

  // 재현 가능한 빌드(README §15). 같은 소스 · 같은 esbuild면 두 번 돌려도 같은 값이 나온다.
  // 빌드 안에 시각·난수를 넣지 않는 한 이 값들은 제삼자의 손에서도 재현된다.
  console.log('\nSHA-256')
  for (const { label, sha256 } of sizes) {
    console.log('  ' + label.padEnd(width) + '  ' + sha256)
  }
}

main().catch((err) => {
  console.error('\n빌드 실패:', err.message)
  process.exitCode = 1
})
