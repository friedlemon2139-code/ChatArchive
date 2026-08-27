// 루나톡 붙여넣기 파서 (README §5.1)
//
// 루나톡은 API 사용을 허락하지 않는다. 그래서 루나톡 저장은 북마클릿이 아니라
// **화면에서 복사한 것**을 받아 처리한다. 붙여넣기에는 클립보드 두 형식이 함께 오고,
// 이 모듈은 좋은 쪽부터 세 갈래로 나눠 읽는다(`parseLunaClipboard`가 고른다):
//
//   html      페이지 전체 복사본(`text/html`에 `#messageList li.cWrap`)      — 정확
//   fragment  메시지 하나만 복사된 조각(`span.narration` 등)                 — 부분
//   text      평문(`text/plain`)만 있을 때                                   — 근사
//
// 아래 절반이 평문 파서(`parseLunaPaste`), 아래쪽이 클립보드 HTML 파서다.
// 평문 복사에는 그림도, 굵게·기울임 같은 서식도, 작성 시각도 남지 않는다.
// 어느 모드에서도 없는 값은 만들어 넣지 않는다 — 작성 시각은 복사본에 아예 없으므로
// `createdAt`은 항상 null이고, 평문 모드의 `imageUrls`는 항상 빈 배열이다.
//
// 순수 함수. DOM·네트워크·전역 상태를 건드리지 않는다. 어떤 입력에도 예외를 던지지 않는다.

/** 대화 앞에 붙는 안내 문구 두 줄. 여기까지를 머리말로 보고 버린다. */
const DISCLAIMER_HEAD = '이 캐릭터는 유저가 기입한 정보를 토대로 제작된 AI 챗봇 입니다.'
const DISCLAIMER_TAIL = '동명의 실존인물 혹은 단체와는 관계가 없습니다.'

/** 대화 뒤에 붙는 입력창 안내. 이 줄부터 끝까지 버린다. */
const FOOTER_MARK = '\u{1F6A8}' // 🚨
const FOOTER_MARK_ALT = '*지문*'

/** 꼬리에 남을 수 있는 잡줄. */
const DISCOUNT_PREFIX = '위키 적응기 할인'
const INPUT_PLACEHOLDER = '*손을 흔들며 밝게 인사한다* "안녕!"'

/** 상태창 제목으로 인정할 최대 길이(UTF-16 코드 유닛). */
const LABEL_MAX = 12

const USER_SPEAKER = '나'

export const WARN_NO_DISCLAIMER = '안내 문구를 찾지 못해 첫 줄을 이름으로 사용했습니다'
export const WARN_NO_TURNS = '대화를 찾지 못했습니다'

/** 줄 끝에 붙는 공백류(복사하면 자주 섞인다). 개행은 이미 분리한 뒤라 넣지 않는다. */
const TRAILING_BLANK = /[ \t\u00a0\u200b\u200c\u200d\ufeff]+$/

/**
 * CRLF 정규화 + 줄 끝 공백 제거.
 * @param {unknown} text
 * @returns {string[]}
 */
function splitLines (text) {
  return String(text == null ? '' : text)
    .replace(/^\ufeff/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(TRAILING_BLANK, ''))
}

/**
 * 안내 문구가 끝나는 지점(그 다음 줄의 인덱스). 없으면 -1.
 * 두 줄 중 어느 쪽이든 마지막으로 나온 자리를 기준으로 자른다.
 */
function findDisclaimerEnd (lines) {
  let end = -1
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()
    if (t === DISCLAIMER_HEAD || t === DISCLAIMER_TAIL) end = i + 1
  }
  return end
}

function firstNonEmpty (lines, from) {
  for (let i = Math.max(0, from); i < lines.length; i++) {
    if (lines[i].trim() !== '') return i
  }
  return -1
}

/**
 * 꼬리(입력창 안내 등)를 잘라 낸 끝 인덱스(exclusive).
 * `from` 이후에서만 찾는다 — 적어도 한 줄은 대화로 남긴다.
 */
