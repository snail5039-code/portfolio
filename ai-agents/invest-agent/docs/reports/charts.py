"""README·성과 모음에 넣는 그래프(SVG)를 만든다. 표준 라이브러리만 쓴다.

    python docs/reports/charts.py

숫자는 날짜별 리포트(live-*.md)와 앱 캡처에서 옮겨 왔다. 새 날이 생기면 아래 표에 한 줄 더 넣고 다시 돌린다.
"""

from pathlib import Path

OUT = Path(__file__).resolve().parent / "img"
ACCOUNT, KOSPI = "#2a78d6", "#eb6834"  # 범주 1·2번 (dataviz 기본 팔레트, 색약 검사 통과)
INK, INK2, GRID, SURFACE, SHADE = "#0b0b0b", "#52514e", "#e6e5e0", "#fcfcfb", "#f1efe8"
FONT = "font-family=\"'Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif\""

# 10/7 종가 대비 누적 % (리포트 1장). 10/8 계좌는 평가손익 −71,750원만 반영한 추정 (수수료 미포함)
# 코스피가 None이면 그날 종가 미확인 (선을 그날 앞에서 끊는다). 10/19 계좌는 KIS 모의 종가 × 보유 수량 + 현금
DAYS = [("10/7", 0.0, 0.0), ("10/8", -0.72, -2.62), ("10/12", -3.50, -6.17), ("10/13", -5.22, -11.30),
        ("10/14", -5.24, -11.69), ("10/15", -5.39, -18.37), ("10/16", -5.71, -16.69), ("10/19", -5.75, -15.23),
        ("10/20", -8.85, -18.39), ("10/21", -8.98, -15.70)]
# 10/16 앱 자산 화면 캡처 (시각, 총자산). 14:32부터 AI 분석 한도가 차서 판단이 멈췄다
AFTERNOON = [("14:10", 9_616_136), ("14:22", 9_605_036), ("14:33", 9_577_736), ("15:05", 9_521_736), ("15:31", 9_428_986)]
PREV_CLOSE = 9_461_096
# 10/19 앱 자산 화면 캡처. 15:19는 16:03 캡처의 잔고 기준 시각, 15:30은 KIS 모의 종가로 계산한 마감 총자산
DAY_1019 = [("10:22", 9_326_007), ("10:39", 9_275_733), ("10:57", 9_235_633), ("11:56", 9_301_883), ("12:56", 9_366_833),
            ("13:56", 9_368_073), ("14:56", 9_378_413), ("15:19", 9_416_713), ("15:30", 9_424_763)]
PREV_CLOSE_1019 = 9_428_986
# 10/20 폰이 올린 장중 총자산 (서버 account_snapshots.total_krw). 15:34는 마감 뒤 폰 계산 = KIS 모의 종가 × 수량 + 현금
DAY_1020 = [("09:05", 9_352_313), ("09:16", 9_262_763), ("09:41", 9_198_501), ("10:14", 9_093_471), ("11:03", 9_172_971),
            ("12:04", 9_184_071), ("13:03", 9_127_771), ("14:09", 9_092_921), ("15:04", 9_109_421), ("15:34", 9_115_405)]
PREV_CLOSE_1020 = 9_424_763
# 10/21 폰이 올린 장중 총자산. 15:35는 마감 뒤 폰 계산 = KIS 모의 종가 × 수량 + 현금
DAY_1021 = [("09:02", 9_164_605), ("09:27", 9_208_955), ("10:08", 9_089_477), ("11:01", 9_161_964), ("12:02", 9_152_264),
            ("13:04", 9_118_094), ("14:04", 9_129_175), ("15:02", 9_084_625), ("15:35", 9_102_175)]
PREV_CLOSE_1021 = 9_115_405


def text(x, y, s, size=12, color=INK2, anchor="start", weight="normal"):
    return f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" fill="{color}" text-anchor="{anchor}" font-weight="{weight}" {FONT}>{s}</text>'


def frame(w, h, body, title):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="100%" style="max-width:{w}px" role="img">'
            f'<title>{title}</title><rect width="{w}" height="{h}" rx="8" fill="{SURFACE}"/>{body}</svg>')


