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
    """야후 금융: 현재가와 '전날 종가'.
    야후가 주는 previousClose 는 가끔 그저께 값이 들어 있어(코스닥 2026-10-16) 믿지 않고,
    일봉(하루 막대)에서 '오늘이 아닌 가장 최근 날'의 종가를 직접 고른다."""
    j = get(f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.request.quote(sym)}?range=10d&interval=1d")
    r = j["chart"]["result"][0]; m = r["meta"]
    price = float(m["regularMarketPrice"])
    tz = datetime.timezone(datetime.timedelta(seconds=m.get("gmtoffset", 0)))
    today = datetime.datetime.fromtimestamp(m["regularMarketTime"], tz).date()
    closes = r["indicators"]["quote"][0]["close"]
    prev = None
    for ts, c in zip(r.get("timestamp", []), closes):
        if c is not None and datetime.datetime.fromtimestamp(ts, tz).date() < today:
            prev = float(c)
    return price, prev


def naver_index(code):
    """네이버 증권 지수(코스피 KOSPI / 코스닥 KOSDAQ): 현재가와 전날 대비 → 전날 종가"""
    j = get(f"https://m.stock.naver.com/api/index/{code}/basic")
    num = lambda x: float(str(x).replace(",", ""))
    price = num(j["closePrice"]); diff = num(j["compareToPreviousClosePrice"])
    # 내림이면 diff 가 음수로 오지만, 부호 없이 오는 경우를 대비해 등락 구분 값을 본다
    kind = str((j.get("compareToPreviousPrice") or {}).get("name", "")).upper()
    if kind in ("FALLING", "LOWER_LIMIT") and diff > 0: diff = -diff
    return price, price - diff


def item(label, value, prev, unit, digits=0, note=""):
    chg = None if not prev else (value - prev) / prev * 100
    return {"label": label, "value": round(value, digits), "unit": unit, "change": None if chg is None else round(chg, 2), "note": note}


def main():
    out, errors = [], []
    usd = None
    # 1) 환율: 실시간에 가까운 시장 환율(야후). 실패하면 하루 한 번 갱신되는 공개 환율로
    try:
        usd, usd0 = yahoo("KRW=X")
        jpy, jpy0 = yahoo("JPYKRW=X")
        eur, eur0 = yahoo("EURKRW=X")
        out.append(item("미국 달러", usd, usd0, "원", 1))
        out.append(item("일본 엔 (100엔)", jpy * 100, (jpy0 * 100) if jpy0 else None, "원", 1))
        out.append(item("유로", eur, eur0, "원", 1))
    except Exception as e:
        errors.append(f"환율(야후): {e}")
        try:
            fx = get("https://open.er-api.com/v6/latest/USD")["rates"]
            usd = fx["KRW"]
            out.append(item("미국 달러", usd, None, "원", 1))
            out.append(item("일본 엔 (100엔)", usd / fx["JPY"] * 100, None, "원", 1))
            out.append(item("유로", usd / fx["EUR"], None, "원", 1))
        except Exception as e2:
            errors.append(f"환율: {e2}")
    # 2) 코스피·코스닥
    # 네이버 증권(우리가 늘 보는 숫자)을 먼저, 안 되면 야후
    for code, sym, label in (("KOSPI", "^KS11", "코스피"), ("KOSDAQ", "^KQ11", "코스닥")):
        try:
            p, prev = naver_index(code)
        except Exception as e:
            errors.append(f"{label}(네이버): {e}")
            try:
                p, prev = yahoo(sym)
            except Exception as e2:
                errors.append(f"{label}: {e2}"); continue
        # 하루에 ±15% 넘게 움직였다고 나오면 잘못 받은 값 → 등락은 비워 둠
        if prev and abs(p - prev) / prev > 0.15: prev = None
        out.append(item(label, p, prev, "", 2))
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
    if os.environ.get("SAVE_LOG"):
        json.dump(doc, open(os.path.join(HERE, "last-market.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("저장 완료", doc["updatedAt"])


if __name__ == "__main__":
    main()
