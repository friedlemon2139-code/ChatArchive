// 대화 저장 도구 — 빌드 산출물. 원본: src/
(() => {
  var __defProp = Object.defineProperty;
  var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

  // generated/viewer.readable.txt
  var viewer_readable_default = `// 대화 저장 도구 — 빌드 산출물. 원본: src/
(() => {
  var __defProp = Object.defineProperty;
  var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

  // src/markdown.js
  var MARK = String.fromCharCode(0);
  var RESTORE_RE = new RegExp(MARK + "(\\\\d+)" + MARK, "g");
  var LINK_PROTOCOL_RE = /^https?:\\/\\//i;
  var IMG_ALLOWED_RE = /^(https?:\\/\\/|data:image\\/|blob:)/i;
  var HAS_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;
  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  __name(escapeHtml, "escapeHtml");
  function unescapeHtml(s) {
    return String(s).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
  }
  __name(unescapeHtml, "unescapeHtml");
  function isSafeImgSrc(url) {
    if (IMG_ALLOWED_RE.test(url)) return true;
    return !HAS_SCHEME_RE.test(url);
  }
  __name(isSafeImgSrc, "isSafeImgSrc");
  function imageHtml(escapedAlt, escapedUrl, options) {
    const rawUrl = unescapeHtml(escapedUrl);
    const rawAlt = unescapeHtml(escapedAlt);
    let src = rawUrl;
    const resolve = options && options.resolveImage;
    if (typeof resolve === "function") {
      try {
        const r = resolve(rawUrl, rawAlt);
        if (typeof r === "string") src = r;
      } catch (_e) {
      }
    }
    if (!isSafeImgSrc(src)) return null;
    return '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(rawAlt) + '" loading="lazy">';
  }
  __name(imageHtml, "imageHtml");
  function renderInline(raw, options) {
    const stash = [];
    const put = /* @__PURE__ */ __name((html) => MARK + (stash.push(html) - 1) + MARK, "put");
    let s = escapeHtml(raw);
    s = s.replace(/\`([^\`\\n]+)\`/g, (_m, code) => put("<code>" + code + "</code>"));
    s = s.replace(/!\\[([^\\]\\n]*)\\]\\(\\s*([^()\\s]*)\\s*\\)/g, (m, alt, url) => {
      if (!url) return m;
      const html = imageHtml(alt, url, options);
      return html === null ? m : put(html);
    });
    s = s.replace(/\\[([^\\]\\n]*)\\]\\(\\s*([^()\\s]*)\\s*\\)/g, (m, text, url) => {
      const rawUrl = unescapeHtml(url);
      if (!LINK_PROTOCOL_RE.test(rawUrl)) return m;
      return put(
        '<a href="' + escapeHtml(rawUrl) + '" target="_blank" rel="noopener noreferrer">' + text + "</a>"
      );
    });
    s = s.replace(/\\*\\*([^*\\n]+)\\*\\*/g, (_m, x) => "<strong>" + x + "</strong>");
    s = s.replace(/~~([^~\\n]+)~~/g, (_m, x) => "<del>" + x + "</del>");
    s = s.replace(/(^|[^*])\\*([^*\\n]+)\\*/g, (_m, pre, x) => pre + "<em>" + x + "</em>");
    s = s.replace(RESTORE_RE, (m, i) => {
      const v = stash[Number(i)];
      return v === void 0 ? m : v;
    });
    return s;
  }
  __name(renderInline, "renderInline");
  var RE_FENCE = /^\\s{0,3}(\`\`\`|~~~)\\s*([^\\s\`~]*)\\s*$/;
  var RE_HR = /^\\s{0,3}(-{3,}|\\*{3,}|_{3,})\\s*$/;
  var RE_HEADING = /^\\s{0,3}(#{1,3})\\s+(.*)$/;
  var RE_QUOTE = /^\\s{0,3}>\\s?(.*)$/;
  var RE_UL = /^\\s{0,3}[-*]\\s+(.+)$/;
  var RE_OL = /^\\s{0,3}\\d+[.)]\\s+(.+)$/;
  var RE_BLANK = /^\\s*$/;
  function startsNewBlock(line) {
    return RE_BLANK.test(line) || RE_FENCE.test(line) || RE_HR.test(line) || RE_HEADING.test(line) || RE_QUOTE.test(line) || RE_UL.test(line) || RE_OL.test(line);
  }
  __name(startsNewBlock, "startsNewBlock");
  function inlineLines(lines, options) {
    return lines.map((l) => renderInline(l, options)).join("<br>");
  }
  __name(inlineLines, "inlineLines");
  function renderMarkdown(text, options = {}) {
    if (typeof text !== "string" || text === "") return "";
    try {
      const src = text.split(MARK).join("").replace(/\\r\\n?/g, "\\n");
      const lines = src.split("\\n");
      const out = [];
      let i = 0;
      while (i < lines.length) {
        const line = lines[i];
        if (RE_BLANK.test(line)) {
          i++;
          continue;
        }
        const fence = RE_FENCE.exec(line);
        if (fence) {
          const closer = fence[1];
          const lang = fence[2] || "";
          const body = [];
          i++;
          while (i < lines.length && !new RegExp("^\\\\s{0,3}" + closer + "+\\\\s*$").test(lines[i])) {
            body.push(lines[i]);
            i++;
          }
          if (i < lines.length) i++;
          const cls = lang ? ' class="language-' + escapeHtml(lang) + '"' : "";
          out.push("<pre><code" + cls + ">" + escapeHtml(body.join("\\n")) + "</code></pre>");
          continue;
        }
        if (RE_HR.test(line)) {
          out.push("<hr>");
          i++;
          continue;
        }
        const h = RE_HEADING.exec(line);
        if (h) {
          const level = h[1].length;
          out.push("<h" + level + ">" + renderInline(h[2].trim(), options) + "</h" + level + ">");
          i++;
          continue;
        }
        if (RE_QUOTE.test(line)) {
          const body = [];
          while (i < lines.length && RE_QUOTE.test(lines[i])) {
            body.push(RE_QUOTE.exec(lines[i])[1]);
            i++;
          }
          out.push("<blockquote><p>" + inlineLines(body, options) + "</p></blockquote>");
          continue;
        }
        if (RE_UL.test(line)) {
          const items = [];
          while (i < lines.length && RE_UL.test(lines[i]) && !RE_HR.test(lines[i])) {
            items.push(RE_UL.exec(lines[i])[1]);
            i++;
          }
          out.push("<ul>" + items.map((x) => "<li>" + renderInline(x, options) + "</li>").join("") + "</ul>");
          continue;
        }
        if (RE_OL.test(line)) {
          const items = [];
          while (i < lines.length && RE_OL.test(lines[i])) {
            items.push(RE_OL.exec(lines[i])[1]);
            i++;
          }
          out.push("<ol>" + items.map((x) => "<li>" + renderInline(x, options) + "</li>").join("") + "</ol>");
          continue;
        }
        const para = [line];
        i++;
        while (i < lines.length && !startsNewBlock(lines[i])) {
          para.push(lines[i]);
          i++;
        }
        out.push("<p>" + inlineLines(para, options) + "</p>");
      }
      return out.join("\\n");
    } catch (_e) {
      return "<p>" + escapeHtml(text) + "</p>";
    }
  }
  __name(renderMarkdown, "renderMarkdown");

  // src/zip.js
  var LOCAL_SIG = 67324752;
  var CENTRAL_SIG = 33639248;
  var EOCD_SIG = 101010256;
  var LOCAL_HEADER_SIZE = 30;
  var CENTRAL_HEADER_SIZE = 46;
  var EOCD_SIZE = 22;
  var FLAG_UTF8 = 2048;
  var VERSION_NEEDED = 20;
  var CRC_TABLE = null;
  function crcTable() {
    if (CRC_TABLE) return CRC_TABLE;
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
      }
      table[n] = c >>> 0;
    }
    CRC_TABLE = table;
    return table;
  }
  __name(crcTable, "crcTable");
  function crc32(bytes) {
    const table = crcTable();
    let c = 4294967295;
    for (let i = 0; i < bytes.length; i++) {
      c = table[(c ^ bytes[i]) & 255] ^ c >>> 8;
    }
    return (c ^ 4294967295) >>> 0;
  }
  __name(crc32, "crc32");
  var encoder = new TextEncoder();
  function toBytes(data) {
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    return encoder.encode(String(data ?? ""));
  }
  __name(toBytes, "toBytes");
  function normalizeName(name) {
    return String(name ?? "").replace(/\\\\/g, "/").replace(/^\\/+/, "");
  }
  __name(normalizeName, "normalizeName");
  function dosDateTime(d) {
    const year = d.getFullYear();
    const safeYear = year < 1980 ? 1980 : year;
    const time = (d.getHours() & 31) << 11 | (d.getMinutes() & 63) << 5 | d.getSeconds() >> 1 & 31;
    const date = (safeYear - 1980 & 127) << 9 | (d.getMonth() + 1 & 15) << 5 | d.getDate() & 31;
    return { time, date };
  }
  __name(dosDateTime, "dosDateTime");
  function createZip(entries) {
    const list = Array.isArray(entries) ? entries : [];
    const stamp = dosDateTime(/* @__PURE__ */ new Date());
    const prepared = list.map((e) => {
      const src = e && typeof e === "object" ? e : {};
      const nameBytes = encoder.encode(normalizeName(src.name));
      const data = toBytes(src.data);
      return { nameBytes, data, crc: crc32(data), offset: 0 };
    });
    let total = 0;
    for (const p of prepared) {
      p.offset = total;
      total += LOCAL_HEADER_SIZE + p.nameBytes.length + p.data.length;
    }
    const centralStart = total;
    let centralSize = 0;
    for (const p of prepared) {
      centralSize += CENTRAL_HEADER_SIZE + p.nameBytes.length;
    }
    total += centralSize + EOCD_SIZE;
    const out = new Uint8Array(total);
    const view = new DataView(out.buffer);
    let pos = 0;
    const u16 = /* @__PURE__ */ __name((v) => {
      view.setUint16(pos, v & 65535, true);
      pos += 2;
    }, "u16");
    const u32 = /* @__PURE__ */ __name((v) => {
      view.setUint32(pos, v >>> 0, true);
      pos += 4;
    }, "u32");
    const raw = /* @__PURE__ */ __name((bytes) => {
      out.set(bytes, pos);
      pos += bytes.length;
    }, "raw");
    for (const p of prepared) {
      u32(LOCAL_SIG);
      u16(VERSION_NEEDED);
      u16(FLAG_UTF8);
      u16(0);
      u16(stamp.time);
      u16(stamp.date);
      u32(p.crc);
      u32(p.data.length);
      u32(p.data.length);
      u16(p.nameBytes.length);
      u16(0);
      raw(p.nameBytes);
      raw(p.data);
    }
    for (const p of prepared) {
      u32(CENTRAL_SIG);
      u16(VERSION_NEEDED);
      u16(VERSION_NEEDED);
      u16(FLAG_UTF8);
      u16(0);
      u16(stamp.time);
      u16(stamp.date);
      u32(p.crc);
      u32(p.data.length);
      u32(p.data.length);
      u16(p.nameBytes.length);
      u16(0);
      u16(0);
      u16(0);
      u16(0);
      u32(0);
      u32(p.offset);
      raw(p.nameBytes);
    }
    u32(EOCD_SIG);
    u16(0);
    u16(0);
    u16(prepared.length);
    u16(prepared.length);
    u32(centralSize);
    u32(centralStart);
    u16(0);
    return out;
  }
  __name(createZip, "createZip");

  // src/schema.js
  var CAPTURES = ["api", "paste", "screen"];
  var DEFAULT_CAPTURE = "api";
  var PASTE_KINDS = ["html", "fragment", "text"];
  var FORBIDDEN_FILENAME_CHARS = /[<>:"/\\\\|?*]/g;
  function captureKind(exp) {
    const capture = exp && exp.source ? exp.source.capture : null;
    return CAPTURES.includes(capture) ? capture : DEFAULT_CAPTURE;
  }
  __name(captureKind, "captureKind");
  function pasteKind(exp) {
    if (captureKind(exp) !== "paste") return null;
    const kind = exp && exp.source ? exp.source.pasteKind : null;
    return PASTE_KINDS.includes(kind) ? kind : null;
  }
  __name(pasteKind, "pasteKind");
  function imageDataUri(exp, img) {
    if (!img || typeof img !== "object") return null;
    if (typeof img.dataUri === "string" && img.dataUri !== "") return img.dataUri;
    const asset = imageAsset(exp, img);
    return asset && typeof asset.dataUri === "string" && asset.dataUri !== "" ? asset.dataUri : null;
  }
  __name(imageDataUri, "imageDataUri");
  function imageMime(exp, img) {
    if (!img || typeof img !== "object") return null;
    if (typeof img.mime === "string" && img.mime !== "") return img.mime;
    const asset = imageAsset(exp, img);
    return asset && typeof asset.mime === "string" && asset.mime !== "" ? asset.mime : null;
  }
  __name(imageMime, "imageMime");
  function imageAsset(exp, img) {
    const assets = exp && typeof exp === "object" ? exp.assets : null;
    if (!assets || typeof assets !== "object") return null;
    const id = img && img.assetId;
    if (typeof id !== "string" || id === "") return null;
    const asset = assets[id];
    return asset && typeof asset === "object" ? asset : null;
  }
  __name(imageAsset, "imageAsset");
  function stripControlChars(s) {
    let out = "";
    for (const ch of String(s ?? "")) {
      const code = ch.codePointAt(0);
      if (code < 32 || code === 127) continue;
      out += ch;
    }
    return out;
  }
  __name(stripControlChars, "stripControlChars");
  function sanitizeFileNamePart(s) {
    return stripControlChars(s).replace(FORBIDDEN_FILENAME_CHARS, "").replace(/\\s+/g, "_").replace(/_{2,}/g, "_").replace(/^[._]+|[._\\s]+$/g, "");
  }
  __name(sanitizeFileNamePart, "sanitizeFileNamePart");
  function yyyymmddLocal(iso) {
    const d = iso ? new Date(iso) : /* @__PURE__ */ new Date();
    const dt = Number.isNaN(d.getTime()) ? /* @__PURE__ */ new Date() : d;
    const p = /* @__PURE__ */ __name((n) => String(n).padStart(2, "0"), "p");
    return \`\${dt.getFullYear()}\${p(dt.getMonth() + 1)}\${p(dt.getDate())}\`;
  }
  __name(yyyymmddLocal, "yyyymmddLocal");
  function exportFileName(exp, ext) {
    const source = exp && exp.source || {};
    const platform = sanitizeFileNamePart(source.platform) || "unknown";
    const label = sanitizeFileNamePart(source.title) || sanitizeFileNamePart(source.chatId) || "chat";
    const capped = sanitizeFileNamePart(label.slice(0, 60)) || "chat";
    const date = yyyymmddLocal(source.exportedAt);
    const cleanExt = sanitizeFileNamePart(String(ext ?? "").replace(/^\\.+/, "")) || "txt";
    return \`Geas_\${platform}_\${capped}_\${date}.\${cleanExt}\`;
  }
  __name(exportFileName, "exportFileName");

  // src/export-md.js
  function extForMime(mime) {
    const m = String(mime ?? "").toLowerCase().split(";")[0].trim();
    if (m === "image/png") return "png";
    if (m === "image/jpeg") return "jpg";
    if (m === "image/webp") return "webp";
    return "bin";
  }
  __name(extForMime, "extForMime");
  function imageStem(img) {
    const assetId = img && img.assetId;
    if (typeof assetId === "string" && assetId !== "") return assetId;
    return img && img.id || "image";
  }
  __name(imageStem, "imageStem");
  function imagePath(exp, img) {
    return "images/" + imageStem(img) + "." + extForMime(imageMime(exp, img));
  }
  __name(imagePath, "imagePath");
  function failedNote(img) {
    return "(이미지 내장 실패: " + img.originalUrl + ")";
  }
  __name(failedNote, "failedNote");
  function isEmbedded(exp, img) {
    return Boolean(img) && img.status === "embedded" && imageDataUri(exp, img) != null;
  }
  __name(isEmbedded, "isEmbedded");
  function imageRef(exp, img, alt) {
    const label = alt != null ? alt : img.alt || "";
    if (!isEmbedded(exp, img)) return failedNote(img);
    return "![" + label + "](" + imagePath(exp, img) + ")";
  }
  __name(imageRef, "imageRef");
  function dataUriToBytes(uri) {
    if (typeof uri !== "string") return null;
    const comma = uri.indexOf(",");
    if (comma < 0) return null;
    const head = uri.slice(0, comma);
    const body = uri.slice(comma + 1);
    if (!/;base64/i.test(head)) {
      try {
        return new TextEncoder().encode(decodeURIComponent(body));
      } catch (_e) {
        return null;
      }
    }
    const b64 = body.replace(/\\s+/g, "");
    try {
      if (typeof atob === "undefined") {
        return new Uint8Array(Buffer.from(b64, "base64"));
      }
      const bin = atob(b64);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    } catch (_e) {
      return null;
    }
  }
  __name(dataUriToBytes, "dataUriToBytes");
  function rewriteImageRefs(exp, text, images) {
    const usedIds = /* @__PURE__ */ new Set();
    if (typeof text !== "string" || text === "" || images.length === 0) {
      return { text: typeof text === "string" ? text : "", usedIds };
    }
    const byUrl = /* @__PURE__ */ new Map();
    for (const img of images) {
      if (img.originalUrl && !byUrl.has(img.originalUrl)) byUrl.set(img.originalUrl, img);
    }
    const replacementFor = /* @__PURE__ */ __name((img, altOverride) => {
      usedIds.add(img.id);
      return imageRef(exp, img, altOverride);
    }, "replacementFor");
    let out = text.replace(/!\\[([^\\]\\n]*)\\]\\(\\s*([^()\\s]+)\\s*\\)/g, (m, alt, url) => {
      const img = byUrl.get(url);
      if (!img) return m;
      return replacementFor(img, alt);
    });
    out = out.replace(/\\{\\{url\\}\\}([^\\s)\\]]+)/g, (m, path) => {
      const img = images.find((x) => x.originalUrl && x.originalUrl.endsWith(path));
      if (!img) return m;
      return replacementFor(img, null);
    });
    return { text: out, usedIds };
  }
  __name(rewriteImageRefs, "rewriteImageRefs");
  function metaTable(exp) {
    const s = exp.source || {};
    const turnCount = Array.isArray(exp.turns) ? exp.turns.length : 0;
    const rows = [
      ["플랫폼", s.platform || "-"],
      ["내보낸 시각", s.exportedAt || "-"],
      ["턴 수", String(turnCount)]
    ];
    if (s.url) rows.push(["원본 URL", s.url]);
    return ["| 항목 | 값 |", "| --- | --- |", ...rows.map((r) => "| " + r[0] + " | " + r[1] + " |")].join("\\n");
  }
  __name(metaTable, "metaTable");
  function buildMarkdown(exp) {
    const src = exp && exp.source || {};
    const meta = exp && exp.meta || {};
    const turns = Array.isArray(exp && exp.turns) ? exp.turns : [];
    const parts = [];
    parts.push("# " + (src.title || src.chatId || "무제 대화"));
    parts.push("");
    parts.push(metaTable(exp));
    if (meta.startSetting) {
      parts.push("");
      parts.push("## 시작 설정");
      parts.push("");
      parts.push(meta.startSetting);
    }
    if (meta.persona) {
      parts.push("");
      parts.push("## 유저 페르소나");
      parts.push("");
      parts.push(meta.persona);
    }
    const images = [];
    const seenPaths = /* @__PURE__ */ new Set();
    turns.forEach((turn, i) => {
      const turnImages = Array.isArray(turn.images) ? turn.images : [];
      for (const img of turnImages) {
        if (!isEmbedded(exp, img)) continue;
        const path = imagePath(exp, img);
        if (seenPaths.has(path)) continue;
        const bytes = dataUriToBytes(imageDataUri(exp, img));
        if (!bytes) continue;
        seenPaths.add(path);
        images.push({ path, bytes });
      }
      parts.push("");
      parts.push("---");
      parts.push("");
      const speaker = turn.speaker || turn.role || "";
      parts.push("**" + speaker + "**" + (turn.createdAt ? " · " + turn.createdAt : ""));
      parts.push("");
      const { text, usedIds } = rewriteImageRefs(exp, turn.text || "", turnImages);
      if (text) parts.push(text);
      const leftovers = turnImages.filter((img) => !usedIds.has(img.id));
      if (leftovers.length) {
        parts.push("");
        for (const img of leftovers) {
          parts.push(imageRef(exp, img, null));
        }
      }
    });
    const markdown = parts.join("\\n").replace(/\\n{4,}/g, "\\n\\n\\n") + "\\n";
    return { markdown, images };
  }
  __name(buildMarkdown, "buildMarkdown");
  function buildMarkdownZip(exp) {
    const { markdown, images } = buildMarkdown(exp);
    const entries = [{ name: "chat.md", data: markdown }];
    for (const img of images) entries.push({ name: img.path, data: img.bytes });
    entries.push({ name: "export.json", data: JSON.stringify(exp, null, 2) });
    return createZip(entries);
  }
  __name(buildMarkdownZip, "buildMarkdownZip");

  // src/viewer/viewer.js
  var PLATFORM_LABELS = { genit: "젠잇", luna: "루나톡" };
  var ROLE_FALLBACK_SPEAKER = { user: "나", assistant: "AI", system: "시스템" };
  var ROLES = ["user", "assistant", "system"];
  var NOTICE_KEY = "geas-export:notice-dismissed";
  var PASTE_NOTICE_HTML = "화면에서 복사한 내용으로 만든 파일입니다. 작성 시각은 포함되지 않습니다.";
  var PASTE_NOTICE_FRAGMENT = PASTE_NOTICE_HTML + " 메시지 하나만 담겨 있습니다.";
  var PASTE_NOTICE_TEXT = "화면에서 복사한 텍스트로 만든 파일입니다. 굵게·기울임 같은 서식과 이미지는 포함되지 않습니다.";
  var PASTE_NOTICE_GENIT = "젠잇 내부 이미지는 원본 주소로 대체하여 저장하며, 대체할 수 없는 이미지는 포함되지 않습니다.";
  var SCREEN_NOTICE = "화면에 표시된 대화를 저장한 파일입니다. 작성 시각은 포함되지 않습니다.";
  function pasteNotice(exp) {
    const kind = pasteKind(exp);
    const genit = exp && exp.source && exp.source.platform === "genit";
    if (kind === "html") return PASTE_NOTICE_HTML + (genit ? " " + PASTE_NOTICE_GENIT : "");
    if (kind === "fragment") return PASTE_NOTICE_FRAGMENT + (genit ? " " + PASTE_NOTICE_GENIT : "");
    return PASTE_NOTICE_TEXT;
  }
  __name(pasteNotice, "pasteNotice");
  function captureNotice(exp) {
    const capture = captureKind(exp);
    if (capture === "paste") return pasteNotice(exp);
    if (capture === "screen") return SCREEN_NOTICE;
    return null;
  }
  __name(captureNotice, "captureNotice");
  var BARE_IMAGE_TOKEN = /^\\{\\{url\\}\\}(\\S+)$/;
  var FAIL_MARKER_HEAD = "GEASxIMGFAILx";
  var FAIL_MARKER_TAIL = "xENDGEASx";
  var FAIL_MARKER_RE = new RegExp(FAIL_MARKER_HEAD + "(\\\\d+)" + FAIL_MARKER_TAIL, "g");
  var $ = /* @__PURE__ */ __name((id) => document.getElementById(id), "$");
  function escapeHtml2(value) {
    return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  __name(escapeHtml2, "escapeHtml");
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  __name(el, "el");
  function formatDateTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    try {
      return d.toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (_e) {
      return d.toString();
    }
  }
  __name(formatDateTime, "formatDateTime");
  function platformLabel(exp) {
    const p = exp.source && exp.source.platform || "";
    return PLATFORM_LABELS[p] || p || "알 수 없는 플랫폼";
  }
  __name(platformLabel, "platformLabel");
  var CAPTURE_CHIP = { paste: " (복사본)", screen: " (화면)" };
  function platformChip(exp) {
    return platformLabel(exp) + (CAPTURE_CHIP[captureKind(exp)] || "");
  }
  __name(platformChip, "platformChip");
  function safeFileName(exp, ext, fallbackStem) {
    try {
      const name = exportFileName(exp, ext);
      if (name) return name;
    } catch (_e) {
    }
    return fallbackStem + "." + ext;
  }
  __name(safeFileName, "safeFileName");
  function readExport() {
    const holder = $("geas-export");
    if (!holder) throw new Error("내보내기 데이터(#geas-export)를 찾을 수 없습니다. 파일이 손상되었을 수 있습니다.");
    let parsed;
    try {
      parsed = JSON.parse(holder.textContent || "");
    } catch (e) {
      throw new Error("내보내기 데이터를 읽지 못했습니다. (" + (e && e.message ? e.message : e) + ")");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("내보내기 데이터 형식이 올바르지 않습니다.");
    }
    if (!Array.isArray(parsed.turns)) {
      throw new Error("내보내기 데이터에 대화(turns)가 없습니다.");
    }
    if (!parsed.source || typeof parsed.source !== "object") parsed.source = {};
    if (!parsed.meta || typeof parsed.meta !== "object") parsed.meta = {};
    return parsed;
  }
  __name(readExport, "readExport");
  function countImages(exp) {
    let embedded = 0;
    let failed = 0;
    const distinct = /* @__PURE__ */ new Set();
    for (const turn of exp.turns) {
      const images = Array.isArray(turn && turn.images) ? turn.images : [];
      for (const img of images) {
        if (!img) continue;
        if (isFailed(exp, img)) {
          failed += 1;
          continue;
        }
        embedded += 1;
        const key = typeof img.assetId === "string" && img.assetId ? "a:" + img.assetId : "d:" + imageDataUri(exp, img);
        distinct.add(key);
      }
    }
    return { embedded, failed, total: embedded + failed, unique: distinct.size };
  }
  __name(countImages, "countImages");
  function showError(message) {
    const box = $("error");
    if (box) {
      box.textContent = message;
      box.hidden = false;
    }
    const toolbar = $("toolbar");
    if (toolbar) toolbar.hidden = true;
  }
  __name(showError, "showError");
  function renderHeader(exp) {
    const head = $("head");
    if (!head) return;
    head.textContent = "";
    const source = exp.source || {};
    head.appendChild(el("h1", "title", source.title || source.chatId || "대화 기록"));
    const sub = el("p", "sub");
    sub.appendChild(el("span", "chip", platformChip(exp)));
    const exportedAt = formatDateTime(source.exportedAt);
    if (exportedAt) sub.appendChild(el("span", null, "내보낸 시각 " + exportedAt));
    sub.appendChild(el("span", null, "턴 " + exp.turns.length + "개"));
    const counts = countImages(exp);
    if (counts.total > 0) {
      let text = "이미지 " + counts.total + "장 (고유 " + counts.unique;
      text += counts.failed > 0 ? " · 실패 " + counts.failed + ")" : ")";
      sub.appendChild(el("span", null, text));
    }
    head.appendChild(sub);
  }
  __name(renderHeader, "renderHeader");
  function renderMetaPanel(container, label, text) {
    if (text == null || String(text).trim() === "") return;
    const details = document.createElement("details");
    details.appendChild(el("summary", null, label));
    const body = el("div", "meta-body");
    body.innerHTML = renderMarkdown(String(text));
    details.appendChild(body);
    container.appendChild(details);
  }
  __name(renderMetaPanel, "renderMetaPanel");
  function renderMeta(exp) {
    const container = $("meta");
    if (!container) return;
    container.textContent = "";
    const meta = exp.meta || {};
    renderMetaPanel(container, "시작 설정", meta.startSetting);
    renderMetaPanel(container, "페르소나", meta.persona);
  }
  __name(renderMeta, "renderMeta");
  function renderFooter(exp) {
    const foot = $("foot");
    if (!foot) return;
    foot.textContent = "";
    const source = exp.source || {};
    const bits = ["대화 저장 · " + platformLabel(exp)];
    if (source.url) bits.push(source.url);
    foot.appendChild(el("span", null, bits.join(" · ")));
  }
  __name(renderFooter, "renderFooter");
  function normalizeImages(turn) {
    return (Array.isArray(turn && turn.images) ? turn.images : []).filter(
      (img) => img && typeof img === "object"
    );
  }
  __name(normalizeImages, "normalizeImages");
  function isFailed(exp, img) {
    return img.status === "failed" || imageDataUri(exp, img) == null;
  }
  __name(isFailed, "isFailed");
  function findImageByPath(images, rawPath) {
    const path = String(rawPath).replace(/^\\/+/, "");
    if (!path) return null;
    for (const img of images) {
      const url = String(img.originalUrl || "");
      if (url === path || url.endsWith("/" + path)) return img;
    }
    for (const img of images) {
      if (String(img.originalUrl || "").endsWith(path)) return img;
    }
    return null;
  }
  __name(findImageByPath, "findImageByPath");
  function safeAlt(alt) {
    return String(alt == null ? "" : alt).replace(/[\\[\\]()\\n\\r]/g, " ").trim();
  }
  __name(safeAlt, "safeAlt");
  function prepareBody(exp, turn, images) {
    const byUrl = /* @__PURE__ */ new Map();
    for (const img of images) {
      if (img.originalUrl) byUrl.set(String(img.originalUrl), img);
    }
    let text = String(turn && turn.text != null ? turn.text : "");
    if (images.length > 0 && text.indexOf("{{url}}") !== -1) {
      text = text.split("\\n").map((line) => {
        const m = BARE_IMAGE_TOKEN.exec(line.trim());
        if (!m) return line;
        const img = findImageByPath(images, m[1]);
        if (!img) return line;
        const alt = safeAlt(img.alt) || safeAlt(m[1].replace(/\\.[a-z0-9]+$/i, ""));
        return "![" + alt + "](" + img.originalUrl + ")";
      }).join("\\n");
    }
    const failed = [];
    const referenced = /* @__PURE__ */ new Set();
    text = text.replace(/!\\[([^\\]\\n]*)\\]\\(([^)\\s]*)\\)/g, (whole, _alt, url) => {
      const img = byUrl.get(url);
      if (!img) return whole;
      referenced.add(img);
      if (!isFailed(exp, img)) return whole;
      const i = failed.push(img) - 1;
      return FAIL_MARKER_HEAD + i + FAIL_MARKER_TAIL;
    });
    return { text, failed, referenced, byUrl };
  }
  __name(prepareBody, "prepareBody");
  function failedImageHtml(img) {
    return '<span class="img-failed">' + escapeHtml2("이미지 내장 실패: " + (img && img.originalUrl ? img.originalUrl : "(주소 없음)")) + "</span>";
  }
  __name(failedImageHtml, "failedImageHtml");
  function renderTurn(exp, turn, position) {
    const role = ROLES.indexOf(turn && turn.role) !== -1 ? turn.role : "system";
    const article = el("article", "turn role-" + role);
    const header = el("div", "turn-head");
    header.appendChild(
      el("span", "speaker", turn && turn.speaker || ROLE_FALLBACK_SPEAKER[role] || role)
    );
    const index = typeof (turn && turn.index) === "number" ? turn.index : position;
    header.appendChild(el("span", "idx", "#" + index));
    if (index === 0 && role === "assistant" && turn && turn.createdAt === null) {
      const screenText = exp && exp.source && exp.source.platform === "luna" && captureKind(exp) !== "paste";
      header.appendChild(el("span", "tag", screenText ? "시작 인사말 (화면 텍스트)" : "시작 인사말"));
    }
    const when = formatDateTime(turn && turn.createdAt);
    if (when) {
      const time = el("time", null, when);
      time.setAttribute("datetime", String(turn.createdAt));
      header.appendChild(time);
    }
    const rawText = String(turn && turn.text != null ? turn.text : "");
    const copyBtn = el("button", "copy", "원문 복사");
    copyBtn.type = "button";
    copyBtn.title = "이 턴의 원문(마크다운)을 클립보드에 복사";
    copyBtn.addEventListener("click", () => copyToClipboard(rawText));
    header.appendChild(copyBtn);
    article.appendChild(header);
    const images = normalizeImages(turn);
    const prepared = prepareBody(exp, turn, images);
    const body = el("div", "body");
    const resolved = /* @__PURE__ */ new Set();
    let html;
    try {
      html = renderMarkdown(prepared.text, {
        resolveImage(url) {
          const img = prepared.byUrl.get(url);
          if (!img) return null;
          resolved.add(img);
          return imageDataUri(exp, img);
        }
      });
    } catch (e) {
      html = "<p>" + escapeHtml2(prepared.text) + "</p>";
      if (typeof console !== "undefined") console.error("마크다운 렌더 실패", e);
    }
    body.innerHTML = String(html).replace(
      FAIL_MARKER_RE,
      (_m, i) => failedImageHtml(prepared.failed[Number(i)])
    );
    attachCodeCopyButtons(body);
    article.appendChild(body);
    const leftovers = images.filter((img) => !resolved.has(img) && !prepared.referenced.has(img));
    if (leftovers.length > 0) {
      article.appendChild(renderGallery(exp, leftovers));
    }
    return article;
  }
  __name(renderTurn, "renderTurn");
  function renderGallery(exp, images) {
    const gallery = el("div", "gallery");
    for (const img of images) {
      if (isFailed(exp, img)) {
        gallery.appendChild(el("div", "img-failed", "이미지 내장 실패: " + (img.originalUrl || "(주소 없음)")));
        continue;
      }
      const figure = document.createElement("figure");
      const node = document.createElement("img");
      node.src = imageDataUri(exp, img);
      node.alt = String(img.alt == null ? "" : img.alt);
      node.loading = "lazy";
      figure.appendChild(node);
      if (img.alt) figure.appendChild(el("figcaption", null, String(img.alt)));
      gallery.appendChild(figure);
    }
    return gallery;
  }
  __name(renderGallery, "renderGallery");
  function renderTurns(exp) {
    const host = $("turns");
    if (!host) return;
    host.textContent = "";
    const frag = document.createDocumentFragment();
    exp.turns.forEach((turn, i) => frag.appendChild(renderTurn(exp, turn, i)));
    host.appendChild(frag);
  }
  __name(renderTurns, "renderTurns");
  function downloadBlob(fileName, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
  }
  __name(downloadBlob, "downloadBlob");
  function attachCodeCopyButtons(body) {
    for (const pre of body.querySelectorAll("pre")) {
      const wrap = el("div", "pre-wrap");
      pre.parentNode.insertBefore(wrap, pre);
      const code = pre.querySelector("code");
      const m = code && /(?:^|\\s)language-(\\S+)/.exec(code.className || "");
      if (m && m[1]) {
        wrap.classList.add("titled");
        wrap.appendChild(el("div", "pre-title", m[1]));
      }
      wrap.appendChild(pre);
      const btn = el("button", "pre-copy", "복사");
      btn.type = "button";
      btn.title = "이 블록의 내용을 클립보드에 복사";
      btn.addEventListener("click", () => copyToClipboard(pre.textContent || ""));
      wrap.appendChild(btn);
    }
  }
  __name(attachCodeCopyButtons, "attachCodeCopyButtons");
  async function writeClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_e) {
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "-1000px";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch (_e) {
      return false;
    }
  }
  __name(writeClipboard, "writeClipboard");
  async function copyToClipboard(text) {
    const ok = await writeClipboard(text);
    toast(ok ? "복사했습니다." : "복사하지 못했습니다. 본문을 직접 선택해 복사해 주세요.");
  }
  __name(copyToClipboard, "copyToClipboard");
  var toastTimer = 0;
  function toast(message) {
    const box = $("toast");
    if (!box) return;
    box.textContent = message;
    box.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      box.hidden = true;
    }, 1600);
  }
  __name(toast, "toast");
  function setupToolbar(exp) {
    const mdBtn = $("btn-md");
    if (mdBtn) {
      mdBtn.addEventListener("click", () => {
        try {
          const bytes = buildMarkdownZip(exp);
          downloadBlob(safeFileName(exp, "zip", "geas-chat"), new Blob([bytes], { type: "application/zip" }));
        } catch (e) {
          toast("Markdown 저장에 실패했습니다.");
          if (typeof console !== "undefined") console.error("Markdown zip 생성 실패", e);
        }
      });
    }
    const jsonBtn = $("btn-json");
    if (jsonBtn) {
      jsonBtn.addEventListener("click", () => {
        try {
          const blob = new Blob([JSON.stringify(exp, null, 2)], {
            type: "application/json;charset=utf-8"
          });
          downloadBlob(safeFileName(exp, "json", "geas-chat"), blob);
        } catch (e) {
          toast("JSON 저장에 실패했습니다.");
          if (typeof console !== "undefined") console.error("JSON 저장 실패", e);
        }
      });
    }
  }
  __name(setupToolbar, "setupToolbar");
  function setupNotice(exp) {
    const notice = $("notice");
    if (!notice) return;
    const captured = captureNotice(exp);
    if (captured) {
      const text = notice.querySelector(".notice-text");
      if (text) text.textContent = captured;
    }
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(NOTICE_KEY) === "1";
    } catch (_e) {
    }
    if (dismissed) return;
    notice.hidden = false;
    const close = $("notice-close");
    if (!close) return;
    close.addEventListener("click", () => {
      notice.hidden = true;
      try {
        localStorage.setItem(NOTICE_KEY, "1");
      } catch (_e) {
      }
    });
  }
  __name(setupNotice, "setupNotice");
  function setupPrint() {
    if (typeof window.addEventListener !== "function") return;
    let reopened = [];
    window.addEventListener("beforeprint", () => {
      reopened = Array.prototype.filter.call(
        document.querySelectorAll("#meta details"),
        (d) => !d.open
      );
      for (const d of reopened) d.open = true;
    });
    window.addEventListener("afterprint", () => {
      for (const d of reopened) d.open = false;
      reopened = [];
    });
  }
  __name(setupPrint, "setupPrint");
  function boot() {
    let exp;
    try {
      exp = readExport();
    } catch (e) {
      showError(e && e.message ? e.message : String(e));
      if (typeof console !== "undefined") console.error(e);
      return;
    }
    try {
      renderHeader(exp);
      renderMeta(exp);
      renderTurns(exp);
      renderFooter(exp);
    } catch (e) {
      showError("대화를 그리는 중 오류가 났습니다: " + (e && e.message ? e.message : e));
      if (typeof console !== "undefined") console.error(e);
      return;
    }
    try {
      setupToolbar(exp);
      setupNotice(exp);
      setupPrint();
    } catch (e) {
      if (typeof console !== "undefined") console.error("도구 초기화 실패", e);
    }
  }
  __name(boot, "boot");
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
`;

  // generated/viewer.css.readable.txt
  var viewer_css_readable_default = '/* 대화 저장 도구 — 빌드 산출물. 원본: src/ */\n/* src/viewer/viewer.css */\n:root {\n  --bg: #ffffff;\n  --bg-subtle: #f6f7f9;\n  --ink: #1f2328;\n  --ink-2: #57606a;\n  --ink-3: #8b949e;\n  --line: #d0d7de;\n  --accent: #2563eb;\n  --user: #2563eb;\n  --assistant: #1f2328;\n  --system: #8b949e;\n  --danger: #b42318;\n  --sans:\n    system-ui,\n    -apple-system,\n    "Segoe UI",\n    "Apple SD Gothic Neo",\n    "Malgun Gothic",\n    "Noto Sans KR",\n    sans-serif;\n  --mono:\n    ui-monospace,\n    SFMono-Regular,\n    Consolas,\n    "D2Coding",\n    monospace;\n  --code-bg: #eef1f6;\n  --code-border: #c9d1db;\n  --maxw: 760px;\n  --pad: clamp(1rem, 5vw, 2rem);\n  --radius: 6px;\n  color-scheme: light;\n}\n@media (prefers-color-scheme: dark) {\n  :root {\n    --code-bg: #1a1f27;\n    --code-border: #38414d;\n  }\n  :root {\n    --bg: #0f1115;\n    --bg-subtle: #161a20;\n    --ink: #e6e8eb;\n    --ink-2: #a3acb8;\n    --ink-3: #6e7781;\n    --line: #2b313a;\n    --accent: #5b8def;\n    --user: #5b8def;\n    --assistant: #e6e8eb;\n    --danger: #f97066;\n    color-scheme: dark;\n  }\n}\n* {\n  box-sizing: border-box;\n}\nhtml {\n  -webkit-text-size-adjust: 100%;\n}\nbody {\n  margin: 0;\n  background: var(--bg);\n  color: var(--ink);\n  font-family: var(--sans);\n  font-size: 16px;\n  line-height: 1.75;\n  -webkit-font-smoothing: antialiased;\n  word-break: keep-all;\n  overflow-wrap: anywhere;\n}\na {\n  color: var(--accent);\n  text-decoration: none;\n}\na:hover {\n  text-decoration: underline;\n}\n:focus-visible {\n  outline: 2px solid var(--accent);\n  outline-offset: 2px;\n  border-radius: 3px;\n}\n.wrap {\n  max-width: var(--maxw);\n  margin: 0 auto;\n  padding: 2.5rem var(--pad) 5rem;\n}\n.head {\n  scroll-margin-top: 4.5rem;\n  padding-bottom: 1.5rem;\n}\n.head .title {\n  margin: 0 0 0.5rem;\n  font-size: 24px;\n  font-weight: 600;\n  line-height: 1.4;\n  letter-spacing: -0.01em;\n  color: var(--ink);\n}\n.head .sub {\n  margin: 0;\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 0.3rem 0.85rem;\n  font-size: 0.85rem;\n  line-height: 1.6;\n  color: var(--ink-2);\n}\n.head .sub .chip {\n  border: 1px solid var(--line);\n  border-radius: var(--radius);\n  padding: 0 0.5rem;\n  color: var(--ink-2);\n  background: var(--bg);\n}\n.toolbar {\n  position: sticky;\n  top: 0;\n  z-index: 10;\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 0.5rem;\n  margin: 0 calc(-1 * var(--pad));\n  padding: 0.65rem var(--pad);\n  background: var(--bg);\n  border-top: 1px solid var(--line);\n  border-bottom: 1px solid var(--line);\n}\n.toolbar .jump {\n  margin-left: auto;\n  display: flex;\n  align-items: center;\n  gap: 0.4rem;\n  font-size: 0.82rem;\n  color: var(--ink-3);\n  white-space: nowrap;\n}\n.toolbar .jump a {\n  color: var(--ink-2);\n}\n.toolbar .jump a:hover {\n  color: var(--accent);\n}\nbutton {\n  font-family: inherit;\n  font-size: 0.875rem;\n  line-height: 1.5;\n  padding: 0.4rem 0.85rem;\n  color: var(--ink);\n  background: var(--bg);\n  border: 1px solid var(--line);\n  border-radius: var(--radius);\n  cursor: pointer;\n}\nbutton:hover {\n  background: var(--bg-subtle);\n}\nbutton:active {\n  background: var(--bg-subtle);\n}\nbutton:disabled {\n  opacity: 0.45;\n  cursor: default;\n}\n.notice {\n  display: flex;\n  align-items: baseline;\n  gap: 0.75rem;\n  margin: 0;\n  padding: 0.7rem 0;\n  border-bottom: 1px solid var(--line);\n  color: var(--ink-2);\n  font-size: 0.875rem;\n  line-height: 1.6;\n}\n.notice[hidden] {\n  display: none;\n}\n.notice .notice-text {\n  flex: 1 1 auto;\n}\n.notice button {\n  flex: 0 0 auto;\n  padding: 0.15rem 0.55rem;\n  font-size: 0.8rem;\n  color: var(--ink-2);\n}\n.error {\n  margin: 1.5rem 0 0;\n  padding: 0.85rem 1rem;\n  border: 1px solid var(--line);\n  border-left: 3px solid var(--danger);\n  border-radius: var(--radius);\n  background: var(--bg-subtle);\n  color: var(--danger);\n  font-size: 0.925rem;\n}\n.error code {\n  font-family: var(--mono);\n}\n.meta:not(:empty) {\n  margin-top: 1.75rem;\n  display: grid;\n  gap: 0.5rem;\n}\n.meta details {\n  border: 1px solid var(--line);\n  border-radius: var(--radius);\n  background: var(--bg);\n}\n.meta summary {\n  cursor: pointer;\n  padding: 0.5rem 0.9rem;\n  color: var(--ink-2);\n  font-size: 0.9rem;\n  list-style-position: inside;\n}\n.meta summary::marker {\n  color: var(--ink-3);\n}\n.meta .meta-body {\n  padding: 0.7rem 0.9rem 0.8rem;\n  border-top: 1px solid var(--line);\n  color: var(--ink-2);\n  font-size: 0.925rem;\n}\n.turns {\n  margin-top: 2rem;\n  display: block;\n}\n.turn {\n  border-top: 1px solid var(--line);\n  padding: 1.75rem 0;\n}\n.turn:first-child {\n  border-top: 0;\n  padding-top: 0.5rem;\n}\n.turn-head {\n  display: flex;\n  align-items: baseline;\n  flex-wrap: wrap;\n  gap: 0.2rem 0.6rem;\n  margin-bottom: 0.6rem;\n  font-size: 0.8rem;\n}\n.turn-head .speaker {\n  font-size: 1rem;\n  font-weight: 600;\n  line-height: 1.5;\n}\n.turn-head .idx {\n  color: var(--ink-3);\n  font-family: var(--mono);\n  font-size: 0.78rem;\n}\n.turn-head time {\n  color: var(--ink-3);\n}\n.turn-head .tag {\n  border: 1px solid var(--line);\n  border-radius: var(--radius);\n  padding: 0 0.4rem;\n  color: var(--ink-3);\n  font-size: 0.74rem;\n  line-height: 1.6;\n}\n.turn.role-assistant .speaker {\n  color: var(--assistant);\n}\n.turn.role-user .speaker {\n  color: var(--user);\n}\n.turn.role-system .speaker {\n  color: var(--system);\n}\n.turn.role-system {\n  color: var(--ink-3);\n  font-size: 0.9rem;\n}\n.body > :first-child {\n  margin-top: 0;\n}\n.body > :last-child {\n  margin-bottom: 0;\n}\n.body p {\n  margin: 0 0 0.9rem;\n}\n.body h1,\n.body h2,\n.body h3 {\n  margin: 1.5rem 0 0.7rem;\n  line-height: 1.4;\n  font-weight: 600;\n  color: var(--ink);\n}\n.body h1 {\n  font-size: 1.3rem;\n}\n.body h2 {\n  font-size: 1.15rem;\n}\n.body h3 {\n  font-size: 1.02rem;\n}\n.body strong {\n  font-weight: 700;\n}\n.body em {\n  font-style: italic;\n}\n.body del {\n  color: var(--ink-3);\n}\n.body ul,\n.body ol {\n  margin: 0 0 0.9rem;\n  padding-left: 1.4rem;\n}\n.body li {\n  margin: 0.15rem 0;\n}\n.body blockquote {\n  margin: 0 0 0.9rem;\n  padding: 0.1rem 0 0.1rem 1rem;\n  border-left: 3px solid var(--line);\n  color: var(--ink-2);\n}\n.body hr {\n  border: 0;\n  border-top: 1px solid var(--line);\n  margin: 1.6rem 0;\n}\n.body code {\n  font-family: var(--mono);\n  font-size: 0.875em;\n  background: var(--bg-subtle);\n  border-radius: 3px;\n  padding: 0.1em 0.35em;\n}\n.body pre {\n  margin: 0 0 0.9rem;\n  padding: 0.8rem 1rem;\n  background: var(--code-bg);\n  border: 1px solid var(--code-border);\n  border-left: 3px solid var(--accent);\n  border-radius: var(--radius);\n  overflow-x: auto;\n  line-height: 1.6;\n  font-family: var(--mono);\n}\n.body pre code {\n  background: none;\n  padding: 0;\n  font-size: 0.85rem;\n}\n.body table {\n  border-collapse: collapse;\n  margin: 0 0 0.9rem;\n}\n.body th,\n.body td {\n  border: 1px solid var(--line);\n  padding: 0.3rem 0.6rem;\n}\n.body img,\n.gallery img {\n  display: block;\n  max-width: 100%;\n  height: auto;\n  margin: 0.75rem 0;\n  border-radius: var(--radius);\n}\n.img-failed {\n  display: block;\n  margin: 0.5rem 0;\n  color: var(--ink-3);\n  font-size: 0.82rem;\n  font-family: var(--mono);\n  overflow-wrap: anywhere;\n}\n.gallery {\n  margin-top: 0.75rem;\n  display: grid;\n  gap: 0.5rem;\n}\n.gallery figure {\n  margin: 0;\n}\n.gallery figcaption {\n  color: var(--ink-3);\n  font-size: 0.8rem;\n}\n.foot {\n  scroll-margin-top: 4.5rem;\n  margin-top: 3rem;\n  padding-top: 1.25rem;\n  border-top: 1px solid var(--line);\n  color: var(--ink-3);\n  font-size: 0.8rem;\n  overflow-wrap: anywhere;\n}\n.toast {\n  position: fixed;\n  left: 50%;\n  bottom: 2rem;\n  transform: translateX(-50%);\n  z-index: 999;\n  padding: 0.45rem 1.1rem;\n  background: var(--ink);\n  color: var(--bg);\n  border-radius: var(--radius);\n  font-size: 0.875rem;\n  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);\n}\n.toast[hidden] {\n  display: none;\n}\n@media (max-width: 520px) {\n  body {\n    font-size: 15px;\n  }\n  .toolbar button {\n    flex: 1 1 auto;\n  }\n  .toolbar .jump {\n    margin-left: 0;\n    width: 100%;\n  }\n}\n@media print {\n  :root {\n    --bg: #ffffff;\n    --bg-subtle: #f4f5f7;\n    --ink: #1f2328;\n    --ink-2: #4a5259;\n    --ink-3: #6b7280;\n    --line: #c9ced6;\n    --accent: #1f2328;\n    --user: #1f2328;\n    --assistant: #1f2328;\n    --system: #6b7280;\n    color-scheme: light;\n  }\n  .toolbar,\n  .notice,\n  .toast,\n  noscript {\n    display: none !important;\n  }\n  body {\n    background: #fff;\n    color: var(--ink);\n    font-size: 12pt;\n    line-height: 1.6;\n  }\n  .wrap {\n    max-width: none;\n    padding: 0;\n  }\n  a {\n    color: var(--ink);\n    text-decoration: none;\n  }\n  .turn {\n    break-inside: avoid;\n    page-break-inside: avoid;\n  }\n  .body img,\n  .gallery img {\n    max-width: 100%;\n    height: auto;\n    break-inside: avoid;\n    page-break-inside: avoid;\n  }\n}\n.turn-head .copy {\n  margin-left: auto;\n  padding: 0.1rem 0.55rem;\n  font-size: 0.75rem;\n  line-height: 1.6;\n  color: var(--ink-3);\n  background: transparent;\n  border: 1px solid var(--line);\n  border-radius: 999px;\n  cursor: pointer;\n}\n.turn-head .copy:hover {\n  color: var(--ink);\n  border-color: var(--ink-3);\n}\n.pre-wrap {\n  position: relative;\n}\n.pre-wrap .pre-copy {\n  position: absolute;\n  top: 0.45rem;\n  right: 0.45rem;\n  padding: 0.05rem 0.5rem;\n  font-size: 0.72rem;\n  line-height: 1.6;\n  color: var(--ink-3);\n  background: var(--bg);\n  border: 1px solid var(--line);\n  border-radius: 999px;\n  cursor: pointer;\n  opacity: 0;\n  transition: opacity 0.12s;\n}\n.pre-wrap:hover .pre-copy,\n.pre-wrap .pre-copy:focus {\n  opacity: 1;\n}\n@media print {\n  .turn-head .copy,\n  .pre-wrap .pre-copy {\n    display: none !important;\n  }\n}\n.pre-wrap {\n  margin: 0 0 0.9rem;\n}\n.pre-wrap pre {\n  margin: 0;\n}\n.pre-wrap.titled pre {\n  border-top-left-radius: 0;\n  border-top-right-radius: 0;\n}\n.pre-title {\n  display: inline-block;\n  padding: 0.15rem 0.7rem;\n  font-size: 0.74rem;\n  font-weight: 600;\n  letter-spacing: 0.02em;\n  color: var(--ink-2);\n  background: var(--code-border);\n  border: 1px solid var(--code-border);\n  border-bottom: 0;\n  border-radius: var(--radius) var(--radius) 0 0;\n}\n';

  // src/schema.js
  var SCHEMA_VERSION = 1;
  var PLATFORMS = ["genit", "luna"];
  var CAPTURES = ["api", "paste", "screen"];
  var DEFAULT_CAPTURE = "api";
  var PASTE_KINDS = ["html", "fragment", "text"];
  var ROLES = ["user", "assistant", "system"];
  var DEFAULT_BOT_NAME = "Geas";
  var DEFAULT_SPEAKER = {
    user: "나",
    assistant: DEFAULT_BOT_NAME,
    system: "시스템"
  };
  var FORBIDDEN_FILENAME_CHARS = /[<>:"/\\|?*]/g;
  function str(v, fallback = "") {
    if (typeof v === "string") return v;
    if (v == null) return fallback;
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    return fallback;
  }
  __name(str, "str");
  function nullableStr(v) {
    if (typeof v === "string") return v;
    return null;
  }
  __name(nullableStr, "nullableStr");
  function isIsoLike(v) {
    return typeof v === "string" && !Number.isNaN(Date.parse(v));
  }
  __name(isIsoLike, "isIsoLike");
  function normalizeImage(raw, id) {
    const src = raw && typeof raw === "object" ? raw : {};
    const originalUrl = str(src.originalUrl !== void 0 ? src.originalUrl : src.url, "");
    const dataUri = nullableStr(src.dataUri);
    const explicitStatus = src.status === "embedded" || src.status === "failed" ? src.status : null;
    const status = explicitStatus || (dataUri ? "embedded" : "failed");
    const out = {
      id,
      alt: str(src.alt, ""),
      mime: str(src.mime, "image/png"),
      dataUri: status === "embedded" ? dataUri : null,
      assetId: null,
      originalUrl,
      status
    };
    if (status === "failed") {
      const err = str(src.error, "");
      out.error = err || "내장 실패";
    }
    return out;
  }
  __name(normalizeImage, "normalizeImage");
  function createExport({ source, meta, turns } = {}) {
    const src = source && typeof source === "object" ? source : {};
    const mt = meta && typeof meta === "object" ? meta : {};
    const list = Array.isArray(turns) ? turns : [];
    let imageSeq = 0;
    const outTurns = list.map((rawTurn, i) => {
      const t = rawTurn && typeof rawTurn === "object" ? rawTurn : {};
      const role = ROLES.includes(t.role) ? t.role : "assistant";
      const rawImages = Array.isArray(t.images) ? t.images : Array.isArray(t.imageUrls) ? t.imageUrls : [];
      return {
        index: i,
        role,
        speaker: str(t.speaker, "") || DEFAULT_SPEAKER[role],
        text: str(t.text, ""),
        createdAt: isIsoLike(t.createdAt) ? t.createdAt : null,
        images: rawImages.map((img) => normalizeImage(img, `img_${imageSeq++}`))
      };
    });
    const assets = {};
    const assetIdByDataUri = /* @__PURE__ */ new Map();
    let assetSeq = 0;
    for (const turn of outTurns) {
      for (const img of turn.images) {
        if (img.status !== "embedded" || typeof img.dataUri !== "string" || img.dataUri === "") continue;
        let assetId = assetIdByDataUri.get(img.dataUri);
        if (assetId === void 0) {
          assetId = `asset_${assetSeq++}`;
          assetIdByDataUri.set(img.dataUri, assetId);
          assets[assetId] = { mime: img.mime, dataUri: img.dataUri, originalUrl: img.originalUrl };
        }
        img.assetId = assetId;
        img.dataUri = null;
      }
    }
    return {
      schemaVersion: SCHEMA_VERSION,
      source: {
        platform: PLATFORMS.includes(src.platform) ? src.platform : str(src.platform, ""),
        chatId: str(src.chatId, ""),
        title: str(src.title, ""),
        botName: str(src.botName, "") || DEFAULT_BOT_NAME,
        exportedAt: isIsoLike(src.exportedAt) ? src.exportedAt : (/* @__PURE__ */ new Date()).toISOString(),
        url: str(src.url, ""),
        capture: CAPTURES.includes(src.capture) ? src.capture : DEFAULT_CAPTURE,
        // 아는 값일 때만 싣는다. 모르는 값을 빈 문자열로 눌러 담지 않는다.
        ...PASTE_KINDS.includes(src.pasteKind) ? { pasteKind: src.pasteKind } : {}
      },
      meta: {
        startSetting: nullableStr(mt.startSetting),
        persona: nullableStr(mt.persona)
      },
      assets,
      turns: outTurns
    };
  }
  __name(createExport, "createExport");
  function validateExport(obj) {
    const errors = [];
    const push = /* @__PURE__ */ __name((m2) => errors.push(m2), "push");
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
      return { ok: false, errors: ["export가 객체가 아닙니다"] };
    }
    if (obj.schemaVersion !== SCHEMA_VERSION) {
      push(`schemaVersion이 ${SCHEMA_VERSION}이 아닙니다 (받은 값: ${JSON.stringify(obj.schemaVersion)})`);
    }
    const s = obj.source;
    if (!s || typeof s !== "object") {
      push("source가 없습니다");
    } else {
      if (!PLATFORMS.includes(s.platform)) push(`source.platform이 올바르지 않습니다: ${JSON.stringify(s.platform)}`);
      for (const k of ["chatId", "title", "botName", "url"]) {
        if (typeof s[k] !== "string") push(`source.${k}가 문자열이 아닙니다`);
      }
      if (!isIsoLike(s.exportedAt)) push("source.exportedAt이 ISO 8601 문자열이 아닙니다");
      if (s.capture !== void 0 && !CAPTURES.includes(s.capture)) {
        push(`source.capture가 올바르지 않습니다: ${JSON.stringify(s.capture)}`);
      }
      if (s.pasteKind !== void 0 && !PASTE_KINDS.includes(s.pasteKind)) {
        push(`source.pasteKind가 올바르지 않습니다: ${JSON.stringify(s.pasteKind)}`);
      }
    }
    const m = obj.meta;
    if (!m || typeof m !== "object") {
      push("meta가 없습니다");
    } else {
      for (const k of ["startSetting", "persona"]) {
        if (!(m[k] === null || typeof m[k] === "string")) push(`meta.${k}는 문자열 또는 null이어야 합니다`);
      }
    }
    const assets = obj.assets;
    const hasAssets = assets !== void 0 && assets !== null;
    if (hasAssets && (typeof assets !== "object" || Array.isArray(assets))) {
      push("assets가 객체가 아닙니다");
    } else if (hasAssets) {
      for (const [assetId, asset] of Object.entries(assets)) {
        const aa = `assets[${JSON.stringify(assetId)}]`;
        if (!asset || typeof asset !== "object" || Array.isArray(asset)) {
          push(`${aa}가 객체가 아닙니다`);
          continue;
        }
        if (typeof asset.mime !== "string" || asset.mime === "") push(`${aa}.mime이 비어 있습니다`);
        if (typeof asset.dataUri !== "string" || asset.dataUri === "") push(`${aa}.dataUri가 비어 있습니다`);
      }
    }
    const assetTable = hasAssets && typeof assets === "object" && !Array.isArray(assets) ? assets : {};
    if (!Array.isArray(obj.turns)) {
      push("turns가 배열이 아닙니다");
      return { ok: errors.length === 0, errors };
    }
    const seenImageIds = /* @__PURE__ */ new Set();
    obj.turns.forEach((t, i) => {
      const at = `turns[${i}]`;
      if (!t || typeof t !== "object") {
        push(`${at}가 객체가 아닙니다`);
        return;
      }
      if (t.index !== i) push(`${at}.index가 배열 순서와 다릅니다 (${JSON.stringify(t.index)} ≠ ${i})`);
      if (!ROLES.includes(t.role)) push(`${at}.role이 올바르지 않습니다: ${JSON.stringify(t.role)}`);
      if (typeof t.speaker !== "string" || t.speaker === "") push(`${at}.speaker가 비어 있습니다`);
      if (typeof t.text !== "string") push(`${at}.text가 문자열이 아닙니다`);
      if (!(t.createdAt === null || isIsoLike(t.createdAt))) push(`${at}.createdAt이 ISO 8601 문자열 또는 null이 아닙니다`);
      if (!Array.isArray(t.images)) {
        push(`${at}.images가 배열이 아닙니다`);
        return;
      }
      t.images.forEach((img, j) => {
        const ia = `${at}.images[${j}]`;
        if (!img || typeof img !== "object") {
          push(`${ia}가 객체가 아닙니다`);
          return;
        }
        if (typeof img.id !== "string" || img.id === "") push(`${ia}.id가 비어 있습니다`);
        else if (seenImageIds.has(img.id)) push(`${ia}.id가 중복입니다: ${img.id}`);
        else seenImageIds.add(img.id);
        if (typeof img.alt !== "string") push(`${ia}.alt가 문자열이 아닙니다`);
        if (typeof img.mime !== "string") push(`${ia}.mime이 문자열이 아닙니다`);
        else if (img.mime === "") push(`${ia}.mime이 비어 있습니다`);
        if (typeof img.originalUrl !== "string") push(`${ia}.originalUrl이 문자열이 아닙니다`);
        if (img.status !== "embedded" && img.status !== "failed") {
          push(`${ia}.status가 올바르지 않습니다: ${JSON.stringify(img.status)}`);
        }
        if (!(img.assetId === void 0 || img.assetId === null || typeof img.assetId === "string")) {
          push(`${ia}.assetId가 문자열 또는 null이 아닙니다`);
        }
        if (img.status === "embedded") {
          const inline = typeof img.dataUri === "string" && img.dataUri !== "";
          if (typeof img.assetId === "string" && img.assetId !== "") {
            if (!Object.prototype.hasOwnProperty.call(assetTable, img.assetId)) {
              push(`${ia}.assetId가 assets에 없습니다: ${img.assetId}`);
            }
          } else if (!inline) {
            push(`${ia}.status가 embedded인데 dataUri가 없습니다`);
          }
        }
        if (img.status === "failed") {
          if (img.dataUri !== null) push(`${ia}.status가 failed인데 dataUri가 null이 아닙니다`);
          if (typeof img.assetId === "string" && img.assetId !== "") push(`${ia}.status가 failed인데 assetId가 있습니다`);
        }
      });
    });
    return { ok: errors.length === 0, errors };
  }
  __name(validateExport, "validateExport");
  function stripControlChars(s) {
    let out = "";
    for (const ch of String(s ?? "")) {
      const code = ch.codePointAt(0);
      if (code < 32 || code === 127) continue;
      out += ch;
    }
    return out;
  }
  __name(stripControlChars, "stripControlChars");
  function sanitizeFileNamePart(s) {
    return stripControlChars(s).replace(FORBIDDEN_FILENAME_CHARS, "").replace(/\s+/g, "_").replace(/_{2,}/g, "_").replace(/^[._]+|[._\s]+$/g, "");
  }
  __name(sanitizeFileNamePart, "sanitizeFileNamePart");
  function yyyymmddLocal(iso) {
    const d = iso ? new Date(iso) : /* @__PURE__ */ new Date();
    const dt = Number.isNaN(d.getTime()) ? /* @__PURE__ */ new Date() : d;
    const p = /* @__PURE__ */ __name((n) => String(n).padStart(2, "0"), "p");
    return `${dt.getFullYear()}${p(dt.getMonth() + 1)}${p(dt.getDate())}`;
  }
  __name(yyyymmddLocal, "yyyymmddLocal");
  function exportFileName(exp, ext) {
    const source = exp && exp.source || {};
    const platform = sanitizeFileNamePart(source.platform) || "unknown";
    const label = sanitizeFileNamePart(source.title) || sanitizeFileNamePart(source.chatId) || "chat";
    const capped = sanitizeFileNamePart(label.slice(0, 60)) || "chat";
    const date = yyyymmddLocal(source.exportedAt);
    const cleanExt = sanitizeFileNamePart(String(ext ?? "").replace(/^\.+/, "")) || "txt";
    return `Geas_${platform}_${capped}_${date}.${cleanExt}`;
  }
  __name(exportFileName, "exportFileName");

  // src/viewer-template.js
  var PLATFORM_LABELS = { genit: "젠잇", luna: "루나톡" };
  var ARCHIVE_CSP = [
    "default-src 'none'",
    "script-src 'unsafe-inline'",
    "style-src 'unsafe-inline'",
    "img-src data: blob:",
    "form-action 'none'",
    "base-uri 'none'"
  ].join("; ");
  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  __name(escapeHtml, "escapeHtml");
  function embedJson(value) {
    return JSON.stringify(value).replace(/<\/(script)/gi, (_m, tag) => "<\\/" + tag).replace(/<!--/g, "\\u003c!--");
  }
  __name(embedJson, "embedJson");
  function guardScriptBody(js) {
    return String(js == null ? "" : js).replace(/<\/(script)/gi, (_m, tag) => "<\\/" + tag);
  }
  __name(guardScriptBody, "guardScriptBody");
  function guardStyleBody(css) {
    return String(css == null ? "" : css).replace(/<\/(style)/gi, (_m, tag) => "<\\/" + tag);
  }
  __name(guardStyleBody, "guardStyleBody");
  var SKELETON = `<div class="wrap">
  <header class="head" id="head"></header>

  <nav class="toolbar" id="toolbar" aria-label="내보내기 도구">
    <button type="button" id="btn-md">Markdown 저장</button>
    <button type="button" id="btn-json">원본 JSON 저장</button>
    <span class="jump">
      <a href="#foot" id="jump-bottom">맨 아래로</a>
      <span aria-hidden="true">/</span>
      <a href="#head" id="jump-top">맨 위로</a>
    </span>
  </nav>

  <p class="notice" id="notice" hidden>
    <span class="notice-text">이 파일에는 대화 본문, 이미지, 원본 데이터가 함께 들어 있습니다. 위 버튼으로 다른 형식으로 저장할 수 있습니다.</span>
    <button type="button" id="notice-close">닫기</button>
  </p>

  <p class="error" id="error" hidden></p>

  <section class="meta" id="meta"></section>

  <main class="turns" id="turns"></main>

  <footer class="foot" id="foot"></footer>
</div>

<div class="toast" id="toast" role="status" aria-live="polite" hidden></div>

<noscript>
  <p class="error">이 기록은 JavaScript로 그려집니다. 브라우저의 JavaScript를 켠 뒤 파일을 다시 열어 주세요. 원본 데이터는 이 파일 안의 <code>#geas-export</code> JSON에 그대로 들어 있습니다.</p>
</noscript>`;
  function renderHtmlDocument(exp, { viewerJs = "", viewerCss = "" } = {}) {
    const source = exp && exp.source || {};
    const rawTitle = source.title || source.chatId || "Geas 채팅";
    const platform = PLATFORM_LABELS[source.platform] || source.platform || "";
    const docTitle = platform ? rawTitle + " · " + platform + " 채팅 기록" : rawTitle + " · 채팅 기록";
    return `<!doctype html>
<html lang="ko">
<head>
<meta http-equiv="Content-Security-Policy" content="${escapeHtml(ARCHIVE_CSP)}">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<meta name="generator" content="대화 저장">
<title>${escapeHtml(docTitle)}</title>
<style>${guardStyleBody(viewerCss)}</style>
</head>
<body>
${SKELETON}
<script type="application/json" id="geas-export">${embedJson(exp)}<\/script>
<script>${guardScriptBody(viewerJs)}<\/script>
</body>
</html>
`;
  }
  __name(renderHtmlDocument, "renderHtmlDocument");

  // src/images.js
  var DEFAULT_MAX_BYTES = 600 * 1024;
  var LOSSY_QUALITY = 0.85;
  function dataUriBytes(dataUri) {
    const comma = dataUri.indexOf(",");
    if (comma < 0) return 0;
    const body = dataUri.length - comma - 1;
    let pad = 0;
    if (dataUri.endsWith("==")) pad = 2;
    else if (dataUri.endsWith("=")) pad = 1;
    return Math.floor(body * 3 / 4) - pad;
  }
  __name(dataUriBytes, "dataUriBytes");
  function isAbortError(err) {
    return !!err && (err.name === "AbortError" || err.code === 20);
  }
  __name(isAbortError, "isAbortError");
  function blobToDataUri(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("파일 읽기 실패"));
      reader.readAsDataURL(blob);
    });
  }
  __name(blobToDataUri, "blobToDataUri");
  async function decodeBlob(blob) {
    if (typeof createImageBitmap === "function") {
      try {
        return await createImageBitmap(blob);
      } catch (err) {
      }
    }
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise((resolve, reject) => {
        const el2 = new Image();
        el2.onload = () => resolve(el2);
        el2.onerror = () => reject(new Error("이미지 디코드 실패"));
        el2.src = url;
      });
      return img;
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1e4);
    }
  }
  __name(decodeBlob, "decodeBlob");
  function drawToCanvas(source) {
    const w = source.width || source.naturalWidth;
    const h = source.height || source.naturalHeight;
    if (!w || !h) throw new Error("이미지 크기를 알 수 없음");
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d 컨텍스트 없음");
    ctx.drawImage(source, 0, 0, w, h);
    return canvas;
  }
  __name(drawToCanvas, "drawToCanvas");
  async function embedImage(url, opts = {}) {
    const { signal, preferJpeg = false, maxBytes = DEFAULT_MAX_BYTES } = opts;
    let sameOrigin = false;
    try {
      sameOrigin = new URL(url, location.href).origin === location.origin;
    } catch (err) {
    }
    const attempts = sameOrigin ? ["include"] : ["omit", "include"];
    let res = null;
    let lastErr = null;
    for (const credentials of attempts) {
      try {
        res = await fetch(url, { credentials, signal });
        break;
      } catch (err) {
        if (isAbortError(err)) throw err;
        lastErr = err;
      }
    }
    if (!res) {
      throw new Error("가져오기 실패(CORS 차단 또는 네트워크): " + (lastErr && lastErr.message || lastErr));
    }
    if (!res.ok) throw new Error("HTTP " + res.status);
    const blob = await res.blob();
    if (!blob.size) throw new Error("빈 응답");
    const originalMime = (blob.type || "").split(";")[0].toLowerCase();
    const passthroughOk = originalMime === "image/png" || originalMime === "image/jpeg";
    let source = null;
    try {
      source = await decodeBlob(blob);
    } catch (err) {
      if (isAbortError(err)) throw err;
      if (passthroughOk) {
        const dataUri = await blobToDataUri(blob);
        return { mime: originalMime, dataUri };
      }
      throw err;
    }
    try {
      const canvas = drawToCanvas(source);
      if (!preferJpeg) {
        const png = canvas.toDataURL("image/png");
        if (dataUriBytes(png) <= maxBytes) return { mime: "image/png", dataUri: png };
      }
      const webp = canvas.toDataURL("image/webp", LOSSY_QUALITY);
      if (webp.startsWith("data:image/webp")) return { mime: "image/webp", dataUri: webp };
      const jpeg = canvas.toDataURL("image/jpeg", LOSSY_QUALITY);
      if (!jpeg.startsWith("data:image/jpeg")) throw new Error("jpeg 변환 실패");
      return { mime: "image/jpeg", dataUri: jpeg };
    } catch (err) {
      if (isAbortError(err)) throw err;
      if (passthroughOk) {
        const dataUri = await blobToDataUri(blob);
        return { mime: originalMime, dataUri };
      }
      throw err;
    } finally {
      if (source && typeof source.close === "function") source.close();
    }
  }
  __name(embedImage, "embedImage");
  function collectUrls(turns) {
    const urls = [];
    const seen = /* @__PURE__ */ new Set();
    for (const turn of turns || []) {
      for (const item of turn && turn.imageUrls || []) {
        const url = item && item.url;
        if (!url || seen.has(url)) continue;
        seen.add(url);
        urls.push(url);
      }
    }
    return urls;
  }
  __name(collectUrls, "collectUrls");
  async function embedAll(turns, opts = {}) {
    const { signal, onProgress, concurrency = 3 } = opts;
    const urls = collectUrls(turns);
    const result = /* @__PURE__ */ new Map();
    const total = urls.length;
    const report = /* @__PURE__ */ __name((done2) => {
      if (typeof onProgress === "function") {
        onProgress("이미지 내장 " + done2 + "/" + total, total ? done2 / total : 1);
      }
    }, "report");
    report(0);
    if (!total) return result;
    let cursor = 0;
    let done = 0;
    const workers = new Array(Math.max(1, Math.min(concurrency, total))).fill(null).map(async () => {
      for (; ; ) {
        if (signal && signal.aborted) throw new DOMException("중단됨", "AbortError");
        const i = cursor++;
        if (i >= total) return;
        const url = urls[i];
        try {
          result.set(url, await embedImage(url, { signal }));
        } catch (err) {
          if (isAbortError(err)) throw err;
          result.set(url, { error: err && err.message || String(err) });
        }
        report(++done);
      }
    });
    await Promise.all(workers);
    return result;
  }
  __name(embedAll, "embedAll");
  function attachImages(rawTurns, embedded) {
    return (rawTurns || []).map((turn) => {
      const images = [];
      for (const item of turn && turn.imageUrls || []) {
        const url = item && item.url;
        if (!url) continue;
        const result = embedded && embedded.get ? embedded.get(url) : null;
        if (result && result.dataUri) {
          images.push({
            alt: item.alt || "",
            mime: result.mime,
            dataUri: result.dataUri,
            originalUrl: url,
            status: "embedded"
          });
        } else {
          images.push({
            alt: item.alt || "",
            dataUri: null,
            originalUrl: url,
            status: "failed",
            error: result && result.error || "내장하지 못했습니다."
          });
        }
      }
      return {
        role: turn.role,
        speaker: turn.speaker,
        text: turn.text,
        createdAt: turn.createdAt == null ? null : turn.createdAt,
        images
      };
    });
  }
  __name(attachImages, "attachImages");
  function summarizeImages(turns) {
    let ok = 0;
    const assets = /* @__PURE__ */ new Set();
    const failed = [];
    const seen = /* @__PURE__ */ new Set();
    for (const turn of turns || []) {
      for (const img of turn && turn.images || []) {
        if (img.status === "embedded") {
          ok++;
          if (img.assetId) assets.add(img.assetId);
        } else if (!seen.has(img.originalUrl)) {
          seen.add(img.originalUrl);
          failed.push({ url: img.originalUrl, error: img.error });
        }
      }
    }
    return { ok, unique: assets.size, failed };
  }
  __name(summarizeImages, "summarizeImages");
  function countUniqueImageUrls(turns) {
    return collectUrls(turns).length;
  }
  __name(countUniqueImageUrls, "countUniqueImageUrls");

  // src/download.js
  function downloadBlob(fileName, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
  }
  __name(downloadBlob, "downloadBlob");
  function htmlBlob(html) {
    return new Blob([html], { type: "text/html;charset=utf-8" });
  }
  __name(htmlBlob, "htmlBlob");

  // src/paste-page-core.js
  var DEBOUNCE_MS = 200;
  var PREVIEW_CHARS = 80;
  var ROLE_LABEL = { assistant: "AI", user: "나", system: "시스템" };
  var KIND_LABEL = {
    html: "인식: 페이지 복사본(정확)",
    fragment: "인식: 메시지 하나(부분 복사)",
    text: "인식: 글만(텍스트)"
  };
  var $ = /* @__PURE__ */ __name((id) => document.getElementById(id), "$");
  function pickParser(parsers) {
    const body = document.body;
    const name = body && body.dataset ? String(body.dataset.platform || "") : "";
    if (parsers[name]) return parsers[name];
    const first = Object.keys(parsers)[0];
    return first ? parsers[first] : null;
  }
  __name(pickParser, "pickParser");
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  __name(el, "el");
  function clip(text, max) {
    const flat = String(text == null ? "" : text).replace(/\s+/g, " ").trim();
    return flat.length <= max ? flat : flat.slice(0, max) + "…";
  }
  __name(clip, "clip");
  function countRoles(turns) {
    const counts = { assistant: 0, user: 0, system: 0 };
    for (const turn of turns) {
      if (counts[turn.role] === void 0) counts[turn.role] = 0;
      counts[turn.role] += 1;
    }
    return counts;
  }
  __name(countRoles, "countRoles");
  function countImageRefs(turns) {
    let n = 0;
    for (const turn of turns) n += (turn && turn.imageUrls || []).length;
    return n;
  }
  __name(countImageRefs, "countImageRefs");
  function formatBytes(bytes) {
    const n = typeof bytes === "number" && isFinite(bytes) && bytes > 0 ? bytes : 0;
    if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + " MB";
    return Math.round(n / 1024) + " KB";
  }
  __name(formatBytes, "formatBytes");
  function boot(parsers) {
    const pasteEl = $("paste");
    const botNameEl = $("botname");
    const previewEl = $("preview");
    const buildEl = $("build");
    const saveEl = $("save");
    const resultEl = $("result");
    if (!pasteEl || !previewEl || !buildEl) return;
    const parseClipboard = pickParser(parsers || {});
    if (!parseClipboard) return;
    let latest = null;
    let nameEdited = false;
    let timer = 0;
    let lastHtml = "";
    let lastPlain = null;
    let pending = null;
    let building = false;
    function activeHtml() {
      if (lastPlain === null) return "";
      return pasteEl.value === lastPlain ? lastHtml : "";
    }
    __name(activeHtml, "activeHtml");
    function overrideName() {
      if (!nameEdited || !botNameEl) return "";
      return botNameEl.value.trim();
    }
    __name(overrideName, "overrideName");
    function say(message, isError) {
      if (!resultEl) return;
      resultEl.textContent = message || "";
      resultEl.classList.toggle("bad", !!isError);
      resultEl.hidden = !message;
    }
    __name(say, "say");
    function dropPending() {
      pending = null;
      if (saveEl) saveEl.hidden = true;
    }
    __name(dropPending, "dropPending");
    function renderPreview(result) {
      previewEl.textContent = "";
      if (pasteEl.value.trim() === "" && activeHtml() === "") {
        previewEl.appendChild(el("p", "muted", "붙여 넣으면 여기에 결과가 표시됩니다."));
        return;
      }
      previewEl.appendChild(el("p", "kind", KIND_LABEL[result.kind] || KIND_LABEL.text));
      const turns = result.turns;
      const counts = countRoles(turns);
      const parts = ["턴 " + turns.length + "개"];
      if (counts.assistant) parts.push("AI " + counts.assistant + "개");
      if (counts.user) parts.push("나 " + counts.user + "개");
      const images = countImageRefs(turns);
      if (images) parts.push("이미지 " + images + "장");
      previewEl.appendChild(el("p", "count", parts.join(" · ")));
      if (turns.length > 0) {
        const list = el("dl", "sample");
        const first = turns[0];
        const last = turns[turns.length - 1];
        list.appendChild(el("dt", null, "첫 턴 · " + (ROLE_LABEL[first.role] || first.role)));
        list.appendChild(el("dd", null, clip(first.text, PREVIEW_CHARS)));
        if (turns.length > 1) {
          list.appendChild(el("dt", null, "마지막 턴 · " + (ROLE_LABEL[last.role] || last.role)));
          list.appendChild(el("dd", null, clip(last.text, PREVIEW_CHARS)));
        }
        previewEl.appendChild(list);
      }
      for (const warning of result.warnings) {
        previewEl.appendChild(el("p", "warn", warning));
      }
    }
    __name(renderPreview, "renderPreview");
    function parseNow() {
      const result = parseClipboard({
        html: activeHtml(),
        text: pasteEl.value,
        botName: overrideName()
      });
      latest = result;
      if (botNameEl && !nameEdited) botNameEl.value = result.botName;
      renderPreview(result);
      buildEl.disabled = building || result.turns.length === 0;
      return result;
    }
    __name(parseNow, "parseNow");
    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        dropPending();
        say("");
        parseNow();
      }, DEBOUNCE_MS);
    }
    __name(schedule, "schedule");
    function applyName(result) {
      const name = (botNameEl && botNameEl.value || result.botName || "").trim();
      const source = Object.assign({}, result.source);
      if (name) {
        source.botName = name;
        source.title = name;
      }
      const turns = result.turns.map(
        (turn) => turn.role === "assistant" && name ? Object.assign({}, turn, { speaker: name }) : turn
      );
      return { source, turns };
    }
    __name(applyName, "applyName");
    async function build() {
      if (building) return;
      const result = parseNow();
      if (result.turns.length === 0) {
        say("저장할 대화를 찾지 못했습니다. 복사한 것을 다시 붙여 넣어 주세요.", true);
        return;
      }
      building = true;
      buildEl.disabled = true;
      dropPending();
      try {
        const { source, turns } = applyName(result);
        const total = countUniqueImageUrls(turns);
        if (total > 0) say("이미지 내려받는 중 0/" + total);
        const embedded = await embedAll(turns, {
          onProgress: /* @__PURE__ */ __name((_message, ratio) => {
            if (!total) return;
            say("이미지 내려받는 중 " + Math.round((ratio || 0) * total) + "/" + total);
          }, "onProgress")
        });
        say("파일을 만드는 중...");
        const exp = createExport({ source, meta: result.meta, turns: attachImages(turns, embedded) });
        const check = validateExport(exp);
        if (!check.ok) {
          if (typeof console !== "undefined") console.error("[geas-export] 스키마 검증 실패:", check.errors);
          say("만든 데이터가 올바르지 않습니다: " + check.errors.join(", "), true);
          return;
        }
        const html = renderHtmlDocument(exp, { viewerJs: viewer_readable_default, viewerCss: viewer_css_readable_default });
        const fileName = exportFileName(exp, "html");
        const stats = summarizeImages(exp.turns);
        pending = { fileName, html };
        const bits = [
          "파일 크기 약 " + formatBytes(new Blob([html]).size),
          "턴 " + exp.turns.length
        ];
        if (stats.ok || stats.failed.length) {
          bits.push(
            "이미지 " + stats.ok + "(고유 " + stats.unique + (stats.failed.length ? " · 실패 " + stats.failed.length : "") + ")"
          );
        }
        say(bits.join(" · "));
        if (saveEl) {
          saveEl.hidden = false;
          saveEl.textContent = "저장";
        }
      } catch (err) {
        if (typeof console !== "undefined") console.error("[geas-export] 파일 생성 실패:", err);
        say("파일을 만들지 못했습니다. 브라우저 콘솔(F12)에 자세한 원인이 남습니다.", true);
      } finally {
        building = false;
        buildEl.disabled = latest ? latest.turns.length === 0 : true;
      }
    }
    __name(build, "build");
    function save() {
      if (!pending) return;
      const { fileName } = pending;
      try {
        downloadBlob(fileName, htmlBlob(pending.html));
      } catch (err) {
        if (typeof console !== "undefined") console.error("[geas-export] 저장 실패:", err);
        say("저장하지 못했습니다. 브라우저의 다운로드 차단 설정을 확인해 주세요.", true);
        return;
      }
      dropPending();
      say("저장했습니다 — " + fileName);
    }
    __name(save, "save");
    pasteEl.addEventListener("input", schedule);
    pasteEl.addEventListener("paste", (event) => {
      const data = event && event.clipboardData;
      if (data && typeof data.getData === "function") {
        try {
          lastHtml = data.getData("text/html") || "";
          lastPlain = data.getData("text/plain") || "";
        } catch (err) {
          lastHtml = "";
          lastPlain = null;
        }
      } else {
        lastHtml = "";
        lastPlain = null;
      }
      setTimeout(() => {
        if (lastPlain !== null && pasteEl.value !== lastPlain) lastPlain = pasteEl.value;
        clearTimeout(timer);
        dropPending();
        say("");
        parseNow();
      }, 0);
    });
    if (botNameEl) {
      botNameEl.addEventListener("input", () => {
        nameEdited = botNameEl.value.trim() !== "";
        schedule();
      });
    }
    buildEl.addEventListener("click", () => {
      build();
    });
    if (saveEl) saveEl.addEventListener("click", save);
    parseNow();
  }
  __name(boot, "boot");
  function start(parsers) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => boot(parsers), { once: true });
    } else {
      boot(parsers);
    }
  }
  __name(start, "start");

  // src/luna-paste.js
  var DISCLAIMER_HEAD = "이 캐릭터는 유저가 기입한 정보를 토대로 제작된 AI 챗봇 입니다.";
  var DISCLAIMER_TAIL = "동명의 실존인물 혹은 단체와는 관계가 없습니다.";
  var FOOTER_MARK = "🚨";
  var FOOTER_MARK_ALT = "*지문*";
  var DISCOUNT_PREFIX = "위키 적응기 할인";
  var INPUT_PLACEHOLDER = '*손을 흔들며 밝게 인사한다* "안녕!"';
  var LABEL_MAX = 12;
  var USER_SPEAKER = "나";
  var WARN_NO_DISCLAIMER = "안내 문구를 찾지 못해 첫 줄을 이름으로 사용했습니다";
  var WARN_NO_TURNS = "대화를 찾지 못했습니다";
  var TRAILING_BLANK = /[ \t\u00a0\u200b\u200c\u200d\ufeff]+$/;
  function splitLines(text) {
    return String(text == null ? "" : text).replace(/^\ufeff/, "").replace(/\r\n?/g, "\n").split("\n").map((line) => line.replace(TRAILING_BLANK, ""));
  }
  __name(splitLines, "splitLines");
  function findDisclaimerEnd(lines) {
    let end = -1;
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (t === DISCLAIMER_HEAD || t === DISCLAIMER_TAIL) end = i + 1;
    }
    return end;
  }
  __name(findDisclaimerEnd, "findDisclaimerEnd");
  function firstNonEmpty(lines, from) {
    for (let i = Math.max(0, from); i < lines.length; i++) {
      if (lines[i].trim() !== "") return i;
    }
    return -1;
  }
  __name(firstNonEmpty, "firstNonEmpty");
  function cutFooter(lines, from) {
    let end = lines.length;
    for (let i = from; i < end; i++) {
      if (lines[i].trim() === FOOTER_MARK) {
        end = i;
        break;
      }
    }
    if (end === lines.length) {
      for (let i = from; i < end; i++) {
        if (lines[i].trim() === FOOTER_MARK_ALT) {
          end = i;
          break;
        }
      }
    }
    while (end > from) {
      const t = lines[end - 1].trim();
      if (t === "" || t === INPUT_PLACEHOLDER || t.indexOf(DISCOUNT_PREFIX) === 0) {
        end--;
        continue;
      }
      break;
    }
    return end;
  }
  __name(cutFooter, "cutFooter");
  function isRuleLine(t) {
    return /^━+$/.test(t);
  }
  __name(isRuleLine, "isRuleLine");
  function isBlockLine(t) {
    return t !== "" && (t.indexOf("|") !== -1 || isRuleLine(t));
  }
  __name(isBlockLine, "isBlockLine");
  function isLabelLine(t) {
    return t !== "" && t.length <= LABEL_MAX && !/\s/.test(t) && t.indexOf("|") === -1 && !isRuleLine(t);
  }
  __name(isLabelLine, "isLabelLine");
  function readStatusBlock(lines, i, end, botName) {
    const label = lines[i].trim();
    if (!isLabelLine(label) || label === botName) return null;
    if (i + 1 >= end) return null;
    if (!isBlockLine(lines[i + 1].trim())) return null;
    const rows = [];
    let j = i + 1;
    while (j < end) {
      const t = lines[j].trim();
      if (t === botName || !isBlockLine(t)) break;
      rows.push(t);
      j++;
    }
    return { text: "```" + label + "\n" + rows.join("\n") + "\n```", next: j };
  }
  __name(readStatusBlock, "readStatusBlock");
  function tidy(text) {
    return text.replace(/\n{3,}/g, "\n\n").trim();
  }
  __name(tidy, "tidy");
  function makeTurn(role, speaker, buffer) {
    const text = tidy(buffer.join("\n"));
    if (text === "") return null;
    return { role, speaker, text, createdAt: null, imageUrls: [] };
  }
  __name(makeTurn, "makeTurn");
  function parseLunaPaste(text, options = {}) {
    const warnings = [];
    const lines = splitLines(text);
    const override = options && typeof options.botName === "string" ? options.botName.trim() : "";
    const disclaimerEnd = findDisclaimerEnd(lines);
    const start2 = disclaimerEnd >= 0 ? disclaimerEnd : 0;
    if (disclaimerEnd < 0 && firstNonEmpty(lines, 0) >= 0) warnings.push(WARN_NO_DISCLAIMER);
    const nameIdx = firstNonEmpty(lines, start2);
    const detected = nameIdx >= 0 ? lines[nameIdx].trim() : "";
    const botName = override || detected;
    const turns = [];
    if (botName !== "") {
      const end = cutFooter(lines, nameIdx >= 0 ? nameIdx + 1 : start2);
      let i = start2;
      while (i < end) {
        const head = lines[i].trim();
        if (head === "") {
          i++;
          continue;
        }
        if (head === botName) {
          i++;
          const buffer = [];
          while (i < end) {
            if (lines[i].trim() === botName) break;
            const block = readStatusBlock(lines, i, end, botName);
            if (block) {
              buffer.push(block.text);
              i = block.next;
              break;
            }
            buffer.push(lines[i]);
            i++;
          }
          const turn = makeTurn("assistant", botName, buffer);
          if (turn) turns.push(turn);
        } else {
          const buffer = [];
          while (i < end) {
            if (lines[i].trim() === botName) break;
            buffer.push(lines[i]);
            i++;
          }
          const turn = makeTurn("user", USER_SPEAKER, buffer);
          if (turn) turns.push(turn);
        }
      }
    }
    if (turns.length === 0 && warnings.indexOf(WARN_NO_TURNS) === -1) warnings.push(WARN_NO_TURNS);
    return {
      source: {
        platform: "luna",
        chatId: "",
        title: botName,
        botName,
        url: "",
        capture: "paste",
        pasteKind: PASTE_KIND_TEXT
      },
      meta: { startSetting: null, persona: null },
      turns,
      botName,
      warnings,
      kind: PASTE_KIND_TEXT
    };
  }
  __name(parseLunaPaste, "parseLunaPaste");
  var WARN_SINGLE_MESSAGE = "메시지 하나만 복사된 것으로 보입니다. 페이지 전체를 선택(Ctrl+A)해 다시 복사하면 대화 전체가 저장됩니다.";
  var PASTE_KIND_HTML = "html";
  var PASTE_KIND_FRAGMENT = "fragment";
  var PASTE_KIND_TEXT = "text";
  var UNKNOWN_SPEAKER = "AI";
  var NAMED_ENTITIES = {
    quot: '"',
    amp: "&",
    lt: "<",
    gt: ">",
    apos: "'",
    nbsp: " "
  };
  function decodeEntities(value) {
    return String(value == null ? "" : value).replace(
      /&(#\d+|#[xX][0-9a-fA-F]+|[a-zA-Z]+);/g,
      (whole, body) => {
        if (body.charAt(0) === "#") {
          const hex = body.charAt(1) === "x" || body.charAt(1) === "X";
          const code = hex ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
          if (!isFinite(code) || code < 0 || code > 1114111) return whole;
          try {
            return String.fromCodePoint(code);
          } catch (err) {
            return whole;
          }
        }
        const named = NAMED_ENTITIES[body.toLowerCase()];
        return named === void 0 ? whole : named;
      }
    );
  }
  __name(decodeEntities, "decodeEntities");
  function sourceUrlOf(html) {
    const head = String(html == null ? "" : html).slice(0, 2e3);
    const m = /^SourceURL:(.*)$/m.exec(head);
    if (!m) return "";
    const url = m[1].trim();
    return /^https?:\/\//i.test(url) ? url : "";
  }
  __name(sourceUrlOf, "sourceUrlOf");
  function chatIdOf(url) {
    const m = /\/talk\/(\d+)/.exec(String(url == null ? "" : url));
    return m ? m[1] : "";
  }
  __name(chatIdOf, "chatIdOf");
  function hasClass(classAttr, name) {
    return String(classAttr == null ? "" : classAttr).split(/\s+/).indexOf(name) !== -1;
  }
  __name(hasClass, "hasClass");
  function attrOf(attrs, name) {
    const re = new RegExp("\\b" + name + '="([^"]*)"', "i");
    const m = re.exec(String(attrs == null ? "" : attrs));
    return m ? m[1] : "";
  }
  __name(attrOf, "attrOf");
  function stripClipboardHeader(html) {
    const s = String(html == null ? "" : html);
    const i = s.search(/<html[\s>]/i);
    return i >= 0 ? s.slice(i) : s;
  }
  __name(stripClipboardHeader, "stripClipboardHeader");
  function messageListRegion(html) {
    const open = /<ul\b[^>]*\bid="messageList"[^>]*>/i.exec(html);
    if (!open) return "";
    const from = open.index + open[0].length;
    const re = /<(\/?)ul\b/gi;
    re.lastIndex = from;
    let depth = 1;
    let tag;
    while (tag = re.exec(html)) {
      depth += tag[1] ? -1 : 1;
      if (depth === 0) return html.slice(from, tag.index);
    }
    return html.slice(from);
  }
  __name(messageListRegion, "messageListRegion");
  function looksLikeLunaPage(html) {
    const region = messageListRegion(stripClipboardHeader(html));
    return region !== "" && /<li\b[^>]*\bclass="[^"]*\bcWrap\b/i.test(region);
  }
  __name(looksLikeLunaPage, "looksLikeLunaPage");
  function looksLikeLunaFragment(html) {
    const s = stripClipboardHeader(html);
    if (s === "") return false;
    return /class="[^"]*\b(?:narration|dialogue|md-bold|cbox)\b/i.test(s);
  }
  __name(looksLikeLunaFragment, "looksLikeLunaFragment");
  function wrapInline(mark, inner) {
    if (mark === "") return inner;
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner);
    if (!m || m[2] === "") return inner;
    return m[1] + mark + m[2] + mark + m[3];
  }
  __name(wrapInline, "wrapInline");
  function spanMark(classAttr) {
    if (hasClass(classAttr, "narration")) return "*";
    if (hasClass(classAttr, "md-bold")) return "**";
    return "";
  }
  __name(spanMark, "spanMark");
  function codeToFence(raw) {
    const lines = splitLines(raw);
    while (lines.length && lines[0].trim() === "") lines.shift();
    while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
    let label = "";
    let body = lines;
    const first = lines.length ? lines[0].trim() : "";
    if (lines.length > 1 && isLabelLine(first)) {
      label = first;
      body = lines.slice(1);
    }
    return "```" + label + "\n" + body.join("\n") + "\n```";
  }
  __name(codeToFence, "codeToFence");
  function textNode(html) {
    return decodeEntities(html).replace(/ /g, " ");
  }
  __name(textNode, "textNode");
  function textOnly(html) {
    return textNode(String(html == null ? "" : html).replace(/<[^>]*>/g, ""));
  }
  __name(textOnly, "textOnly");
  function fragmentToMarkdown(html) {
    const source = String(html == null ? "" : html);
    const stack = [{ mark: "", buf: [] }];
    const put = /* @__PURE__ */ __name((s) => {
      stack[stack.length - 1].buf.push(s);
    }, "put");
    const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
    let cursor = 0;
    let tag;
    while (tag = TAG.exec(source)) {
      if (tag.index > cursor) put(textNode(source.slice(cursor, tag.index)));
      cursor = TAG.lastIndex;
      const closing = tag[1] === "/";
      const name = tag[2].toLowerCase();
      const attrs = tag[3];
      if (name === "pre" && !closing) {
        const end = source.toLowerCase().indexOf("</pre>", cursor);
        const inner = end < 0 ? source.slice(cursor) : source.slice(cursor, end);
        put(codeToFence(textOnly(inner)));
        cursor = end < 0 ? source.length : end + 6;
        TAG.lastIndex = cursor;
        continue;
      }
      if (name === "br" && !closing) {
        put("\n");
        continue;
      }
      if (name === "img" && !closing) {
        const src = decodeEntities(attrOf(attrs, "src")).trim();
        if (src !== "") put("![" + decodeEntities(attrOf(attrs, "alt")) + "](" + src + ")");
        continue;
      }
      if (name === "span") {
        if (closing) {
          if (stack.length > 1) {
            const top = stack.pop();
            put(wrapInline(top.mark, top.buf.join("")));
          }
          continue;
        }
        if (!/\/\s*$/.test(attrs)) stack.push({ mark: spanMark(attrOf(attrs, "class")), buf: [] });
        continue;
      }
    }
    if (cursor < source.length) put(textNode(source.slice(cursor)));
    while (stack.length > 1) {
      const top = stack.pop();
      put(wrapInline(top.mark, top.buf.join("")));
    }
    return stack[0].buf.join("");
  }
  __name(fragmentToMarkdown, "fragmentToMarkdown");
  function collectImageUrls(text) {
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    const re = /!\[([^\]\n]*)\]\(\s*([^()\s]*)\s*\)/g;
    let m;
    while (m = re.exec(text)) {
      const url = m[2];
      if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
      seen.add(url);
      out.push({ url, alt: m[1] || "" });
    }
    return out;
  }
  __name(collectImageUrls, "collectImageUrls");
  function splitMessageItems(region) {
    const re = /<li\b((?:"[^"]*"|'[^']*'|[^>"'])*)>/gi;
    const heads = [];
    let m;
    while (m = re.exec(region)) {
      if (hasClass(attrOf(m[1], "class"), "cWrap")) {
        heads.push({ attrs: m[1], from: m.index + m[0].length });
      }
    }
    return heads.map((head, i) => ({
      attrs: head.attrs,
      html: region.slice(head.from, i + 1 < heads.length ? heads[i + 1].from : region.length)
    }));
  }
  __name(splitMessageItems, "splitMessageItems");
  function makeClipboardResult(kind, botName, turns, warnings, url) {
    return {
      source: {
        platform: "luna",
        chatId: chatIdOf(url),
        title: botName,
        botName,
        url,
        capture: "paste",
        pasteKind: kind
      },
      meta: { startSetting: null, persona: null },
      turns,
      botName,
      warnings,
      kind
    };
  }
  __name(makeClipboardResult, "makeClipboardResult");
  function parseLunaClipboardHtml(html, options = {}) {
    const warnings = [];
    const raw = String(html == null ? "" : html);
    const url = sourceUrlOf(raw);
    const doc = stripClipboardHeader(raw);
    const override = options && typeof options.botName === "string" ? options.botName.trim() : "";
    const items = splitMessageItems(messageListRegion(doc));
    let detected = "";
    const turns = [];
    for (const item of items) {
      const classAttr = attrOf(item.attrs, "class");
      const role = hasClass(classAttr, "user") ? "user" : "assistant";
      const nameMatch = /<span\b[^>]*\bclass="[^"]*\bcName\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i.exec(item.html);
      const name = nameMatch ? decodeEntities(nameMatch[1].replace(/<[^>]*>/g, "")).trim() : "";
      if (role === "assistant" && name !== "" && detected === "") detected = name;
      const contentMatch = /\bdata-content="([^"]*)"/i.exec(item.html);
      if (!contentMatch) continue;
      const text = tidy(splitLines(decodeEntities(contentMatch[1])).join("\n"));
      if (text === "") continue;
      turns.push({
        role,
        speaker: role === "user" ? USER_SPEAKER : name || detected || UNKNOWN_SPEAKER,
        text,
        createdAt: null,
        imageUrls: collectImageUrls(text)
      });
    }
    const botName = override || detected;
    if (botName !== "") {
      for (const turn of turns) {
        if (turn.role !== "user") turn.speaker = botName;
      }
    }
    if (turns.length === 0) warnings.push(WARN_NO_TURNS);
    return makeClipboardResult(PASTE_KIND_HTML, botName, turns, warnings, url);
  }
  __name(parseLunaClipboardHtml, "parseLunaClipboardHtml");
  function parseLunaClipboardFragment(html, options = {}) {
    const warnings = [];
    const raw = String(html == null ? "" : html);
    const url = sourceUrlOf(raw);
    const override = options && typeof options.botName === "string" ? options.botName.trim() : "";
    let body = stripClipboardHeader(raw);
    const start2 = body.indexOf("<!--StartFragment-->");
    if (start2 >= 0) body = body.slice(start2 + 20);
    const end = body.indexOf("<!--EndFragment-->");
    if (end >= 0) body = body.slice(0, end);
    const text = tidy(splitLines(fragmentToMarkdown(body)).join("\n"));
    const turns = [];
    if (text !== "") {
      turns.push({
        role: "assistant",
        speaker: override || UNKNOWN_SPEAKER,
        text,
        createdAt: null,
        imageUrls: collectImageUrls(text)
      });
      warnings.push(WARN_SINGLE_MESSAGE);
    } else {
      warnings.push(WARN_NO_TURNS);
    }
    return makeClipboardResult(PASTE_KIND_FRAGMENT, override, turns, warnings, url);
  }
  __name(parseLunaClipboardFragment, "parseLunaClipboardFragment");
  function parseLunaClipboard(input = {}) {
    const src = input && typeof input === "object" ? input : {};
    const html = typeof src.html === "string" ? src.html : "";
    const options = { botName: typeof src.botName === "string" ? src.botName : "" };
    if (html.trim() !== "") {
      if (looksLikeLunaPage(html)) return parseLunaClipboardHtml(html, options);
      if (looksLikeLunaFragment(html)) return parseLunaClipboardFragment(html, options);
    }
    return parseLunaPaste(src.text, options);
  }
  __name(parseLunaClipboard, "parseLunaClipboard");

  // src/paste-page-luna.js
  start({ luna: parseLunaClipboard });
})();
