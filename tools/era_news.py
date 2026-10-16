"""그해 오늘 — '그날의 신문' 자동 생성. 사용: python tools/era_news.py 2026-10-19 [--dry] [--ago 30,20]

50·40·30·20·10년 전 그날(과 그 전날) 신문·기사를 모아 분야별(정치·경제·사회·문화·연예·생활·스포츠) 헤드라인을 고른다.
원칙: 실제로 열어서 날짜가 확인된 기사만 싣는다. Gemini는 '후보 찾기'와 '고르고 다듬기'에만 쓰고, 출처 주소는 후보 목록 안의 것만 허용한다.
결과: Firestore daily/{날짜}.era[ago].news / papers / mood  (사진은 따로: place_photos.yml)
"""
import os, sys, json, re, time, datetime, html, urllib.request, urllib.error, urllib.parse, concurrent.futures as cf
sys.path.insert(0, os.path.dirname(__file__))
from gen_daily import gemini, list_models, parse_json, firestore, KST

DBG = []
FIELDS = ["정치", "경제", "사회", "문화", "연예", "생활", "스포츠"]
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36", "Accept": "text/html,application/xhtml+xml,*/*;q=0.8", "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.5", "Referer": "https://www.seoul.co.kr/"}
NL = lambda y, m, d, o: f"https://newslibrary.naver.com/viewer/index.naver?publishDate={y}-{m:02d}-{d:02d}&officeId={o}"

def fetch(url, timeout=20):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
            if r.status != 200: DBG.append(f"fetch {r.status} {url[:80]}"); return None
            raw = r.read(600_000)
        for enc in ("utf-8", "euc-kr", "cp949"):
            try: return raw.decode(enc)
            except Exception: pass
        return raw.decode("utf-8", "ignore")
    except Exception as e:
        if len(DBG) < 40: DBG.append(f"fetch 실패 {url[:80]} {str(e)[:60]}")
        return None

def strip_html(s):
    s = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", s, flags=re.S | re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", html.unescape(s)).strip()

def page_title(h):
    m = re.search(r"<meta[^>]+property=[\"']og:title[\"'][^>]+content=[\"']([^\"']+)", h, re.I) or re.search(r"<title>(.*?)</title>", h, re.S | re.I)
    return strip_html(m.group(1))[:120] if m else ""

def page_desc(h, n=600):
    m = re.search(r"<meta[^>]+(?:property=[\"']og:description[\"']|name=[\"']description[\"'])[^>]+content=[\"']([^\"']+)", h, re.I)
    d = strip_html(m.group(1)) if m else ""
    if len(d) < 80:
        body = strip_html(h)
        d = body[:n]
    return d[:n]

def has_date(text, y, m, d):
    """본문·메타에 그날 날짜가 적혀 있는가 (여러 표기)."""
    pats = [rf"{y}[.\-/년 ]\s*0?{m}[.\-/월 ]\s*0?{d}\b", rf"{y}{m:02d}{d:02d}", rf"0?{m}월\s*0?{d}일", rf"(?:Oct|October|Nov|November|Sep|September|Dec|December|Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August)[a-z]*\.?\s+0?{d},?\s+{y}", rf"{d}\s+(?:Oct|Nov|Sep|Dec|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug)[a-z]*\.?\s+{y}"]
    return any(re.search(p, text) for p in pats)

# ── 후보 모으기: 주소 규칙이 있는 신문은 직접 훑는다 ──
def crawl_seoul_1990s(y, m, d):
    """서울신문 1990년대 지면: /news/YYYY/MM/DD/YYYYMMDD<면2><번호3>"""
    urls = [f"https://www.seoul.co.kr/news/{y}/{m:02d}/{d:02d}/{y}{m:02d}{d:02d}{p:02d}{n:03d}" for p in range(1, 33) for n in range(1, 6)]
    out = []
    h0 = fetch(urls[0]); DBG.append(f"서울신문90 probe {urls[0][-14:]} → {'없음' if not h0 else str(len(h0)) + 'B title=' + page_title(h0)[:40] + ' desc=' + str(len(page_desc(h0)))}")
    def one(u):
        h = fetch(u)
        if not h or "seoul.co.kr" not in h: return None
        t, desc = page_title(h), page_desc(h)
        if len(t) < 4 or len(desc) < 40: return None
        return {"title": t, "snippet": desc[:400], "url": u, "source": "서울신문", "date": f"{y}-{m:02d}-{d:02d}", "page": int(u[-5:-3])}
    with cf.ThreadPoolExecutor(8) as ex:
        for r in ex.map(one, urls):
            if r: out.append(r)
    return out

def crawl_osen(y, m, d):
    """OSEN 2006년 무렵: /article/G{yy}{mm}{dd}{nnnn} 연예·스포츠"""
    base = f"https://osen.co.kr/article/G{y % 100:02d}{m:02d}{d:02d}"
    out, miss = [], 0
    def one(n):
        h = fetch(base + f"{n:04d}")
        if not h: return None
        t, desc = page_title(h), page_desc(h)
        if len(t) < 4: return None
        return {"title": t, "snippet": desc[:400], "url": base + f"{n:04d}", "source": "OSEN", "date": f"{y}-{m:02d}-{d:02d}"}
    with cf.ThreadPoolExecutor(8) as ex:
        for r in ex.map(one, range(1, 161)):
            if r: out.append(r)
    return out

def crawl_seoul_2010s(y, m, d):
    """서울신문 2010년대: /news/YYYY/MM/DD/YYYYMMDD5000NN (종합) · 8000NN (온라인)"""
    urls = [f"https://m.seoul.co.kr/news/{y}/{m:02d}/{d:02d}/{y}{m:02d}{d:02d}{k}{n:03d}" for k in ("500", "800") for n in range(1, 161)]
    out = []
    def one(u):
        h = fetch(u)
        if not h: return None
        t, desc = page_title(h), page_desc(h)
        if len(t) < 4 or "서울신문" not in h: return None
        return {"title": t, "snippet": desc[:400], "url": u, "source": "서울신문", "date": f"{y}-{m:02d}-{d:02d}"}
    with cf.ThreadPoolExecutor(8) as ex:
        for r in ex.map(one, urls):
            if r: out.append(r)
    return out

def search_candidates(y, m, d, fields_needed):
    """Gemini 검색으로 후보를 찾고, 주소를 실제로 열어 날짜가 있는 것만 남긴다."""
    prompt = f"""{y}년 {m}월 {d}일(또는 그 전날 {m}월 {d-1}일)에 실제로 있었던 한국 소식(세계 소식은 큰 것만)을 구글 검색으로 찾아라. 분야: {', '.join(fields_needed)}.
분야마다 2~3개, 기사·기록 페이지 주소를 반드시 붙인다(위키백과·나무위키·신문사·공공기관·기록 사이트). 날짜가 그 페이지에 적혀 있는 것만.
newslibrary.naver.com 주소는 쓰지 않는다. 형식(JSON 배열만): [{{"field":"정치","title":"...","url":"https://...","why":"페이지에 적힌 날짜 표기"}}]"""
    try:
        txt = gemini(prompt, json_mode=False, search=True, timeout=150)
        m = re.search(r"\[\s*\{.*\}\s*\]", txt, re.S)
        j = json.loads(m.group(0)) if m else parse_json(txt)
    except Exception as e:
        DBG.append(f"검색 {y} 실패: {str(e)[:160]}"); print(f"[search] {y} 실패 {str(e)[:100]}", file=sys.stderr); return []
    items = j if isinstance(j, list) else j.get("items", []) if isinstance(j, dict) else []
    DBG.append(f"검색 {y}: Gemini 후보 {len(items)}개 " + "; ".join(str(it.get("url",""))[:60] for it in items[:6]))
    out = []
    def one(it):
        u = str(it.get("url", "")).strip()
        if not u.startswith("http") or "newslibrary.naver" in u: return None
        h = fetch(u)
        if not h: return None
        text = strip_html(h)[:200_000]
        ok = has_date(text, y, m, d) or has_date(text, y, m, d - 1) or has_date(h, y, m, d)
        if not ok: DBG.append(f"날짜 없음 {u[:70]}"); return None
        return {"title": page_title(h) or str(it.get("title", "")), "snippet": page_desc(h)[:400], "url": u, "source": re.sub(r"^www\.", "", urllib.parse.urlparse(u).netloc), "date": f"{y}-{m:02d}-{d:02d}", "field_hint": it.get("field", "")}
    with cf.ThreadPoolExecutor(6) as ex:
        for r in ex.map(one, items[:30]):
            if r: out.append(r)
    return out

def gather(y, m, d):
    cands = []
    if 1990 <= y <= 1999:
        for dd in (d, d + 1):
            cands += crawl_seoul_1990s(y, m, dd)
    if 2000 <= y <= 2009:
        cands += crawl_osen(y, m, d)
    if y >= 2010:
        cands += crawl_seoul_2010s(y, m, d)
    print(f"[gather] {y}: 직접 훑은 후보 {len(cands)}", file=sys.stderr)
    need = FIELDS if len(cands) < 30 else ["정치", "경제", "사회", "문화", "생활"]
    if y <= 1999: need = FIELDS
    cands += search_candidates(y, m, d, need)
    seen, uniq = set(), []
    for c in cands:
        if c["url"] in seen: continue
        seen.add(c["url"]); uniq.append(c)
    return uniq

# ── 고르고 다듬기 ──
def choose(y, m, d, cands, used_titles):
    if not cands: return None
    lst = "\n".join(f"[{i}] ({c['source']}{', ' + str(c['page']) + '면' if c.get('page') else ''}) {c['title']} — {c['snippet'][:260]}" for i, c in enumerate(cands[:220]))
    avoid = ("\n어제 실은 소식과 같은 것은 고르지 않는다: " + "; ".join(used_titles[:40])) if used_titles else ""
    prompt = f"""아래는 {y}년 {m}월 {d}일자 신문·기사 후보다(번호 [n]). 이 가운데에서만 골라 '그날의 신문' 면을 만든다.
분야: 정치, 경제, 사회, 문화(책·공연·전시·수상·학술), 연예(가요·영화·TV·드라마·스타), 생활(날씨·물가·건강·살림·교통·신제품·유행), 스포츠. 분야마다 가장 중요하거나 재미있는 것 1~2개. 후보에 없는 분야는 비운다(지어내지 않는다).
독자는 50~60대 한국인(마음은 40대). 사건사고의 잔혹한 묘사, 광고성 기사, 단순 인사·부고는 피한다. 연예는 꼭 챙긴다.
각 항목: headline은 신문 제목처럼 28자 안(따옴표는 " "), summary는 두 문장 60~110자, 반듯한 '-습니다'체, 기사 문장을 그대로 베끼지 말고 새로 쓴다. 날짜 표기는 "17일" 처럼 날만.
mood: 그날 분위기 한 줄 40~60자(날짜는 쓰지 말 것, '-입니다'체).{avoid}
형식(JSON만): {{"mood":"...","news":[{{"field":"정치","idx":3,"headline":"...","summary":"..."}}, ...]}}

{lst}"""
    j = gemini(prompt, json_mode=True, search=False)
    news = []
    for it in j.get("news", []):
        try: c = cands[int(it["idx"])]
        except Exception: continue
        f = str(it.get("field", "")).strip()
        if f not in FIELDS: continue
        hl, sm = str(it.get("headline", "")).strip(), str(it.get("summary", "")).strip()
        if len(hl) < 4 or len(sm) < 30: continue
        news.append({"field": f, "headline": hl[:40], "summary": sm[:160], "source_name": c["source"], "source_url": c["url"]})
    order = {f: i for i, f in enumerate(FIELDS)}
    news.sort(key=lambda x: order[x["field"]])
    per, kept = {}, []
    for n in news:
        if per.get(n["field"], 0) >= 2: continue
        per[n["field"]] = per.get(n["field"], 0) + 1; kept.append(n)
    news = kept
    return {"mood": str(j.get("mood", "")).strip()[:80], "news": news}

def main():
    date = sys.argv[1] if len(sys.argv) > 1 and re.match(r"\d{4}-\d{2}-\d{2}", sys.argv[1]) else datetime.datetime.now(KST).strftime("%Y-%m-%d")
    dry = "--dry" in sys.argv
    agos = [50, 40, 30, 20, 10]
    if "--ago" in sys.argv: agos = [int(x) for x in sys.argv[sys.argv.index("--ago") + 1].split(",")]
    d0 = datetime.date.fromisoformat(date)
    gemini.models = list_models()
    ref = firestore().collection("daily").document(date) if not dry else None
    have = (ref.get().to_dict() or {}) if ref else {}
    era = have.get("era") or {}
    prev = {}
    try:
        pd = datetime.date.fromisoformat(date) - datetime.timedelta(days=1)
        pj = json.load(open(os.path.join(os.path.dirname(__file__), "..", "daily", f"{pd}.json")))
        prev = {k: [n["headline"] for n in v.get("news", [])] for k, v in (pj.get("era") or {}).items()}
    except Exception: pass
    log = []
    for ago in agos:
        y = d0.year - ago
        if era.get(str(ago), {}).get("news") and "--force" not in sys.argv:
            log.append(f"{y} 이미 있음"); continue
        cands = gather(y, d0.month, d0.day)
        res = choose(y, d0.month, d0.day, cands, prev.get(str(ago), []))
        if not res or not res["news"]:
            log.append(f"{y} 후보 {len(cands)} → 실은 것 없음"); continue
        papers = [[n, NL(y, d0.month, d0.day, o)] for n, o in (("동아일보", "00020"), ("경향신문", "00032"), ("매일경제", "00009"), ("한겨레", "00028")) if not (n == "한겨레" and y < 1988)][:3]
        e = dict(era.get(str(ago), {}))
        e.update({"news": res["news"], "papers": papers})
        if res["mood"]: e["mood"] = res["mood"]
        era[str(ago)] = e
        log.append(f"{y} 후보 {len(cands)} → {len(res['news'])}건 " + "/".join(sorted(set(n['field'] for n in res['news']), key=FIELDS.index)))
        if ref: ref.set({"era": {str(ago): e}}, merge=True)
    print("\n".join(log))
    p = os.path.join(os.path.dirname(__file__), "..", "daily", f"{date}.json")
    if ref:
        full = ref.get().to_dict() or {}
        json.dump(full, open(p, "w"), ensure_ascii=False, indent=1, default=str)
    else:
        json.dump({"era": era}, open(f"/tmp/era-{date}.json", "w"), ensure_ascii=False, indent=1)
    open(os.path.join(os.path.dirname(__file__), "last-era-news.log"), "w").write(f"{date}\n" + "\n".join(log) + "\n--- 자세히 ---\n" + "\n".join(DBG[:120]) + "\n")

if __name__ == "__main__":
    main()
