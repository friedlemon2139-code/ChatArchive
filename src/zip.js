/**
 * store-only zip 작성기 (README §4)
 *
 * 압축 없음(method 0 = store). CRC32 직접 구현. 파일명 UTF-8 플래그(bit 11).
 * 로컬 헤더 + 중앙 디렉터리 + EOCD. 외부 의존 0.
 */

const LOCAL_SIG = 0x04034b50
const CENTRAL_SIG = 0x02014b50
const EOCD_SIG = 0x06054b50

const LOCAL_HEADER_SIZE = 30
const CENTRAL_HEADER_SIZE = 46
const EOCD_SIZE = 22

/** 파일명 UTF-8 플래그 (general purpose bit 11) */
const FLAG_UTF8 = 0x0800

/** zip 스펙의 "MS-DOS" 버전. 2.0 = 20 */
const VERSION_NEEDED = 20

let CRC_TABLE = null

function crcTable() {
  if (CRC_TABLE) return CRC_TABLE
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  CRC_TABLE = table
  return table
}

/**
 * CRC-32 (IEEE 802.3, zip/gzip과 같은 다항식).
 * @param {Uint8Array} bytes
 * @returns {number} 부호 없는 32비트
 */
export function crc32(bytes) {
  const table = crcTable()
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    c = table[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

const encoder = new TextEncoder()

function toBytes(data) {
  if (data instanceof Uint8Array) return data
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  return encoder.encode(String(data ?? ''))
}

/** zip 안의 경로는 항상 `/` 구분자, 선행 `/`와 드라이브 표기는 제거 */
function normalizeName(name) {
  return String(name ?? '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
}

/** JS Date → DOS 날짜/시간 한 쌍 */
function dosDateTime(d) {
  const year = d.getFullYear()
  const safeYear = year < 1980 ? 1980 : year
  const time = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((d.getSeconds() >> 1) & 0x1f)
  const date = (((safeYear - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0x0f) << 5) | (d.getDate() & 0x1f)
  return { time, date }
}

/**
 * store-only zip을 만든다.
 *
 * @param {Array<{ name: string, data: Uint8Array | string }>} entries
 *   문자열 data는 UTF-8로 인코딩한다. 날짜/시간은 현재 시각(DOS 형식).
 * @returns {Uint8Array} zip 바이트
 */
export function createZip(entries) {
  const list = Array.isArray(entries) ? entries : []
  const stamp = dosDateTime(new Date())

  const prepared = list.map((e) => {
    const src = e && typeof e === 'object' ? e : {}
    const nameBytes = encoder.encode(normalizeName(src.name))
    const data = toBytes(src.data)
    return { nameBytes, data, crc: crc32(data), offset: 0 }
  })

  let total = 0
  for (const p of prepared) {
    p.offset = total
    total += LOCAL_HEADER_SIZE + p.nameBytes.length + p.data.length
  }
  const centralStart = total
  let centralSize = 0
  for (const p of prepared) {
    centralSize += CENTRAL_HEADER_SIZE + p.nameBytes.length
  }
  total += centralSize + EOCD_SIZE

  const out = new Uint8Array(total)
  const view = new DataView(out.buffer)
  let pos = 0

  const u16 = (v) => {
    view.setUint16(pos, v & 0xffff, true)
    pos += 2
  }
  const u32 = (v) => {
    view.setUint32(pos, v >>> 0, true)
    pos += 4
  }
  const raw = (bytes) => {
    out.set(bytes, pos)
    pos += bytes.length
  }

  // 로컬 파일 헤더 + 데이터
  for (const p of prepared) {
    u32(LOCAL_SIG)
    u16(VERSION_NEEDED)
    u16(FLAG_UTF8)
    u16(0) // method: store
    u16(stamp.time)
    u16(stamp.date)
    u32(p.crc)
    u32(p.data.length) // compressed size
    u32(p.data.length) // uncompressed size
    u16(p.nameBytes.length)
    u16(0) // extra field length
    raw(p.nameBytes)
    raw(p.data)
  }

  // 중앙 디렉터리
  for (const p of prepared) {
    u32(CENTRAL_SIG)
    u16(VERSION_NEEDED) // version made by
    u16(VERSION_NEEDED) // version needed
    u16(FLAG_UTF8)
    u16(0) // method: store
    u16(stamp.time)
    u16(stamp.date)
    u32(p.crc)
    u32(p.data.length)
    u32(p.data.length)
    u16(p.nameBytes.length)
    u16(0) // extra
    u16(0) // comment
    u16(0) // disk number start
    u16(0) // internal attrs
    u32(0) // external attrs
    u32(p.offset)
    raw(p.nameBytes)
  }

  // EOCD
  u32(EOCD_SIG)
  u16(0) // this disk
  u16(0) // disk with central dir
  u16(prepared.length)
  u16(prepared.length)
  u32(centralSize)
  u32(centralStart)
  u16(0) // comment length

  return out
}
