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

def norm(s): return re.sub(r"[\s\W_]+", "", s or "").lower()

songs = json.load(open(os.path.join(HERE, "songs.json"), encoding="utf-8"))
have = json.load(open(OUT, encoding="utf-8")) if os.path.exists(OUT) else {}
todo = [(t, a) for y, lst in songs.items() if not y.startswith("_") for t, a in lst if f"{t}|{a}" not in have]
print("남은 노래", len(todo))
for t, a in todo[:90]:
    try:
        items = search(f"{a} {t}")
    except Exception as e:
        print("검색 실패", t, e); break
    bad = ("커버", "cover", "노래방", "karaoke", "반주", "mr", "inst", "lesson", "강좌", "리액션", "reaction", "shorts")
    def score(it):
        sn = it["snippet"]; ti = sn["title"].lower(); s = 0
        if norm(t) in norm(ti): s += 3
        if norm(a) in norm(ti) or norm(a) in norm(sn["channelTitle"]): s += 3
        if any(b in ti for b in bad): s -= 5
        if "official" in sn["channelTitle"].lower() or "공식" in sn["channelTitle"] or "kbs" in sn["channelTitle"].lower() or "mbc" in sn["channelTitle"].lower(): s += 1
        return s
    items.sort(key=score, reverse=True)
    if items and score(items[0]) >= 3:
        it = items[0]; have[f"{t}|{a}"] = {"v": it["id"]["videoId"], "t": it["snippet"]["title"], "c": it["snippet"]["channelTitle"]}
        print("ok", t, "-", a, "→", it["snippet"]["title"][:50])
    else:
        have[f"{t}|{a}"] = None; print("못 찾음", t, a)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(have, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
print("저장", len([v for v in have.values() if v]), "곡")
