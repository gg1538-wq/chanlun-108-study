/* 缠论108课学习 PWA —— Service Worker
 * install：预缓存应用外壳（页面/脚本/样式/manifest/图标/四份数据 JSON）
 * runtime：figures 图片 cache-first 按需缓存（不预缓存 154 张，避免撑爆 iOS 配额）
 * 更新策略：版本号常量 + activate 清理旧缓存
 */
"use strict";

var VERSION = "chanlun-pwa-v1.0.0";
var SHELL_CACHE = VERSION + "-shell";
var IMG_CACHE = VERSION + "-figures";
var IMG_CACHE_LIMIT = 154; // figures 上限，超出时清理最旧条目

var SHELL_ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./style.css",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./data/lessons.json",
  "./data/concepts.json",
  "./data/modules.json",
  "./data/search_index.json"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(function (cache) {
      return cache.addAll(SHELL_ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== SHELL_CACHE && key !== IMG_CACHE) {
          return caches.delete(key);
        }
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 不拦截跨域请求

  // figures 图片：cache-first，按需写入运行时缓存
  if (url.pathname.indexOf("/assets/figures/") >= 0) {
    event.respondWith(
      caches.open(IMG_CACHE).then(function (cache) {
        return cache.match(req).then(function (hit) {
          if (hit) return hit;
          return fetch(req).then(function (resp) {
            if (resp && resp.ok) {
              cache.put(req, resp.clone());
              trimImageCache(cache);
            }
            return resp;
          }).catch(function () {
            return cache.match(req); // 网络失败回退缓存
          });
        });
      })
    );
    return;
  }

  // 应用外壳与数据：cache-first，失败回退缓存；数据文件网络优先更新
  if (url.pathname.indexOf("/data/") >= 0) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(function (cache) {
        return fetch(req).then(function (resp) {
          if (resp && resp.ok) cache.put(req, resp.clone());
          return resp;
        }).catch(function () {
          return cache.match(req);
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (resp) {
        if (resp && resp.ok && url.origin === self.location.origin) {
          var copy = resp.clone();
          caches.open(SHELL_CACHE).then(function (cache) { cache.put(req, copy); });
        }
        return resp;
      }).catch(function () {
        // 页面导航失败时回退到 index.html（离线 SPA）
        if (req.mode === "navigate") {
          return caches.match("./index.html");
        }
        return hit;
      });
    })
  );
});

function trimImageCache(cache) {
  cache.keys().then(function (keys) {
    if (keys.length > IMG_CACHE_LIMIT) {
      var excess = keys.length - IMG_CACHE_LIMIT;
      for (var i = 0; i < excess; i++) cache.delete(keys[i]);
    }
  });
}
