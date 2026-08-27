/**
 * GeasExport 스키마 · 생성 / 검증 / 정규화 (README §2)
 *
 * 순수 ES2020. 브라우저와 Node 22 양쪽에서 동작한다. 외부 의존 0.
 *
 * 이미지 바이트는 턴이 아니라 export 최상위 `assets`에 한 번씩만 담는다.
 * 같은 캐릭터 카드 이미지가 수십 턴에 반복되는 게 흔하고 한 장이 수백 KB라, 턴마다
 * 넣으면 파일이 그만큼 부푼다.
 *
 *   assets: { [assetId: string]: { mime: string, dataUri: string, originalUrl: string } }
 *   TurnImage: {
 *     id, alt, mime, originalUrl, status: 'embedded' | 'failed',
 *     dataUri: string | null,   // 신버전은 항상 null. 구버전 export는 여기에 바이트가 있다
 *     assetId: string | null,   // 'asset_<n>'. status가 embedded가 아니면 null
 *     error?: string
 *   }
 *
 * 그림은 언제나 파일 안에 넣는다. 받지 못한 그림만 failed로 남는다.
 *
 * 바이트/mime을 읽을 때는 두 형태를 모두 처리하는 `imageDataUri(exp, img)` ·
 * `imageMime(exp, img)`를 쓴다. `img.dataUri`를 직접 읽지 않는다.
 */

export const SCHEMA_VERSION = 1

/** 허용 플랫폼 id */
export const PLATFORMS = ['genit', 'luna']

/**
 * 대화를 어떻게 가져왔는가.
 * - `api`    플랫폼 API에서 원문을 그대로 받았다(젠잇 북마클릿의 API 버전).
 * - `paste`  유저가 화면에서 복사해 붙여 넣은 것을 파싱했다(루나톡, README §5.1).
 *            그림·굵게·기울임 같은 서식·작성 시각이 없을 수 있다.
 * - `screen` 화면에 그려져 있던 것을 북마클릿이 그대로 읽었다(젠잇 화면 읽기 버전, README §5.4).
 *            화면에 불러와진 메시지만 담기고 작성 시각은 없다.
 *
 * 선택 항목이다. 없으면 `api`로 본다(이 값이 생기기 전에 만든 파일).
 */
export const CAPTURES = ['api', 'paste', 'screen']

const DEFAULT_CAPTURE = 'api'

/**
 * 붙여넣기(`capture: 'paste'`)일 때, 유저가 붙여 넣은 것이 무엇이었나.
 * - `html`     루나톡 페이지 전체 복사본. 화자·순서·서식·그림이 정확하다.
 * - `fragment` 메시지 하나만 복사된 조각. 서식·그림은 있지만 그 메시지 하나뿐이다.
 * - `text`     평문만. 서식도 그림도 없다.
 *
 * 선택 항목이다. 없으면 모르는 것으로 둔다(이 값이 생기기 전에 만든 파일).
 * 뷰어는 이 값으로 안내 문구를 고른다(README §7).
 */
export const PASTE_KINDS = ['html', 'fragment', 'text']

/** 허용 role */
export const ROLES = ['user', 'assistant', 'system']

const DEFAULT_BOT_NAME = 'Geas'

/** role별 화자 기본 표시 이름 */
const DEFAULT_SPEAKER = {
  user: '나',
  assistant: DEFAULT_BOT_NAME,
  system: '시스템',
}

