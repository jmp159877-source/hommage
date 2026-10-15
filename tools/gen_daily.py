# 오마주 매일 콘텐츠 자동 생성
# 매일 자정(한국 시간) GitHub Actions가 실행한다.
#   1) Gemini로 그날 글을 만들고 (인사말·운세·그해 오늘·한 끼·퀴즈·사연)
#   2) 노래는 tools/songs.json 에서 10곡을 골라 붙이고
#   3) Firestore daily/{YYYY-MM-DD} 에 저장한다.
# 사이트(js/app.js)는 daily 문서가 있으면 그것을, 없으면 js/content.js 기본값을 쓴다.
# 필요한 비밀값(GitHub Secrets): GEMINI_API_KEY, FIREBASE_SERVICE_ACCOUNT(서비스 계정 JSON 전체)

import os, sys, json, re, time, datetime, urllib.request, urllib.error, random

KST = datetime.timezone(datetime.timedelta(hours=9))
HERE = os.path.dirname(os.path.abspath(__file__))
GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "")
MODELS = ["gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.0-flash"]  # 목록 조회가 안 될 때의 예비

def list_models():
    """구글에서 지금 쓸 수 있는 Flash 모델을 최신순으로 고른다 (이름이 바뀌어도 코드를 안 고치게)."""
    try:
        with urllib.request.urlopen(f"https://generativelanguage.googleapis.com/v1beta/models?key={GEMINI_KEY}&pageSize=200", timeout=30) as r:
            ms = json.load(r).get("models", [])
        names = [m["name"].split("/")[-1] for m in ms if "generateContent" in m.get("supportedGenerationMethods", [])]
        flash = [n for n in names if "flash" in n and "lite" not in n and "image" not in n and "tts" not in n and "live" not in n and "audio" not in n]
        def ver(n):
            m = re.search(r"gemini-(\d+)(?:\.(\d+))?", n); return (int(m.group(1)), int(m.group(2) or 0), 0 if "preview" in n or "exp" in n else 1) if m else (0, 0, 0)
        flash.sort(key=ver, reverse=True)
        picked = flash[:3] + [m for m in MODELS if m not in flash]
        print("[models]", picked[:4])
        return picked
    except Exception as e:
        print("[models] 목록 조회 실패, 예비 목록 사용:", e, file=sys.stderr)
        return MODELS

ZODIAC = ["쥐", "소", "호랑이", "토끼", "용", "뱀", "말", "양", "원숭이", "닭", "개", "돼지"]
QUIZ_KINDS = ["사자성어", "속담", "우리말", "상식", "역사"]

STYLE = """너는 '오마주'의 편집자다. 오마주는 60~70대가 매일 아침 5분 보는 한국어 사이트다.
원칙: 이들을 젊게 대한다. 가르치지 않고 돌보지 않고 같이 논다.
말투: 담백하고 품격 있는 존댓말("~입니다", "~세요"). 짧은 문장. 과장·느낌표·이모지 금지.
절대 쓰지 않는 말: 시니어, 어르신, 노인, 노년, 은퇴, 치매, 두뇌, 건강관리, 효도, 실버, 황혼.
한자는 사자성어 표기 외에는 쓰지 않는다. 외래어 남발 금지.
반드시 JSON만 출력한다. 설명·마크다운·코드펜스 없이 JSON 객체 하나만."""


def today():
    return datetime.datetime.now(KST).date()


def gemini(prompt, json_mode=True, search=False, max_retry=3):
    """Gemini REST 호출. json_mode면 JSON 객체를 파싱해 돌려준다."""
    if not GEMINI_KEY:
        raise RuntimeError("GEMINI_API_KEY 없음")
    last = None
    for model in gemini.models:
        for attempt in range(max_retry):
            body = {
                "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                "systemInstruction": {"parts": [{"text": STYLE}]},
                "generationConfig": {"temperature": 0.9, "maxOutputTokens": 4096},
            }
            if json_mode and not search:
                body["generationConfig"]["responseMimeType"] = "application/json"
            if search:
                body["tools"] = [{"google_search": {}}]
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_KEY}"
            req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
            try:
                with urllib.request.urlopen(req, timeout=120) as r:
                    res = json.load(r)
                text = "".join(p.get("text", "") for p in res["candidates"][0]["content"]["parts"])
                if not json_mode:
                    return text
                return parse_json(text)
            except Exception as e:  # 429·500·파싱 실패 등 → 잠시 쉬고 재시도
                last = e
                print(f"[gemini] {model} 시도 {attempt + 1} 실패: {e}", file=sys.stderr)
                time.sleep(8 * (attempt + 1))
    raise RuntimeError(f"Gemini 실패: {last}")


