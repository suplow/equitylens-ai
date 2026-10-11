"""Independent MOCK fixture calculator, Python stdlib Decimal (50 digits).
No application imports, subprocesses, network or engine-generated expectations.
Run: python src/lib/financial/fixtures/recompute.py [--check]
"""
import csv
import io
import json
import sys
from decimal import Decimal, getcontext
from pathlib import Path

getcontext().prec = 50
ROOT = Path(__file__).resolve().parent
D = lambda n: Decimal(str(n))
M = D(1000000)
SCALE = dict(unit=D(1), thousand=D(1000), million=M, billion=D(1000000000))
INC = "revenue costOfRevenue grossProfit operatingExpenses ebit interestExpense pretaxIncome incomeTax netIncome netIncomeToCommon dilutedEps depreciation".split()
BAL = "cash receivables inventory currentAssets totalAssets currentLiabilities shortTermDebt longTermDebt totalLiabilities shareholdersEquity minorityInterest preferredEquity nonOperatingAssets otherClaims operatingWorkingCapital".split()
CASH = "cfo capex cfi cff".split()
FIELDS = INC + BAL + CASH


def row(income, balance, cash):
    cells = (income + " " + balance + " " + cash).split()
    assert len(cells) == len(FIELDS)
    return dict(zip(FIELDS, [None if c == "null" else D(c) for c in cells]))


# Manually designed economic cases. Amounts millions; EPS/price VND/share.
TABLES = {
    "stable": {
        2023: row("900 540 360 180 180 10 170 34 136 130 1300 40", "100 110 140 380 900 160 60 100 300 550 40 10 20 5 150", "170 55 -55 -15"),
        2024: row("1000 600 400 200 200 10 190 38 152 144 1440 45", "110 120 160 420 1000 180 60 110 330 610 45 15 25 8 160", "190 60 -60 -120"),
        2025: row("1100 660 440 220 220 12 208 41.6 166.4 156 1560 50", "140 130 180 480 1150 200 70 130 370 710 50 20 30 10 175", "210 70 -70 -110"),
    },
    "growth": {
        2023: row("600 390 210 120 90 15 75 15 60 55 550 45", "50 100 150 350 1000 250 150 250 550 390 40 20 10 15 180", "80 100 -100 20"),
        2024: row("900 558 342 189 153 20 133 26.6 106.4 95 950 70", "65 170 260 570 1450 360 220 380 800 560 60 30 20 25 300", "105 190 -190 100"),
        2025: row("1350 810 540 270 270 28 242 48.4 193.6 175 1750 110", "80 290 430 900 2200 600 350 650 1250 820 90 40 35 50 500", "140 320 -320 195"),
    },
    "distressed": {
        2024: row("500 350 150 110 40 30 10 2 8 5 50 20", "20 100 100 250 800 300 250 300 720 40 30 10 40 25 80", "20 35 -35 15"),
        2025: row("420 340 80 110 -30 50 -80 0 -80 -85 -850 25", "10 null 140 210 750 400 300 380 800 -100 35 15 null 70 90", "-20 45 -45 55"),
    },
}
PRICES = dict(stable=D(12500), growth=D(18000), distressed=D(1500))
BASIS = "MOCK same accounting/share basis; no corporate actions"


def metadata(year, kind="annual", q=None):
    start, end, published, suffix = f"{year}-01-01", f"{year}-12-31", f"{year+1}-03-31", ""
    if q:
        if kind == "quarter":
            start = f"{year}-{(q-1)*3+1:02d}-01"
        end = f"{year}-" + ["03-31", "06-30", "09-30", "12-31"][q-1]
        published = f"{year}-{q*3+1:02d}-30" if q < 4 else f"{year+1}-01-30"
        suffix = f"_{'Q' if kind == 'quarter' else 'YTD'}{q}"
    return dict(id=f"FY{year}{suffix}", kind=kind, fiscalYear=year, fiscalQuarter=q,
                startDate=start, endDate=end, scope="consolidated", audited="unaudited", publishedAt=published, basis=BASIS)


def report(case, year, values, kind="annual", q=None):
    fields = {}
    for key, n in values.items():
        unit = "unit" if key == "dilutedEps" else "billion" if case == "growth" else "million"
        if case == "stable" and kind == "annual":
            unit = {(2025, "revenue"): "billion", (2024, "shareholdersEquity"): "thousand", (2023, "totalAssets"): "unit"}.get((year, key), unit)
        base = n if n is None or key == "dilutedEps" else n*M
        fields[key] = dict(value=None if base is None else base/SCALE[unit], unit=unit, sourceId="SYNTHETIC", locator=f"MOCK table {case}/{year}/{kind}/{q or 'FY'}/{key}")
    return {**metadata(year, kind, q), "fields": fields}


