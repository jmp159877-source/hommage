"""그해 그곳 사진 후보를 한꺼번에 긁어 모은다 (Actions 안에서만 돈다 — 바깥 사이트가 열려야 함).

서울연구원 경관기록사진(data.si.re.kr, 공공누리 1유형 + CC BY 4.0).
상세 페이지에 통합코드·촬영년/월·촬영장소·대상지·세부대상지가 그대로 적혀 있고,
세부대상지에 '○○구'가 들어 있어 구를 가려낼 수 있다.

두 단계로 나눈다 (한 번에 다 하면 너무 오래 걸린다).
  --scan 1-1200     컬렉션 목록만 훑어 data/photo-collections.json (제목 + 사진 코드 목록)
  --build 500-700   그 가운데 고른 컬렉션의 사진 상세를 읽어 data/place-photos.json
  --probe           사이트 모양 보기
"""
import json, os, re, sys, time, html, urllib.request, concurrent.futures as cf

BASE = "https://data.si.re.kr"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,*/*;q=0.8", "Accept-Language": "ko-KR,ko;q=0.9"}
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
COLS_PATH = os.path.join(DATA, "photo-collections.json")
OUT_PATH = os.path.join(DATA, "place-photos.json")
SRC_NAME = "서울연구원 경관기록사진 (공공누리 1유형 · CC BY 4.0)"

# 컬렉션 하나가 한 곳을 찍은 묶음이라, 구는 컬렉션에서 정한다.
# (세부대상지에서 글자로 찾으면 '지구·입구·출입구'까지 걸린다.)
COL_GU = {
    523: "서울 강북구", 524: "서울 관악구", 526: "서울 중구", 527: "서울 성북구", 528: "서울 종로구",
    529: "서울 종로구", 530: "서울 종로구", 531: "서울 종로구", 532: "서울 강남구", 534: "서울 강남구",
    536: "서울 성동구", 537: "서울 성북구", 538: "서울 강서구", 539: "서울 관악구", 541: "서울 동대문구",
    542: "서울 동작구", 543: "서울 마포구", 544: "서울 마포구", 545: "서울 서초구", 546: "서울 송파구",
    547: "서울 송파구", 548: "서울 송파구", 550: "서울 송파구", 551: "서울 영등포구", 553: "서울 용산구",
    554: "서울 종로구", 557: "서울 중구", 558: "서울 중구", 560: "서울 강남구", 561: "서울 동대문구",
    566: "서울 중구", 569: "서울 서대문구", 570: "서울 중구", 571: "서울 종로구", 572: "서울 영등포구",
    573: "서울 강남구", 574: "서울 용산구", 576: "서울 은평구", 578: "서울 서대문구", 580: "서울 구로구",
    583: "서울 중구", 584: "서울 중구", 585: "서울 영등포구", 586: "서울 종로구", 587: "서울 종로구",
    588: "서울 종로구", 589: "서울 중구", 590: "서울 종로구", 591: "서울 종로구", 592: "서울 중구",
    593: "서울 종로구", 594: "서울 종로구",
}


def fetch(url, timeout=30, tries=2):
    for t in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
                raw = r.read(1_500_000)
            for enc in ("utf-8", "euc-kr", "cp949"):
                try: return raw.decode(enc)
                except Exception: pass
            return raw.decode("utf-8", "ignore")
        except Exception as e:
            if t + 1 == tries: return None
            time.sleep(1)
    return None


def flat(h):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", h)))


# ── 1단계: 컬렉션 훑기 ──
CODE_RE = re.compile(r'href="/photo/([0-9A-Za-z]{10,20})"')


def one_collection(n):
    h = fetch(f"{BASE}/photo/collection/{n}")
    if not h: return None
    t = re.search(r"<title>(.*?)</title>", h, re.S)
    title = re.sub(r"\s*\|\s*서울연구데이터서비스\s*$", "", flat(t.group(1))).strip() if t else ""
    codes = sorted(set(CODE_RE.findall(h)))
    if not codes or not title: return None
    return {"id": n, "title": title, "n": len(codes), "codes": codes}


def scan(nums, workers=8):
    out = []
    with cf.ThreadPoolExecutor(workers) as ex:
        for r in ex.map(one_collection, nums):
            if r:
                out.append(r)
                print(f"  [{r['id']}] {r['title'][:46]} — {r['n']}장", flush=True)
    out.sort(key=lambda r: r["id"])
    os.makedirs(DATA, exist_ok=True)
    json.dump({"_설명": "data.si.re.kr 사진 컬렉션 목록 (그해 그곳 사진 후보 찾기용)",
               "만든때": time.strftime("%Y-%m-%d %H:%M"), "컬렉션수": len(out), "컬렉션": out},
              open(COLS_PATH, "w"), ensure_ascii=False, indent=1)
    print(f"컬렉션 {len(out)}개, 사진 {sum(r['n'] for r in out)}장 → data/photo-collections.json")


# ── 2단계: 사진 상세 읽기 ──
def detail(code):
    h = fetch(f"{BASE}/photo/{code}")
    if not h: return None
    t = flat(h)
    def f(label, nxt):
        m = re.search(label + r"\s+(.{1,80}?)\s+" + nxt, t)
        return m.group(1).strip() if m else ""
    real = re.search(r"통합코드번호\s+([0-9A-Za-z]{10,20})", t)
    ym = re.search(r"촬영년/월\s+(\d{4})\s*/\s*(\d{0,2})", t)
    if not real or not ym: return None
    where = f("촬영장소", "대상지")
    target = f("대상지", "세부대상지")
    sub = f("세부대상지", "이용목적")
    img = re.search(r'(?:src|href)="(/sites/default/files/photos/' + re.escape(real.group(1)) + r'\.jpg)"', h)
    return {"code": real.group(1), "year": int(ym.group(1)), "month": int(ym.group(2)) if ym.group(2) else None,
            "gu": "", "where": where, "target": target, "sub": sub,
            "page": f"{BASE}/photo/{real.group(1)}",
            "img": BASE + (img.group(1) if img else f"/sites/default/files/photos/{real.group(1)}.jpg")}


