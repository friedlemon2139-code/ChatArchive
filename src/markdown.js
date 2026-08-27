/**
 * 안전한 최소 마크다운 → HTML (README §3)
 *
 * 보안 원칙: 모든 원문 텍스트는 태그를 만들기 전에 HTML 이스케이프한다.
 * 원문에 들어 있던 HTML 태그는 절대 렌더되지 않고 글자로 보인다.
 * 어떤 입력이 와도 예외를 던지지 않는다.
 */

/** 인라인 처리 중 완성된 태그를 잠시 보관할 때 쓰는 마커(원문에서는 제거해 둔다) */
const MARK = String.fromCharCode(0)

const RESTORE_RE = new RegExp(MARK + '(\\d+)' + MARK, 'g')

/** 링크에 허용하는 프로토콜 */
const LINK_PROTOCOL_RE = /^https?:\/\//i

/** img src에 허용하는 형태: http(s), data:image/, blob:, 또는 스킴이 없는 상대 경로 */
const IMG_ALLOWED_RE = /^(https?:\/\/|data:image\/|blob:)/i
const HAS_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** escapeHtml의 정확한 역함수. 순서 주의(&amp;를 마지막에). */
function unescapeHtml(s) {
  return String(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

function isSafeImgSrc(url) {
  if (IMG_ALLOWED_RE.test(url)) return true
  return !HAS_SCHEME_RE.test(url)
}

function imageHtml(escapedAlt, escapedUrl, options) {
  const rawUrl = unescapeHtml(escapedUrl)
  const rawAlt = unescapeHtml(escapedAlt)
  let src = rawUrl
  const resolve = options && options.resolveImage
  if (typeof resolve === 'function') {
    try {
      const r = resolve(rawUrl, rawAlt)
      if (typeof r === 'string') src = r
    } catch (_e) {
      // resolveImage가 던져도 렌더는 계속한다
    }
  }
  if (!isSafeImgSrc(src)) return null
  return '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(rawAlt) + '" loading="lazy">'
}

/**
 * 인라인 문법 처리. 입력은 원문(비이스케이프), 출력은 HTML.
 *
 * 한계(의도적): 링크·이미지 안쪽 텍스트에는 굵게/기울임이 적용되지 않는다.
 * 완성된 태그를 먼저 잠가 두기 때문이다. 미지원 문법은 글자 그대로 남는다.
 */
function renderInline(raw, options) {
  const stash = []
  const put = (html) => MARK + (stash.push(html) - 1) + MARK

  let s = escapeHtml(raw)

  // 인라인 코드가 가장 강하다 — 안쪽의 다른 문법은 무시
  s = s.replace(/`([^`\n]+)`/g, (_m, code) => put('<code>' + code + '</code>'))

  // 이미지
  s = s.replace(/!\[([^\]\n]*)\]\(\s*([^()\s]*)\s*\)/g, (m, alt, url) => {
    if (!url) return m
    const html = imageHtml(alt, url, options)
    return html === null ? m : put(html)
  })

  // 링크 (http/https만; 그 외 프로토콜은 글자 그대로)
  s = s.replace(/\[([^\]\n]*)\]\(\s*([^()\s]*)\s*\)/g, (m, text, url) => {
    const rawUrl = unescapeHtml(url)
    if (!LINK_PROTOCOL_RE.test(rawUrl)) return m
    return put(
      '<a href="' + escapeHtml(rawUrl) + '" target="_blank" rel="noopener noreferrer">' + text + '</a>',
    )
  })

  s = s.replace(/\*\*([^*\n]+)\*\*/g, (_m, x) => '<strong>' + x + '</strong>')
  s = s.replace(/~~([^~\n]+)~~/g, (_m, x) => '<del>' + x + '</del>')
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, (_m, pre, x) => pre + '<em>' + x + '</em>')

  s = s.replace(RESTORE_RE, (m, i) => {
    const v = stash[Number(i)]
    return v === undefined ? m : v
  })
  return s
}

const RE_FENCE = /^\s{0,3}(```|~~~)\s*([^\s`~]*)\s*$/
const RE_HR = /^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/
const RE_HEADING = /^\s{0,3}(#{1,3})\s+(.*)$/
const RE_QUOTE = /^\s{0,3}>\s?(.*)$/
const RE_UL = /^\s{0,3}[-*]\s+(.+)$/
const RE_OL = /^\s{0,3}\d+[.)]\s+(.+)$/
const RE_BLANK = /^\s*$/

function startsNewBlock(line) {
  return (
    RE_BLANK.test(line) ||
    RE_FENCE.test(line) ||
    RE_HR.test(line) ||
    RE_HEADING.test(line) ||
    RE_QUOTE.test(line) ||
    RE_UL.test(line) ||
    RE_OL.test(line)
  )
}

/** 여러 줄을 한 덩어리로: 단일 개행은 <br> */
function inlineLines(lines, options) {
  return lines.map((l) => renderInline(l, options)).join('<br>')
}

/**
 * 최소 마크다운을 HTML 문자열로 렌더한다.
 *
 * @param {string} text 원문 마크다운
 * @param {{ resolveImage?: (url: string, alt: string) => (string|null) }} [options]
 *   resolveImage가 문자열을 반환하면 그 값을 src로, null/undefined면 원본 url을 src로 쓴다.
 * @returns {string} HTML
 */
export function renderMarkdown(text, options = {}) {
  if (typeof text !== 'string' || text === '') return ''
  try {
    const src = text.split(MARK).join('').replace(/\r\n?/g, '\n')
    const lines = src.split('\n')
    const out = []
    let i = 0

    while (i < lines.length) {
      const line = lines[i]

      if (RE_BLANK.test(line)) {
        i++
        continue
      }

      const fence = RE_FENCE.exec(line)
      if (fence) {
        const closer = fence[1]
        const lang = fence[2] || ''
        const body = []
        i++
        while (i < lines.length && !new RegExp('^\\s{0,3}' + closer + '+\\s*$').test(lines[i])) {
          body.push(lines[i])
          i++
        }
        if (i < lines.length) i++ // 닫는 펜스 소비 (없으면 문서 끝까지 코드블록)
        const cls = lang ? ' class="language-' + escapeHtml(lang) + '"' : ''
        out.push('<pre><code' + cls + '>' + escapeHtml(body.join('\n')) + '</code></pre>')
        continue
      }

      if (RE_HR.test(line)) {
        out.push('<hr>')
        i++
        continue
      }

      const h = RE_HEADING.exec(line)
      if (h) {
        const level = h[1].length
        out.push('<h' + level + '>' + renderInline(h[2].trim(), options) + '</h' + level + '>')
        i++
        continue
      }

      if (RE_QUOTE.test(line)) {
        const body = []
        while (i < lines.length && RE_QUOTE.test(lines[i])) {
          body.push(RE_QUOTE.exec(lines[i])[1])
          i++
        }
        out.push('<blockquote><p>' + inlineLines(body, options) + '</p></blockquote>')
        continue
      }

      if (RE_UL.test(line)) {
        const items = []
        while (i < lines.length && RE_UL.test(lines[i]) && !RE_HR.test(lines[i])) {
          items.push(RE_UL.exec(lines[i])[1])
          i++
        }
        out.push('<ul>' + items.map((x) => '<li>' + renderInline(x, options) + '</li>').join('') + '</ul>')
        continue
      }

      if (RE_OL.test(line)) {
        const items = []
        while (i < lines.length && RE_OL.test(lines[i])) {
          items.push(RE_OL.exec(lines[i])[1])
          i++
        }
        out.push('<ol>' + items.map((x) => '<li>' + renderInline(x, options) + '</li>').join('') + '</ol>')
        continue
      }

      const para = [line]
      i++
      while (i < lines.length && !startsNewBlock(lines[i])) {
        para.push(lines[i])
        i++
      }
      out.push('<p>' + inlineLines(para, options) + '</p>')
    }

    return out.join('\n')
  } catch (_e) {
    // 절대 던지지 않는다 — 최악의 경우 원문을 글자 그대로 보여 준다
    return '<p>' + escapeHtml(text) + '</p>'
  }
}

export { escapeHtml }