def polyline(points, color, dash=""):
    path = " ".join(f"{x:.1f},{y:.1f}" for x, y in points)
    dots = "".join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="4" fill="{color}" stroke="{SURFACE}" stroke-width="2"/>' for x, y in points)
    return f'<polyline points="{path}" fill="none" stroke="{color}" stroke-width="2" stroke-linejoin="round"{dash}/>' + dots


def cumulative() -> str:
    w, h, left, right, top, bottom = 720, 330, 56, 120, 64, 40
    lo, hi = -20.0, 0.0
    sx = lambda i: left + i * (w - left - right) / (len(DAYS) - 1)
    sy = lambda v: top + (hi - v) * (h - top - bottom) / (hi - lo)
    body = [text(20, 28, "누적 수익률 (10/7 종가 대비)", 15, INK, weight="bold"),
            f'<rect x="20" y="40" width="14" height="3" fill="{ACCOUNT}"/>', text(40, 46, "모의 계좌"),
            f'<line x1="110" y1="41.5" x2="124" y2="41.5" stroke="{KOSPI}" stroke-width="2" stroke-dasharray="5 3"/>',
            text(130, 46, "코스피")]
    for v in range(0, -21, -5):
        body.append(f'<line x1="{left}" y1="{sy(v):.1f}" x2="{w - right}" y2="{sy(v):.1f}" stroke="{GRID}"/>')
        body.append(text(left - 8, sy(v) + 4, f"{v}%" if v else "0%", 11, anchor="end"))
    for i, (day, _, _) in enumerate(DAYS):
        body.append(text(sx(i), h - 16, day, 11, anchor="middle"))
    known = [(i, k) for i, (_, _, k) in enumerate(DAYS) if k is not None]
    body.append(polyline([(sx(i), sy(k)) for i, k in known], KOSPI, ' stroke-dasharray="5 3"'))
    body.append(polyline([(sx(i), sy(a)) for i, (_, a, _) in enumerate(DAYS)], ACCOUNT))
    last, (ki, kv) = len(DAYS) - 1, known[-1]
    body.append(text(sx(last) + 10, sy(DAYS[-1][1]) + 4, f"계좌 {DAYS[-1][1]:+.2f}%".replace("-", "−"), 12, INK, weight="bold"))
    body.append(text(sx(ki) + 10, sy(kv) + 4, f"코스피 {kv:+.2f}% ({DAYS[ki][0]})".replace("-", "−"), 12, INK))
    if ki < last:
        body.append(text(sx(last), sy(kv) + 24, f"{DAYS[last][0]} 코스피 종가 미확인", 10, anchor="middle"))
    body.append(text(sx(1), sy(DAYS[1][1]) - 10, "추정", 10, anchor="middle"))
    return frame(w, h, "".join(body), f"누적 수익률: 모의 계좌 {DAYS[-1][1]:+.2f}% ({DAYS[-1][0]}), 코스피 {kv:+.2f}% ({DAYS[ki][0]})"
                 .replace("-", "−"))