/** 윈도 파일명 금지 문자 + 제어문자 */
// eslint-disable-next-line no-control-regex
const FORBIDDEN_FILENAME_CHARS = /[<>:"/\\|?*]/g

/**
 * 문자열 길이를 UTF-16 코드 유닛 기준으로 센다.
 * 길이 비교 기준이 UTF-16이라는 점을 드러내려고 래핑해 둔다.
 * @param {string} str
 * @returns {number}
 */
export function toUtf16Length(str) {
  return typeof str === 'string' ? str.length : String(str ?? '').length
}

function str(v, fallback = '') {
  if (typeof v === 'string') return v
  if (v == null) return fallback
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return fallback
}

function nullableStr(v) {
  if (typeof v === 'string') return v
  return null
}

function isIsoLike(v) {
  return typeof v === 'string' && !Number.isNaN(Date.parse(v))
}

/**
 * 이미지 항목 정규화. 어댑터 중간 형식({ url, alt })과 최종 형식 양쪽을 받는다.
 * dataUri는 이 시점에 그대로 두고, createExport가 나중에 `assets`로 빼낸다.
 * @param {any} raw
 * @param {string} id
 */
function normalizeImage(raw, id) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const originalUrl = str(src.originalUrl !== undefined ? src.originalUrl : src.url, '')
  const dataUri = nullableStr(src.dataUri)
  const explicitStatus = src.status === 'embedded' || src.status === 'failed' ? src.status : null
  const status = explicitStatus || (dataUri ? 'embedded' : 'failed')
  const out = {
    id,
    alt: str(src.alt, ''),
    mime: str(src.mime, 'image/png'),
    dataUri: status === 'embedded' ? dataUri : null,
    assetId: null,
    originalUrl,
    status,
  }
  if (status === 'failed') {
    const err = str(src.error, '')
    out.error = err || '내장 실패'
  }
  return out
}

/**
 * 어댑터 결과(CollectResult) 또는 부분적인 GeasExport를 최종 GeasExport로 만든다.
 * - 누락 필드에 기본값을 채운다
 * - turn.index를 0부터 다시 부여한다
 * - 이미지 id를 export 전체에서 유일한 `img_<n>`으로 다시 부여한다
 * - 같은 dataUri를 쓰는 이미지를 `exp.assets`로 합친다(§2 자산 중복 제거)
 *
 * turn은 `images`(최종 형식) 또는 `imageUrls`(RawTurn, README §5) 어느 쪽이든 받는다.
 * README에 `finalizeExport()`라는 이름이 언급되지만 export 목록(§2)에는 `createExport`만
 * 있으므로 이 함수가 그 역할을 겸한다.
 *
 * @param {{ source?: any, meta?: any, turns?: any[] }} input
 * @returns {object} GeasExport
 */
export function createExport({ source, meta, turns } = {}) {
  const src = source && typeof source === 'object' ? source : {}
  const mt = meta && typeof meta === 'object' ? meta : {}
  const list = Array.isArray(turns) ? turns : []

  let imageSeq = 0
  const outTurns = list.map((rawTurn, i) => {
    const t = rawTurn && typeof rawTurn === 'object' ? rawTurn : {}
    const role = ROLES.includes(t.role) ? t.role : 'assistant'
    const rawImages = Array.isArray(t.images)
      ? t.images
      : Array.isArray(t.imageUrls)
        ? t.imageUrls
        : []
    return {
      index: i,
      role,
      speaker: str(t.speaker, '') || DEFAULT_SPEAKER[role],
      text: str(t.text, ''),
      createdAt: isIsoLike(t.createdAt) ? t.createdAt : null,
      images: rawImages.map((img) => normalizeImage(img, `img_${imageSeq++}`)),
    }
  })

  // 같은 이미지가 여러 턴에 반복해서 붙는 일이 흔하다(캐릭터 카드 등). 한 장당 한 번만 담는다.
  // 한 번만 쓰이는 이미지도 똑같이 assets로 보낸다 — 모든 내장 이미지가 같은 모양을 갖도록.
  const assets = {}
  const assetIdByDataUri = new Map()
  let assetSeq = 0
  for (const turn of outTurns) {
    for (const img of turn.images) {
      if (img.status !== 'embedded' || typeof img.dataUri !== 'string' || img.dataUri === '') continue
      let assetId = assetIdByDataUri.get(img.dataUri)
      if (assetId === undefined) {
        assetId = `asset_${assetSeq++}`
        assetIdByDataUri.set(img.dataUri, assetId)
        assets[assetId] = { mime: img.mime, dataUri: img.dataUri, originalUrl: img.originalUrl }
      }
      img.assetId = assetId
      img.dataUri = null
    }
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    source: {
      platform: PLATFORMS.includes(src.platform) ? src.platform : str(src.platform, ''),
      chatId: str(src.chatId, ''),
      title: str(src.title, ''),
      botName: str(src.botName, '') || DEFAULT_BOT_NAME,
      exportedAt: isIsoLike(src.exportedAt) ? src.exportedAt : new Date().toISOString(),
      url: str(src.url, ''),
      capture: CAPTURES.includes(src.capture) ? src.capture : DEFAULT_CAPTURE,
      // 아는 값일 때만 싣는다. 모르는 값을 빈 문자열로 눌러 담지 않는다.
      ...(PASTE_KINDS.includes(src.pasteKind) ? { pasteKind: src.pasteKind } : {}),
    },
    meta: {
      startSetting: nullableStr(mt.startSetting),
      persona: nullableStr(mt.persona),
    },
    assets,
    turns: outTurns,
  }
}

