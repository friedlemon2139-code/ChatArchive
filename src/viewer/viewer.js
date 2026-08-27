// viewer.js — 내보낸 HTML 안에서 도는 엔트리 스크립트 (README §7)
//
// 단일 데이터 소스: `#geas-export`의 JSON. 서버 렌더된 턴 HTML은 없다.
// 네트워크 접근 0. 실패해도 빈 화면 대신 오류 문구를 남긴다.

import { renderMarkdown } from '../markdown.js'
import { buildMarkdownZip } from '../export-md.js'
import { exportFileName, imageDataUri, captureKind, pasteKind } from '../schema.js'

/* ─────────────────────────── 상수 ─────────────────────────── */

const PLATFORM_LABELS = { genit: '젠잇', luna: '루나톡' }
const ROLE_FALLBACK_SPEAKER = { user: '나', assistant: 'AI', system: '시스템' }
const ROLES = ['user', 'assistant', 'system']

// 안내 한 줄을 닫았는지 기억하는 키. localStorage가 막힌 환경에서는 그냥 매번 보인다.
const NOTICE_KEY = 'geas-export:notice-dismissed'

// 화면에서 복사한 것으로 만든 파일(README §5.1)은 담긴 것이 다르다. 무엇을 붙여 넣었는지에
// 따라 담긴 것도 다르므로(`source.pasteKind`) 안내를 그에 맞춰 고른다.
const PASTE_NOTICE_HTML =
  '화면에서 복사한 내용으로 만든 파일입니다. 작성 시각은 포함되지 않습니다.'
const PASTE_NOTICE_FRAGMENT = PASTE_NOTICE_HTML + ' 메시지 하나만 담겨 있습니다.'
const PASTE_NOTICE_TEXT =
  '화면에서 복사한 텍스트로 만든 파일입니다. 굵게·기울임 같은 서식과 이미지는 포함되지 않습니다.'

// 젠잇 그림은 CDN이 교차 출처 fetch를 막아 화면에 보이던 것을 그대로 담을 수 없다.
// 같은 그림의 원본이 있는 것만 그 주소로 바꿔 담는다(§5.2). 그 사정을 파일 안에서도 밝힌다.
const PASTE_NOTICE_GENIT =
  '젠잇 내부 이미지는 원본 주소로 대체하여 저장하며, 대체할 수 없는 이미지는 포함되지 않습니다.'

// 화면 읽기 북마클릿(README §5.4)으로 만든 파일. 화면에 불러와진 것만 담긴다.
const SCREEN_NOTICE =
  '화면에 표시된 대화를 저장한 파일입니다. 작성 시각은 포함되지 않습니다.'

/** 붙여넣기로 만든 파일의 안내 한 줄. 모르는 값이면 가장 보수적인(글만) 문구를 쓴다. */
function pasteNotice(exp) {
  const kind = pasteKind(exp)
  const genit = exp && exp.source && exp.source.platform === 'genit'
  if (kind === 'html') return PASTE_NOTICE_HTML + (genit ? ' ' + PASTE_NOTICE_GENIT : '')
  if (kind === 'fragment') return PASTE_NOTICE_FRAGMENT + (genit ? ' ' + PASTE_NOTICE_GENIT : '')
  return PASTE_NOTICE_TEXT
}

/**
 * 취득 방식이 남긴 안내 한 줄. API로 받은 파일에는 덧붙일 말이 없어 null이다.
 * @returns {string | null}
 */
function captureNotice(exp) {
  const capture = captureKind(exp)
  if (capture === 'paste') return pasteNotice(exp)
  if (capture === 'screen') return SCREEN_NOTICE
  return null
}

// 젠잇식 맨몸 이미지 토큰: 한 줄 전체가 `{{url}}A/1.webp`
const BARE_IMAGE_TOKEN = /^\{\{url\}\}(\S+)$/

// 마크다운 렌더를 통과시켜야 하므로 영숫자만 쓴다(이스케이프·서식 영향 없음).
const FAIL_MARKER_HEAD = 'GEASxIMGFAILx'
const FAIL_MARKER_TAIL = 'xENDGEASx'
const FAIL_MARKER_RE = new RegExp(FAIL_MARKER_HEAD + '(\\d+)' + FAIL_MARKER_TAIL, 'g')

/* ─────────────────────────── 잡동사니 ─────────────────────────── */

