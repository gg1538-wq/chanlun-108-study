# 通过 GitHub Git Data API 推送全部文件（适用于 git 协议不可达但 API 可达的网络）
import json, os, sys, base64, time, urllib.request, urllib.error

TOKEN = os.environ["GH_TOKEN"]
OWNER, REPO = "gg1538-wq", "chanlun-108-study"
BASE = f"https://api.github.com/repos/{OWNER}/{REPO}"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # pwa/

def api(method, url, payload=None, retries=3):
    data = json.dumps(payload).encode() if payload is not None else None
    for i in range(retries):
        req = urllib.request.Request(url, data=data, method=method, headers={
            "Authorization": "Bearer " + TOKEN,
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            body = e.read().decode()[:200]
            if e.code in (403, 404) or i == retries - 1:
                raise RuntimeError(f"{method} {url} -> HTTP {e.code}: {body}")
            time.sleep(2 * (i + 1))
        except Exception:
            if i == retries - 1: raise
            time.sleep(2 * (i + 1))

# 0) 空仓库引导：Contents API 放首个文件，使 git data API 可用
parent_sha = None
try:
    ref = api("GET", BASE + "/git/refs/heads/main")
    parent_sha = ref["object"]["sha"]
    print("已有 main 分支，head:", parent_sha[:10], flush=True)
except RuntimeError:
    boot = api("PUT", BASE + "/contents/README.md", {
        "message": "init",
        "content": base64.b64encode("# chanlun-108-study\n".encode()).decode()})
    parent_sha = boot["commit"]["sha"]
    print("空仓库已引导，首个提交:", parent_sha[:10], flush=True)

files = []
for dp, dn, fn in os.walk(ROOT):
    dn[:] = [d for d in dn if d != ".git"]
    for f in fn:
        full = os.path.join(dp, f)
        rel = os.path.relpath(full, ROOT).replace(os.sep, "/")
        files.append((rel, full))
files.sort()
print(f"共 {len(files)} 个文件", flush=True)

CACHE_PATH = os.path.join(ROOT, "tools", ".blob_cache.json")
cache = {}
if os.path.exists(CACHE_PATH):
    cache = json.load(open(CACHE_PATH, encoding="utf-8"))

tree_items = []
t0 = time.time()
for idx, (rel, full) in enumerate(files, 1):
    if rel in cache:
        tree_items.append({"path": rel, "mode": "100644", "type": "blob", "sha": cache[rel]})
        continue
    raw = open(full, "rb").read()
    blob = api("POST", BASE + "/git/blobs", {"content": base64.b64encode(raw).decode(), "encoding": "base64"})
    cache[rel] = blob["sha"]
    json.dump(cache, open(CACHE_PATH, "w", encoding="utf-8"))
    tree_items.append({"path": rel, "mode": "100644", "type": "blob", "sha": blob["sha"]})
    if idx % 20 == 0 or idx == len(files):
        print(f"blob {idx}/{len(files)}  用时 {time.time()-t0:.0f}s", flush=True)

tree = api("POST", BASE + "/git/trees", {"tree": tree_items})
print("tree:", tree["sha"][:10], flush=True)

commit = api("POST", BASE + "/git/commits", {
    "message": "缠论108课学习 PWA（经 Git Data API 部署）",
    "tree": tree["sha"], "parents": [parent_sha]})
print("commit:", commit["sha"][:10], flush=True)

ref = api("PATCH", BASE + "/git/refs/heads/main", {"sha": commit["sha"], "force": True})
print("ref 已指向:", ref["object"]["sha"][:10], flush=True)
print("PUSH_OK", flush=True)