function cutFooter (lines, from) {
  let end = lines.length
  for (let i = from; i < end; i++) {
    if (lines[i].trim() === FOOTER_MARK) { end = i; break }
  }
  if (end === lines.length) {
    for (let i = from; i < end; i++) {
      if (lines[i].trim() === FOOTER_MARK_ALT) { end = i; break }
    }
  }
  // 마커가 없어도 남을 수 있는 잡줄을 뒤에서부터 걷어낸다.
  while (end > from) {
    const t = lines[end - 1].trim()
    if (t === '' || t === INPUT_PLACEHOLDER || t.indexOf(DISCOUNT_PREFIX) === 0) { end--; continue }
    break
  }
  return end
}

/* ── 상태창 블록 ───────────────────────────────────────────────────────── */

function isRuleLine (t) {
  return /^━+$/.test(t) // ━━
}

/** 표 줄: `|`가 있거나 구분선(━━). */
function isBlockLine (t) {
  return t !== '' && (t.indexOf('|') !== -1 || isRuleLine(t))
}

/** 블록 제목 줄: 공백도 `|`도 없는 짧은 낱말(예: `상태창`). */
function isLabelLine (t) {
  return t !== '' && t.length <= LABEL_MAX && !/\s/.test(t) && t.indexOf('|') === -1 && !isRuleLine(t)
}

/**
 * `i`에서 상태창 블록이 시작하는지 보고, 시작하면 펜스 코드블록으로 다시 짠다.
 * 뷰어는 펜스의 언어명을 블록 제목으로 표시한다(viewer.js `attachCodeCopyButtons`).
 * @returns {{ text: string, next: number } | null}
 */
function readStatusBlock (lines, i, end, botName) {
  const label = lines[i].trim()
  if (!isLabelLine(label) || label === botName) return null
  if (i + 1 >= end) return null
  if (!isBlockLine(lines[i + 1].trim())) return null

  const rows = []
  let j = i + 1
  while (j < end) {
    const t = lines[j].trim()
    if (t === botName || !isBlockLine(t)) break
    rows.push(t)
    j++
  }
  return { text: '```' + label + '\n' + rows.join('\n') + '\n```', next: j }
}

/* ── 턴 ────────────────────────────────────────────────────────────────── */

/** 턴 안에서 빈 줄 3개 이상은 2개로, 앞뒤 공백은 제거. */
function tidy (text) {
  return text.replace(/\n{3,}/g, '\n\n').trim()
}

function makeTurn (role, speaker, buffer) {
  const text = tidy(buffer.join('\n'))
  if (text === '') return null
  return { role, speaker, text, createdAt: null, imageUrls: [] }
}

/**
 * 화면에서 복사한 루나톡 대화 평문을 어댑터 결과 모양으로 바꾼다.
 *
 * 규칙(README §5.1):
 * - 안내 문구 두 줄까지를 머리말로 버린다. 없으면 첫 줄을 이름으로 보고 거기서 시작한다(근사).
 * - 안내 문구 다음 첫 줄이 캐릭터 이름이다. 그 이름과 똑같은 줄이 나오면 AI 턴이 시작된다.
 * - AI 턴 안에서 상태창 블록이 한 번 시작되면, 블록에 속하지 않는 첫 줄에서 AI 턴이 끝나고
 *   유저 턴이 시작된다(평문 복사에는 둘 사이에 빈 줄이 없다).
 *   블록이 나오기 전이라면 AI 턴은 다음 이름 줄에서만 끝난다.
 *
 * @param {string} text 붙여 넣은 평문
 * @param {{ botName?: string }} [options] `botName`을 주면 자동 인식 대신 그 이름으로 턴을 나눈다
 * @returns {{ source: object, meta: object, turns: object[], botName: string, warnings: string[] }}
 */