const $ = (id) => document.getElementById(id)

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text != null) node.textContent = text
  return node
}

function formatDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return String(iso)
  try {
    return d.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch (_e) {
    return d.toString()
  }
}

function platformLabel(exp) {
  const p = (exp.source && exp.source.platform) || ''
  return PLATFORM_LABELS[p] || p || '알 수 없는 플랫폼'
}

/** 헤더 칩. API로 받은 것이 아니면 어떻게 가져온 것인지 이름에 붙인다. */
const CAPTURE_CHIP = { paste: ' (복사본)', screen: ' (화면)' }

function platformChip(exp) {
  return platformLabel(exp) + (CAPTURE_CHIP[captureKind(exp)] || '')
}

function safeFileName(exp, ext, fallbackStem) {
  try {
    const name = exportFileName(exp, ext)
    if (name) return name
  } catch (_e) {
    /* schema.js가 이름을 못 만들면 폴백 */
  }
  return fallbackStem + '.' + ext
}

/* ─────────────────────────── 데이터 읽기 ─────────────────────────── */

function readExport() {
  const holder = $('geas-export')
  if (!holder) throw new Error('내보내기 데이터(#geas-export)를 찾을 수 없습니다. 파일이 손상되었을 수 있습니다.')

  let parsed
  try {
    parsed = JSON.parse(holder.textContent || '')
  } catch (e) {
    throw new Error('내보내기 데이터를 읽지 못했습니다. (' + (e && e.message ? e.message : e) + ')')
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('내보내기 데이터 형식이 올바르지 않습니다.')
  }
  if (!Array.isArray(parsed.turns)) {
    throw new Error('내보내기 데이터에 대화(turns)가 없습니다.')
  }
  if (!parsed.source || typeof parsed.source !== 'object') parsed.source = {}
  if (!parsed.meta || typeof parsed.meta !== 'object') parsed.meta = {}
  return parsed
}

/**
 * 이미지 수 집계.
 * embedded/failed는 턴에 붙은 이미지 하나하나를 센다(같은 그림이 여러 턴에 나오면 그만큼).
 * unique는 실제로 담긴 서로 다른 그림의 수 — 자산 참조는 assetId로, 구버전 인라인
 * 이미지는 dataUri 자체로 묶는다.
 */
function countImages(exp) {
  let embedded = 0
  let failed = 0
  const distinct = new Set()
  for (const turn of exp.turns) {
    const images = Array.isArray(turn && turn.images) ? turn.images : []
    for (const img of images) {
      if (!img) continue
      if (isFailed(exp, img)) {
        failed += 1
        continue
      }
      embedded += 1
      const key = typeof img.assetId === 'string' && img.assetId ? 'a:' + img.assetId : 'd:' + imageDataUri(exp, img)
      distinct.add(key)
    }
  }
  return { embedded, failed, total: embedded + failed, unique: distinct.size }
}

function showError(message) {
  const box = $('error')
  if (box) {
    box.textContent = message
    box.hidden = false
  }
  const toolbar = $('toolbar')
  if (toolbar) toolbar.hidden = true
}

/* ─────────────────────────── 헤더 · 메타 ─────────────────────────── */

function renderHeader(exp) {
  const head = $('head')
  if (!head) return
  head.textContent = ''

  const source = exp.source || {}
  head.appendChild(el('h1', 'title', source.title || source.chatId || '대화 기록'))

  const sub = el('p', 'sub')
  sub.appendChild(el('span', 'chip', platformChip(exp)))

  const exportedAt = formatDateTime(source.exportedAt)
  if (exportedAt) sub.appendChild(el('span', null, '내보낸 시각 ' + exportedAt))

  sub.appendChild(el('span', null, '턴 ' + exp.turns.length + '개'))

  const counts = countImages(exp)
  if (counts.total > 0) {
    let text = '이미지 ' + counts.total + '장 (고유 ' + counts.unique
    text += counts.failed > 0 ? ' · 실패 ' + counts.failed + ')' : ')'
    sub.appendChild(el('span', null, text))
  }

  head.appendChild(sub)
}

function renderMetaPanel(container, label, text) {
  if (text == null || String(text).trim() === '') return
  const details = document.createElement('details')
  details.appendChild(el('summary', null, label))
  const body = el('div', 'meta-body')
  body.innerHTML = renderMarkdown(String(text)) // renderMarkdown은 이스케이프된 안전 HTML을 돌려준다
  details.appendChild(body)
  container.appendChild(details)
}

