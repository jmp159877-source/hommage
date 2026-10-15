"""하루 콘텐츠 일부를 손으로 고쳐 넣기 (Firestore + daily/<날짜>.json). PATCH 환경변수에 JSON."""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from gen_daily import firestore

date, patch = os.environ["DATE"], json.loads(os.environ["PATCH"])
firestore().collection("daily").document(date).set(patch, merge=True)
p = f"daily/{date}.json"
d = json.load(open(p)) if os.path.exists(p) else {}
d.update(patch); json.dump(d, open(p, "w"), ensure_ascii=False, indent=1)
print("고침", date, list(patch))
