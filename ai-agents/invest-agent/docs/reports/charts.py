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
DAYS = [("10/7", 0.0, 0.0), ("10/8", -0.72, -2.62), ("10/12", -3.50, -6.17), ("10/13", -5.22, -11.30),
        ("10/14", -5.24, -11.69), ("10/15", -5.39, -18.37), ("10/16", -5.71, -16.69)]
# 10/16 앱 자산 화면 캡처 (시각, 총자산). 14:32부터 AI 분석 한도가 차서 판단이 멈췄다
AFTERNOON = [("14:10", 9_616_136), ("14:22", 9_605_036), ("14:33", 9_577_736), ("15:05", 9_521_736), ("15:31", 9_428_986)]
PREV_CLOSE = 9_461_096


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
    body.append(polyline([(sx(i), sy(k)) for i, (_, _, k) in enumerate(DAYS)], KOSPI, ' stroke-dasharray="5 3"'))
    body.append(polyline([(sx(i), sy(a)) for i, (_, a, _) in enumerate(DAYS)], ACCOUNT))
    last = len(DAYS) - 1
    body.append(text(sx(last) + 10, sy(DAYS[-1][1]) + 4, f"계좌 {DAYS[-1][1]:+.2f}%".replace("-", "−"), 12, INK, weight="bold"))
    body.append(text(sx(last) + 10, sy(DAYS[-1][2]) + 4, f"코스피 {DAYS[-1][2]:+.2f}%".replace("-", "−"), 12, INK))
    body.append(text(sx(1), sy(DAYS[1][1]) - 10, "추정", 10, anchor="middle"))
    return frame(w, h, "".join(body), "누적 수익률: 모의 계좌 −5.71%, 코스피 −16.69% (10/7~10/16)")


def afternoon() -> str:
    w, h, left, right, top, bottom = 720, 300, 72, 120, 56, 40
    minutes = [int(t[:2]) * 60 + int(t[3:]) for t, _ in AFTERNOON]
    t0, t1, lo, hi = 14 * 60, 15 * 60 + 35, 9_400_000, 9_650_000
    sx = lambda m: left + (m - t0) * (w - left - right) / (t1 - t0)
    sy = lambda v: top + (hi - v) * (h - top - bottom) / (hi - lo)
    stop = 14 * 60 + 32
    body = [text(20, 28, "10/16 오후 총자산 (앱 자산 화면 캡처)", 15, INK, weight="bold"),
            f'<rect x="{sx(stop):.1f}" y="{top}" width="{sx(t1) - sx(stop):.1f}" height="{h - top - bottom}" fill="{SHADE}"/>',
            text(sx(stop) + 8, top + 16, "14:32~ AI 분석 한도 소진 · 보유 종목 판단 0건", 11, INK)]
    for v in range(lo, hi + 1, 50_000):
        body.append(f'<line x1="{left}" y1="{sy(v):.1f}" x2="{w - right}" y2="{sy(v):.1f}" stroke="{GRID}"/>')
        body.append(text(left - 8, sy(v) + 4, f"{v / 10_000:,.0f}만", 11, anchor="end"))
    for m in range(t0, t1, 30):
        body.append(text(sx(m), h - 16, f"{m // 60}:{m % 60:02d}", 11, anchor="middle"))
    body.append(f'<line x1="{left}" y1="{sy(PREV_CLOSE):.1f}" x2="{w - right}" y2="{sy(PREV_CLOSE):.1f}" stroke="{INK2}" stroke-dasharray="3 3"/>')
    body.append(text(w - right + 8, sy(PREV_CLOSE) + 4, "전날 마감", 11))
    body.append(polyline([(sx(m), sy(v)) for m, (_, v) in zip(minutes, AFTERNOON)], ACCOUNT))
    body.append(text(sx(minutes[0]), sy(AFTERNOON[0][1]) - 12, f"{AFTERNOON[0][1]:,}원", 12, INK, anchor="middle", weight="bold"))
    body.append(text(sx(minutes[-1]) + 10, sy(AFTERNOON[-1][1]) + 4, f"{AFTERNOON[-1][1]:,}원", 12, INK, weight="bold"))
    return frame(w, h, "".join(body), "10/16 오후 총자산: 14:10 9,616,136원에서 15:31 9,428,986원으로")


if __name__ == "__main__":
    (OUT / "cumulative.svg").write_text(cumulative(), encoding="utf-8")
    (OUT / "live-20261016" / "afternoon.svg").write_text(afternoon(), encoding="utf-8")
    print("그래프 2개를 만들었다:", OUT)
