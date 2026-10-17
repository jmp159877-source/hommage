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
    """사이트 모양을 눈으로 보려고 HTML 일부를 찍는다."""
    for url in [BASE + "/photo",
                BASE + "/photo/search",
                BASE + "/photo/search?keys=용산",
                BASE + "/photo/collection/553",
                BASE + "/photo/01101935Dc6000"]:
        h = fetch(url)
        print("\n" + "=" * 70)
        print("URL:", url, "→", "없음" if h is None else f"{len(h)}자")
        if not h: continue
        body = h
        # 눈에 띄는 것만: 사진 링크, 폼 입력칸, 선택 상자
        links = re.findall(r'href="(/photo/[^"#?]+)"', body)
        print("사진·목록 링크 보기:", links[:15], "…총", len(links))
        for pat, name in [(r'<form[^>]*>', '폼'), (r'<input[^>]*>', '입력칸'), (r'<select[^>]*>.{0,400}?</select>', '선택상자')]:
            found = re.findall(pat, body, re.S)[:6]
            if found: print(f"-- {name}:", [re.sub(r"\s+", " ", f)[:200] for f in found])
        print("-- 본문 앞머리:", re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", body))[:600])


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
