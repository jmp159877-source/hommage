# 오마주 오늘의 시세: 환율·금·은·코스피·코스닥·비트코인을 모아 Firestore settings/market 에 저장
# 한 시간마다 GitHub Actions가 실행한다. 키가 필요 없는 공개 출처만 쓴다.
import os, sys, json, datetime, urllib.request

KST = datetime.timezone(datetime.timedelta(hours=9))
HERE = os.path.dirname(os.path.abspath(__file__))
UA = {"User-Agent": "Mozilla/5.0 (omaju.kr daily market)"}


def get(url, timeout=20):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


def yahoo(sym):
    """야후 금융: 현재가와 전일 종가"""
    j = get(f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.request.quote(sym)}?range=5d&interval=1d")
    m = j["chart"]["result"][0]["meta"]
    price = m.get("regularMarketPrice")
    prev = m.get("chartPreviousClose") or m.get("previousClose")
    return float(price), (float(prev) if prev else None)


def item(label, value, prev, unit, digits=0, note=""):
    chg = None if not prev else (value - prev) / prev * 100
    return {"label": label, "value": round(value, digits), "unit": unit, "change": None if chg is None else round(chg, 2), "note": note}


def main():
    out, errors = [], []
    usd = None
    # 1) 환율 (달러 기준 공개 API, 하루 한 번 갱신)
    try:
        fx = get("https://open.er-api.com/v6/latest/USD")["rates"]
        usd = fx["KRW"]
        out.append(item("미국 달러", usd, None, "원", 1))
        out.append(item("일본 엔 (100엔)", usd / fx["JPY"] * 100, None, "원", 1))
        out.append(item("유로", usd / fx["EUR"], None, "원", 1))
    except Exception as e:
        errors.append(f"환율: {e}")
    # 2) 코스피·코스닥
    for sym, label in (("^KS11", "코스피"), ("^KQ11", "코스닥")):
        try:
            p, prev = yahoo(sym); out.append(item(label, p, prev, "", 2))
        except Exception as e:
            errors.append(f"{label}: {e}")
    # 3) 금·은 (국제 시세를 원/돈으로 환산. 1돈 = 3.75g, 1온스 = 31.1035g)
    if usd:
        for sym, label in (("GC=F", "금 1돈"), ("SI=F", "은 1돈")):
            try:
                p, prev = yahoo(sym)
                k = usd / 31.1035 * 3.75
                out.append(item(label, p * k, (prev * k) if prev else None, "원", 0, "국제 시세 환산"))
            except Exception as e:
                errors.append(f"{label}: {e}")
    # 4) 비트코인·이더리움 (업비트, 원화)
    try:
        for t in get("https://api.upbit.com/v1/ticker?markets=KRW-BTC,KRW-ETH"):
            label = "비트코인" if t["market"] == "KRW-BTC" else "이더리움"
            out.append(item(label, t["trade_price"], t["prev_closing_price"], "원", 0))
    except Exception as e:
        errors.append(f"코인: {e}")

    if not out:
        raise SystemExit("시세를 하나도 못 받음: " + "; ".join(errors))
    doc = {"items": out, "updatedAt": datetime.datetime.now(KST).isoformat(), "errors": errors}
    for e in errors:
        print("[fail]", e, file=sys.stderr)
    print(json.dumps(doc, ensure_ascii=False, indent=1))

    from google.cloud import firestore as fs
    from google.oauth2 import service_account
    info = json.loads(os.environ["FIREBASE_SERVICE_ACCOUNT"])
    db = fs.Client(project=info["project_id"], credentials=service_account.Credentials.from_service_account_info(info))
    db.collection("settings").document("market").set(doc)
    print("저장 완료", doc["updatedAt"])


if __name__ == "__main__":
    main()