/**
 * 이 export를 어떻게 가져왔는지(`api` | `paste` | `screen`). 값이 없거나 모르는 값이면 `api`.
 * 뷰어는 이 값으로 안내 문구와 플랫폼 칩을 바꾼다(README §7).
 * @param {object} exp GeasExport
 * @returns {'api' | 'paste' | 'screen'}
 */
export function captureKind(exp) {
  const capture = exp && exp.source ? exp.source.capture : null
  return CAPTURES.includes(capture) ? capture : DEFAULT_CAPTURE
}

/**
 * 붙여넣기로 만든 파일이라면 무엇을 붙여 넣었는지(`html` | `fragment` | `text`).
 * 붙여넣기가 아니거나 모르는 값이면 null.
 * @param {object} exp GeasExport
 * @returns {'html' | 'fragment' | 'text' | null}
 */
export function pasteKind(exp) {
  if (captureKind(exp) !== 'paste') return null
  const kind = exp && exp.source ? exp.source.pasteKind : null
  return PASTE_KINDS.includes(kind) ? kind : null
}

/**
 * TurnImage의 실제 바이트(data URI)를 찾아 준다.
 * 인라인 `dataUri`(구버전 export)가 있으면 그것을, 없으면 `exp.assets[assetId]`를 본다.
 * @param {object} exp GeasExport
 * @param {object} img TurnImage
 * @returns {string | null}
 */
export function imageDataUri(exp, img) {
  if (!img || typeof img !== 'object') return null
  if (typeof img.dataUri === 'string' && img.dataUri !== '') return img.dataUri
  const asset = imageAsset(exp, img)
  return asset && typeof asset.dataUri === 'string' && asset.dataUri !== '' ? asset.dataUri : null
}

/**
 * TurnImage의 mime. TurnImage에 있는 값이 우선, 없으면 자산의 mime.
 * @param {object} exp GeasExport
 * @param {object} img TurnImage
 * @returns {string | null}
 */
export function imageMime(exp, img) {
  if (!img || typeof img !== 'object') return null
  if (typeof img.mime === 'string' && img.mime !== '') return img.mime
  const asset = imageAsset(exp, img)
  return asset && typeof asset.mime === 'string' && asset.mime !== '' ? asset.mime : null
}

function imageAsset(exp, img) {
  const assets = exp && typeof exp === 'object' ? exp.assets : null
  if (!assets || typeof assets !== 'object') return null
  const id = img && img.assetId
  if (typeof id !== 'string' || id === '') return null
  const asset = assets[id]
  return asset && typeof asset === 'object' ? asset : null
}