def dataset(case):
    table = TABLES[case]
    reports = [report(case, year, vals) for year, vals in table.items()]
    if case == "stable":
        # Both FY2024 and Q4 exist: explicitly select the annual opening balances.
        current_index = next(i for i, r in enumerate(reports) if r["id"] == "FY2025")
        reports[current_index] = {"id": "FY2025", "openingReportId": "FY2024", **reports[current_index]}
        for year, q in [(2024, 3), (2024, 4), (2025, 1), (2025, 2), (2025, 3)]:
            old, new = table[year-1], table[year]
            weight = D(".25") if year == 2024 else [D(".24"), D(".25"), D(".26")][q-1]
            vals = {k: old[k]+(new[k]-old[k])*D(q)/4 if k in BAL else new[k]*weight for k in FIELDS}
            reports.append(report(case, year, vals, "quarter", q))
        for q, weight in [(1, D(".24")), (2, D(".49"))]:
            vals = {k: table[2024][k]+(table[2025][k]-table[2024][k])*D(q)/4 if k in BAL else table[2025][k]*weight for k in FIELDS}
            reports.append(report(case, 2025, vals, "ytd", q))
    def mf(n, unit):
        return dict(value=n, unit=unit, sourceId="SYNTHETIC", locator="MOCK quote/shares; not an exchange observation")
    return dict(version="2.0", industry="corporate", symbol={"stable": "MOCKSTBL", "growth": "MOCKGROW", "distressed": "MOCKDIST"}[case],
                name=f"SYNTHETIC MOCK {case}; not a real company", currency="VND", fiscalYearEndMonth=12,
                sources=[dict(id="SYNTHETIC", title=f"MOCK independent verification: {case}", url="", accessedAt="2026-10-10", provenance="mock")],
                analysisAsOf="2026-04-01", corporateActions=dict(reviewedFrom="2024-09-30", reviewedThrough="2026-04-01", sourceId="SYNTHETIC", events=[]),
                market=dict(asOf="2026-04-01", sharesAsOf="2025-12-31", price=mf(PRICES[case], "unit"), sharesOutstanding=mf(D(100000) if case == "growth" else D(".1"), "unit" if case == "growth" else "million"), basis=BASIS), reports=reports)


def scenarios(case):
    settings = {"stable": [(".01", ".18", ".12", ".01"), (".03", ".20", ".10", ".02"), (".05", ".22", ".09", ".025")],
                "growth": [(".15", ".24", ".16", ".01"), (".20", ".26", ".14", ".02"), (".25", ".28", ".12", ".03")],
                "distressed": [(".01", ".10", ".18", "0"), (".03", ".15", ".16", ".01"), (".05", ".20", ".14", ".02")]}
    return [dict(name=name, years=5, growth=D(g), ebitMargin=D(m), taxRate=D(".2"), depreciationRate=D(".08") if case == "growth" else D(".04"),
                 capexRate=[D(".18"), D(".16"), D(".15")][i] if case == "growth" else D(".06"), workingCapitalRate=D(".45") if case == "growth" else D(".16"),
                 wacc=D(w), terminalGrowth=D(t), peMultiple=D(12+i*3), pbMultiple=D("1.2")+D(i)*D(".3"), evEbitdaMultiple=D(6+i*2))
            for i, (name, (g, m, w, t)) in enumerate(zip(["Bear", "Base", "Bull"], settings[case]))]


def ok(value): return dict(value=value)
def blocked(code): return dict(value=None, code=code)
def div(n, d): return blocked("missing_data") if n is None or d is None else blocked("not_meaningful") if d <= 0 else ok(n/d)
def avg(n, o, c): return blocked("missing_data") if None in (n, o, c) else blocked("not_meaningful") if min(o, c) <= 0 else div(n, (o+c)/2)