export function parseLunaPaste (text, options = {}) {
  const warnings = []
  const lines = splitLines(text)
  const override = options && typeof options.botName === 'string' ? options.botName.trim() : ''

  const disclaimerEnd = findDisclaimerEnd(lines)
  const start = disclaimerEnd >= 0 ? disclaimerEnd : 0
  if (disclaimerEnd < 0 && firstNonEmpty(lines, 0) >= 0) warnings.push(WARN_NO_DISCLAIMER)

  const nameIdx = firstNonEmpty(lines, start)
  const detected = nameIdx >= 0 ? lines[nameIdx].trim() : ''
  const botName = override || detected

  const turns = []
  if (botName !== '') {
    const end = cutFooter(lines, nameIdx >= 0 ? nameIdx + 1 : start)
    let i = start

    while (i < end) {
      const head = lines[i].trim()
      if (head === '') { i++; continue }

      if (head === botName) {
        i++ // 이름 줄은 본문이 아니다
        const buffer = []
        while (i < end) {
          if (lines[i].trim() === botName) break
          const block = readStatusBlock(lines, i, end, botName)
          if (block) {
            buffer.push(block.text)
            i = block.next
            break // 상태창 블록이 끝나면 AI 턴도 끝난다
          }
          buffer.push(lines[i])
          i++
        }
        const turn = makeTurn('assistant', botName, buffer)
        if (turn) turns.push(turn)
      } else {
        const buffer = []
        while (i < end) {
          if (lines[i].trim() === botName) break
          buffer.push(lines[i])
          i++
        }
        const turn = makeTurn('user', USER_SPEAKER, buffer)
        if (turn) turns.push(turn)
      }
    }
  }

  if (turns.length === 0 && warnings.indexOf(WARN_NO_TURNS) === -1) warnings.push(WARN_NO_TURNS)

  return {
    source: {
      platform: 'luna',
      chatId: '',
      title: botName,
      botName,
      url: '',
      capture: 'paste',
      pasteKind: PASTE_KIND_TEXT
    },
    meta: { startSetting: null, persona: null },
    turns,
    botName,
    warnings,
    kind: PASTE_KIND_TEXT
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   클립보드 HTML 파서 (README §5.1)

   붙여넣기에는 클립보드 두 형식이 함께 온다 — `text/plain`(위 파서가 읽는 평문)과
   `text/html`. 루나톡 화면을 Ctrl+A 로 통째로 복사하면 `text/html` 쪽에 라이트 DOM이
   그대로 들어온다:

     <ul id="messageList">
       <li class="cWrap aichat first-greeting"> <span class="cName">이름</span>
         <div class="cbox" data-content="…원문 마크다운…">
       <li class="cWrap user" data-idx="…">
       <li class="cWrap aichat last-ai" data-idx="…">

   `data-content`가 **그 메시지의 원문 마크다운**이다(`*지문*`, `**굵게**`,
   `![](https://…webp)`, 상태창 펜스 블록). 화자·순서·서식·그림 주소가 전부 정확히 들어 있어
   평문 파서의 추정(이름 줄로 턴 나누기, 상태창 휴리스틱)이 필요 없다.

   유저가 메시지 **글자 위**를 클릭한 뒤 Ctrl+A 를 누르면 선택이 그 메시지 안에 갇혀
   `#messageList`가 없는 조각만 온다(`span.narration` / `span.dialogue` / `span.md-bold` /
   `<img>` / `<pre><code>`). 이때는 조각을 마크다운으로 되돌려 **AI 턴 하나**로 담고 경고한다.

   파싱은 DOMParser가 아니라 정규식으로 한다. 브라우저와 Node 테스트가 **같은 경로**를 타고,
   의존이 없고, 결과가 결정적이다.
   ══════════════════════════════════════════════════════════════════════════ */

export const WARN_SINGLE_MESSAGE =
  '메시지 하나만 복사된 것으로 보입니다. 페이지 전체를 선택(Ctrl+A)해 다시 복사하면 대화 전체가 저장됩니다.'

/** 붙여 넣은 것이 무엇이었나. `source.pasteKind`로 실려 뷰어 안내를 고른다. */
export const PASTE_KIND_HTML = 'html'
export const PASTE_KIND_FRAGMENT = 'fragment'
export const PASTE_KIND_TEXT = 'text'

/** 조각 모드에서 이름을 모를 때 쓰는 화자. 없는 이름을 지어내지 않는다. */
const UNKNOWN_SPEAKER = 'AI'

const NAMED_ENTITIES = {
  quot: '"',
  amp: '&',
  lt: '<',
  gt: '>',
  apos: "'",
  nbsp: ' '
}

/** HTML 엔티티 해제. 이름 있는 것 여섯 + 십진/십육진 숫자 참조. 한 번만 훑는다. */
function decodeEntities (value) {
  return String(value == null ? '' : value).replace(
    /&(#\d+|#[xX][0-9a-fA-F]+|[a-zA-Z]+);/g,
    (whole, body) => {
      if (body.charAt(0) === '#') {
        const hex = body.charAt(1) === 'x' || body.charAt(1) === 'X'
        const code = hex ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
        if (!isFinite(code) || code < 0 || code > 0x10ffff) return whole
        try { return String.fromCodePoint(code) } catch (err) { return whole }
      }
      const named = NAMED_ENTITIES[body.toLowerCase()]
      return named === undefined ? whole : named
    }
  )
}

/** 윈도 클립보드 "HTML Format" 머리말의 `SourceURL:` 한 줄. 없으면 ''. */
function sourceUrlOf (html) {
  const head = String(html == null ? '' : html).slice(0, 2000)
  const m = /^SourceURL:(.*)$/m.exec(head)
  if (!m) return ''
  const url = m[1].trim()
  return /^https?:\/\//i.test(url) ? url : ''
}

/** `https://lunatalk.chat/talk/1000000001` → `1000000001`. 못 읽으면 ''. */
function chatIdOf (url) {
  const m = /\/talk\/(\d+)/.exec(String(url == null ? '' : url))
  return m ? m[1] : ''
}

/** class 속성 값에 그 클래스가 토큰으로 들어 있는가. */
function hasClass (classAttr, name) {
  return String(classAttr == null ? '' : classAttr).split(/\s+/).indexOf(name) !== -1
}

/** 여는 태그의 속성 문자열에서 큰따옴표 속성 하나를 꺼낸다. */
function attrOf (attrs, name) {
  const re = new RegExp('\\b' + name + '="([^"]*)"', 'i')
  const m = re.exec(String(attrs == null ? '' : attrs))
  return m ? m[1] : ''
}

/** 클립보드 머리말을 떼고 문서 부분만. */
function stripClipboardHeader (html) {
  const s = String(html == null ? '' : html)
  const i = s.search(/<html[\s>]/i)
  return i >= 0 ? s.slice(i) : s
}

/** `<ul id="messageList">`의 안쪽. 없으면 ''. 중첩 `<ul>`을 세어 짝을 맞춘다. */
function messageListRegion (html) {
  const open = /<ul\b[^>]*\bid="messageList"[^>]*>/i.exec(html)
  if (!open) return ''
  const from = open.index + open[0].length
  const re = /<(\/?)ul\b/gi
  re.lastIndex = from
  let depth = 1
  let tag
  while ((tag = re.exec(html))) {
    depth += tag[1] ? -1 : 1
    if (depth === 0) return html.slice(from, tag.index)
  }
  return html.slice(from)
}

/** 클립보드 HTML이 페이지 전체 복사본인가(= `#messageList` 안에 `li.cWrap`이 있는가). */
export function looksLikeLunaPage (html) {
  const region = messageListRegion(stripClipboardHeader(html))
  return region !== '' && /<li\b[^>]*\bclass="[^"]*\bcWrap\b/i.test(region)
}

/** 클립보드 HTML이 메시지 조각인가(= 루나톡 메시지 마크업만 있는가). */
export function looksLikeLunaFragment (html) {
  const s = stripClipboardHeader(html)
  if (s === '') return false
  return /class="[^"]*\b(?:narration|dialogue|md-bold|cbox)\b/i.test(s)
}

/* ── 조각 → 마크다운 ──────────────────────────────────────────────────── */

/** `*`·`**`로 감쌀 때 안쪽 앞뒤 공백은 밖으로 뺀다(`* 글 *`은 기울임이 되지 않는다). */
function wrapInline (mark, inner) {
  if (mark === '') return inner
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner)
  if (!m || m[2] === '') return inner
  return m[1] + mark + m[2] + mark + m[3]
}

