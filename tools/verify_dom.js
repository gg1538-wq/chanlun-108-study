// 静态断言：五页关键 DOM 结构与功能点存在性检查
"use strict";
const fs = require("fs");
const assert = require("assert");

const html = fs.readFileSync(__dirname + "/../index.html", "utf8");
const app = fs.readFileSync(__dirname + "/../app.js", "utf8");

// 五个底部标签页
["home", "lessons", "read", "dict", "review"].forEach((t) => {
  assert(html.includes('data-tab="' + t + '"'), "缺标签 " + t);
});

// index.html 关键结构与 iOS meta
[
  'id="view"', 'id="tabbar"', 'id="topbar"', 'id="lightbox"',
  "apple-mobile-web-app-capable",
  "apple-mobile-web-app-status-bar-style",
  "viewport-fit=cover",
  "theme-color",
  "manifest.webmanifest",
  "apple-touch-icon",
].forEach((s) => assert(html.includes(s), "index.html 缺 " + s));

// 五个视图渲染函数
["renderHome", "renderLessons", "renderRead", "renderDict", "renderReview"].forEach((f) => {
  assert(app.includes("function " + f), "app.js 缺 " + f);
});

// 关键功能点
[
  "localStorage", "chanlun.", "标记已读", "掌握度", "导出我的数据",
  "禁止后视", "serviceWorker", 'loading="lazy', "prevNext",
  "search_index", "progress.scroll", "starsHtml",
].forEach((s) => assert(app.includes(s), "app.js 缺功能: " + s));

// 复盘表单字段完整
["日期", "标的", "信号时点", "当时可见信息", "我的判断", "失效条件", "成本", "事后结果", "反例与教训", "评分"].forEach((s) => {
  assert(app.includes(s), "复盘缺字段 " + s);
});

// manifest
const mf = JSON.parse(fs.readFileSync(__dirname + "/../manifest.webmanifest", "utf8"));
assert(mf.name === "缠论108课学习" && mf.short_name === "缠论学习");
assert(mf.display === "standalone" && mf.theme_color);
assert(mf.icons.some((i) => i.purpose === "maskable"));
assert(mf.icons.some((i) => i.sizes === "192x192"));
assert(mf.icons.some((i) => i.sizes === "512x512"));

// sw.js
const sw = fs.readFileSync(__dirname + "/../sw.js", "utf8");
["install", "activate", "SHELL_ASSETS", "chanlun-pwa-v", "/assets/figures/", "skipWaiting"].forEach((s) =>
  assert(sw.includes(s), "sw.js 缺 " + s)
);
// sw 预缓存清单包含四个 json
["lessons.json", "concepts.json", "modules.json", "search_index.json"].forEach((s) =>
  assert(sw.includes(s), "sw.js 预缓存缺 " + s)
);

// package.json
const pkg = JSON.parse(fs.readFileSync(__dirname + "/../package.json", "utf8"));
assert(pkg.scripts && pkg.scripts.dev === "node server.js");

console.log("DOM / 功能断言全部通过");