def ratios(case):
    table = TABLES[case]
    v, p, first = table[2025], table[2024], table[min(table)]
    eq = lambda r: r["shareholdersEquity"]+r["minorityInterest"]+r["preferredEquity"]
    cap = lambda r: eq(r)+r["shortTermDebt"]+r["longTermDebt"]-r["cash"]
    fcf, price, mc = v["cfo"]-v["capex"], PRICES[case], PRICES[case]/10
    ev = None if v["nonOperatingAssets"] is None else mc+v["shortTermDebt"]+v["longTermDebt"]+v["minorityInterest"]+v["preferredEquity"]+v["otherClaims"]-v["cash"]-v["nonOperatingAssets"]
    result = dict(grossMargin=div(v["grossProfit"], v["revenue"]), operatingMargin=div(v["ebit"], v["revenue"]), netProfitMargin=div(v["netIncome"], v["revenue"]),
                  roe=avg(v["netIncomeToCommon"], p["shareholdersEquity"], v["shareholdersEquity"]), roa=avg(v["netIncome"], p["totalAssets"], v["totalAssets"]),
                  roic=blocked("not_meaningful") if v["pretaxIncome"] <= 0 else avg(v["ebit"]*(1-v["incomeTax"]/v["pretaxIncome"]), cap(p), cap(v)),
                  currentRatio=div(v["currentAssets"], v["currentLiabilities"]), quickRatio=div(None if v["receivables"] is None else v["cash"]+v["receivables"], v["currentLiabilities"]),
                  cashRatio=div(v["cash"], v["currentLiabilities"]), debtToEquity=div(v["shortTermDebt"]+v["longTermDebt"], eq(v)), netDebt=ok((v["shortTermDebt"]+v["longTermDebt"]-v["cash"])*M),
                  interestCoverage=div(v["ebit"], v["interestExpense"]), assetTurnover=avg(v["revenue"], p["totalAssets"], v["totalAssets"]), inventoryTurnover=avg(v["costOfRevenue"], p["inventory"], v["inventory"]),
                  receivableDays=div(None if v["receivables"] is None else (p["receivables"]+v["receivables"])/2*365, v["revenue"]), cfoNetIncome=div(v["cfo"], v["netIncome"]), freeCashFlow=ok(fcf*M), fcfMargin=div(fcf, v["revenue"]),
                  cashConversion=div(v["cfo"], v["ebit"]+v["depreciation"]), revenueGrowth=div(v["revenue"]-p["revenue"], p["revenue"]), earningsGrowth=div(v["netIncomeToCommon"]-p["netIncomeToCommon"], p["netIncomeToCommon"]),
                  epsGrowth=div(v["dilutedEps"]-p["dilutedEps"], p["dilutedEps"]), revenueCagr=ok((v["revenue"]/first["revenue"])**(D(1)/(2025-min(table)))-1),
                  pe=div(price, v["dilutedEps"]), pb=div(price, v["shareholdersEquity"]*10), evEbitda=div(ev, v["ebit"]+v["depreciation"]), fcfYield=div(fcf, mc))
    assert len(result) == 27
    return result


def bridge(case):
    v = TABLES[case][2025]
    return {"cash": v["cash"]*M, "debt": (v["shortTermDebt"]+v["longTermDebt"])*M, "sharesOutstanding": D(100000),
            **{k: None if v[k] is None else v[k]*M for k in ["nonOperatingAssets", "minorityInterest", "preferredEquity", "otherClaims"]}}


def pure_inputs(case):
    table = TABLES[case]
    v, p, first = table[2025], table[2024], table[min(table)]
    eq = lambda r: r["shareholdersEquity"]+r["minorityInterest"]+r["preferredEquity"]
    cap = lambda r: (eq(r)+r["shortTermDebt"]+r["longTermDebt"]-r["cash"])*M
    price, mc = PRICES[case], PRICES[case]*100000
    b = bridge(case)
    ev = None if b["nonOperatingAssets"] is None else mc+b["debt"]+b["minorityInterest"]+b["preferredEquity"]+b["otherClaims"]-b["cash"]-b["nonOperatingAssets"]
    amounts = lambda *keys: [None if v[k] is None else v[k]*M for k in keys]
    args = dict(grossMargin=amounts("grossProfit", "revenue"), operatingMargin=amounts("ebit", "revenue"), netProfitMargin=amounts("netIncome", "revenue"),
                roe=[v["netIncomeToCommon"]*M, p["shareholdersEquity"]*M, v["shareholdersEquity"]*M], roa=[v["netIncome"]*M, p["totalAssets"]*M, v["totalAssets"]*M],
                roic=[v["ebit"]*M, None if v["pretaxIncome"] <= 0 else v["incomeTax"]/v["pretaxIncome"], cap(p), cap(v)],
                currentRatio=amounts("currentAssets", "currentLiabilities"), quickRatio=amounts("cash", "receivables", "currentLiabilities"), cashRatio=amounts("cash", "currentLiabilities"),
                debtToEquity=[v["shortTermDebt"]*M, v["longTermDebt"]*M, eq(v)*M], netDebt=amounts("shortTermDebt", "longTermDebt", "cash"), interestCoverage=amounts("ebit", "interestExpense"),
                assetTurnover=[v["revenue"]*M, p["totalAssets"]*M, v["totalAssets"]*M], inventoryTurnover=[v["costOfRevenue"]*M, p["inventory"]*M, v["inventory"]*M],
                receivableDays=[p["receivables"]*M, None if v["receivables"] is None else v["receivables"]*M, v["revenue"]*M, D(365)],
                cfoNetIncome=amounts("cfo", "netIncome"), freeCashFlow=amounts("cfo", "capex"), fcfMargin=amounts("cfo", "capex", "revenue"), cashConversion=amounts("cfo", "ebit", "depreciation"),
                revenueGrowth=[v["revenue"]*M, p["revenue"]*M], earningsGrowth=[v["netIncomeToCommon"]*M, p["netIncomeToCommon"]*M], epsGrowth=[v["dilutedEps"], p["dilutedEps"]],
                revenueCagr=[first["revenue"]*M, v["revenue"]*M, D(2025-min(table))], pe=[price, v["dilutedEps"]], pb=[price, v["shareholdersEquity"]*M, D(100000)],
                evEbitda=[ev, v["ebit"]*M, v["depreciation"]*M], fcfYield=[v["cfo"]*M, v["capex"]*M, mc])
    assert len(args) == 27
    return args


