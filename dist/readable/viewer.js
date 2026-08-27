// 대화 저장 도구 — 빌드 산출물. 원본: src/
(() => {
  var __defProp = Object.defineProperty;
  var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

  // src/markdown.js
  var MARK = String.fromCharCode(0);
  var RESTORE_RE = new RegExp(MARK + "(\\d+)" + MARK, "g");
  var LINK_PROTOCOL_RE = /^https?:\/\//i;
  var IMG_ALLOWED_RE = /^(https?:\/\/|data:image\/|blob:)/i;
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
    s = s.replace(/`([^`\n]+)`/g, (_m, code) => put("<code>" + code + "</code>"));
    s = s.replace(/!\[([^\]\n]*)\]\(\s*([^()\s]*)\s*\)/g, (m, alt, url) => {
      if (!url) return m;
      const html = imageHtml(alt, url, options);
      return html === null ? m : put(html);
    });
    s = s.replace(/\[([^\]\n]*)\]\(\s*([^()\s]*)\s*\)/g, (m, text, url) => {
      const rawUrl = unescapeHtml(url);
      if (!LINK_PROTOCOL_RE.test(rawUrl)) return m;
      return put(
        '<a href="' + escapeHtml(rawUrl) + '" target="_blank" rel="noopener noreferrer">' + text + "</a>"
      );
    });
    s = s.replace(/\*\*([^*\n]+)\*\*/g, (_m, x) => "<strong>" + x + "</strong>");
    s = s.replace(/~~([^~\n]+)~~/g, (_m, x) => "<del>" + x + "</del>");
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, (_m, pre, x) => pre + "<em>" + x + "</em>");
    s = s.replace(RESTORE_RE, (m, i) => {
      const v = stash[Number(i)];
      return v === void 0 ? m : v;
    });
    return s;
  }
  __name(renderInline, "renderInline");
  var RE_FENCE = /^\s{0,3}(```|~~~)\s*([^\s`~]*)\s*$/;
  var RE_HR = /^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/;
  var RE_HEADING = /^\s{0,3}(#{1,3})\s+(.*)$/;
  var RE_QUOTE = /^\s{0,3}>\s?(.*)$/;
  var RE_UL = /^\s{0,3}[-*]\s+(.+)$/;
  var RE_OL = /^\s{0,3}\d+[.)]\s+(.+)$/;
  var RE_BLANK = /^\s*$/;
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
      const src = text.split(MARK).join("").replace(/\r\n?/g, "\n");
      const lines = src.split("\n");
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
          while (i < lines.length && !new RegExp("^\\s{0,3}" + closer + "+\\s*$").test(lines[i])) {
            body.push(lines[i]);
            i++;
          }
          if (i < lines.length) i++;
          const cls = lang ? ' class="language-' + escapeHtml(lang) + '"' : "";
          out.push("<pre><code" + cls + ">" + escapeHtml(body.join("\n")) + "</code></pre>");
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
      return out.join("\n");
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
    return String(name ?? "").replace(/\\/g, "/").replace(/^\/+/, "");
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
  var FORBIDDEN_FILENAME_CHARS = /[<>:"/\\|?*]/g;
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
    const b64 = body.replace(/\s+/g, "");
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
    let out = text.replace(/!\[([^\]\n]*)\]\(\s*([^()\s]+)\s*\)/g, (m, alt, url) => {
      const img = byUrl.get(url);
      if (!img) return m;
      return replacementFor(img, alt);
    });
    out = out.replace(/\{\{url\}\}([^\s)\]]+)/g, (m, path) => {
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
    return ["| 항목 | 값 |", "| --- | --- |", ...rows.map((r) => "| " + r[0] + " | " + r[1] + " |")].join("\n");
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
    const markdown = parts.join("\n").replace(/\n{4,}/g, "\n\n\n") + "\n";
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
  var BARE_IMAGE_TOKEN = /^\{\{url\}\}(\S+)$/;
  var FAIL_MARKER_HEAD = "GEASxIMGFAILx";
  var FAIL_MARKER_TAIL = "xENDGEASx";
  var FAIL_MARKER_RE = new RegExp(FAIL_MARKER_HEAD + "(\\d+)" + FAIL_MARKER_TAIL, "g");
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
    const path = String(rawPath).replace(/^\/+/, "");
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
    return String(alt == null ? "" : alt).replace(/[\[\]()\n\r]/g, " ").trim();
  }
  __name(safeAlt, "safeAlt");
  function prepareBody(exp, turn, images) {
    const byUrl = /* @__PURE__ */ new Map();
    for (const img of images) {
      if (img.originalUrl) byUrl.set(String(img.originalUrl), img);
    }
    let text = String(turn && turn.text != null ? turn.text : "");
    if (images.length > 0 && text.indexOf("{{url}}") !== -1) {
      text = text.split("\n").map((line) => {
        const m = BARE_IMAGE_TOKEN.exec(line.trim());
        if (!m) return line;
        const img = findImageByPath(images, m[1]);
        if (!img) return line;
        const alt = safeAlt(img.alt) || safeAlt(m[1].replace(/\.[a-z0-9]+$/i, ""));
        return "![" + alt + "](" + img.originalUrl + ")";
      }).join("\n");
    }
    const failed = [];
    const referenced = /* @__PURE__ */ new Set();
    text = text.replace(/!\[([^\]\n]*)\]\(([^)\s]*)\)/g, (whole, _alt, url) => {
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
      const m = code && /(?:^|\s)language-(\S+)/.exec(code.className || "");
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
