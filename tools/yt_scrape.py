"""유튜브 검색 결과 페이지에서 영상 고르기 (API 한도와 무관)"""
import re, json, urllib.request, urllib.parse

def scrape(q):
    """유튜브 한도가 바닥났을 때: 검색 결과 페이지에서 영상 번호·제목을 읽는다 (한도 없음)."""
    req = urllib.request.Request("https://www.youtube.com/results?" + urllib.parse.urlencode({"search_query": q, "hl": "ko", "gl": "KR"}), headers={"User-Agent": "Mozilla/5.0", "Accept-Language": "ko-KR"})
    html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "ignore")
    m = re.search(r"var ytInitialData = (\{.*?\});</script>", html)
    if not m: return []
    out = []
    def walk(o):
        if isinstance(o, dict):
            v = o.get("videoRenderer")
            if v and v.get("videoId"):
                t = "".join(r.get("text", "") for r in v.get("title", {}).get("runs", []))
                c = "".join(r.get("text", "") for r in v.get("ownerText", {}).get("runs", []))
                out.append({"id": {"videoId": v["videoId"]}, "snippet": {"title": t, "channelTitle": c}})
            for x in o.values(): walk(x)
        elif isinstance(o, list):
            for x in o: walk(x)
    walk(json.loads(m.group(1)))
    return out[:8]

