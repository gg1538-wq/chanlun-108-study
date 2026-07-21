/* 缠论108课学习 PWA —— 零依赖静态服务器
 * 用法：node server.js [--port 7100] [--host 127.0.0.1]
 */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

function argValue(name, fallback) {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  const eq = process.argv.find((a) => a.startsWith(name + "="));
  if (eq) return eq.split("=")[1];
  return fallback;
}

const PORT = parseInt(argValue("--port", "7100"), 10);
const HOST = argValue("--host", "127.0.0.1");
const ROOT = __dirname;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8"
};

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  } catch (e) {
    res.writeHead(400); res.end("Bad Request"); return;
  }
  if (urlPath === "/") urlPath = "/index.html";

  // 防目录穿越
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end("Forbidden"); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const headers = {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "no-cache"
    };
    if (path.basename(filePath) === "sw.js") {
      headers["Service-Worker-Allowed"] = "/";
    }
    res.writeHead(200, headers);
    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`缠论108课学习 PWA 已启动: http://${HOST}:${PORT}/`);
  console.log("按 Ctrl+C 停止。");
});