def parse_json(text):
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.S)
    m = re.search(r"\{.*\}", text, flags=re.S)
    return json.loads(m.group(0) if m else text)


# ── 각 코너 ────────────────────────────────────────────────

def gen_greetings(d):
    season = ["겨울", "겨울", "봄", "봄", "봄", "여름", "여름", "여름", "가을", "가을", "가을", "겨울"][d.month - 1]
    j = gemini(f"""오늘은 {d.year}년 {d.month}월 {d.day}일, {season}이다.
아침 인사 카드에 넣을 짧은 인사말 4개를 만들어라. 카톡으로 친구에게 보내는 그림 카드에 들어간다.
각 인사말은 세 줄, 줄마다 2~6글자 내외의 짧은 구절, 줄바꿈은 \\n으로. 전체 25자 이내.
하나는 계절·날씨 느낌, 하나는 안부, 하나는 응원, 하나는 유머나 여유. 서로 다른 어조로.
형식: {{"greetings": ["...","...","...","..."]}}""")
    g = [str(x).strip() for x in j.get("greetings", []) if str(x).strip()]
    assert len(g) == 4, "인사말 4개 아님"
    return g


def gen_fortune(d):
    j = gemini(f"""오늘은 {d.year}년 {d.month}월 {d.day}일. 열두 띠 각각의 오늘 한마디를 만들어라.
점괘가 아니라 하루를 기분 좋게 시작하게 하는 구체적인 권유 한 문장(25~45자). 돈·건강·불운 언급 금지. 띠마다 내용이 겹치지 않게.
형식: {{"fortune": {{"쥐":"...","소":"...","호랑이":"...","토끼":"...","용":"...","뱀":"...","말":"...","양":"...","원숭이":"...","닭":"...","개":"...","돼지":"..."}}}}""")
    f = j.get("fortune", {})
    assert all(z in f and f[z].strip() for z in ZODIAC), "띠 누락"
    return {z: f[z].strip() for z in ZODIAC}


def gen_era(d):
    era = {}
    for ago in (50, 40, 30, 20):
        yr = d.year - ago
        text = gemini(f"""{yr}년 {d.month}월(가능하면 {d.month}월 {d.day}일 전후 한 주 안)에 실제로 있었던 일을 구글 검색으로 확인해서 2~3개 골라라.
한국 소식 위주로 하되 세계 소식 1개를 섞어도 된다. 정치 논쟁·사건사고·죽음은 피하고 스포츠·문화·생활·방송·유행 위주로.
반드시 검색으로 확인된 사실만 쓰고, 날짜가 확실하면 "{d.month}월 N일," 로 시작한다. 확인이 안 되면 그 항목은 빼라.
또 그 시절(한국 {yr}년 무렵)의 생활 풍경을 떠올리게 하는 분위기 문장 한 개(40~60자)도 써라. "~그 시절을 다시 꺼내어 봅니다."로 끝낸다.
형식(JSON만): {{"mood":"...", "facts":[["짧은 제목(4~8자)","설명 한두 문장(40~90자)"], ...]}}""", json_mode=True, search=True)
        j = text if isinstance(text, dict) else parse_json(text)
        facts = [[str(a).strip(), str(b).strip()] for a, b in j.get("facts", []) if str(b).strip()][:3]
        assert j.get("mood") and facts, f"{yr} 그해 오늘 비어 있음"
        era[str(ago)] = {"mood": j["mood"].strip(), "facts": facts, "songs": pick_songs(yr, d)}
    return era


def pick_songs(yr, d):
    songs = json.load(open(os.path.join(HERE, "songs.json"), encoding="utf-8")).get(str(yr), [])
    if not songs:
        return []
    n = len(songs)
    start = (d.timetuple().tm_yday * 3) % n
    return [songs[(start + i) % n] for i in range(min(10, n))]


def gen_meal(d):
    season = ["한겨울", "늦겨울", "초봄", "봄", "늦봄", "초여름", "한여름", "늦여름", "초가을", "가을", "늦가을", "초겨울"][d.month - 1]
    j = gemini(f"""{season}({d.month}월)에 어울리는, 혼자서도 15~20분이면 만드는 한 끼 요리 하나를 정해라. 재료 5가지 이내, 흔한 재료. 한식·간단 양식·면 요리 등 매일 다르게.
형식: {{"meal": {{"title":"요리 이름(12자 이내)", "sub":"1인분 · N분 · 재료 N가지", "lead":"요리를 권하는 두 문장(50~80자, 제철 이야기 포함)", "ingredients":["재료와 양", ...5개 이내], "steps":["한 문장", "한 문장", "한 문장"], "tip":"한 문장"}}}}""")
    m = j["meal"]
    assert m.get("title") and len(m.get("steps", [])) >= 2 and m.get("ingredients"), "한 끼 형식 오류"
    return m


