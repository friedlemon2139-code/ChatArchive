// 붙여넣기 저장 페이지 엔트리 — 루나톡 (README §5.1, §11-5)
//
// `site/export/luna.html` 이 `<script src="paste-page-luna.js">` 로 불러간다.
// 흐름은 전부 `paste-page-core.js`에 있고, 이 파일은 **어느 파서를 싣는가**만 정한다 —
// 루나톡 파서 하나뿐이라 젠잇 파서는 이 번들에 들어오지 않는다.

import { start } from './paste-page-core.js'
import { parseLunaClipboard } from './luna-paste.js'

start({ luna: parseLunaClipboard })

export { start }
