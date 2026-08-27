/**
 * GeasExport → Markdown 문자열 + zip 항목 (README §8)
 */

import { createZip } from './zip.js'
import { imageDataUri, imageMime } from './schema.js'

/** mime → 파일 확장자. 아는 것만 매핑하고 나머지는 bin. */
export function extForMime(mime) {
  const m = String(mime ?? '').toLowerCase().split(';')[0].trim()
  if (m === 'image/png') return 'png'
  if (m === 'image/jpeg') return 'jpg'
  if (m === 'image/webp') return 'webp'
  return 'bin'
}

/**
 * zip 안 파일 이름의 어간. 자산으로 합쳐진 이미지는 assetId를 쓰므로 같은 그림을 공유하는
 * 여러 턴이 한 파일을 가리킨다. assetId가 없는 구버전 export는 이미지 id로 떨어진다.
 */
function imageStem(img) {
  const assetId = img && img.assetId
  if (typeof assetId === 'string' && assetId !== '') return assetId
  return (img && img.id) || 'image'
}

/** 이미지의 zip 안 경로 */
function imagePath(exp, img) {
  return 'images/' + imageStem(img) + '.' + extForMime(imageMime(exp, img))
}

/** 내장 실패 이미지를 본문에 남길 때 쓰는 표기 */
function failedNote(img) {
  return '(이미지 내장 실패: ' + img.originalUrl + ')'
}

function isEmbedded(exp, img) {
  return Boolean(img) && img.status === 'embedded' && imageDataUri(exp, img) != null
}

/** 본문/갤러리에 쓸 마크다운 이미지 표기. 실패 이미지는 안내 문구. */
function imageRef(exp, img, alt) {
  const label = alt != null ? alt : img.alt || ''
  if (!isEmbedded(exp, img)) return failedNote(img)
  return '![' + label + '](' + imagePath(exp, img) + ')'
}

/**
 * data URI → 바이트.
 * 브라우저는 atob를 쓴다. Node에도 atob가 있으므로 Buffer 폴백은 atob가 없을 때만 쓴다.
 * @param {string} uri
 * @returns {Uint8Array | null}
 */
export function dataUriToBytes(uri) {
  if (typeof uri !== 'string') return null
  const comma = uri.indexOf(',')
  if (comma < 0) return null
  const head = uri.slice(0, comma)
  const body = uri.slice(comma + 1)

  if (!/;base64/i.test(head)) {
    try {
      return new TextEncoder().encode(decodeURIComponent(body))
    } catch (_e) {
      return null
    }
  }

  const b64 = body.replace(/\s+/g, '')
  try {
    if (typeof atob === 'undefined') {
      // Node 폴백 (Node 22에는 atob가 있으므로 보통 여기로 오지 않는다)
      // eslint-disable-next-line no-undef
      return new Uint8Array(Buffer.from(b64, 'base64'))
    }
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch (_e) {
    return null
  }
}

/**
 * 본문 안의 이미지 표기를 zip 안 경로로 바꾼다.
 *
 * 두 가지 표기를 처리한다.
 *  1. 표준 마크다운 `![alt](originalUrl)`
 *  2. 젠잇식 맨 토큰 `{{url}}A/1.webp` — originalUrl이 그 경로로 끝나는 이미지와 매칭
 * 매칭되지 않은 표기는 손대지 않는다.
 *
 * @returns {{ text: string, usedIds: Set<string> }}
 */
function rewriteImageRefs(exp, text, images) {
  const usedIds = new Set()
  if (typeof text !== 'string' || text === '' || images.length === 0) {
    return { text: typeof text === 'string' ? text : '', usedIds }
  }
  const byUrl = new Map()
  for (const img of images) {
    if (img.originalUrl && !byUrl.has(img.originalUrl)) byUrl.set(img.originalUrl, img)
  }

  const replacementFor = (img, altOverride) => {
    usedIds.add(img.id)
    return imageRef(exp, img, altOverride)
  }

  let out = text.replace(/!\[([^\]\n]*)\]\(\s*([^()\s]+)\s*\)/g, (m, alt, url) => {
    const img = byUrl.get(url)
    if (!img) return m
    return replacementFor(img, alt)
  })

  out = out.replace(/\{\{url\}\}([^\s)\]]+)/g, (m, path) => {
    const img = images.find((x) => x.originalUrl && x.originalUrl.endsWith(path))
    if (!img) return m
    return replacementFor(img, null)
  })

  return { text: out, usedIds }
}