def day_curve(points, prev_close, title, desc, t0, t1, lo, hi, shade=None, mark=0) -> str:
    """장중 총자산 선. shade: (시작 "HH:MM", 설명) 회색 구간. mark: 금액을 따로 적을 점 번호 (처음·마지막은 늘 적는다)"""
    w, h, left, right, top, bottom = 720, 300, 72, 120, 56, 40
    minute = lambda t: int(t[:2]) * 60 + int(t[3:])
    minutes = [minute(t) for t, _ in points]
    sx = lambda m: left + (m - t0) * (w - left - right) / (t1 - t0)
    sy = lambda v: top + (hi - v) * (h - top - bottom) / (hi - lo)
    body = [text(20, 28, title, 15, INK, weight="bold")]
    if shade:
        start = minute(shade[0])
        body += [f'<rect x="{sx(start):.1f}" y="{top}" width="{sx(t1) - sx(start):.1f}" height="{h - top - bottom}" fill="{SHADE}"/>',
                 text(sx(start) + 8, top + 16, shade[1], 11, INK)]
    for v in range(lo, hi + 1, 50_000):
        body.append(f'<line x1="{left}" y1="{sy(v):.1f}" x2="{w - right}" y2="{sy(v):.1f}" stroke="{GRID}"/>')
        body.append(text(left - 8, sy(v) + 4, f"{v / 10_000:,.0f}만", 11, anchor="end"))
    for m in range(t0, t1, 30 if t1 - t0 <= 120 else 60):
        body.append(text(sx(m), h - 16, f"{m // 60}:{m % 60:02d}", 11, anchor="middle"))
    body.append(f'<line x1="{left}" y1="{sy(prev_close):.1f}" x2="{w - right}" y2="{sy(prev_close):.1f}" stroke="{INK2}" stroke-dasharray="3 3"/>')
    body.append(text(w - right + 8, sy(prev_close) + 4, "전날 마감", 11))
    body.append(polyline([(sx(m), sy(v)) for m, (_, v) in zip(minutes, points)], ACCOUNT))
    for i in sorted({0, mark}):
        dy = 20 if points[i][1] < prev_close and i else -12
        body.append(text(sx(minutes[i]), sy(points[i][1]) + dy, f"{points[i][1]:,}원", 12, INK, anchor="middle", weight="bold"))
    near = abs(sy(points[-1][1]) - sy(prev_close)) < 14  # "전날 마감" 글자와 겹치면 아래로
    body.append(text(sx(minutes[-1]) + 10, sy(points[-1][1]) + (18 if near else 4), f"{points[-1][1]:,}원", 12, INK, weight="bold"))
    return frame(w, h, "".join(body), desc)


def afternoon() -> str:
    return day_curve(AFTERNOON, PREV_CLOSE, "10/16 오후 총자산 (앱 자산 화면 캡처)",
                     "10/16 오후 총자산: 14:10 9,616,136원에서 15:31 9,428,986원으로", 14 * 60, 15 * 60 + 35, 9_400_000, 9_650_000,
                     shade=("14:32", "14:32~ AI 분석 한도 소진 · 보유 종목 판단 0건"))


def day_1019() -> str:
    low = min(range(len(DAY_1019)), key=lambda i: DAY_1019[i][1])
    return day_curve(DAY_1019, PREV_CLOSE_1019, "10/19 총자산 (앱 자산 화면 캡처)",
                     "10/19 총자산: 10:57 9,235,633원 바닥에서 종가 9,424,763원으로", 9 * 60, 15 * 60 + 35, 9_200_000, 9_450_000,
                     mark=low)


def day_1020() -> str:
    low = min(range(len(DAY_1020)), key=lambda i: DAY_1020[i][1])
    return day_curve(DAY_1020, PREV_CLOSE_1020, "10/20 총자산 (폰이 올린 장중 값)",
                     "10/20 총자산: 전날 9,424,763원에서 종가 9,115,405원으로 (코스피 −3.73%)", 9 * 60, 15 * 60 + 35,
                     9_050_000, 9_450_000, mark=low)


def day_1021() -> str:
    low = min(range(len(DAY_1021)), key=lambda i: DAY_1021[i][1])
    return day_curve(DAY_1021, PREV_CLOSE_1021, "10/21 총자산 (폰이 올린 장중 값)",
                     "10/21 총자산: 전날 9,115,405원에서 종가 9,102,175원으로 (코스피 +3.29%)", 9 * 60, 15 * 60 + 35,
                     9_050_000, 9_250_000, mark=low)


if __name__ == "__main__":
    (OUT / "cumulative.svg").write_text(cumulative(), encoding="utf-8")
    (OUT / "live-20261016" / "afternoon.svg").write_text(afternoon(), encoding="utf-8")
    (OUT / "live-20261019" / "intraday.svg").write_text(day_1019(), encoding="utf-8")
    (OUT / "live-20261020" / "intraday.svg").write_text(day_1020(), encoding="utf-8")
    (OUT / "live-20261021" / "intraday.svg").write_text(day_1021(), encoding="utf-8")
    print("그래프 5개를 만들었다:", OUT)