def build(nums, workers=8):
    cols = json.load(open(COLS_PATH))["컬렉션"]
    want = [c for c in cols if not nums or c["id"] in nums]
    codes, seen, gu_of = [], set(), {}
    for c in want:
        for k in c["codes"]:
            gu_of.setdefault(k.lower(), (COL_GU.get(c["id"], ""), c["id"], c["title"]))
            if k.lower() in seen: continue
            seen.add(k.lower()); codes.append(k)
    print(f"컬렉션 {len(want)}개 · 사진 {len(codes)}장 읽는 중…", flush=True)
    rows, done = [], 0
    with cf.ThreadPoolExecutor(workers) as ex:
        for r in ex.map(detail, codes):
            done += 1
            if done % 200 == 0: print(f"  …{done}/{len(codes)}", flush=True)
            if not r: continue
            g, cid, ctitle = gu_of.get(r["code"].lower(), ("", 0, ""))
            r["gu"], r["collection"], r["collection_title"] = g, cid, ctitle
            rows.append(r)
    rows.sort(key=lambda r: (r["gu"], r["year"], r["month"] or 0))
    old = {}
    if os.path.exists(OUT_PATH):
        try: old = {r["code"]: r for r in json.load(open(OUT_PATH)).get("사진", [])}
        except Exception: old = {}
    for r in rows: old[r["code"]] = r
    allrows = sorted(old.values(), key=lambda r: (r["gu"], r["year"], r["month"] or 0))
    json.dump({"_설명": "그해 그곳 사진 후보. 날짜·장소는 출처 페이지에 적힌 그대로.",
               "출처이름": SRC_NAME, "만든때": time.strftime("%Y-%m-%d %H:%M"), "장수": len(allrows), "사진": allrows},
              open(OUT_PATH, "w"), ensure_ascii=False, indent=1)
    byg = {}
    for r in allrows: byg.setdefault(r["gu"] or "(구 모름)", []).append(r["year"])
    for g, ys in sorted(byg.items(), key=lambda x: -len(x[1])):
        print(f"  {g}: {len(ys)}장, 해 {sorted(set(ys))}")
    print(f"모두 {len(allrows)}장 → data/place-photos.json")


def probe():
    h = fetch(BASE + "/photo/01101935Dc6000")
    print(flat(h)[:1500] if h else "없음")


def rng(s):
    out = []
    for part in str(s).split(","):
        part = part.strip()
        if "-" in part:
            a, b = part.split("-"); out += list(range(int(a), int(b) + 1))
        elif part: out.append(int(part))
    return out


if __name__ == "__main__":
    a = sys.argv
    if "--probe" in a: probe()
    elif "--scan" in a: scan(rng(a[a.index("--scan") + 1]))
    elif "--build" in a: build(set(rng(a[a.index("--build") + 1])) if len(a) > a.index("--build") + 1 and not a[a.index("--build") + 1].startswith("--") else None)
    else: print(__doc__)
