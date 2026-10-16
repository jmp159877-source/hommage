"""이번 주말 나들이: 주 단위로 data/outing.json 에 지역별로 쌓는다.
매 실행마다 아직 없는 지역만 만든다 → AI 하루 한도가 막혀도 다음 실행에서 이어서 채움."""
import os, sys, json, datetime
sys.path.insert(0, os.path.dirname(__file__))
import gen_daily as g

KST = datetime.timezone(datetime.timedelta(hours=9))
today = datetime.datetime.now(KST).date()
sat = today + datetime.timedelta(days=(5 - today.weekday()) % 7) if today.weekday() != 6 else today - datetime.timedelta(days=1)
P = os.path.join(os.path.dirname(__file__), "..", "data", "outing.json")
cur = json.load(open(P, encoding="utf-8")) if os.path.exists(P) else {}
if cur.get("week") != sat.isoformat():
    cur = {"week": sat.isoformat(), "regions": {}}
missing = [r for r in g.REGIONS if r not in cur["regions"]]
limit = int(os.environ.get("LIMIT", "9"))
print("이번 주", sat, "채운 지역", len(cur["regions"]), "남은 지역", len(missing))
def save():
    cur["updated"] = datetime.datetime.now(KST).isoformat(timespec="minutes")
    json.dump(cur, open(P, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

save()  # 파일이 늘 있게
if missing:
    import time
    t0 = time.time()
    g.gemini.models = g.list_models()
    for r in missing[:limit]:  # 한 지역씩 만들고 바로 저장 → 시간 제한에 걸려도 만든 만큼은 남음
        if time.time() - t0 > 25 * 60:
            print("시간이 다 되어 여기까지:", r); break
        g.gen_outing.regions = [r]
        try:
            got = g.gen_outing(today)
            if got.get(r): cur["regions"][r] = got[r]; save(); print("[ok]", r, len(got[r]))
            else: print("[빈 결과]", r)
        except Exception as e:
            print("[실패]", r, str(e)[:150])
save()
print("저장: 지역", len(cur["regions"]), list(cur["regions"]))
