# -*- coding: utf-8 -*-
"""
解析《缠论108课_深度精读总稿.md》，生成 PWA 数据层：
  pwa/data/lessons.json      108 课，每课含 sections(html)、figures、prevNext
  pwa/data/concepts.json     248 条术语
  pwa/data/modules.json      12 模块（含焦点链）
  pwa/data/search_index.json 每课纯文本搜索索引
并复制 154 张插图到 pwa/assets/figures/。
只读使用 pwa/ 之外的源文件。
"""
import json
import re
import shutil
import sys
from pathlib import Path

from markdown_it import MarkdownIt

ROOT = Path(__file__).resolve().parent.parent          # pwa/
SRC = ROOT.parent / "markdown" / "缠论108课_深度精读总稿.md"
FIG_SRC = ROOT.parent / "markdown" / "assets" / "figures"
FIG_DST = ROOT / "assets" / "figures"
OVERVIEW = ROOT.parent / "全局结构总览.md"

md = MarkdownIt("commonmark", {"html": False, "linkify": False}).enable("table")

MODULE_RANGES = [(1, 1, 10), (2, 11, 21), (3, 22, 31), (4, 32, 41), (5, 42, 53),
                 (6, 54, 61), (7, 62, 72), (8, 73, 81), (9, 82, 93), (10, 94, 100),
                 (11, 101, 105), (12, 106, 108)]

SECTION_KEY_MAP = {
    "原文主张": "yuanwen",
    "白话解释": "baihua",
    "论证链": "lunzheng",
    "核心概念": "gainian",
    "研究与训练规则": "xunlian",
    "原图逐页说明": "tujie",
    "常见误读": "wudu",
    "解释分歧": "fenqi",
    "批判性评估": "pipan",
    "证据锚点": "zhengju",
    "自测与市场观察": "zice",
}

IMG_RE = re.compile(r'!\[([^\]]*)\]\((?:\.\./)?(?:markdown/)?assets/figures/([^)]+)\)')
PREV_RE = re.compile(r'\*\*前置联系\*\*：([^\n]+)')
NEXT_RE = re.compile(r'\*\*后续联系\*\*：([^\n]+)')
LESSON_REF_RE = re.compile(r'第\s*(\d{1,3})\s*课')


def lesson_refs(text):
    """从 '第2课' / '第1、3课' 等表述提取课号列表。"""
    if not text or text.strip() in ("无", "—", "-"):
        return []
    nums = []
    for m in LESSON_REF_RE.finditer(text):
        n = int(m.group(1))
        if 1 <= n <= 108 and n not in nums:
            nums.append(n)
    return nums


def module_of(n):
    for mid, a, b in MODULE_RANGES:
        if a <= n <= b:
            return mid
    return 0


def md_to_html(text):
    html = md.render(text)
    # 图片 src 重写为 pwa 内相对路径
    html = re.sub(r'src="(?:\.\./)*(?:markdown/)?assets/figures/([^"]+)"',
                  r'src="assets/figures/\1"', html)
    return html


def md_to_text(text):
    """粗略 markdown -> 纯文本，供搜索索引。"""
    t = IMG_RE.sub(r'\1', text)
    t = re.sub(r'\*\*([^*]+)\*\*', r'\1', t)
    t = re.sub(r'^#{1,6}\s*', '', t, flags=re.M)
    t = re.sub(r'^[\s]*[-*]\s+', '', t, flags=re.M)
    t = re.sub(r'^\d+\.\s+', '', t, flags=re.M)
    t = re.sub(r'^>\s?', '', t, flags=re.M)
    t = re.sub(r'\|', ' ', t)
    t = re.sub(r'-{3,}', '', t)
    t = re.sub(r'\n{2,}', '\n', t)
    return t.strip()


def parse_lessons(body):
    """body: 模块一之后到文末的文本。按 '# 第N课：' 切分。"""
    pat = re.compile(r'^# 第(\d{1,3})课[：:]\s*(.+?)\s*$', re.M)
    matches = list(pat.finditer(body))
    lessons = []
    anomalies = []
    for i, m in enumerate(matches):
        n = int(m.group(1))
        title = m.group(2).strip()
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(body)
        chunk = body[start:end]
        # 去掉课尾的分隔线
        chunk = re.sub(r'\n-{3,}\s*$', '', chunk.strip())

        prev_m = PREV_RE.search(chunk)
        next_m = NEXT_RE.search(chunk)
        prev = [x for x in (lesson_refs(prev_m.group(1)) if prev_m else []) if x != n]
        nxt = [x for x in (lesson_refs(next_m.group(1)) if next_m else []) if x != n]
        # 从正文中移除前置/后续行，避免重复展示
        chunk_clean = PREV_RE.sub('', chunk)
        chunk_clean = NEXT_RE.sub('', chunk_clean)

        figures = IMG_RE.findall(chunk_clean)
        fig_files = sorted(set(f[1] for f in figures))

        # 按二级标题切节
        sec_pat = re.compile(r'^##\s+(.+?)\s*$', re.M)
        secs = list(sec_pat.finditer(chunk_clean))
        sections = []
        preamble = chunk_clean[:secs[0].start()].strip() if secs else chunk_clean.strip()
        if preamble:
            sections.append({"key": "intro", "title": "本课概要", "html": md_to_html(preamble)})
        for j, s in enumerate(secs):
            stitle = s.group(1).strip()
            sstart = s.end()
            send = secs[j + 1].start() if j + 1 < len(secs) else len(chunk_clean)
            sbody = chunk_clean[sstart:send].strip()
            sbody = re.sub(r'\n-{3,}\s*$', '', sbody)
            key = SECTION_KEY_MAP.get(stitle)
            if not key:
                key = "sec" + str(j)
                anomalies.append(f"第{n}课 非标准节名: {stitle}")
            sections.append({"key": key, "title": stitle, "html": md_to_html(sbody)})

        lessons.append({
            "n": n,
            "title": title,
            "module": module_of(n),
            "sections": sections,
            "figures": fig_files,
            "prevNext": {"前置": prev, "后续": nxt},
        })
    return lessons, anomalies