/** 여는 `<span>`의 class에 따라 붙일 마크다운 표식. 모르는 span은 ''(그대로 통과). */
function spanMark (classAttr) {
  if (hasClass(classAttr, 'narration')) return '*'
  if (hasClass(classAttr, 'md-bold')) return '**'
  return ''
}

/** `<pre><code>` 안의 글을 펜스 블록으로. 첫 줄이 블록 제목이면 펜스 언어명으로 올린다. */
function codeToFence (raw) {
  const lines = splitLines(raw)
  while (lines.length && lines[0].trim() === '') lines.shift()
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop()
  let label = ''
  let body = lines
  const first = lines.length ? lines[0].trim() : ''
  if (lines.length > 1 && isLabelLine(first)) {
    label = first
    body = lines.slice(1)
  }
  return '```' + label + '\n' + body.join('\n') + '\n```'
}

/**
 * 조각의 글 마디 하나. 엔티티를 풀고 NBSP를 보통 공백으로 되돌린다.
 * 화면 조각에는 줄바꿈을 막으려고 넣은 NBSP가 섞여 오는데, 원문 마크다운에는 보통 공백이다.
 */
function textNode (html) {
  return decodeEntities(html).replace(/ /g, ' ')
}

/** 태그를 모두 걷어내고 글만. `<pre>` 안쪽처럼 서식이 없는 곳에 쓴다. */
function textOnly (html) {
  return textNode(String(html == null ? '' : html).replace(/<[^>]*>/g, ''))
}

