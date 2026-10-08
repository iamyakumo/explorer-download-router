// 下载路径助手 - 后台服务脚本
// 原理：监听 chrome.downloads.onDeterminingFilename，
// 若下载来源匹配用户规则，则把文件名改写成 "子文件夹/原文件名"，
// 文件即会落入默认下载目录下的对应子文件夹中。

let rules = [];
let enabled = true;

// 内置默认规则：目标网站 + 其资源 CDN 域名
// （CDN 规则能让其他下载插件代发的直链下载也被正确路由）
const DEFAULT_RULES = [
  { pattern: "x.com", folder: "download-router" },
  { pattern: "twitter.com", folder: "download-router" },
  { pattern: "twimg.com", folder: "download-router" },
  { pattern: "weibo.com", folder: "download-router" },
  { pattern: "sinaimg.cn", folder: "download-router" },
  { pattern: "weibocdn.com", folder: "download-router" },
  { pattern: "weibocdn.cn", folder: "download-router" },
  { pattern: "grok.com", folder: "download-router" },
  { pattern: "x.ai", folder: "download-router" },
];

// 把缺失的默认规则并入用户规则（用户自己加的规则不受影响，可再编辑）
async function ensureDefaultRules() {
  const data = await chrome.storage.sync.get({ rules: [] });
  const existing = Array.isArray(data.rules) ? data.rules : [];
  const have = new Set(existing.map((r) => String(r.pattern || "").toLowerCase()));
  const missing = DEFAULT_RULES.filter((r) => !have.has(r.pattern));
  if (missing.length > 0) {
    await chrome.storage.sync.set({ rules: existing.concat(missing) });
  }
}

async function loadState() {
  const data = await chrome.storage.sync.get({ rules: [], enabled: true });
  rules = Array.isArray(data.rules) ? data.rules : [];
  enabled = data.enabled !== false;
}

loadState();
ensureDefaultRules();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && (changes.rules || changes.enabled)) {
    loadState();
  }
});

// Windows 文件名非法字符： < > : " | ? * 以及反斜杠和控制字符
const ILLEGAL_CHARS = new Set(["<", ">", ":", '"', "|", "?", "*", String.fromCharCode(92)]);

function cleanSegment(seg) {
  let out = "";
  for (const ch of String(seg)) {
    const code = ch.codePointAt(0);
    if (code < 32 || ILLEGAL_CHARS.has(ch)) continue;
    out += ch;
  }
  // 去掉首尾的点和空白
  return out.replace(/^[. ]+/, "").replace(/[. ]+$/, "");
}

// 清理文件夹名，支持多级路径（用 / 分隔）
function sanitizeFolder(folder) {
  return String(folder || "")
    .split("/")
    .map(cleanSegment)
    .filter(Boolean)
    .join("/")
    .slice(0, 120);
}

// 域名匹配：
//   "example.com"   -> 匹配 example.com 及其所有子域名
//   "*.example.com" -> 仅匹配子域名（不含 example.com 本身）
//   "*example"      -> 主机名包含 "example" 即匹配
function hostMatches(host, pattern) {
  const p = String(pattern || "").trim().toLowerCase();
  if (!p) return false;
  if (p.startsWith("*.")) {
    const base = p.slice(2);
    return host !== base && host.endsWith("." + base);
  }
  if (p.startsWith("*")) {
    return host.includes(p.slice(1));
  }
  return host === p || host.endsWith("." + p);
}

// 从下载项里推断来源网站的 host
// 兼容 blob:https://host/uuid 与 filesystem: 形式（视频/图片下载插件常用）
function parseHost(u) {
  try {
    if (!u || typeof u !== "string") return null;
    let s = u;
    if (/^blob:/i.test(s)) s = s.slice(5);
    if (/^filesystem:/i.test(s)) s = s.slice(11);
    if (/^https?:/i.test(s)) {
      return new URL(s).host.toLowerCase();
    }
  } catch (e) {
    // 忽略无法解析的 URL
  }
  return null;
}

function getSourceHost(item) {
  const candidates = [item.referrer, item.finalUrl, item.url];
  for (const u of candidates) {
    const h = parseHost(u);
    if (h) return h;
  }
  return null;
}

// 把文件名末尾的 .jfif 后缀改写为 .jpg
// 仅修改文件名后缀，不改动文件内容或格式
function jfifToJpg(name) {
  return String(name || "").replace(/\.jfif$/i, ".jpg");
}

chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  try {
    if (!enabled) {
      suggest();
      return;
    }
    const host = getSourceHost(item);
    const renamed = jfifToJpg(item.filename);
    if (host) {
      for (const rule of rules) {
        const folder = sanitizeFolder(rule.folder);
        if (folder && hostMatches(host, rule.pattern)) {
          suggest({
            filename: folder + "/" + renamed,
            conflictAction: "uniquify",
          });
          return;
        }
      }
    }
    if (renamed !== item.filename) {
      suggest({ filename: renamed, conflictAction: "uniquify" });
      return;
    }
    suggest();
  } catch (e) {
    // 任何异常都不要阻断下载
    try {
      suggest();
    } catch (e2) {
      // ignore
    }
  }
});