def parse_concepts(full_text):
    """解析术语总表 markdown 表格。"""
    m = re.search(r'^# 术语总表\s*$', full_text, re.M)
    if not m:
        raise RuntimeError("未找到术语总表")
    tail = full_text[m.end():]
    end_m = re.search(r'^# ', tail, re.M)
    table_text = tail[:end_m.start()] if end_m else tail
    concepts = []
    for line in table_text.splitlines():
        line = line.strip()
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if len(cells) < 4:
            continue
        if cells[0] in ("术语",) or set(cells[0]) <= set("-: "):
            continue
        term, definition, relation, lessons_col = cells[0], cells[1], cells[2], cells[3]
        lessons = []
        for tok in re.split(r'[、,，\s]+', lessons_col):
            tok = tok.strip()
            if re.fullmatch(r'\d{1,3}', tok):
                n = int(tok)
                if 1 <= n <= 108 and n not in lessons:
                    lessons.append(n)
            else:
                for mm in re.finditer(r'(\d{1,3})\s*[–-]\s*(\d{1,3})', tok):
                    for n in range(int(mm.group(1)), int(mm.group(2)) + 1):
                        if 1 <= n <= 108 and n not in lessons:
                            lessons.append(n)
        concepts.append({
            "term": term,
            "definition": definition + (f"（{relation}）" if relation else ""),
            "lessons": lessons,
        })
    return concepts


def parse_modules():
    text = OVERVIEW.read_text(encoding="utf-8")
    # 从总稿取模块标签
    src = SRC.read_text(encoding="utf-8")
    labels = {}
    for m in re.finditer(r'^# 模块([一二三四五六七八九十]+)[：:]\s*(.+?)\s*$', src, re.M):
        labels[m.group(1)] = m.group(2).strip()
    cn = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"]
    focus = {}
    for m in re.finditer(r'^\|\s*(\d+)\s*\|\s*([\d–-]+)\s*\|\s*([^|]+)\|\s*([^|]+)\|', text, re.M):
        focus[int(m.group(1))] = m.group(4).strip()
    modules = []
    for i, (mid, a, b) in enumerate(MODULE_RANGES):
        modules.append({
            "id": mid,
            "range": [a, b],
            "label": labels.get(cn[i], ""),
            "focus": focus.get(mid, ""),
        })
    return modules


def main():
    src_text = SRC.read_text(encoding="utf-8")
    # 正文起点：模块一标题
    m0 = re.search(r'^# 模块一[：:]', src_text, re.M)
    body = src_text[m0.start():]
    # 去掉模块标题行（保留课文），防止混进某课 chunk
    body = re.sub(r'^# 模块[一二三四五六七八九十]+[：:].*$\n?', '', body, flags=re.M)

    lessons, anomalies = parse_lessons(body)
    concepts = parse_concepts(src_text)
    modules = parse_modules()

    # 搜索索引：每课纯文本，按节拆分以便定位到节
    search_index = []
    for les in lessons:
        sec_entries = []
        for s in les["sections"]:
            t = re.sub(r'<[^>]+>', ' ', s["html"])
            t = re.sub(r'\s+', ' ', t).strip()
            sec_entries.append({"key": s["key"], "title": s["title"], "text": t})
        search_index.append({
            "n": les["n"],
            "title": les["title"],
            "module": les["module"],
            "sections": sec_entries,
        })

    FIG_DST.mkdir(parents=True, exist_ok=True)
    copied = 0
    for f in FIG_SRC.glob("*.jpg"):
        shutil.copy2(f, FIG_DST / f.name)
        copied += 1

    data_dir = ROOT / "data"
    data_dir.mkdir(exist_ok=True)
    (data_dir / "lessons.json").write_text(
        json.dumps(lessons, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (data_dir / "concepts.json").write_text(
        json.dumps(concepts, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (data_dir / "modules.json").write_text(
        json.dumps(modules, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (data_dir / "search_index.json").write_text(
        json.dumps(search_index, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    # 校验
    print(f"lessons: {len(lessons)}")
    print(f"concepts: {len(concepts)}")
    print(f"modules: {len(modules)}")
    print(f"figures copied: {copied}")
    total_sections = sum(len(l["sections"]) for l in lessons)
    total_fig_refs = sum(len(l["figures"]) for l in lessons)
    print(f"total sections: {total_sections}")
    print(f"total figure files referenced: {total_fig_refs}")
    size = (data_dir / "lessons.json").stat().st_size
    print(f"lessons.json size: {size} bytes ({size/1024:.1f} KB)")
    si_size = (data_dir / "search_index.json").stat().st_size
    print(f"search_index.json size: {si_size} bytes ({si_size/1024:.1f} KB)")
    bad = [l["n"] for l in lessons if len(l["sections"]) < 10]
    print(f"lessons with <10 sections: {bad if bad else '无'}")
    if anomalies:
        print("ANOMALIES:")
        for a in anomalies:
            print("  " + a)
    else:
        print("anomalies: 无")
    # 核对所有引用图片均已复制
    missing = []
    on_disk = {p.name for p in FIG_DST.glob("*.jpg")}
    for l in lessons:
        for f in l["figures"]:
            if f not in on_disk:
                missing.append(f"第{l['n']}课: {f}")
    print(f"missing figure files: {missing if missing else '无'}")


if __name__ == "__main__":
    main()