function renderMeta(exp) {
  const container = $('meta')
  if (!container) return
  container.textContent = ''
  const meta = exp.meta || {}
  renderMetaPanel(container, '시작 설정', meta.startSetting)
  renderMetaPanel(container, '페르소나', meta.persona)
}

function renderFooter(exp) {
  const foot = $('foot')
  if (!foot) return
  foot.textContent = ''
  const source = exp.source || {}
  const bits = ['대화 저장 · ' + platformLabel(exp)]
  if (source.url) bits.push(source.url)
  foot.appendChild(el('span', null, bits.join(' · ')))
}

/* ─────────────────────────── 이미지 매칭 ─────────────────────────── */

function normalizeImages(turn) {
  return (Array.isArray(turn && turn.images) ? turn.images : []).filter(
    (img) => img && typeof img === 'object'
  )
}

function isFailed(exp, img) {
  return img.status === 'failed' || imageDataUri(exp, img) == null
}

/** 맨몸 토큰 경로(`A/1.webp`)로 이미지를 찾는다. 강한 매칭(`/경로`) 우선. */
function findImageByPath(images, rawPath) {
  const path = String(rawPath).replace(/^\/+/, '')
  if (!path) return null
  for (const img of images) {
    const url = String(img.originalUrl || '')
    if (url === path || url.endsWith('/' + path)) return img
  }
  for (const img of images) {
    if (String(img.originalUrl || '').endsWith(path)) return img
  }
  return null
}

/** 합성 마크다운에 넣어도 문법을 깨지 않는 alt. */
function safeAlt(alt) {
  return String(alt == null ? '' : alt)
    .replace(/[\[\]()\n\r]/g, ' ')
    .trim()
}

/**
 * 본문을 renderMarkdown에 넘기기 전 손질한다.
 * 1) 맨몸 이미지 토큰 줄 → `![alt](originalUrl)` (매칭 실패 시 원문 유지)
 * 2) 내장 실패 이미지 참조 → 영숫자 마커 (렌더 후 안내 문구로 치환)
 */
function prepareBody(exp, turn, images) {
  const byUrl = new Map()
  for (const img of images) {
    if (img.originalUrl) byUrl.set(String(img.originalUrl), img)
  }

  let text = String(turn && turn.text != null ? turn.text : '')

  if (images.length > 0 && text.indexOf('{{url}}') !== -1) {
    text = text
      .split('\n')
      .map((line) => {
        const m = BARE_IMAGE_TOKEN.exec(line.trim())
        if (!m) return line
        const img = findImageByPath(images, m[1])
        if (!img) return line // 매칭 실패한 표기는 그대로 둔다
        const alt = safeAlt(img.alt) || safeAlt(m[1].replace(/\.[a-z0-9]+$/i, ''))
        return '![' + alt + '](' + img.originalUrl + ')'
      })
      .join('\n')
  }

  const failed = []
  const referenced = new Set()

  text = text.replace(/!\[([^\]\n]*)\]\(([^)\s]*)\)/g, (whole, _alt, url) => {
    const img = byUrl.get(url)
    if (!img) return whole
    referenced.add(img)
    if (!isFailed(exp, img)) return whole
    const i = failed.push(img) - 1
    return FAIL_MARKER_HEAD + i + FAIL_MARKER_TAIL
  })

  return { text, failed, referenced, byUrl }
}

function failedImageHtml(img) {
  return (
    '<span class="img-failed">' +
    escapeHtml('이미지 내장 실패: ' + (img && img.originalUrl ? img.originalUrl : '(주소 없음)')) +
    '</span>'
  )
}

/* ─────────────────────────── 턴 ─────────────────────────── */

