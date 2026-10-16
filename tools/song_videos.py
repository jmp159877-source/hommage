# 노래마다 유튜브 영상 하나를 골라 data/song_videos.json 에 저장 (한 번 고르면 계속 씀)
# 유튜브 무료 한도(하루 검색 약 100번) 안에서, 아직 안 고른 노래만 한 번에 최대 90곡.
import os, sys, json, re, urllib.request, urllib.parse
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "data", "song_videos.json")
KEY = os.environ["YOUTUBE_API_KEY"]

def search(q):
    p = urllib.parse.urlencode({"part": "snippet", "q": q, "type": "video", "videoEmbeddable": "true", "regionCode": "KR", "relevanceLanguage": "ko", "maxResults": 6, "key": KEY})
    with urllib.request.urlopen(f"https://www.googleapis.com/youtube/v3/search?{p}", timeout=30) as r:
        return json.load(r).get("items", [])

sys.path.insert(0, HERE)
from yt_scrape import scrape

def norm(s): return re.sub(r"[\s\W_]+", "", s or "").lower()

# 클래식·외국 곡은 영어 제목으로 올라온 영상이 많다 → 다른 이름도 같이 맞춰 본다
ALIAS = {"쇼팽": "chopin", "생상스": "saint-saens", "베토벤": "beethoven", "모차르트": "mozart", "드뷔시": "debussy", "슈베르트": "schubert",
         "차이콥스키": "tchaikovsky", "비발디": "vivaldi", "바흐": "bach", "엘가": "elgar", "마스네": "massenet", "리스트": "liszt", "브람스": "brahms",
         "녹턴": "nocturne", "백조": "the swan", "월광": "moonlight", "사계": "four seasons", "타이스의 명상곡": "meditation thais", "사랑의 인사": "salut d'amour"}
def en(x):
    for k, v in ALIAS.items(): x = x.replace(k, v)
    return x.replace("2번", "no. 2").replace("번", "")

songs = json.load(open(os.path.join(HERE, "songs.json"), encoding="utf-8"))
have = json.load(open(OUT, encoding="utf-8")) if os.path.exists(OUT) else {}
import datetime
Y = datetime.date.today().year
now_years = {str(Y - n) for n in (50, 40, 30, 20)}
def prio(k):  # 올해 화면에 나오는 해(가요·팝송) → 장르 → 내년 것
    yr = k.split(":")[-1]
    return 0 if yr in now_years else 1 if k.startswith("genre:") else 2
todo, seen = [], set()
for y in sorted([k for k in songs if not k.startswith("_")], key=prio):
    for t, a in songs[y]:
        if not have.get(f"{t}|{a}") and (t, a) not in seen: seen.add((t, a)); todo.append((t, a))
print("남은 노래", len(todo))
bad = re.compile(r"커버|cover|노래방|karaoke|반주|\bmr\b|\binst\b|lesson|강좌|리액션|reaction|shorts|배우기", re.I)
def score(it):
    sn = it["snippet"]; ti = sn["title"].lower(); s = 0
    if norm(t) in norm(ti) or norm(en(t)) in norm(ti): s += 3
    if any(norm(x) in norm(ti) or norm(x) in norm(sn["channelTitle"]) for x in (a, en(a))): s += 3
    if bad.search(ti): s -= 5
    if "official" in sn["channelTitle"].lower() or "공식" in sn["channelTitle"] or "kbs" in sn["channelTitle"].lower() or "mbc" in sn["channelTitle"].lower(): s += 1
    return s

api_ok = True
for t, a in todo[:400]:
    items = None
    if api_ok:
        try:
            items = search(f"{a} {t}")
        except Exception as e:
            print("유튜브 한도 바닥 → 검색 페이지로 계속:", str(e)[:80]); api_ok = False
    if items is None:
        try:
            items = scrape(f"{a} {t}")
        except Exception as e:
            print("검색 실패", t, e); continue
    # 안 맞으면 영어 이름·공식 영상으로 한 번 더
    for q2 in ([f"{en(a)} {en(t)}"] if en(a + t) != a + t else []) + [f"{a} {t} 공식 뮤직비디오", f"{t} {a} live"]:
        if items and max(map(lambda it: score(it), items)) >= 3: break
        try: items = (items or []) + scrape(q2)
        except Exception: pass
    items.sort(key=score, reverse=True)
    if items and score(items[0]) >= 3:
        it = items[0]; have[f"{t}|{a}"] = {"v": it["id"]["videoId"], "t": it["snippet"]["title"], "c": it["snippet"]["channelTitle"]}
        print("ok", t, "-", a, "→", it["snippet"]["title"][:50])
    else:
        have[f"{t}|{a}"] = None; print("못 찾음", t, a)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(have, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
print("저장", len([v for v in have.values() if v]), "곡")
