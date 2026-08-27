// 이미지 내장 (README §6)
//
// 플랫폼 이미지 URL을 유저 세션으로 받아 data URI로 바꾼다.
// 원칙: 하나가 실패해도 전체를 멈추지 않는다. 실패는 { error }로 기록하고 진행.

// 내장 포맷 정책:
//   PNG 결과가 이 크기 이하면 PNG 그대로 둔다(작은 그림·픽셀 그림은 무손실이 낫다).
//   넘으면 WebP 0.85로 내장하고, 브라우저가 WebP 인코딩을 못 하면 JPEG 0.85로 떨어진다.
// 실측: Geas 원본은 1216² 무손실 webp라 PNG로는 장당 ~4MB다.
const DEFAULT_MAX_BYTES = 600 * 1024
const LOSSY_QUALITY = 0.85

/** data URI의 실제 바이트 수(대략). base64 길이에서 역산한다. */
function dataUriBytes (dataUri) {
  const comma = dataUri.indexOf(',')
  if (comma < 0) return 0
  const body = dataUri.length - comma - 1
  let pad = 0
  if (dataUri.endsWith('==')) pad = 2
  else if (dataUri.endsWith('=')) pad = 1
  return Math.floor((body * 3) / 4) - pad
}

function isAbortError (err) {
  return !!err && (err.name === 'AbortError' || err.code === 20)
}

/** Blob → data URI (FileReader). Canvas를 거치지 않는 원본 그대로의 경로. */
function blobToDataUri (blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('파일 읽기 실패'))
    reader.readAsDataURL(blob)
  })
}

/** Blob → ImageBitmap. createImageBitmap이 없거나 실패하면 <img>로 폴백. */
async function decodeBlob (blob) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob)
    } catch (err) {
      // 포맷 미지원 등. <img> 경로로 폴백.
    }
  }
  const url = URL.createObjectURL(blob)
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('이미지 디코드 실패'))
      el.src = url
    })
    // blob: URL은 동일 출처라 canvas를 오염시키지 않는다.
    return img
  } finally {
    // 그리기가 끝난 뒤 revoke해야 안전하므로 살짝 늦춘다.
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }
}

function drawToCanvas (source) {
  const w = source.width || source.naturalWidth
  const h = source.height || source.naturalHeight
  if (!w || !h) throw new Error('이미지 크기를 알 수 없음')
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d 컨텍스트 없음')
  ctx.drawImage(source, 0, 0, w, h)
  return canvas
}

/**
 * 이미지 하나를 data URI로 내장한다.
 *
 * PNG가 `maxBytes` 이하면 PNG, 넘으면 WebP 0.85, WebP 인코딩이 안 되면 JPEG 0.85.
 * `preferJpeg`은 "PNG 시도를 건너뛴다"는 뜻으로 남겨 둔다(이름은 호출 호환을 위해 유지).
 *
 * @param {string} url 절대 URL
 * @param {{ signal?: AbortSignal, preferJpeg?: boolean, maxBytes?: number }} opts
 * @returns {Promise<{ mime: string, dataUri: string }>} 실패 시 throw
 */
export async function embedImage (url, opts = {}) {
  const { signal, preferJpeg = false, maxBytes = DEFAULT_MAX_BYTES } = opts

  // 같은 출처는 쿠키를 붙인다(플랫폼 내부 업로드). 교차 출처는 쿠키 없이 먼저 시도한다 —
  // `Access-Control-Allow-Origin: *`인 호스트(pages.dev 등)는 credentials가 붙으면 거부하기 때문이다.
  // 그래도 실패하면 쿠키를 붙여 한 번 더 시도한다.
  let sameOrigin = false
  try { sameOrigin = new URL(url, location.href).origin === location.origin } catch (err) { /* data: 등 */ }
  const attempts = sameOrigin ? ['include'] : ['omit', 'include']
  let res = null
  let lastErr = null
  for (const credentials of attempts) {
    try {
      res = await fetch(url, { credentials, signal })
      break
    } catch (err) {
      if (isAbortError(err)) throw err
      lastErr = err
    }
  }
  if (!res) {
    // fetch 자체의 TypeError는 대개 CORS 차단 또는 네트워크 실패다.
    throw new Error('가져오기 실패(CORS 차단 또는 네트워크): ' + ((lastErr && lastErr.message) || lastErr))
  }
  if (!res.ok) throw new Error('HTTP ' + res.status)
  const blob = await res.blob()
  if (!blob.size) throw new Error('빈 응답')

  const originalMime = (blob.type || '').split(';')[0].toLowerCase()
  const passthroughOk = originalMime === 'image/png' || originalMime === 'image/jpeg'

  let source = null
  try {
    source = await decodeBlob(blob)
  } catch (err) {
    if (isAbortError(err)) throw err
    // 디코드 자체가 안 되면 원본이 범용 포맷일 때만 그대로 넣는다.
    if (passthroughOk) {
      const dataUri = await blobToDataUri(blob)
      return { mime: originalMime, dataUri }
    }
    throw err
  }

  try {
    const canvas = drawToCanvas(source)

    if (!preferJpeg) {
      // toDataURL은 canvas가 오염됐으면 SecurityError를 던진다.
      const png = canvas.toDataURL('image/png')
      if (dataUriBytes(png) <= maxBytes) return { mime: 'image/png', dataUri: png }
    }
    // WebP 인코딩을 못 하는 브라우저는 요청을 무시하고 PNG를 돌려준다. 접두사로 확인한다.
    const webp = canvas.toDataURL('image/webp', LOSSY_QUALITY)
    if (webp.startsWith('data:image/webp')) return { mime: 'image/webp', dataUri: webp }
    const jpeg = canvas.toDataURL('image/jpeg', LOSSY_QUALITY)
    if (!jpeg.startsWith('data:image/jpeg')) throw new Error('jpeg 변환 실패')
    return { mime: 'image/jpeg', dataUri: jpeg }
  } catch (err) {
    if (isAbortError(err)) throw err
    // canvas tainted(cross-origin 미허용) 등. 원본이 png/jpeg면 그대로 내장.
    if (passthroughOk) {
      const dataUri = await blobToDataUri(blob)
      return { mime: originalMime, dataUri }
    }
    throw err
  } finally {
    if (source && typeof source.close === 'function') source.close()
  }
}