function renderTurn(exp, turn, position) {
  const role = ROLES.indexOf(turn && turn.role) !== -1 ? turn.role : 'system'
  const article = el('article', 'turn role-' + role)

  const header = el('div', 'turn-head')
  header.appendChild(
    el('span', 'speaker', (turn && turn.speaker) || ROLE_FALLBACK_SPEAKER[role] || role)
  )

  const index = typeof (turn && turn.index) === 'number' ? turn.index : position
  header.appendChild(el('span', 'idx', '#' + index))

  // 0번 assistant 턴에 시간이 없으면 시작 인사말이다(어댑터 계약, README §5).
  if (index === 0 && role === 'assistant' && turn && turn.createdAt === null) {
    // 붙여넣기로 만든 파일은 모든 턴이 화면 텍스트라 0번만 따로 표시할 이유가 없다.
    // 구버전 루나톡 API 파일(0번 턴만 화면 텍스트였다)은 그대로 둔다.
    const screenText =
      exp && exp.source && exp.source.platform === 'luna' && captureKind(exp) !== 'paste'
    header.appendChild(el('span', 'tag', screenText ? '시작 인사말 (화면 텍스트)' : '시작 인사말'))
  }

  const when = formatDateTime(turn && turn.createdAt)
  if (when) {
    const time = el('time', null, when)
    time.setAttribute('datetime', String(turn.createdAt))
    header.appendChild(time)
  }

  // 원문 복사: 렌더된 모습이 아니라 마크다운 원문(펜스·구분선 포함)을 그대로 복사한다.
  const rawText = String(turn && turn.text != null ? turn.text : '')
  const copyBtn = el('button', 'copy', '원문 복사')
  copyBtn.type = 'button'
  copyBtn.title = '이 턴의 원문(마크다운)을 클립보드에 복사'
  copyBtn.addEventListener('click', () => copyToClipboard(rawText))
  header.appendChild(copyBtn)
  article.appendChild(header)

  const images = normalizeImages(turn)
  const prepared = prepareBody(exp, turn, images)

  const body = el('div', 'body')
  const resolved = new Set()
  let html
  try {
    html = renderMarkdown(prepared.text, {
      resolveImage(url) {
        const img = prepared.byUrl.get(url)
        if (!img) return null
        resolved.add(img)
        return imageDataUri(exp, img)
      },
    })
  } catch (e) {
    html = '<p>' + escapeHtml(prepared.text) + '</p>'
    if (typeof console !== 'undefined') console.error('마크다운 렌더 실패', e)
  }
  body.innerHTML = String(html).replace(FAIL_MARKER_RE, (_m, i) =>
    failedImageHtml(prepared.failed[Number(i)])
  )
  attachCodeCopyButtons(body)
  article.appendChild(body)

  // 본문에서 언급되지 않은 이미지는 뒤에 갤러리로
  const leftovers = images.filter((img) => !resolved.has(img) && !prepared.referenced.has(img))
  if (leftovers.length > 0) {
    article.appendChild(renderGallery(exp, leftovers))
  }

  return article
}

function renderGallery(exp, images) {
  const gallery = el('div', 'gallery')
  for (const img of images) {
    if (isFailed(exp, img)) {
      gallery.appendChild(el('div', 'img-failed', '이미지 내장 실패: ' + (img.originalUrl || '(주소 없음)')))
      continue
    }
    const figure = document.createElement('figure')
    const node = document.createElement('img')
    node.src = imageDataUri(exp, img)
    node.alt = String(img.alt == null ? '' : img.alt)
    node.loading = 'lazy'
    figure.appendChild(node)
    if (img.alt) figure.appendChild(el('figcaption', null, String(img.alt)))
    gallery.appendChild(figure)
  }
  return gallery
}

function renderTurns(exp) {
  const host = $('turns')
  if (!host) return
  host.textContent = ''
  const frag = document.createDocumentFragment()
  exp.turns.forEach((turn, i) => frag.appendChild(renderTurn(exp, turn, i)))
  host.appendChild(frag)
}

/* ─────────────────────────── 저장 · 복사 ─────────────────────────── */

function downloadBlob(fileName, blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 코드블록(상태창 등)마다 그 안의 텍스트만 복사하는 버튼을 붙인다. */
function attachCodeCopyButtons(body) {
  for (const pre of body.querySelectorAll('pre')) {
    const wrap = el('div', 'pre-wrap')
    pre.parentNode.insertBefore(wrap, pre)
    // 펜스 언어명(```상태창)을 블록 제목으로 보여 준다.
    const code = pre.querySelector('code')
    const m = code && /(?:^|\s)language-(\S+)/.exec(code.className || '')
    if (m && m[1]) {
      wrap.classList.add('titled')
      wrap.appendChild(el('div', 'pre-title', m[1]))
    }
    wrap.appendChild(pre)
    const btn = el('button', 'pre-copy', '복사')
    btn.type = 'button'
    btn.title = '이 블록의 내용을 클립보드에 복사'
    btn.addEventListener('click', () => copyToClipboard(pre.textContent || ''))
    wrap.appendChild(btn)
  }
}

async function writeClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch (_e) {
    /* 권한 거부 등 → 폴백 */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '-1000px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    ta.setSelectionRange(0, ta.value.length)
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch (_e) {
    return false
  }
}

async function copyToClipboard(text) {
  const ok = await writeClipboard(text)
  toast(ok ? '복사했습니다.' : '복사하지 못했습니다. 본문을 직접 선택해 복사해 주세요.')
}

let toastTimer = 0
function toast(message) {
  const box = $('toast')
  if (!box) return
  box.textContent = message
  box.hidden = false
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    box.hidden = true
  }, 1600)
}

