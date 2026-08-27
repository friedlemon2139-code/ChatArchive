// 붙여넣기 저장 페이지 — 공통 흐름 (README §5.1, §5.2, §11)
//
// `site/export/luna.html`·`unpublished/genit.html` 안에서 돈다. 유저가 대화 화면에서 복사한 것을
// 붙여 넣으면 파싱 결과를 미리 보여 주고, 버튼을 누르면 뷰어 HTML 한 장을 만들어 저장한다.
//
// **파서를 import하지 않는다.** 어느 파서를 실을지는 엔트리가 정한다(`paste-page-luna.js` ·
// `paste-page-genit.js`) — 그래야 플랫폼 하나만 담은 번들이 다른 플랫폼의 코드를 끌고 오지 않는다.
// 파서만 갈릴 뿐 미리보기·파일 만들기·저장 흐름은 어느 페이지나 같다 — 그래서 이 모듈이 하나다.
//
// 페이지가 어느 플랫폼인지는 `<body data-platform="…">`가 말한다. 엔트리가 준 파서 중에 그 이름이
// 없으면 첫 번째 파서를 쓴다 — 파서가 하나뿐인 번들에서는 언제나 그 하나다.
//
// 붙여넣기에는 클립보드 두 형식이 함께 온다. `paste` 이벤트에서 `text/html`을 따로 챙겨 두고
// (`lastHtml`), 눈에 보이는 평문은 그대로 칸에 떨어뜨린다. 파싱은 좋은 쪽부터 고른다 —
// 페이지 복사본 > 메시지 조각 > 평문(§5.1).
//
// 네트워크: 페이지 복사본에는 그림 주소가 들어 있어 **그림만** 내려받아 파일에 넣는다
// (README §6, CORS가 허락하는 호스트만). 붙여 넣은 글은 어디로도 나가지 않고,
// 플랫폼 서버에는 접속하지 않는다.

import viewerJs from '../generated/viewer.txt'
import viewerCss from '../generated/viewer.css.txt'

import { createExport, validateExport, exportFileName } from './schema.js'
import { renderHtmlDocument } from './viewer-template.js'
import { embedAll, attachImages, summarizeImages, countUniqueImageUrls } from './images.js'
import { downloadBlob, htmlBlob } from './download.js'

/** 입력이 멈춘 뒤 파싱까지 기다리는 시간. 긴 글을 붙여 넣어도 타자가 끊기지 않게. */
const DEBOUNCE_MS = 200

/** 미리보기에 보여 주는 앞부분 길이. */
const PREVIEW_CHARS = 80

const ROLE_LABEL = { assistant: 'AI', user: '나', system: '시스템' }

/** 무엇을 붙여 넣었는지 미리보기 맨 윗줄에 밝힌다. 정확도가 다르기 때문이다. */
const KIND_LABEL = {
  html: '인식: 페이지 복사본(정확)',
  fragment: '인식: 메시지 하나(부분 복사)',
  text: '인식: 글만(텍스트)'
}

const $ = (id) => document.getElementById(id)

/**
 * 이 페이지가 어느 플랫폼의 붙여넣기 페이지인가.
 * 엔트리가 실은 파서 중에 `<body data-platform>`의 이름이 없으면 첫 번째 파서를 쓴다 —
 * 파서가 하나뿐인 번들에서는 언제나 그 하나다.
 */
function pickParser (parsers) {
  const body = document.body
  const name = body && body.dataset ? String(body.dataset.platform || '') : ''
  if (parsers[name]) return parsers[name]
  const first = Object.keys(parsers)[0]
  return first ? parsers[first] : null
}

function el (tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text != null) node.textContent = text
  return node
}

/** 여러 줄을 한 줄로 눌러 앞부분만. */
function clip (text, max) {
  const flat = String(text == null ? '' : text).replace(/\s+/g, ' ').trim()
  return flat.length <= max ? flat : flat.slice(0, max) + '…'
}

function countRoles (turns) {
  const counts = { assistant: 0, user: 0, system: 0 }
  for (const turn of turns) {
    if (counts[turn.role] === undefined) counts[turn.role] = 0
    counts[turn.role] += 1
  }
  return counts
}

/** 턴에 달린 그림 수(같은 주소가 여러 턴에 나오면 그만큼). */
function countImageRefs (turns) {
  let n = 0
  for (const turn of turns) n += ((turn && turn.imageUrls) || []).length
  return n
}

function formatBytes (bytes) {
  const n = typeof bytes === 'number' && isFinite(bytes) && bytes > 0 ? bytes : 0
  if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + ' MB'
  return Math.round(n / 1024) + ' KB'
}

/**
 * 페이지를 켠다.
 * @param {Record<string, Function>} parsers 플랫폼 이름 → 붙여넣기 파서. 엔트리가 준다.
 */