/**
 * 루나톡 메시지 마크업 조각을 원문 마크다운으로 되돌린다.
 *
 * `span.narration`→`*…*`, `span.md-bold`→`**…**`, `span.dialogue`·그 밖의 span→그대로,
 * `<br>`→줄바꿈, `<img src>`→`![alt](src)`, `<pre><code>`→제목 있는 펜스 블록.
 * 모르는 태그는 버리고 안쪽 글만 남긴다.
 *
 * @param {string} html
 * @returns {string}
 */
export function fragmentToMarkdown (html) {
  const source = String(html == null ? '' : html)
  // span 중첩을 버티려고 버퍼를 쌓는다. 바닥(index 0)이 결과다.
  const stack = [{ mark: '', buf: [] }]
  const put = (s) => { stack[stack.length - 1].buf.push(s) }

  const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g
  let cursor = 0
  let tag
  while ((tag = TAG.exec(source))) {
    if (tag.index > cursor) put(textNode(source.slice(cursor, tag.index)))
    cursor = TAG.lastIndex

    const closing = tag[1] === '/'
    const name = tag[2].toLowerCase()
    const attrs = tag[3]

    if (name === 'pre' && !closing) {
      // `<pre>`는 통째로 떼어 내 펜스로 바꾼다. 안쪽 `<code>`는 서식이 아니라 글이다.
      const end = source.toLowerCase().indexOf('</pre>', cursor)
      const inner = end < 0 ? source.slice(cursor) : source.slice(cursor, end)
      put(codeToFence(textOnly(inner)))
      cursor = end < 0 ? source.length : end + 6
      TAG.lastIndex = cursor
      continue
    }
    if (name === 'br' && !closing) { put('\n'); continue }
    if (name === 'img' && !closing) {
      const src = decodeEntities(attrOf(attrs, 'src')).trim()
      if (src !== '') put('![' + decodeEntities(attrOf(attrs, 'alt')) + '](' + src + ')')
      continue
    }
    if (name === 'span') {
      if (closing) {
        if (stack.length > 1) {
          const top = stack.pop()
          put(wrapInline(top.mark, top.buf.join('')))
        }
        continue
      }
      // 자기 닫는 `<span/>`은 열지 않는다.
      if (!/\/\s*$/.test(attrs)) stack.push({ mark: spanMark(attrOf(attrs, 'class')), buf: [] })
      continue
    }
    // 그 밖의 태그는 버린다. 안쪽 글은 이미 그대로 흐른다.
  }
  if (cursor < source.length) put(textNode(source.slice(cursor)))

  // 닫히지 않은 span은 표식을 붙여 정리한다.
  while (stack.length > 1) {
    const top = stack.pop()
    put(wrapInline(top.mark, top.buf.join('')))
  }
  return stack[0].buf.join('')
}