/**
 * GeasExport 구조 검증.
 * @param {any} obj
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateExport(obj) {
  const errors = []
  const push = (m) => errors.push(m)

  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, errors: ['export가 객체가 아닙니다'] }
  }
  if (obj.schemaVersion !== SCHEMA_VERSION) {
    push(`schemaVersion이 ${SCHEMA_VERSION}이 아닙니다 (받은 값: ${JSON.stringify(obj.schemaVersion)})`)
  }

  const s = obj.source
  if (!s || typeof s !== 'object') {
    push('source가 없습니다')
  } else {
    if (!PLATFORMS.includes(s.platform)) push(`source.platform이 올바르지 않습니다: ${JSON.stringify(s.platform)}`)
    for (const k of ['chatId', 'title', 'botName', 'url']) {
      if (typeof s[k] !== 'string') push(`source.${k}가 문자열이 아닙니다`)
    }
    if (!isIsoLike(s.exportedAt)) push('source.exportedAt이 ISO 8601 문자열이 아닙니다')
    // capture는 선택 항목이다. 없으면 api로 본다. 있으면 아는 값이어야 한다.
    if (s.capture !== undefined && !CAPTURES.includes(s.capture)) {
      push(`source.capture가 올바르지 않습니다: ${JSON.stringify(s.capture)}`)
    }
    // pasteKind도 선택 항목이다. 있으면 아는 값이어야 한다.
    if (s.pasteKind !== undefined && !PASTE_KINDS.includes(s.pasteKind)) {
      push(`source.pasteKind가 올바르지 않습니다: ${JSON.stringify(s.pasteKind)}`)
    }
  }

  const m = obj.meta
  if (!m || typeof m !== 'object') {
    push('meta가 없습니다')
  } else {
    for (const k of ['startSetting', 'persona']) {
      if (!(m[k] === null || typeof m[k] === 'string')) push(`meta.${k}는 문자열 또는 null이어야 합니다`)
    }
  }

  // assets는 선택 항목이다. 구버전 export(인라인 dataUri만 있는 것)도 계속 통과시킨다.
  const assets = obj.assets
  const hasAssets = assets !== undefined && assets !== null
  if (hasAssets && (typeof assets !== 'object' || Array.isArray(assets))) {
    push('assets가 객체가 아닙니다')
  } else if (hasAssets) {
    for (const [assetId, asset] of Object.entries(assets)) {
      const aa = `assets[${JSON.stringify(assetId)}]`
      if (!asset || typeof asset !== 'object' || Array.isArray(asset)) {
        push(`${aa}가 객체가 아닙니다`)
        continue
      }
      if (typeof asset.mime !== 'string' || asset.mime === '') push(`${aa}.mime이 비어 있습니다`)
      if (typeof asset.dataUri !== 'string' || asset.dataUri === '') push(`${aa}.dataUri가 비어 있습니다`)
    }
  }
  const assetTable = hasAssets && typeof assets === 'object' && !Array.isArray(assets) ? assets : {}

  if (!Array.isArray(obj.turns)) {
    push('turns가 배열이 아닙니다')
    return { ok: errors.length === 0, errors }
  }

  const seenImageIds = new Set()
  obj.turns.forEach((t, i) => {
    const at = `turns[${i}]`
    if (!t || typeof t !== 'object') {
      push(`${at}가 객체가 아닙니다`)
      return
    }
    if (t.index !== i) push(`${at}.index가 배열 순서와 다릅니다 (${JSON.stringify(t.index)} ≠ ${i})`)
    if (!ROLES.includes(t.role)) push(`${at}.role이 올바르지 않습니다: ${JSON.stringify(t.role)}`)
    if (typeof t.speaker !== 'string' || t.speaker === '') push(`${at}.speaker가 비어 있습니다`)
    if (typeof t.text !== 'string') push(`${at}.text가 문자열이 아닙니다`)
    if (!(t.createdAt === null || isIsoLike(t.createdAt))) push(`${at}.createdAt이 ISO 8601 문자열 또는 null이 아닙니다`)
    if (!Array.isArray(t.images)) {
      push(`${at}.images가 배열이 아닙니다`)
      return
    }
    t.images.forEach((img, j) => {
      const ia = `${at}.images[${j}]`
      if (!img || typeof img !== 'object') {
        push(`${ia}가 객체가 아닙니다`)
        return
      }
      if (typeof img.id !== 'string' || img.id === '') push(`${ia}.id가 비어 있습니다`)
      else if (seenImageIds.has(img.id)) push(`${ia}.id가 중복입니다: ${img.id}`)
      else seenImageIds.add(img.id)
      if (typeof img.alt !== 'string') push(`${ia}.alt가 문자열이 아닙니다`)
      if (typeof img.mime !== 'string') push(`${ia}.mime이 문자열이 아닙니다`)
      else if (img.mime === '') push(`${ia}.mime이 비어 있습니다`)
      if (typeof img.originalUrl !== 'string') push(`${ia}.originalUrl이 문자열이 아닙니다`)
      if (img.status !== 'embedded' && img.status !== 'failed') {
        push(`${ia}.status가 올바르지 않습니다: ${JSON.stringify(img.status)}`)
      }
      if (!(img.assetId === undefined || img.assetId === null || typeof img.assetId === 'string')) {
        push(`${ia}.assetId가 문자열 또는 null이 아닙니다`)
      }
      if (img.status === 'embedded') {
        // 바이트는 인라인 dataUri(구버전) 또는 assets 참조(신버전) 둘 중 하나로 있어야 한다.
        const inline = typeof img.dataUri === 'string' && img.dataUri !== ''
        if (typeof img.assetId === 'string' && img.assetId !== '') {
          if (!Object.prototype.hasOwnProperty.call(assetTable, img.assetId)) {
            push(`${ia}.assetId가 assets에 없습니다: ${img.assetId}`)
          }
        } else if (!inline) {
          push(`${ia}.status가 embedded인데 dataUri가 없습니다`)
        }
      }
      if (img.status === 'failed') {
        if (img.dataUri !== null) push(`${ia}.status가 failed인데 dataUri가 null이 아닙니다`)
        if (typeof img.assetId === 'string' && img.assetId !== '') push(`${ia}.status가 failed인데 assetId가 있습니다`)
      }
    })
  })

  return { ok: errors.length === 0, errors }
}

/**
 * 파일명 안전화: 윈도 금지문자·제어문자 제거, 공백류는 `_`로, 앞뒤 점·공백 제거.
 * @param {string} s
 * @returns {string}
 */
