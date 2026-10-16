"""하루 콘텐츠 일부를 손으로 고쳐 넣기 (Firestore + daily/<날짜>.json). PATCH 환경변수에 JSON."""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from gen_daily import firestore

date, patch = os.environ["DATE"], json.loads(os.environ["PATCH"])
firestore().collection("daily").document(date).set(patch, merge=True)
p = f"daily/{date}.json"
d = json.load(open(p)) if os.path.exists(p) else {}
def deep(a, b):
    for k, v in b.items():
        if isinstance(v, dict) and isinstance(a.get(k), dict): deep(a[k], v)
        else: a[k] = v
deep(d, patch)
# 파일은 Firestore 의 지금 내용 전체로 (다른 작업과 겹쳐도 최신이 남게)
try: d = firestore().collection("daily").document(date).get().to_dict() or d
except Exception: pass
json.dump(d, open(p, "w"), ensure_ascii=False, indent=1, default=str)
print("고침", date, list(patch))