/* ── 이미지 ───────────────────────────────────────────────────────────── */

/** 마크다운 이미지에서 절대 http(s) 주소만. 한 턴 안에서 같은 주소는 한 번만. */
function collectImageUrls (text) {
  const out = []
  const seen = new Set()
  const re = /!\[([^\]\n]*)\]\(\s*([^()\s]*)\s*\)/g
  let m
  while ((m = re.exec(text))) {
    const url = m[2]
    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue
    seen.add(url)
    out.push({ url, alt: m[1] || '' })
  }
  return out
}

/* ── 페이지 복사본 ────────────────────────────────────────────────────── */

/** `<li class="cWrap …">` 하나하나를 잘라 낸다(다음 cWrap 앞까지). */
function splitMessageItems (region) {
  const re = /<li\b((?:"[^"]*"|'[^']*'|[^>"'])*)>/gi
  const heads = []
  let m
  while ((m = re.exec(region))) {
    if (hasClass(attrOf(m[1], 'class'), 'cWrap')) {
      heads.push({ attrs: m[1], from: m.index + m[0].length })
    }
  }
  return heads.map((head, i) => ({
    attrs: head.attrs,
    html: region.slice(head.from, i + 1 < heads.length ? heads[i + 1].from : region.length)
  }))
}

function makeClipboardResult (kind, botName, turns, warnings, url) {
  return {
    source: {
      platform: 'luna',
      chatId: chatIdOf(url),
      title: botName,
      botName,
      url,
      capture: 'paste',
      pasteKind: kind
    },
    meta: { startSetting: null, persona: null },
    turns,
    botName,
    warnings,
    kind
  }
}

/**
 * 루나톡 페이지 전체 복사본(클립보드 `text/html`)을 어댑터 결과 모양으로 바꾼다.
 *
 * 역할·순서·원문 마크다운·그림 주소를 `#messageList` 안의 `li.cWrap`에서 그대로 읽는다.
 * 추정하는 것이 없다. 작성 시각은 복사본에 없으므로 `createdAt`은 언제나 null이다.
 *
 * @param {string} html 클립보드 HTML(윈도 "HTML Format" 머리말이 있어도 된다)
 * @param {{ botName?: string }} [options] 이름을 주면 화자·제목을 그 이름으로 덮어쓴다
 * @returns {{ source: object, meta: object, turns: object[], botName: string, warnings: string[], kind: string }}
 */
export function parseLunaClipboardHtml (html, options = {}) {
  const warnings = []
  const raw = String(html == null ? '' : html)
  const url = sourceUrlOf(raw)
  const doc = stripClipboardHeader(raw)
  const override = options && typeof options.botName === 'string' ? options.botName.trim() : ''

  const items = splitMessageItems(messageListRegion(doc))
  let detected = ''
  const turns = []

  for (const item of items) {
    const classAttr = attrOf(item.attrs, 'class')
    const role = hasClass(classAttr, 'user') ? 'user' : 'assistant'

    const nameMatch = /<span\b[^>]*\bclass="[^"]*\bcName\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i.exec(item.html)
    const name = nameMatch ? decodeEntities(nameMatch[1].replace(/<[^>]*>/g, '')).trim() : ''
    if (role === 'assistant' && name !== '' && detected === '') detected = name

    const contentMatch = /\bdata-content="([^"]*)"/i.exec(item.html)
    if (!contentMatch) continue
    const text = tidy(splitLines(decodeEntities(contentMatch[1])).join('\n'))
    if (text === '') continue

    turns.push({
      role,
      speaker: role === 'user' ? USER_SPEAKER : (name || detected || UNKNOWN_SPEAKER),
      text,
      createdAt: null,
      imageUrls: collectImageUrls(text)
    })
  }

  const botName = override || detected
  if (botName !== '') {
    for (const turn of turns) {
      if (turn.role !== 'user') turn.speaker = botName
    }
  }
  if (turns.length === 0) warnings.push(WARN_NO_TURNS)

  return makeClipboardResult(PASTE_KIND_HTML, botName, turns, warnings, url)
}