def discounted(flows, wacc, g, b):
    if g >= wacc or wacc <= 0 or g <= -1: return blocked("invalid")
    if flows[-1] <= 0: return blocked("not_meaningful")
    if None in b.values(): return blocked("missing_data")
    pv = sum(f/(1+wacc)**t for t, f in enumerate(flows, 1))
    tv = flows[-1]*(1+g)/(wacc-g)
    pvt = tv/(1+wacc)**len(flows)
    ev = pv+pvt
    equity = ev+b["cash"]+b["nonOperatingAssets"]-b["debt"]-b["minorityInterest"]-b["preferredEquity"]-b["otherClaims"]
    if equity <= 0: return blocked("not_meaningful")
    return ok(dict(pvForecast=pv, terminalValue=tv, pvTerminal=pvt, enterpriseValue=ev, equityValue=equity, intrinsicValuePerShare=equity/b["sharesOutstanding"], terminalContribution=pvt/ev))


def forecast(case, a, rows=True):
    v = TABLES[case][2025]
    rev, wc, projections = v["revenue"]*M, v["operatingWorkingCapital"]*M, []
    for t in range(1, a["years"]+1):
        rev *= 1+a["growth"]
        ebit, da, capex, new_wc = rev*a["ebitMargin"], rev*a["depreciationRate"], rev*a["capexRate"], rev*a["workingCapitalRate"]
        nopat, delta = ebit*(1-a["taxRate"]), new_wc-wc
        fcff, df = nopat+da-capex-delta, 1/(1+a["wacc"])**t
        projections.append(dict(year=2025+t, revenue=rev, ebit=ebit, nopat=nopat, depreciation=da, capex=capex, workingCapital=new_wc, changeWorkingCapital=delta, fcff=fcff, discountFactor=df, presentValue=fcff*df))
        wc = new_wc
    result = discounted([p["fcff"] for p in projections], a["wacc"], a["terminalGrowth"], bridge(case))
    return {**result, **({"projections": projections} if rows else {})}


def relative(case, method, multiple):
    v, b = TABLES[case][2025], bridge(case)
    if method == "pe":
        if v["dilutedEps"] <= 0: return blocked("not_meaningful")
        share = v["dilutedEps"]*multiple
        return ok(dict(enterpriseValue=None, equityValue=share*100000, intrinsicValuePerShare=share))
    if method == "pb":
        if v["shareholdersEquity"] <= 0: return blocked("not_meaningful")
        equity = v["shareholdersEquity"]*M*multiple
        return ok(dict(enterpriseValue=None, equityValue=equity, intrinsicValuePerShare=equity/100000))
    ebitda = (v["ebit"]+v["depreciation"])*M
    if ebitda <= 0: return blocked("not_meaningful")
    if None in b.values(): return blocked("missing_data")
    ev = ebitda*multiple
    equity = ev+b["cash"]+b["nonOperatingAssets"]-b["debt"]-b["minorityInterest"]-b["preferredEquity"]-b["otherClaims"]
    return blocked("not_meaningful") if equity <= 0 else ok(dict(enterpriseValue=ev, equityValue=equity, intrinsicValuePerShare=equity/b["sharesOutstanding"]))


def normalized(r): return {k: None if f["value"] is None else f["value"]*SCALE[f["unit"]] for k, f in r["fields"].items()}


