/* 缠论108课学习 PWA —— 单页应用逻辑（原生 JS，无依赖） */
(function () {
  "use strict";

  /* ================= 本地存储 ================= */
  var PREFIX = "chanlun.";
  function lsGet(key, fallback) {
    try {
      var raw = localStorage.getItem(PREFIX + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(val)); } catch (e) { console.warn("存储失败", e); }
  }

  var progress = lsGet("progress", { read: {}, mastery: {}, lastLesson: 1, scroll: {}, days: {} });
  var reviews = lsGet("reviews", []);
  function saveProgress() { lsSet("progress", progress); }
  function saveReviews() { lsSet("reviews", reviews); }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function touchDay() { progress.days[todayStr()] = true; saveProgress(); }

  /* ================= 全局数据 ================= */
  var DATA = { lessons: null, concepts: null, modules: null, index: null };
  var lessonByN = {};

  function loadAll() {
    return Promise.all([
      fetch("data/lessons.json").then(function (r) { return r.json(); }),
      fetch("data/concepts.json").then(function (r) { return r.json(); }),
      fetch("data/modules.json").then(function (r) { return r.json(); }),
      fetch("data/search_index.json").then(function (r) { return r.json(); })
    ]).then(function (arr) {
      DATA.lessons = arr[0];
      DATA.concepts = arr[1];
      DATA.modules = arr[2];
      DATA.index = arr[3];
      DATA.lessons.forEach(function (l) { lessonByN[l.n] = l; });
    });
  }

  /* ================= 工具 ================= */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function moduleLabel(mid) {
    var m = DATA.modules[mid - 1];
    return m ? "模块" + mid : "";
  }
  function isRead(n) { return !!progress.read[n]; }
  function masteryOf(n) { return progress.mastery[n] || 0; }
  function starsHtml(n) {
    var m = masteryOf(n), out = "";
    for (var i = 1; i <= 5; i++) out += i <= m ? "★" : "☆";
    return out;
  }
  function streakDays() {
    var count = 0;
    var d = new Date();
    if (!progress.days[todayStr()]) d.setDate(d.getDate() - 1); // 今天还没学，从昨天往回数
    while (true) {
      var key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      if (progress.days[key]) { count++; d.setDate(d.getDate() - 1); } else break;
    }
    return count;
  }
  function avgMastery() {
    var sum = 0, cnt = 0;
    DATA.lessons.forEach(function (l) { if (progress.mastery[l.n]) { sum += progress.mastery[l.n]; cnt++; } });
    return cnt ? (sum / cnt).toFixed(1) : "0.0";
  }
  function readCount() {
    var c = 0;
    DATA.lessons.forEach(function (l) { if (isRead(l.n)) c++; });
    return c;
  }

  /* ================= 路由 ================= */
  function route() {
    var hash = location.hash || "#/home";
    var parts = hash.replace(/^#\//, "").split("?");
    var path = parts[0];
    var query = {};
    (parts[1] || "").split("&").forEach(function (kv) {
      if (!kv) return;
      var p = kv.split("=");
      query[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || "");
    });
    var seg = path.split("/");
    var tab = seg[0] || "home";

    $all(".tab").forEach(function (t) {
      t.classList.toggle("active", t.getAttribute("data-tab") === tab);
    });

    if (!DATA.lessons) return; // 数据未就绪

    if (tab === "home") renderHome();
    else if (tab === "lessons") renderLessons(query);
    else if (tab === "read") renderRead(parseInt(seg[1], 10) || progress.lastLesson || 1, query);
    else if (tab === "dict") renderDict(query);
    else if (tab === "review") renderReview(query);
    else renderHome();
  }

  /* ================= A. 首页 ================= */
  function renderHome() {
    var v = $("#view");
    var rc = readCount();
    var last = progress.lastLesson || 1;
    var lastLesson = lessonByN[last];

    var html = "";
    html += '<div class="stat-grid">';
    html += '<div class="stat"><div class="stat-num">' + rc + '<small> / 108</small></div><div class="stat-label">已读课数</div></div>';
    html += '<div class="stat"><div class="stat-num">' + avgMastery() + '</div><div class="stat-label">平均掌握度</div></div>';
    html += '<div class="stat"><div class="stat-num">' + streakDays() + '<small> 天</small></div><div class="stat-label">连续学习</div></div>';
    html += "</div>";

    if (lastLesson) {
      html += '<div class="card"><div class="dim" style="font-size:12px;margin-bottom:6px">最近阅读</div>' +
        '<a class="lesson-item" style="margin-bottom:0" href="#/read/' + last + '">' +
        '<span class="lesson-n">' + last + "</span>" +
        '<span class="lesson-title">' + esc(lastLesson.title) + "</span>" +
        '<span class="stars">' + starsHtml(last) + "</span></a></div>";
    }

    html += '<div class="section-title">十二模块</div>';
    DATA.modules.forEach(function (m) {
      var a = m.range[0], b = m.range[1];
      var done = 0;
      for (var n = a; n <= b; n++) if (isRead(n)) done++;
      var p = Math.round((done / (b - a + 1)) * 100);
      html += '<a class="card module-card" style="text-decoration:none;color:inherit;display:flex" href="#/lessons?module=' + m.id + '">' +
        '<div class="ring" style="--p:' + p + '">' + p + "%</div>" +
        '<div class="module-info">' +
        '<div class="module-name">模块' + m.id + " · " + esc(m.label) + "</div>" +
        '<div class="module-focus">' + esc(m.focus) + "</div>" +
        '<div class="module-range">第' + a + "–" + b + "课 · 已读 " + done + "/" + (b - a + 1) + "</div>" +
        "</div></a>";
    });

    html += '<div class="section-title">我的数据</div>';
    html += '<div class="card"><div class="dim" style="font-size:12px;margin-bottom:8px">学习进度与复盘记录仅保存在本机浏览器（localStorage）。建议定期导出备份。</div>' +
      '<div class="data-ops">' +
      '<button class="btn" id="btn-export">导出我的数据</button>' +
      '<button class="btn" id="btn-import">导入</button>' +
      '<input type="file" id="import-file" accept="application/json,.json" hidden>' +
      "</div></div>";

    v.innerHTML = html;
    $("#btn-export").addEventListener("click", exportMyData);
    $("#btn-import").addEventListener("click", function () { $("#import-file").click(); });
    $("#import-file").addEventListener("change", importMyData);
    window.scrollTo(0, 0);
  }

  function exportMyData() {
    var dump = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(PREFIX) === 0) {
        try { dump[k.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(k)); } catch (e) {}
      }
    }
    downloadJson(dump, "chanlun-backup-" + todayStr() + ".json");
  }
  function importMyData(ev) {
    var file = ev.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var dump = JSON.parse(reader.result);
        if (dump.progress) { progress = dump.progress; saveProgress(); }
        if (dump.reviews) { reviews = dump.reviews; saveReviews(); }
        Object.keys(dump).forEach(function (k) {
          if (k !== "progress" && k !== "reviews") lsSet(k, dump[k]);
        });
        alert("导入成功");
        route();
      } catch (e) { alert("导入失败：文件格式不正确"); }
    };
    reader.readAsText(file);
    ev.target.value = "";
  }

  /* ================= B. 课次列表 + 搜索 ================= */
  var lessonFilter = { module: 0, status: "all", q: "" };
  function renderLessons(query) {
    if (query && query.module) lessonFilter.module = parseInt(query.module, 10) || 0;
    var v = $("#view");
    var html = "";
    html += '<input type="text" id="search-box" placeholder="全文搜索：关键词可定位到课与节…" value="' + esc(lessonFilter.q) + '">';
    html += '<div class="filter-row" style="margin-top:10px">';
    html += '<select id="filter-module"><option value="0">全部模块</option>';
    DATA.modules.forEach(function (m) {
      html += '<option value="' + m.id + '"' + (lessonFilter.module === m.id ? " selected" : "") + ">模块" + m.id + "（" + m.range[0] + "–" + m.range[1] + "）</option>";
    });
    html += "</select>";
    html += '<select id="filter-status">';
    [["all", "全部状态"], ["todo", "未开始"], ["read", "已读"], ["master", "掌握≥4"]].forEach(function (o) {
      html += '<option value="' + o[0] + '"' + (lessonFilter.status === o[0] ? " selected" : "") + ">" + o[1] + "</option>";
    });
    html += "</select></div>";
    html += '<div id="lesson-list"></div>';
    v.innerHTML = html;

    $("#search-box").addEventListener("input", debounce(function (e) {
      lessonFilter.q = e.target.value.trim();
      renderLessonList();
    }, 200));
    $("#filter-module").addEventListener("change", function (e) {
      lessonFilter.module = parseInt(e.target.value, 10) || 0;
      renderLessonList();
    });
    $("#filter-status").addEventListener("change", function (e) {
      lessonFilter.status = e.target.value;
      renderLessonList();
    });
    renderLessonList();
    window.scrollTo(0, 0);
  }

  function renderLessonList() {
    var box = $("#lesson-list");
    if (!box) return;
    var q = lessonFilter.q;
    if (q) { box.innerHTML = searchResultsHtml(q); return; }

    var html = "";
    DATA.lessons.forEach(function (l) {
      if (lessonFilter.module && l.module !== lessonFilter.module) return;
      var m = masteryOf(l.n), rd = isRead(l.n);
      if (lessonFilter.status === "todo" && (rd || m > 0)) return;
      if (lessonFilter.status === "read" && !rd) return;
      if (lessonFilter.status === "master" && m < 4) return;
      html += '<a class="lesson-item" href="#/read/' + l.n + '">' +
        '<span class="lesson-n">' + l.n + "</span>" +
        '<span class="lesson-title">' + esc(l.title) + "</span>" +
        '<span class="lesson-meta">' +
        '<span class="badge module">' + moduleLabel(l.module) + "</span>" +
        (rd ? '<span class="badge read">已读</span>' : '<span class="badge">未读</span>') +
        (m >= 4 ? '<span class="badge master">★' + m + "</span>" : "") +
        "</span></a>";
    });
    box.innerHTML = html || '<div class="empty">没有符合条件的课次</div>';
  }

  function searchResultsHtml(q) {
    var terms = q.split(/\s+/).filter(Boolean);
    if (!terms.length) return "";
    var hits = [];
    DATA.index.forEach(function (entry) {
      var titleHit = terms.every(function (t) { return entry.title.indexOf(t) >= 0; });
      var secHits = [];
      entry.sections.forEach(function (s) {
        var ok = terms.every(function (t) { return s.text.indexOf(t) >= 0; });
        if (ok) {
          var pos = s.text.indexOf(terms[0]);
          var ctx = s.text.slice(Math.max(0, pos - 30), pos + 90);
          secHits.push({ key: s.key, title: s.title, ctx: ctx });
        }
      });
      if (titleHit || secHits.length) {
        hits.push({ n: entry.n, title: entry.title, module: entry.module, secHits: secHits.slice(0, 3), total: secHits.length });
      }
    });
    if (!hits.length) return '<div class="empty">未找到「' + esc(q) + "」相关内容</div>";
    var html = '<div class="dim" style="font-size:12px;margin-bottom:8px">共 ' + hits.length + " 课命中</div>";
    hits.slice(0, 60).forEach(function (h) {
      html += '<div class="card" style="padding:10px 12px">' +
        '<a class="lesson-item" style="border:none;background:none;padding:0;margin:0" href="#/read/' + h.n + '">' +
        '<span class="lesson-n">' + h.n + "</span>" +
        '<span class="lesson-title">' + highlight(h.title, terms) + "</span>" +
        '<span class="badge module">' + moduleLabel(h.module) + "</span></a>";
      h.secHits.forEach(function (s) {
        html += '<a style="text-decoration:none" href="#/read/' + h.n + "?sec=" + encodeURIComponent(s.key) + '">' +
          '<div class="search-hit-sec">▸ ' + esc(s.title) + "</div>" +
          '<div class="search-hit-ctx">' + highlight(s.ctx, terms) + "</div></a>";
      });
      if (h.total > 3) html += '<div class="dim" style="font-size:11px">另有 ' + (h.total - 3) + " 节命中…</div>";
      html += "</div>";
    });
    return html;
  }
  function highlight(text, terms) {
    var out = esc(text);
    terms.forEach(function (t) {
      if (!t) return;
      var re = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
      out = out.replace(re, function (m) { return "<mark>" + m + "</mark>"; });
    });
    return out;
  }

  /* ================= C. 阅读页 ================= */
  var scrollSaveTimer = null;
  function renderRead(n, query) {
    var l = lessonByN[n];
    var v = $("#view");
    if (!l) { v.innerHTML = '<div class="empty">课次不存在</div>'; return; }
    progress.lastLesson = n; saveProgress();

    var html = "";
    html += '<div class="read-head">' +
      '<div class="read-title">第' + l.n + "课：" + esc(l.title) + "</div>" +
      '<div class="read-meta"><span class="badge module">' + moduleLabel(l.module) + "</span>" +
      (isRead(n) ? '<span class="badge read">已读</span>' : '<span class="badge">未读</span>') +
      '<span class="stars">' + starsHtml(n) + "</span></div></div>";

    html += '<nav id="anchor-nav">';
    l.sections.forEach(function (s) {
      html += '<a href="javascript:void 0" data-sec="' + esc(s.key) + '">' + esc(s.title) + "</a>";
    });
    html += "</nav>";

    html += '<div id="read-content">';
    l.sections.forEach(function (s) {
      html += '<section class="read-section" id="sec-' + esc(s.key) + '">' +
        "<h2>" + esc(s.title) + "</h2>" +
        '<div class="read-body">' + lazyImgs(s.html) + "</div></section>";
    });
    html += "</div>";

    html += '<div class="read-actions">' +
      '<button class="btn primary" id="btn-read-toggle">' + (isRead(n) ? "已读 ✓（点击取消）" : "标记已读") + "</button>" +
      '<div class="dim" style="font-size:12px;margin-top:14px">掌握度自评（0–5 星）</div>' +
      '<div class="star-rate" id="star-rate">' + starRateHtml(masteryOf(n)) + "</div>" +
      '<div class="prevnext">';
    var prev = (l.prevNext["前置"] && l.prevNext["前置"].length) ? l.prevNext["前置"][l.prevNext["前置"].length - 1] : (n > 1 ? n - 1 : 0);
    var next = (l.prevNext["后续"] && l.prevNext["后续"].length) ? l.prevNext["后续"][0] : (n < 108 ? n + 1 : 0);
    if (prev && lessonByN[prev]) {
      html += '<a class="btn" href="#/read/' + prev + '">← 第' + prev + "课</a>";
    }
    if (next && lessonByN[next]) {
      html += '<a class="btn" href="#/read/' + next + '">第' + next + "课 →</a>";
    }
    html += "</div></div>";

    v.innerHTML = html;

    // 锚点导航
    $all("#anchor-nav a").forEach(function (a) {
      a.addEventListener("click", function () {
        var sec = document.getElementById("sec-" + a.getAttribute("data-sec"));
        if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    // 已读切换
    $("#btn-read-toggle").addEventListener("click", function () {
      if (isRead(n)) delete progress.read[n];
      else { progress.read[n] = true; touchDay(); }
      saveProgress(); renderRead(n, query);
    });

    // 星级打分
    $all("#star-rate span").forEach(function (sp) {
      sp.addEventListener("click", function () {
        var val = parseInt(sp.getAttribute("data-v"), 10);
        if (progress.mastery[n] === val) delete progress.mastery[n];
        else progress.mastery[n] = val;
        touchDay(); saveProgress();
        $("#star-rate").innerHTML = starRateHtml(masteryOf(n));
        bindStars(n);
      });
    });

    // 图片懒加载已由 loading=lazy 处理；点击放大
    $all("#read-content img").forEach(function (img) {
      img.addEventListener("click", function () {
        $("#lightbox-img").src = img.getAttribute("src");
        $("#lightbox-cap").textContent = img.alt || "";
        $("#lightbox").hidden = false;
      });
    });

    // 滚动位置恢复 / 定位到节
    if (query && query.sec) {
      setTimeout(function () {
        var sec = document.getElementById("sec-" + query.sec);
        if (sec) sec.scrollIntoView({ block: "start" });
      }, 60);
    } else if (progress.scroll[n]) {
      setTimeout(function () { window.scrollTo(0, progress.scroll[n]); }, 60);
    } else {
      window.scrollTo(0, 0);
    }

    // 滚动自动保存
    window.onscroll = function () {
      if (scrollSaveTimer) clearTimeout(scrollSaveTimer);
      scrollSaveTimer = setTimeout(function () {
        var hash = location.hash || "";
        if (hash.indexOf("#/read/") === 0) {
          progress.scroll[n] = window.scrollY;
          saveProgress();
        }
      }, 300);
    };
  }
  function bindStars(n) {
    $all("#star-rate span").forEach(function (sp) {
      sp.addEventListener("click", function () {
        var val = parseInt(sp.getAttribute("data-v"), 10);
        if (progress.mastery[n] === val) delete progress.mastery[n];
        else progress.mastery[n] = val;
        touchDay(); saveProgress();
        $("#star-rate").innerHTML = starRateHtml(masteryOf(n));
        bindStars(n);
      });
    });
  }
  function starRateHtml(m) {
    var out = "";
    for (var i = 1; i <= 5; i++) {
      out += '<span data-v="' + i + '" class="' + (i <= m ? "on" : "") + '">★</span>';
    }
    return out;
  }
  function lazyImgs(html) {
    return html.replace(/<img /g, '<img loading="lazy" ');
  }

  /* ================= D. 词典 ================= */
  var dictQ = "";
  function renderDict() {
    var v = $("#view");
    v.innerHTML =
      '<input type="text" id="dict-box" placeholder="搜索术语…" value="' + esc(dictQ) + '">' +
      '<div class="dim" style="font-size:12px;margin:8px 0">共 ' + DATA.concepts.length + " 条术语</div>" +
      '<div id="dict-list"></div>';
    $("#dict-box").addEventListener("input", debounce(function (e) {
      dictQ = e.target.value.trim();
      renderDictList();
    }, 200));
    renderDictList();
    window.scrollTo(0, 0);
  }
  function renderDictList() {
    var box = $("#dict-list");
    if (!box) return;
    var q = dictQ;
    var html = "";
    var count = 0;
    DATA.concepts.forEach(function (c, idx) {
      if (q && c.term.indexOf(q) < 0 && c.definition.indexOf(q) < 0) return;
      count++;
      if (count > 80) return;
      html += '<div class="term-item" data-idx="' + idx + '">' +
        '<div class="term-head"><span class="term-name">' + esc(c.term) + '</span><span class="term-toggle">展开 ▾</span></div>' +
        '<div class="term-body"><div>' + esc(c.definition) + "</div>" +
        (c.lessons.length ? '<div class="term-lessons">' + c.lessons.map(function (n) {
          return '<a href="#/read/' + n + '">第' + n + "课</a>";
        }).join("") + "</div>" : "") +
        "</div></div>";
    });
    box.innerHTML = html || '<div class="empty">未找到相关术语</div>';
    $all(".term-item", box).forEach(function (el) {
      $(".term-head", el).addEventListener("click", function () { el.classList.toggle("open"); });
    });
  }

  /* ================= E. 复盘 ================= */
  var REVIEW_FIELDS = [
    ["date", "日期", "date"],
    ["target", "标的", "text"],
    ["signalTime", "信号时点", "text"],
    ["visibleInfo", "当时可见信息", "textarea"],
    ["judgment", "我的判断", "textarea"],
    ["invalidCondition", "失效条件", "textarea"],
    ["cost", "成本", "text"],
    ["outcome", "事后结果", "textarea"],
    ["counterExample", "反例与教训", "textarea"]
  ];
  var editingId = null;
  var formScore = 0;

  function renderReview(query) {
    var v = $("#view");
    editingId = query && query.edit ? query.edit : null;
    var editing = editingId ? reviews.filter(function (r) { return r.id === editingId; })[0] : null;
    formScore = editing ? (editing.score || 0) : 0;

    var html = '<div class="warn-banner">⚠ 只用当时可见信息填写，禁止后视。任何"事后看来"的内容只能写入「事后结果 / 反例与教训」。</div>';

    html += '<div class="card"><div class="section-title" style="margin-top:0">' + (editing ? "编辑复盘记录" : "新建复盘记录") + "</div>";
    html += '<form id="review-form">';
    REVIEW_FIELDS.forEach(function (f) {
      var val = editing ? (editing[f[0]] || "") : (f[0] === "date" ? todayStr() : "");
      html += "<label>" + f[1] + "</label>";
      if (f[2] === "textarea") {
        html += '<textarea name="' + f[0] + '">' + esc(val) + "</textarea>";
      } else {
        html += '<input type="' + f[2] + '" name="' + f[0] + '" value="' + esc(val) + '">';
      }
    });
    html += "<label>评分（0–5）</label>";
    html += '<div class="score-row" id="score-row">';
    for (var i = 0; i <= 5; i++) {
      html += '<span data-v="' + i + '" class="' + (i === formScore ? "on" : "") + '">' + i + "</span>";
    }
    html += "</div>";
    html += '<div class="form-actions">' +
      '<button type="submit" class="btn primary">' + (editing ? "保存修改" : "保存记录") + "</button>" +
      (editing ? '<a class="btn" href="#/review">取消</a>' : "") +
      "</div></form></div>";

    html += '<div class="section-title">历史记录（' + reviews.length + "）</div>";
    if (reviews.length) {
      html += '<div class="data-ops" style="margin-bottom:12px"><button class="btn" id="btn-export-reviews">导出全部复盘 JSON</button></div>';
    }
    var sorted = reviews.slice().sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
    sorted.forEach(function (r) {
      html += '<div class="card review-item">' +
        '<div class="review-head"><span class="review-target">' + esc(r.target || "（未填标的）") + "</span>" +
        '<span class="review-date">' + esc(r.date || "") + ' · 评分 ' + (r.score || 0) + "/5</span></div>";
      if (r.signalTime) html += '<div class="review-field"><b>信号时点：</b>' + esc(r.signalTime) + "</div>";
      if (r.visibleInfo) html += '<div class="review-field"><b>当时可见信息：</b>' + esc(r.visibleInfo) + "</div>";
      if (r.judgment) html += '<div class="review-field"><b>我的判断：</b>' + esc(r.judgment) + "</div>";
      if (r.invalidCondition) html += '<div class="review-field"><b>失效条件：</b>' + esc(r.invalidCondition) + "</div>";
      if (r.cost) html += '<div class="review-field"><b>成本：</b>' + esc(r.cost) + "</div>";
      if (r.outcome) html += '<div class="review-field"><b>事后结果：</b>' + esc(r.outcome) + "</div>";
      if (r.counterExample) html += '<div class="review-field"><b>反例与教训：</b>' + esc(r.counterExample) + "</div>";
      html += '<div class="review-ops">' +
        '<a class="btn small" href="#/review?edit=' + encodeURIComponent(r.id) + '">编辑</a>' +
        '<button class="btn small danger" data-del="' + esc(r.id) + '">删除</button>' +
        "</div></div>";
    });
    if (!reviews.length) html += '<div class="empty">还没有复盘记录，从上方表单开始第一条。</div>';

    v.innerHTML = html;
    window.scrollTo(0, 0);

    // 评分选择
    $all("#score-row span").forEach(function (sp) {
      sp.addEventListener("click", function () {
        formScore = parseInt(sp.getAttribute("data-v"), 10);
        $all("#score-row span").forEach(function (s) {
          s.classList.toggle("on", parseInt(s.getAttribute("data-v"), 10) === formScore);
        });
      });
    });

    // 表单提交
    $("#review-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var rec = editing || { id: "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) };
      REVIEW_FIELDS.forEach(function (f) { rec[f[0]] = String(fd.get(f[0]) || "").trim(); });
      rec.score = formScore;
      if (!editing) reviews.push(rec);
      saveReviews(); touchDay();
      location.hash = "#/review";
      renderReview({});
    });

    // 删除
    $all("[data-del]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!confirm("确定删除这条复盘记录？")) return;
        reviews = reviews.filter(function (r) { return r.id !== btn.getAttribute("data-del"); });
        saveReviews(); renderReview({});
      });
    });

    // 导出复盘
    var expBtn = $("#btn-export-reviews");
    if (expBtn) {
      expBtn.addEventListener("click", function () {
        downloadJson(reviews, "chanlun-reviews-" + todayStr() + ".json");
      });
    }
  }

  /* ================= 通用 ================= */
  function downloadJson(obj, filename) {
    var blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 200);
  }
  function debounce(fn, ms) {
    var t = null;
    return function () {
      var args = arguments, self = this;
      if (t) clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }

  // 图片放大浮层关闭
  $("#lightbox").addEventListener("click", function () { $("#lightbox").hidden = true; });

  /* ================= Service Worker 注册 ================= */
  function registerSW() {
    var isSecure = location.protocol === "https:" ||
      location.hostname === "localhost" || location.hostname === "127.0.0.1";
    if (!("serviceWorker" in navigator)) {
      console.info("[PWA] 当前浏览器不支持 Service Worker，离线缓存不可用。");
      return;
    }
    if (!isSecure) {
      console.info("[PWA] 非安全上下文（需 https 或 localhost），跳过 Service Worker 注册。");
      return;
    }
    navigator.serviceWorker.register("sw.js").then(function (reg) {
      console.info("[PWA] Service Worker 已注册，作用域：" + reg.scope);
    }).catch(function (err) {
      console.warn("[PWA] Service Worker 注册失败：", err);
    });
  }

  /* ================= 启动 ================= */
  window.addEventListener("hashchange", function () {
    window.onscroll = null;
    route();
  });
  loadAll().then(function () {
    route();
    registerSW();
  }).catch(function (err) {
    $("#view").innerHTML = '<div class="empty">数据加载失败，请检查 data/ 目录是否完整。<br>' + esc(err && err.message) + "</div>";
  });
})();
