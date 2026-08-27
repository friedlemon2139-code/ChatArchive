// viewer-template.js — GeasExport → 완성 HTML 문자열 (README §7)
// 순수 함수. 외부 의존 0. 브라우저/Node 양쪽에서 import 가능해야 한다.

const PLATFORM_LABELS = { genit: '젠잇', luna: '루나톡' }

/**
 * 완성된 기록 파일이 스스로에게 거는 제한(README §15).
 *
 * 이 파일은 대화·그림·원본 JSON을 이미 다 품고 있어 바깥에서 가져올 것이 없다. 그래서
 * `default-src 'none'`으로 전부 막고 필요한 것만 연다 —
 * 인라인 `<style>`·`<script>`(번들이 문서 안에 박혀 있다), `data:` 그림(내장된 그림),
 * `blob:`(Markdown·JSON 저장이 만드는 URL). `connect-src`는 열지 않는다. 이 파일은
 * 어디에도 접속하지 않으며, 그 사실을 브라우저가 강제한다.
 *
 * `frame-ancestors`는 meta로 주면 브라우저가 무시하므로 넣지 않는다(헤더 전용).
 */
export const ARCHIVE_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  'img-src data: blob:',
  "form-action 'none'",
  "base-uri 'none'"
].join('; ')

/** HTML 텍스트/속성 이스케이프. */
export function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * `<script type="application/json">` 안에 안전하게 넣을 수 있는 JSON 문자열.
 *
 * - `</script` → `<\/script` : JSON에서 `\/`는 `/`로 파싱된다. 태그 대소문자는 보존.
 * - `<!--`     → `<!--` : JSON에서 `<`는 `<`로 파싱된다.
 *
 * 둘 다 JSON.parse 왕복이 보장된다.
 *
 * ※ README §7은 `<!--` → `<\!--`로 적었으나 `\!`는 JSON에 없는 이스케이프라 JSON.parse가
 *   실패한다(뷰어가 빈 화면이 된다). 같은 목적 — HTML 토크나이저를 script-data-escaped
 *   상태로 넣지 않는 것 — 을 유효한 JSON으로 달성한다.
 */
export function embedJson(value) {
  return JSON.stringify(value)
    .replace(/<\/(script)/gi, (_m, tag) => '<\\/' + tag)
    .replace(/<!--/g, '\\u003c!--')
}

/**
 * 인라인 `<script>` 본문이 문서를 조기 종료시키지 못하게 한다.
 * JS 소스에서 `</script`는 문자열/정규식 리터럴 안에만 나올 수 있고, 거기서 `<\/script`는 동치다.
 */
function guardScriptBody(js) {
  return String(js == null ? '' : js).replace(/<\/(script)/gi, (_m, tag) => '<\\/' + tag)
}

/**
 * 인라인 `<style>` 본문이 문서를 조기 종료시키지 못하게 한다.
 * CSS 문자열/식별자 안에서 `\/`는 `/`로 해석된다. 실제로 등장할 일은 없지만 방어용.
 */
function guardStyleBody(css) {
  return String(css == null ? '' : css).replace(/<\/(style)/gi, (_m, tag) => '<\\/' + tag)
}

const SKELETON = `<div class="wrap">
  <header class="head" id="head"></header>

  <nav class="toolbar" id="toolbar" aria-label="내보내기 도구">
    <button type="button" id="btn-md">Markdown 저장</button>
    <button type="button" id="btn-json">원본 JSON 저장</button>
    <span class="jump">
      <a href="#foot" id="jump-bottom">맨 아래로</a>
      <span aria-hidden="true">/</span>
      <a href="#head" id="jump-top">맨 위로</a>
    </span>
  </nav>

  <p class="notice" id="notice" hidden>
    <span class="notice-text">이 파일에는 대화 본문, 이미지, 원본 데이터가 함께 들어 있습니다. 위 버튼으로 다른 형식으로 저장할 수 있습니다.</span>
    <button type="button" id="notice-close">닫기</button>
  </p>

  <p class="error" id="error" hidden></p>

  <section class="meta" id="meta"></section>

  <main class="turns" id="turns"></main>

  <footer class="foot" id="foot"></footer>
</div>

<div class="toast" id="toast" role="status" aria-live="polite" hidden></div>

<noscript>
  <p class="error">이 기록은 JavaScript로 그려집니다. 브라우저의 JavaScript를 켠 뒤 파일을 다시 열어 주세요. 원본 데이터는 이 파일 안의 <code>#geas-export</code> JSON에 그대로 들어 있습니다.</p>
</noscript>`

/**
 * @param {object} exp GeasExport
 * @param {{ viewerJs?: string, viewerCss?: string }} bundles 번들된 뷰어 스크립트·스타일
 * @returns {string} 완성 HTML 문서
 */
export function renderHtmlDocument(exp, { viewerJs = '', viewerCss = '' } = {}) {
  const source = (exp && exp.source) || {}
  const rawTitle = source.title || source.chatId || 'Geas 채팅'
  const platform = PLATFORM_LABELS[source.platform] || source.platform || ''
  const docTitle = platform ? rawTitle + ' · ' + platform + ' 채팅 기록' : rawTitle + ' · 채팅 기록'

  return `<!doctype html>
<html lang="ko">
<head>
<meta http-equiv="Content-Security-Policy" content="${escapeHtml(ARCHIVE_CSP)}">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<meta name="generator" content="대화 저장">
<title>${escapeHtml(docTitle)}</title>
<style>${guardStyleBody(viewerCss)}</style>
</head>
<body>
${SKELETON}
<script type="application/json" id="geas-export">${embedJson(exp)}</script>
<script>${guardScriptBody(viewerJs)}</script>
</body>
</html>
`
}

export default renderHtmlDocument