function stripControlChars(s) {
  let out = ''
  for (const ch of String(s ?? '')) {
    const code = ch.codePointAt(0)
    if (code < 32 || code === 127) continue
    out += ch
  }
  return out
}

function sanitizeFileNamePart(s) {
  return stripControlChars(s)
    .replace(FORBIDDEN_FILENAME_CHARS, '')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[._]+|[._\s]+$/g, '')
}

function yyyymmddLocal(iso) {
  const d = iso ? new Date(iso) : new Date()
  const dt = Number.isNaN(d.getTime()) ? new Date() : d
  const p = (n) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}${p(dt.getMonth() + 1)}${p(dt.getDate())}`
}

/**
 * `Geas_{platform}_{title|chatId}_{YYYYMMDD}.{ext}` 형식 파일명.
 * 날짜는 exportedAt을 로컬 시간으로 해석한다.
 * title도 chatId도 비어 있으면 `chat`을 쓴다(README 미규정 — 이중 밑줄 방지).
 *
 * @param {object} exp GeasExport
 * @param {string} ext 확장자(앞의 점은 있어도 되고 없어도 된다)
 * @returns {string}
 */
export function exportFileName(exp, ext) {
  const source = (exp && exp.source) || {}
  const platform = sanitizeFileNamePart(source.platform) || 'unknown'
  const label = sanitizeFileNamePart(source.title) || sanitizeFileNamePart(source.chatId) || 'chat'
  const capped = sanitizeFileNamePart(label.slice(0, 60)) || 'chat'
  const date = yyyymmddLocal(source.exportedAt)
  const cleanExt = sanitizeFileNamePart(String(ext ?? '').replace(/^\.+/, '')) || 'txt'
  return `Geas_${platform}_${capped}_${date}.${cleanExt}`
}