def gen_quiz(d):
    kind = QUIZ_KINDS[d.timetuple().tm_yday % len(QUIZ_KINDS)]
    j = gemini(f"""오늘의 퀴즈 한 문제. 종류: {kind}.
사자성어면 뜻을 풀어 주고 사자성어를 고르게, 속담이면 상황을 주고 속담을 고르게, 우리말이면 뜻을 주고 낱말을 고르게, 상식·역사면 쉬우면서도 "아, 그렇지" 싶은 문제.
보기 4개, 정답은 하나, 오답도 그럴듯하게. 정답 번호(answer)는 0~3 중 무작위.
해설(explain)은 정답을 다시 말하고 유래나 뜻을 2~3문장(100~160자)으로. 사자성어는 한자와 글자별 뜻을 함께.
형식: {{"quiz": {{"kind":"{kind}", "question":"...", "options":["...","...","...","..."], "answer":0, "explain":"..."}}}}""")
    q = j["quiz"]
    assert len(q.get("options", [])) == 4 and 0 <= int(q.get("answer", -1)) <= 3, "퀴즈 형식 오류"
    q["answer"] = int(q["answer"])
    q["kind"] = kind
    return q


def gen_story(d):
    theme = random.Random(d.toordinal()).choice(["서랍 속 물건", "동네 가게", "첫 월급", "라디오", "소풍", "편지", "시장", "겨울 난로", "자전거", "사진 한 장", "전화", "다방", "극장", "기차", "텃밭", "친구"])
    j = gemini(f"""'오늘의 사연' 한 편. 소재: {theme}. 1인칭 수필, 두 문단(각 120~180자). 1970~90년대의 기억 하나를 구체적인 물건·소리·냄새로 떠올리고, 마지막은 지금의 담담한 한 줄로 맺는다. 교훈·설교 금지. 제목은 8자 이내, 부제는 15자 이내.
형식: {{"story": {{"title":"...", "sub":"...", "paras":["문단1","문단2"], "by":"오마주 편집실"}}}}""")
    s = j["story"]
    assert s.get("title") and len(s.get("paras", [])) >= 2, "사연 형식 오류"
    s["by"] = "오마주 편집실"
    return s


# ── 저장 ────────────────────────────────────────────────

def firestore():
    from google.cloud import firestore as fs
    from google.oauth2 import service_account
    raw = os.environ.get("FIREBASE_SERVICE_ACCOUNT", "")
    if not raw:
        raise RuntimeError("FIREBASE_SERVICE_ACCOUNT 없음")
    info = json.loads(raw)
    cred = service_account.Credentials.from_service_account_info(info)
    return fs.Client(project=info["project_id"], credentials=cred)


def main():
    gemini.models = list_models()
    force = "--force" in sys.argv
    d = today()
    for a in sys.argv:
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", a):
            d = datetime.date.fromisoformat(a)
    key = d.isoformat()
    db = firestore()
    ref = db.collection("daily").document(key)
    cur = ref.get()
    if cur.exists and cur.to_dict().get("source") == "auto" and not force:
        print(f"{key} 이미 만들어져 있음. 건너뜀."); return
    if cur.exists and cur.to_dict().get("source") == "admin" and not force:
        print(f"{key} 관리자가 직접 쓴 내용이 있음. 건너뜀."); return

    out, errors = {}, []
    for name, fn in [("greetings", gen_greetings), ("fortune", gen_fortune), ("era", gen_era), ("meal", gen_meal), ("quiz", gen_quiz), ("story", gen_story)]:
        try:
            out[name] = fn(d)
            print(f"[ok] {name}")
        except Exception as e:
            errors.append(f"{name}: {e}")
            print(f"[fail] {name}: {e}", file=sys.stderr)
    if not out:
        raise SystemExit("아무것도 만들지 못함")
    out["source"] = "auto"
    out["generatedAt"] = datetime.datetime.now(KST).isoformat()
    out["errors"] = errors
    ref.set(out, merge=True)
    os.makedirs(os.path.join(HERE, "..", "daily"), exist_ok=True)
    with open(os.path.join(HERE, "..", "daily", key + ".json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f"{key} 저장 완료. 코너 {len(out) - 3}개" + (f", 실패 {len(errors)}개" if errors else ""))


if __name__ == "__main__":
    main()
