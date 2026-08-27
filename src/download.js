// Blob 저장 (README §10)

/**
 * Blob을 파일로 저장한다. <a download> 클릭 방식.
 * @param {string} fileName
 * @param {Blob} blob
 */
export function downloadBlob (fileName, blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  // 클릭 직후 removeChild는 안전하지만 revoke는 저장이 시작될 시간을 준다.
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * HTML 문자열을 저장용 Blob으로.
 * @param {string} html
 * @returns {Blob}
 */
export function htmlBlob (html) {
  return new Blob([html], { type: 'text/html;charset=utf-8' })
}