/** turns에서 이미지 URL을 중복 없이 뽑는다. */
function collectUrls (turns) {
  const urls = []
  const seen = new Set()
  for (const turn of turns || []) {
    for (const item of (turn && turn.imageUrls) || []) {
      const url = item && item.url
      if (!url || seen.has(url)) continue
      seen.add(url)
      urls.push(url)
    }
  }
  return urls
}

/**
 * 턴 전체의 이미지를 내장한다. 같은 URL은 한 번만 받는다.
 * @param {Array} turns RawTurn[]
 * @param {{ signal?: AbortSignal, onProgress?: (msg: string, ratio?: number) => void, concurrency?: number }} opts
 * @returns {Promise<Map<string, { mime: string, dataUri: string } | { error: string }>>}
 */
export async function embedAll (turns, opts = {}) {
  const { signal, onProgress, concurrency = 3 } = opts
  const urls = collectUrls(turns)
  const result = new Map()
  const total = urls.length
  const report = (done) => {
    if (typeof onProgress === 'function') {
      onProgress('이미지 내장 ' + done + '/' + total, total ? done / total : 1)
    }
  }

  report(0)
  if (!total) return result

  let cursor = 0
  let done = 0
  const workers = new Array(Math.max(1, Math.min(concurrency, total))).fill(null).map(async () => {
    for (;;) {
      if (signal && signal.aborted) throw new DOMException('중단됨', 'AbortError')
      const i = cursor++
      if (i >= total) return
      const url = urls[i]
      try {
        result.set(url, await embedImage(url, { signal }))
      } catch (err) {
        if (isAbortError(err)) throw err
        result.set(url, { error: (err && err.message) || String(err) })
      }
      report(++done)
    }
  })

  await Promise.all(workers)
  return result
}

/**
 * RawTurn[] + 내장 결과 → 최종 turns(이미지 id는 createExport가 붙인다).
 * 북마클릿과 붙여넣기 페이지가 함께 쓴다.
 *
 * @param {Array} rawTurns RawTurn[]
 * @param {Map<string, { mime: string, dataUri: string } | { error: string }>} embedded embedAll 결과
 * @returns {Array}
 */
export function attachImages (rawTurns, embedded) {
  return (rawTurns || []).map((turn) => {
    const images = []
    for (const item of (turn && turn.imageUrls) || []) {
      const url = item && item.url
      if (!url) continue
      const result = embedded && embedded.get ? embedded.get(url) : null
      if (result && result.dataUri) {
        images.push({
          alt: (item.alt || ''),
          mime: result.mime,
          dataUri: result.dataUri,
          originalUrl: url,
          status: 'embedded'
        })
      } else {
        // mime은 넣지 않는다. 받아보지 못한 이미지의 형식을 지어내지 않고,
        // schema.js의 기본값에 맡긴다(스키마는 빈 mime을 허용하지 않는다).
        images.push({
          alt: (item.alt || ''),
          dataUri: null,
          originalUrl: url,
          status: 'failed',
          error: (result && result.error) || '내장하지 못했습니다.'
        })
      }
    }
    return {
      role: turn.role,
      speaker: turn.speaker,
      text: turn.text,
      createdAt: turn.createdAt == null ? null : turn.createdAt,
      images
    }
  })
}

/**
 * 최종 turns에서 이미지 내장 수·고유 수와 실패 목록(URL 중복 제거)을 센다.
 * 고유 수는 실제로 파일에 담긴 서로 다른 자산의 수다(같은 그림이 여러 턴에 나와도 하나).
 *
 * @param {Array} turns createExport를 거친 turns
 * @returns {{ ok: number, unique: number, failed: Array<{ url: string, error?: string }> }}
 */
export function summarizeImages (turns) {
  let ok = 0
  const assets = new Set()
  const failed = []
  const seen = new Set()
  for (const turn of turns || []) {
    for (const img of (turn && turn.images) || []) {
      if (img.status === 'embedded') {
        ok++
        if (img.assetId) assets.add(img.assetId)
      } else if (!seen.has(img.originalUrl)) {
        seen.add(img.originalUrl)
        failed.push({ url: img.originalUrl, error: img.error })
      }
    }
  }
  return { ok, unique: assets.size, failed }
}

/** 내장해야 할 서로 다른 그림 주소의 수. 진행 표시에 쓴다. */
export function countUniqueImageUrls (turns) {
  return collectUrls(turns).length
}