function metaTable(exp) {
  const s = exp.source || {}
  const turnCount = Array.isArray(exp.turns) ? exp.turns.length : 0
  const rows = [
    ['플랫폼', s.platform || '-'],
    ['내보낸 시각', s.exportedAt || '-'],
    ['턴 수', String(turnCount)],
  ]
  if (s.url) rows.push(['원본 URL', s.url])
  return ['| 항목 | 값 |', '| --- | --- |', ...rows.map((r) => '| ' + r[0] + ' | ' + r[1] + ' |')].join('\n')
}

/**
 * GeasExport를 Markdown 문자열과 이미지 바이트 목록으로 만든다.
 *
 * README §8은 시작 설정·페르소나를 `## 시작 설정` 한 절로만 말하지만,
 * 두 값의 성격이 달라 `## 시작 설정` / `## 유저 페르소나` 두 절로 나눠 쓴다.
 *
 * @param {object} exp GeasExport
 * @returns {{ markdown: string, images: Array<{ path: string, bytes: Uint8Array }> }}
 */
export function buildMarkdown(exp) {
  const src = (exp && exp.source) || {}
  const meta = (exp && exp.meta) || {}
  const turns = Array.isArray(exp && exp.turns) ? exp.turns : []

  const parts = []
  parts.push('# ' + (src.title || src.chatId || '무제 대화'))
  parts.push('')
  parts.push(metaTable(exp))

  if (meta.startSetting) {
    parts.push('')
    parts.push('## 시작 설정')
    parts.push('')
    parts.push(meta.startSetting)
  }
  if (meta.persona) {
    parts.push('')
    parts.push('## 유저 페르소나')
    parts.push('')
    parts.push(meta.persona)
  }

  const images = []
  const seenPaths = new Set()

  turns.forEach((turn, i) => {
    const turnImages = Array.isArray(turn.images) ? turn.images : []

    // 같은 자산을 여러 턴이 공유하면 파일은 한 번만 쓴다(경로가 같으므로 자연히 걸러진다).
    for (const img of turnImages) {
      if (!isEmbedded(exp, img)) continue
      const path = imagePath(exp, img)
      if (seenPaths.has(path)) continue
      const bytes = dataUriToBytes(imageDataUri(exp, img))
      if (!bytes) continue
      seenPaths.add(path)
      images.push({ path, bytes })
    }

    // 턴 사이(그리고 헤더와 첫 턴 사이) 구분선
    parts.push('')
    parts.push('---')
    parts.push('')

    const speaker = turn.speaker || turn.role || ''
    parts.push('**' + speaker + '**' + (turn.createdAt ? ' · ' + turn.createdAt : ''))
    parts.push('')

    const { text, usedIds } = rewriteImageRefs(exp, turn.text || '', turnImages)
    if (text) parts.push(text)

    const leftovers = turnImages.filter((img) => !usedIds.has(img.id))
    if (leftovers.length) {
      parts.push('')
      for (const img of leftovers) {
        parts.push(imageRef(exp, img, null))
      }
    }
  })

  const markdown = parts.join('\n').replace(/\n{4,}/g, '\n\n\n') + '\n'
  return { markdown, images }
}

/**
 * `chat.md` + `images/<assetId>.<ext>` + `export.json`을 담은 store-only zip.
 * 서로 다른 자산 하나당 파일 하나. 같은 그림을 쓰는 턴들은 같은 경로를 가리킨다.
 * @param {object} exp GeasExport
 * @returns {Uint8Array}
 */
export function buildMarkdownZip(exp) {
  const { markdown, images } = buildMarkdown(exp)
  const entries = [{ name: 'chat.md', data: markdown }]
  for (const img of images) entries.push({ name: img.path, data: img.bytes })
  entries.push({ name: 'export.json', data: JSON.stringify(exp, null, 2) })
  return createZip(entries)
}