def expected(case, data, assumptions):
    v, p = TABLES[case][2025], TABLES[case][2024]
    historical = blocked("not_meaningful") if v["pretaxIncome"] <= 0 else ok((v["ebit"]*(1-v["incomeTax"]/v["pretaxIncome"])+v["depreciation"]-v["capex"]-v["operatingWorkingCapital"]+p["operatingWorkingCapital"])*M)
    base = assumptions[1]
    out = dict(label="SYNTHETIC MOCK; independent Python Decimal", reportId="FY2025", ratios=ratios(case), pureInputs=pure_inputs(case), historicalFcff=historical,
               scenarios={a["name"]: forecast(case, a) for a in assumptions},
               relative={a["name"]: {m: relative(case, m, a[k]) for m, k in [("pe", "peMultiple"), ("pb", "pbMultiple"), ("evEbitda", "evEbitdaMultiple")]} for a in assumptions},
               sensitivity=[dict(wacc=base["wacc"]+dw, growth=base["terminalGrowth"]+dg, result=forecast(case, {**base, "wacc": base["wacc"]+dw, "terminalGrowth": base["terminalGrowth"]+dg}, False)) for dw in map(D, ["-.02", "-.01", "0", ".01", ".02"]) for dg in map(D, ["-.01", "-.005", "0", ".005", ".01"])])
    if case == "stable":
        by_id = {r["id"]: r for r in data["reports"]}
        ids = ["FY2024_Q4", "FY2025_Q1", "FY2025_Q2", "FY2025_Q3"]
        values = [normalized(by_id[i]) for i in ids]
        out["ttm"] = dict(quarterIds=ids, openingId="FY2024_Q3", startDate="2024-10-01", endDate="2025-09-30", days=365,
                          values={k: None if k == "dilutedEps" else values[-1][k] if k in BAL else sum(r[k] for r in values) for k in FIELDS})
        cur, prev = normalized(by_id["FY2025_YTD2"]), normalized(by_id["FY2025_YTD1"])
        out["ytdDifference"] = dict(currentId="FY2025_YTD2", priorId="FY2025_YTD1", startDate="2025-04-01", endDate="2025-06-30",
                                    values={k: None if k == "dilutedEps" else cur[k] if k in BAL else cur[k]-prev[k] for k in FIELDS})
    return out


def serial(value, golden):
    if isinstance(value, Decimal): return str(value) if golden else int(value) if value == value.to_integral_value() else float(value)
    if isinstance(value, dict): return {k: serial(v, golden) for k, v in value.items()}
    if isinstance(value, list): return [serial(v, golden) for v in value]
    return value


def save(name, body):
    if "--check" in sys.argv:
        assert (ROOT/name).read_text(encoding="utf-8") == body, f"Fixture drift: {name}"
    else: (ROOT/name).write_text(body, encoding="utf-8")


def main():
    sheet = io.StringIO(newline="")
    writer = csv.writer(sheet, lineterminator="\n")
    writer.writerow(["case", "ratio", "value_normalized", "blocked_code"])
    for case in TABLES:
        data, assumptions = dataset(case), scenarios(case)
        answer = expected(case, data, assumptions)
        for suffix, content, golden in [("input", data, False), ("scenarios", assumptions, False), ("expected", answer, True)]:
            save(f"{case}.{suffix}.json", json.dumps(serial(content, golden), ensure_ascii=False, indent=2)+"\n")
        for name, r in answer["ratios"].items(): writer.writerow([case, name, r["value"], r.get("code", "")])
    save("ratios.expected.csv", sheet.getvalue())
    simple = dict(cash=D(20), debt=D(30), nonOperatingAssets=D(0), minorityInterest=D(5), preferredEquity=D(0), otherClaims=D(0), sharesOutstanding=D(10))
    core = dict(fcff=D(65), wacc=D(".102"), discountFactorYear2=1/D("1.1")**2, terminalValue=D(1100),
                constantDcf=discounted([D(100), D(100)], D(".1"), D(0), simple), rampDcf=discounted([D(100), D(110)], D(".1"), D(0), simple),
                negativeIntermediate=discounted([D(-50), D(110)], D(".1"), D(0), simple),
                complexClaims=dict(enterpriseValue=D(1000), equityValue=D(610), intrinsicValuePerShare=D(61)))
    save("core.expected.json", json.dumps(serial(core, True), indent=2)+"\n")
    print("Checked" if "--check" in sys.argv else "Wrote", "3 MOCK cases, 81 ratios, 9 scenarios, 75 sensitivity cells, core and YTD/TTM goldens.")


if __name__ == "__main__": main()
