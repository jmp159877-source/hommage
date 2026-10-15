"""인사 카드용 무료 사진(Pexels) 계절별로 모아 저장. 한 번 모아 두고 날마다 돌려 씀.
Pexels 사진은 출처 표기 없이 무료로 쓸 수 있음. 키: PEXELS_API_KEY"""
import json, os, sys, io, urllib.request, urllib.parse
from PIL import Image, ImageStat

KEY = os.environ.get("PEXELS_API_KEY", "")
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
    return bright > 115 and sat > 55, round(bright), round(sat)


def main():
    if not KEY:
        print("PEXELS_API_KEY 없음"); sys.exit(1)
    meta = {}
    for season, qs in Q.items():
        os.makedirs(f"img/cards/{season}", exist_ok=True)
        got, seen = [], set()
        for q in qs:
            for page in (1, 2):
                if len(got) >= PER: break
                u = "https://api.pexels.com/v1/search?" + urllib.parse.urlencode({"query": q, "orientation": "portrait", "per_page": 40, "page": page, "size": "large"})
                j = json.loads(get(u, {"Authorization": KEY}))
                for p in j.get("photos", []):
                    if len(got) >= PER or p["id"] in seen: continue
                    seen.add(p["id"])
                    try:
                        im = Image.open(io.BytesIO(get(p["src"]["portrait"])))
                    except Exception as e:
                        print("skip", p["id"], e); continue
                    ok, br, sat = good(im)
                    if not ok: continue
                    n = len(got) + 1
                    w, h = im.size; th = int(w * 1.25)
                    if h > th: top = (h - th) // 2; im = im.crop((0, top, w, top + th))
                    im = im.convert("RGB").resize((800, 1000), Image.LANCZOS)
                    im.save(f"img/cards/{season}/{n:02d}.jpg", "JPEG", quality=84, optimize=True, progressive=True)
                    got.append({"f": f"img/cards/{season}/{n:02d}.jpg", "id": p["id"], "by": p["photographer"], "alt": p.get("alt", ""), "q": q, "bright": br, "sat": sat})
            print(season, q, len(got))
        meta[season] = got
    json.dump(meta, open("data/card_photos.json", "w"), ensure_ascii=False, indent=1)
    print("완료", {k: len(v) for k, v in meta.items()})


if __name__ == "__main__":
    main()
