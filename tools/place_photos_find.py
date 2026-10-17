"""그해 그곳 사진 후보를 한꺼번에 긁어 모은다 (Actions 안에서만 돈다 — 바깥 사이트가 열려야 함).

서울연구원 경관기록사진(data.si.re.kr, 공공누리 1유형 + CC BY 4.0)에서
구·연도별 사진 후보와 이미지 직접 주소를 모아 data/place-photos.json 으로 만든다.

사용:
  python tools/place_photos_find.py --probe        # 사이트 모양 확인용 (HTML 일부를 찍어 본다)
  python tools/place_photos_find.py --build        # 후보 표 만들기
"""
import json, os, re, sys, time, html, urllib.request, urllib.parse, concurrent.futures as cf

BASE = "https://data.si.re.kr"
IMG = BASE + "/sites/default/files/photos/{}.jpg"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,*/*;q=0.8", "Accept-Language": "ko-KR,ko;q=0.9"}
HERE = os.path.dirname(os.path.abspath(__file__))


def fetch(url, timeout=30):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
            raw = r.read(1_500_000)
        for enc in ("utf-8", "euc-kr", "cp949"):
            try: return raw.decode(enc)
            except Exception: pass
        return raw.decode("utf-8", "ignore")
    except Exception as e:
        print(f"[fetch 실패] {url[:110]} {str(e)[:80]}", file=sys.stderr)
        return None


def probe():
    """검색이 어느 주소로 도는지, 상세 페이지에서 무엇을 읽을 수 있는지 찾는다."""
    h = fetch(BASE + "/photo/search")
    print("=" * 70, "\n[검색 페이지] 자바스크립트가 부르는 곳")
    if h:
        for pat in [r'["\'](/[a-z0-9_\-/]*(?:ajax|api|json|search)[a-z0-9_\-/]*)["\']',
                    r'(?:axios|fetch)\s*\.?\s*(?:get|post)?\s*\(\s*["\']([^"\']+)',
                    r'url\s*:\s*["\']([^"\']+)']:
            hits = sorted(set(re.findall(pat, h, re.I)))
            print("  ", pat[:30], "→", hits[:25])
        for m in re.finditer(r'<script[^>]*>(.{0,4000}?)</script>', h, re.S):
            s = m.group(1)
            if "gu" in s and ("options" in s or "photo" in s) and len(s) > 200:
                print("  [스크립트 조각]", re.sub(r"\s+", " ", s)[:1200]); break
        print("  [js 파일]", sorted(set(re.findall(r'src="([^"]*photo[^"]*\.js[^"]*)"', h)))[:10])

    print("=" * 70, "\n[상세 페이지] 01101935Dc6000")
    h2 = fetch(BASE + "/photo/01101935Dc6000")
    if h2:
        print("  사진 주소:", sorted(set(re.findall(r'(?:src|href)="([^"]*/photos/[^"]+)"', h2)))[:6])
        tb = re.search(r'<(table|dl|ul)[^>]*class="[^"]*(?:info|meta|detail|photo)[^"]*".{0,3000}?</\1>', h2, re.S)
        print("  정보칸:", re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " | ", tb.group(0)))[:800] if tb else "못 찾음")
        txt = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", h2))
        i = txt.find("통합코드")
        print("  통합코드 둘레:", txt[max(0, i - 500):i + 200] if i > 0 else "없음")


# ── 목록에서 사진 하나하나 ──
CODE_RE = re.compile(r'href="/photo/([0-9A-Za-z]{10,20})"')


def parse_detail(code):
    """사진 상세 페이지에서 연·월·장소·구를 읽는다. 통합코드의 대소문자도 여기서 확정한다."""
    h = fetch(f"{BASE}/photo/{code}")
    if not h: return None
    txt = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", h)))
    def grab(label):
        m = re.search(label + r"\s*[:：]?\s*([^ ][^|]{0,60}?)\s{2,}", txt) or re.search(label + r"\s*[:：]?\s*(\S[^ ]{0,40})", txt)
        return m.group(1).strip() if m else ""
    real = re.search(r"통합코드번호\s*[:：]?\s*([0-9A-Za-z]{10,20})", txt)
    code2 = real.group(1) if real else code
    ym = re.search(r"(19\d{2}|20\d{2})\s*년\s*(\d{1,2})\s*월", txt)
    y = re.search(r"(19\d{2}|20\d{2})", txt)
    gu = re.search(r"([가-힣]{1,4}구)\b", txt)
    return {"code": code2, "year": int(ym.group(1)) if ym else (int(y.group(1)) if y else None),
            "month": int(ym.group(2)) if ym else None,
            "gu": gu.group(1) if gu else "", "place": grab("대상지"), "detail": grab("세부대상지"),
            "page": f"{BASE}/photo/{code}", "img": IMG.format(code2)}


def collection(num):
    h = fetch(f"{BASE}/photo/collection/{num}")
    if not h: return None, []
    title = re.search(r"<title>(.*?)</title>", h, re.S)
    return (re.sub(r"\s+", " ", html.unescape(title.group(1))).strip() if title else ""), sorted(set(CODE_RE.findall(h)))


def build(nums, out_path, workers=6):
    rows, seen = [], set()
    for n in nums:
        title, codes = collection(n)
        if not codes:
            print(f"[컬렉션 {n}] 없음"); continue
        codes = [c for c in codes if c.lower() not in seen]
        print(f"[컬렉션 {n}] {title[:40]} — 사진 {len(codes)}장", flush=True)
        with cf.ThreadPoolExecutor(workers) as ex:
            for r in ex.map(parse_detail, codes):
                if not r or not r.get("year"): continue
                if r["code"].lower() in seen: continue
                seen.add(r["code"].lower()); r["collection"] = n; r["collection_title"] = title
                rows.append(r)
        time.sleep(1)
    rows.sort(key=lambda r: (r.get("gu", ""), r["year"], r.get("month") or 0))
    json.dump({"_설명": "그해 그곳 사진 후보. 출처 서울연구원 경관기록사진(공공누리 1유형·CC BY 4.0).",
               "출처이름": "서울연구원 경관기록사진 (공공누리 1유형 · CC BY 4.0)",
               "만든때": time.strftime("%Y-%m-%d %H:%M"), "장수": len(rows), "사진": rows},
              open(out_path, "w"), ensure_ascii=False, indent=1)
    byyear = {}
    for r in rows: byyear.setdefault(r["gu"] or "(구 모름)", set()).add(r["year"])
    for g, ys in sorted(byyear.items()): print(f"  {g}: {len(ys)}개 해 {sorted(ys)}")
    print(f"모두 {len(rows)}장 → {out_path}")


if __name__ == "__main__":
    if "--probe" in sys.argv:
        probe()
    else:
        a = sys.argv[sys.argv.index("--collections") + 1] if "--collections" in sys.argv else "553"
        nums = []
        for part in a.split(","):
            part = part.strip()
            if "-" in part:
                s, e = part.split("-"); nums += list(range(int(s), int(e) + 1))
            elif part: nums.append(int(part))
        build(nums, os.path.join(HERE, "..", "data", "place-photos.json"))
