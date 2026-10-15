# firestore.rules 를 Firebase에 게시 (서비스 계정 사용)
import os, json, sys, datetime
from google.oauth2 import service_account
from google.auth.transport.requests import AuthorizedSession

info = json.loads(os.environ["FIREBASE_SERVICE_ACCOUNT"])
proj = info["project_id"]
cred = service_account.Credentials.from_service_account_info(info, scopes=["https://www.googleapis.com/auth/cloud-platform", "https://www.googleapis.com/auth/firebase"])
s = AuthorizedSession(cred)
src = open("firestore.rules", encoding="utf-8").read()
r = s.post(f"https://firebaserules.googleapis.com/v1/projects/{proj}/rulesets", json={"source": {"files": [{"name": "firestore.rules", "content": src}]}})
print("ruleset:", r.status_code, r.text[:300])
r.raise_for_status()
name = r.json()["name"]
rel = f"projects/{proj}/releases/cloud.firestore"
r2 = s.patch(f"https://firebaserules.googleapis.com/v1/{rel}", json={"release": {"name": rel, "rulesetName": name}})
print("release:", r2.status_code, r2.text[:300])
if r2.status_code == 404:
    r2 = s.post(f"https://firebaserules.googleapis.com/v1/projects/{proj}/releases", json={"name": rel, "rulesetName": name})
    print("release(create):", r2.status_code, r2.text[:300])
r2.raise_for_status()
print("게시 완료", datetime.datetime.now().isoformat())