function boot (parsers) {
  const pasteEl = $('paste')
  const botNameEl = $('botname')
  const previewEl = $('preview')
  const buildEl = $('build')
  const saveEl = $('save')
  const resultEl = $('result')
  if (!pasteEl || !previewEl || !buildEl) return

  const parseClipboard = pickParser(parsers || {})
  if (!parseClipboard) return

  /** 마지막 파싱 결과. `파일 만들기`는 누를 때 다시 파싱하므로 미리보기용이다. */
  let latest = null
  /** 유저가 이름 칸을 직접 고쳤는가. 고쳤으면 자동 인식 값으로 덮어쓰지 않는다. */
  let nameEdited = false
  let timer = 0

  /** 마지막 붙여넣기의 `text/html`과, 그때 칸에 떨어진 평문. */
  let lastHtml = ''
  let lastPlain = null
  /** 다 만들어 놓고 저장을 기다리는 파일. */
  let pending = null
  /** 만드는 중인가. 중복 실행을 막는다. */
  let building = false

  /**
   * 지금 칸의 글이 마지막 붙여넣기 그대로면 그때의 HTML을 쓴다.
   * 유저가 손으로 고쳤다면 HTML은 더 이상 칸의 내용을 설명하지 못하므로 버린다.
   */
  function activeHtml () {
    if (lastPlain === null) return ''
    return pasteEl.value === lastPlain ? lastHtml : ''
  }

  function overrideName () {
    if (!nameEdited || !botNameEl) return ''
    return botNameEl.value.trim()
  }

  function say (message, isError) {
    if (!resultEl) return
    resultEl.textContent = message || ''
    resultEl.classList.toggle('bad', !!isError)
    resultEl.hidden = !message
  }

  /** 만들어 둔 파일을 버린다(칸이 바뀌었거나 새로 만들기 시작할 때). */
  function dropPending () {
    pending = null
    if (saveEl) saveEl.hidden = true
  }

  /* ── 미리보기 ─────────────────────────────────────────────────────────── */

  function renderPreview (result) {
    previewEl.textContent = ''

    if (pasteEl.value.trim() === '' && activeHtml() === '') {
      previewEl.appendChild(el('p', 'muted', '붙여 넣으면 여기에 결과가 표시됩니다.'))
      return
    }

    previewEl.appendChild(el('p', 'kind', KIND_LABEL[result.kind] || KIND_LABEL.text))

    const turns = result.turns
    const counts = countRoles(turns)
    const parts = ['턴 ' + turns.length + '개']
    if (counts.assistant) parts.push('AI ' + counts.assistant + '개')
    if (counts.user) parts.push('나 ' + counts.user + '개')
    const images = countImageRefs(turns)
    if (images) parts.push('이미지 ' + images + '장')
    previewEl.appendChild(el('p', 'count', parts.join(' · ')))

    if (turns.length > 0) {
      const list = el('dl', 'sample')
      const first = turns[0]
      const last = turns[turns.length - 1]
      list.appendChild(el('dt', null, '첫 턴 · ' + (ROLE_LABEL[first.role] || first.role)))
      list.appendChild(el('dd', null, clip(first.text, PREVIEW_CHARS)))
      if (turns.length > 1) {
        list.appendChild(el('dt', null, '마지막 턴 · ' + (ROLE_LABEL[last.role] || last.role)))
        list.appendChild(el('dd', null, clip(last.text, PREVIEW_CHARS)))
      }
      previewEl.appendChild(list)
    }

    for (const warning of result.warnings) {
      previewEl.appendChild(el('p', 'warn', warning))
    }
  }

  /* ── 파싱 ─────────────────────────────────────────────────────────────── */

  function parseNow () {
    const result = parseClipboard({
      html: activeHtml(),
      text: pasteEl.value,
      botName: overrideName()
    })
    latest = result
    if (botNameEl && !nameEdited) botNameEl.value = result.botName
    renderPreview(result)
    buildEl.disabled = building || result.turns.length === 0
    return result
  }

  function schedule () {
    clearTimeout(timer)
    timer = setTimeout(() => {
      dropPending()
      say('')
      parseNow()
    }, DEBOUNCE_MS)
  }

  /* ── 저장 ─────────────────────────────────────────────────────────────── */

  /** 유저가 이름 칸에 적은 이름을 결과 전체에 반영한다. */
  function applyName (result) {
    const name = ((botNameEl && botNameEl.value) || result.botName || '').trim()
    const source = Object.assign({}, result.source)
    if (name) {
      source.botName = name
      source.title = name
    }
    const turns = result.turns.map((turn) =>
      turn.role === 'assistant' && name ? Object.assign({}, turn, { speaker: name }) : turn
    )
    return { source, turns }
  }

  async function build () {
    if (building) return
    const result = parseNow()
    if (result.turns.length === 0) {
      say('저장할 대화를 찾지 못했습니다. 복사한 것을 다시 붙여 넣어 주세요.', true)
      return
    }

    building = true
    buildEl.disabled = true
    dropPending()

    try {
      const { source, turns } = applyName(result)

      // 1. 그림 내려받기. 하나가 실패해도 멈추지 않는다 — 실패는 파일 안에 남는다(§6).
      const total = countUniqueImageUrls(turns)
      if (total > 0) say('이미지 내려받는 중 0/' + total)
      const embedded = await embedAll(turns, {
        onProgress: (_message, ratio) => {
          if (!total) return
          say('이미지 내려받는 중 ' + Math.round((ratio || 0) * total) + '/' + total)
        }
      })

      // 2. 파일 만들기.
      say('파일을 만드는 중...')
      const exp = createExport({ source, meta: result.meta, turns: attachImages(turns, embedded) })
      const check = validateExport(exp)
      if (!check.ok) {
        if (typeof console !== 'undefined') console.error('[geas-export] 스키마 검증 실패:', check.errors)
        say('만든 데이터가 올바르지 않습니다: ' + check.errors.join(', '), true)
        return
      }

      const html = renderHtmlDocument(exp, { viewerJs, viewerCss })
      const fileName = exportFileName(exp, 'html')
      const stats = summarizeImages(exp.turns)

      // 3. 저장 확인: 실제 크기를 재서 보여 주고, 유저가 `저장`을 누를 때 내려받는다(§10-5).
      pending = { fileName, html }
      const bits = [
        '파일 크기 약 ' + formatBytes(new Blob([html]).size),
        '턴 ' + exp.turns.length
      ]
      if (stats.ok || stats.failed.length) {
        bits.push(
          '이미지 ' + stats.ok +
          '(고유 ' + stats.unique +
          (stats.failed.length ? ' · 실패 ' + stats.failed.length : '') + ')'
        )
      }
      say(bits.join(' · '))
      if (saveEl) {
        saveEl.hidden = false
        saveEl.textContent = '저장'
      }
    } catch (err) {
      if (typeof console !== 'undefined') console.error('[geas-export] 파일 생성 실패:', err)
      say('파일을 만들지 못했습니다. 브라우저 콘솔(F12)에 자세한 원인이 남습니다.', true)
    } finally {
      building = false
      buildEl.disabled = latest ? latest.turns.length === 0 : true
    }
  }

  function save () {
    if (!pending) return
    const { fileName } = pending
    try {
      downloadBlob(fileName, htmlBlob(pending.html))
    } catch (err) {
      if (typeof console !== 'undefined') console.error('[geas-export] 저장 실패:', err)
      say('저장하지 못했습니다. 브라우저의 다운로드 차단 설정을 확인해 주세요.', true)
      return
    }
    dropPending()
    say('저장했습니다 — ' + fileName)
  }

  /* ── 연결 ─────────────────────────────────────────────────────────────── */

  pasteEl.addEventListener('input', schedule)
  pasteEl.addEventListener('paste', (event) => {
    // 평문은 평소대로 칸에 떨어뜨린다(유저가 눈으로 확인할 것이 있어야 한다).
    // HTML은 칸에 담을 수 없으므로 따로 기억해 둔다.
    const data = event && event.clipboardData
    if (data && typeof data.getData === 'function') {
      try {
        lastHtml = data.getData('text/html') || ''
        lastPlain = data.getData('text/plain') || ''
      } catch (err) {
        lastHtml = ''
        lastPlain = null
      }
    } else {
      lastHtml = ''
      lastPlain = null
    }
    // 붙여넣기가 끝난 뒤의 칸 내용이 필요하다.
    setTimeout(() => {
      // 칸에 떨어진 것이 우리가 본 평문과 다르면(브라우저 정규화 등) 그 값을 기준으로 삼는다.
      if (lastPlain !== null && pasteEl.value !== lastPlain) lastPlain = pasteEl.value
      clearTimeout(timer)
      dropPending()
      say('')
      parseNow()
    }, 0)
  })
  if (botNameEl) {
    botNameEl.addEventListener('input', () => {
      nameEdited = botNameEl.value.trim() !== ''
      schedule()
    })
  }
  buildEl.addEventListener('click', () => { build() })
  if (saveEl) saveEl.addEventListener('click', save)

  parseNow()
}

/** 문서가 준비되면 켠다. 엔트리가 마지막에 한 번 부른다. */
function start (parsers) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => boot(parsers), { once: true })
  } else {
    boot(parsers)
  }
}

export { boot, start }