/**
 * 메시지 하나만 복사된 조각을 AI 턴 하나로 담는다.
 *
 * 조각에는 화자 이름도, 앞뒤 메시지도 없다. 지어내지 않고 경고를 남긴다.
 *
 * @param {string} html 클립보드 HTML 조각
 * @param {{ botName?: string }} [options]
 * @returns {{ source: object, meta: object, turns: object[], botName: string, warnings: string[], kind: string }}
 */
export function parseLunaClipboardFragment (html, options = {}) {
  const warnings = []
  const raw = String(html == null ? '' : html)
  const url = sourceUrlOf(raw)
  const override = options && typeof options.botName === 'string' ? options.botName.trim() : ''

  let body = stripClipboardHeader(raw)
  const start = body.indexOf('<!--StartFragment-->')
  if (start >= 0) body = body.slice(start + 20)
  const end = body.indexOf('<!--EndFragment-->')
  if (end >= 0) body = body.slice(0, end)

  const text = tidy(splitLines(fragmentToMarkdown(body)).join('\n'))
  const turns = []
  if (text !== '') {
    turns.push({
      role: 'assistant',
      speaker: override || UNKNOWN_SPEAKER,
      text,
      createdAt: null,
      imageUrls: collectImageUrls(text)
    })
    warnings.push(WARN_SINGLE_MESSAGE)
  } else {
    warnings.push(WARN_NO_TURNS)
  }

  return makeClipboardResult(PASTE_KIND_FRAGMENT, override, turns, warnings, url)
}

/**
 * 붙여 넣은 클립보드 두 형식을 보고 알맞은 파서를 고른다.
 *
 * - `text/html`에 `#messageList li.cWrap`이 있으면 페이지 복사본 → `parseLunaClipboardHtml`
 * - `text/html`에 루나톡 메시지 마크업만 있으면 조각 → `parseLunaClipboardFragment`
 * - 그 밖에는 평문 → `parseLunaPaste`
 *
 * @param {{ html?: string, text?: string, botName?: string }} input
 * @returns {{ source: object, meta: object, turns: object[], botName: string, warnings: string[], kind: string }}
 */
export function parseLunaClipboard (input = {}) {
  const src = input && typeof input === 'object' ? input : {}
  const html = typeof src.html === 'string' ? src.html : ''
  const options = { botName: typeof src.botName === 'string' ? src.botName : '' }

  if (html.trim() !== '') {
    if (looksLikeLunaPage(html)) return parseLunaClipboardHtml(html, options)
    if (looksLikeLunaFragment(html)) return parseLunaClipboardFragment(html, options)
  }
  return parseLunaPaste(src.text, options)
}

export default parseLunaPaste