/* ─────────────────────────── 툴바 ─────────────────────────── */

function setupToolbar(exp) {
  const mdBtn = $('btn-md')
  if (mdBtn) {
    mdBtn.addEventListener('click', () => {
      try {
        const bytes = buildMarkdownZip(exp)
        downloadBlob(safeFileName(exp, 'zip', 'geas-chat'), new Blob([bytes], { type: 'application/zip' }))
      } catch (e) {
        toast('Markdown 저장에 실패했습니다.')
        if (typeof console !== 'undefined') console.error('Markdown zip 생성 실패', e)
      }
    })
  }

  const jsonBtn = $('btn-json')
  if (jsonBtn) {
    jsonBtn.addEventListener('click', () => {
      try {
        const blob = new Blob([JSON.stringify(exp, null, 2)], {
          type: 'application/json;charset=utf-8',
        })
        downloadBlob(safeFileName(exp, 'json', 'geas-chat'), blob)
      } catch (e) {
        toast('JSON 저장에 실패했습니다.')
        if (typeof console !== 'undefined') console.error('JSON 저장 실패', e)
      }
    })
  }
}

/* ─────────────────────────── 안내 한 줄 ─────────────────────────── */

/**
 * 툴바 아래 안내 문구. `닫기`를 누르면 localStorage에 기억한다.
 * 파일:// 이나 사생활 보호 모드에서는 localStorage 접근 자체가 던질 수 있어 전부 감싼다.
 */
function setupNotice(exp) {
  const notice = $('notice')
  if (!notice) return

  const captured = captureNotice(exp)
  if (captured) {
    const text = notice.querySelector('.notice-text')
    if (text) text.textContent = captured
  }

  let dismissed = false
  try {
    dismissed = localStorage.getItem(NOTICE_KEY) === '1'
  } catch (_e) {
    /* 못 읽으면 그냥 보여준다 */
  }
  if (dismissed) return

  notice.hidden = false
  const close = $('notice-close')
  if (!close) return
  close.addEventListener('click', () => {
    notice.hidden = true
    try {
      localStorage.setItem(NOTICE_KEY, '1')
    } catch (_e) {
      /* 기억하지 못해도 이번 화면에서는 닫힌다 */
    }
  })
}

/* ─────────────────────────── 인쇄 ─────────────────────────── */

function setupPrint() {
  if (typeof window.addEventListener !== 'function') return
  let reopened = []
  window.addEventListener('beforeprint', () => {
    reopened = Array.prototype.filter.call(
      document.querySelectorAll('#meta details'),
      (d) => !d.open
    )
    for (const d of reopened) d.open = true
  })
  window.addEventListener('afterprint', () => {
    for (const d of reopened) d.open = false
    reopened = []
  })
}

/* ─────────────────────────── 부트 ─────────────────────────── */

function boot() {
  let exp
  try {
    exp = readExport()
  } catch (e) {
    showError(e && e.message ? e.message : String(e))
    if (typeof console !== 'undefined') console.error(e)
    return
  }

  try {
    renderHeader(exp)
    renderMeta(exp)
    renderTurns(exp)
    renderFooter(exp)
  } catch (e) {
    showError('대화를 그리는 중 오류가 났습니다: ' + (e && e.message ? e.message : e))
    if (typeof console !== 'undefined') console.error(e)
    return
  }

  try {
    setupToolbar(exp)
    setupNotice(exp)
    setupPrint()
  } catch (e) {
    if (typeof console !== 'undefined') console.error('도구 초기화 실패', e)
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true })
} else {
  boot()
}

export { boot }
