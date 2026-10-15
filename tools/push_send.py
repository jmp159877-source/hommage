"""아침 알림 보내기: 지금 시각(KST)에 받기로 한 기기들에게 FCM으로 보낸다."""
import os, json, datetime, urllib.request, urllib.error
from google.oauth2 import service_account
import google.auth.transport.requests
from google.cloud import firestore

KST = datetime.timezone(datetime.timedelta(hours=9))
now = datetime.datetime.now(KST)
hour = int(os.environ.get("HOUR") or (now + datetime.timedelta(minutes=15)).hour)  # 몇 분 일찍 깨어나도 그 시각 몫을 보냄
info = json.loads(os.environ["FIREBASE_SERVICE_ACCOUNT"])
cred = service_account.Credentials.from_service_account_info(info, scopes=["https://www.googleapis.com/auth/firebase.messaging", "https://www.googleapis.com/auth/datastore"])
cred.refresh(google.auth.transport.requests.Request())
db = firestore.Client(project=info["project_id"], credentials=cred)

today = now.date().isoformat()
day = db.collection("daily").document(today).get()
g = (day.to_dict() or {}).get("greetings") if day.exists else None
first = (g[0] if g else "좋은 아침입니다.\n오늘도 반갑습니다.").replace("\n", " ")
wd = "월화수목금토일"[now.weekday()]
title = f"오마주 · {now.month}월 {now.day}일 {wd}요일"
body = f"{first}  오늘의 인사 카드와 오늘 PLAY가 기다립니다."

docs = list(db.collection("push").where("hour", "==", hour).stream())
print("보낼 시각", hour, "기기", len(docs))
url = f"https://fcm.googleapis.com/v1/projects/{info['project_id']}/messages:send"
sent = gone = fail = 0
for d in docs:
    tok = d.to_dict().get("token")
    msg = {"message": {"token": tok, "webpush": {"headers": {"Urgency": "high", "TTL": "7200"}, "data": {"title": title, "body": body, "url": "./"}}}}
    req = urllib.request.Request(url, data=json.dumps(msg).encode(), headers={"Authorization": f"Bearer {cred.token}", "Content-Type": "application/json"})
    try:
        urllib.request.urlopen(req, timeout=20); sent += 1
    except urllib.error.HTTPError as e:
        t = e.read().decode()[:200]
        if e.code in (404, 410) or "UNREGISTERED" in t or "INVALID_ARGUMENT" in t:
            d.reference.delete(); gone += 1
        else:
            fail += 1; print("실패", e.code, t)
print(f"보냄 {sent} · 해지된 기기 정리 {gone} · 실패 {fail}")
