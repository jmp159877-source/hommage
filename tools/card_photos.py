"""인사 카드용 무료 사진(Pixabay) 계절별로 모아 저장. 한 번 모아 두고 날마다 돌려 씀.
Pixabay 사진은 출처 표기 없이 무료로 쓸 수 있고, 내려받아 우리 서버에 두는 방식이 규정에 맞음. 키: PIXABAY_API_KEY"""
import json, os, sys, io, urllib.request, urllib.parse
from PIL import Image, ImageStat

KEY = os.environ.get("PIXABAY_API_KEY", "")
PER = 30  # 계절마다 모을 장 수
Q = {
    "spring": ["spring blossom sunlight", "cherry blossom morning", "spring flowers field sunny", "tulips bright"],
    "summer": ["summer morning sunlight nature", "sunflower field", "summer sea bright", "green meadow sunshine"],
    "autumn": ["autumn golden sunlight", "autumn leaves warm light", "cosmos flowers field", "ginkgo yellow trees"],
    "winter": ["winter morning sunlight snow", "cozy winter window light", "camellia flower", "warm tea winter morning"],
}


def get(url, headers=None):
    req = urllib.request.Request(url, headers={"User-Agent": "omaju", **(headers or {})})
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.read()


def good(img):
    """밝고 따뜻한 사진만: 너무 어둡거나 칙칙하면 뺀다."""
    small = img.convert("RGB").resize((64, 80))
    r, g, b = ImageStat.Stat(small).mean
    bright = (r * 299 + g * 587 + b * 114) / 1000
    sat = ImageStat.Stat(small.convert("HSV")).mean[1]
    return bright > int(os.environ.get("MINB", "115")) and sat > 45, round(bright), round(sat)


ONLY = [x for x in os.environ.get("ONLY", "").split(",") if x]
OUT = os.environ.get("OUT", "img/cards")
if os.environ.get("QUERIES"):
    Q = {k: v for k, v in Q.items()}
    for part in os.environ["QUERIES"].split(";"):
        k, qs = part.split(":", 1); Q[k] = [q.strip() for q in qs.split("|") if q.strip()]


def main():
    if not KEY:
        print("PIXABAY_API_KEY 없음"); sys.exit(1)
    meta = {}
    for season, qs in Q.items():
        if ONLY and season not in ONLY: continue
        os.makedirs(f"{OUT}/{season}", exist_ok=True)
        got, seen = [], set()
        for q in qs:
            for page in (1, 2):
                if len(got) >= PER: break
                u = "https://pixabay.com/api/?" + urllib.parse.urlencode({"key": KEY, "q": q, "image_type": "photo", "orientation": "vertical", "per_page": 60, "page": page, "safesearch": "true", "editors_choice": "false", "min_width": 900, "order": "popular"})
                j = json.loads(get(u))
                for p in j.get("hits", []):
                    if len(got) >= PER or p["id"] in seen: continue
                    seen.add(p["id"])
                    try:
                        im = Image.open(io.BytesIO(get(p["largeImageURL"])))
                    except Exception as e:
                        print("skip", p["id"], e); continue
                    ok, br, sat = good(im)
                    if not ok: continue
                    n = len(got) + 1
                    w, h = im.size; th = int(w * 1.25)
                    if h > th: top = (h - th) // 2; im = im.crop((0, top, w, top + th))
                    im = im.convert("RGB").resize((800, 1000), Image.LANCZOS)
                    im.save(f"{OUT}/{season}/{n:02d}.jpg", "JPEG", quality=84, optimize=True, progressive=True)
                    got.append({"f": f"{OUT}/{season}/{n:02d}.jpg", "id": p["id"], "by": p.get("user", ""), "tags": p.get("tags", ""), "q": q, "bright": br, "sat": sat})
            print(season, q, len(got))
        meta[season] = got
    json.dump(meta, open("data/card_photos.json" if OUT == "img/cards" else f"{OUT}/meta.json", "w"), ensure_ascii=False, indent=1)
    print("완료", {k: len(v) for k, v in meta.items()})


if __name__ == "__main__":
    main()
