# 화면 와이어프레임 HTML을 만들고 Chrome headless로 PNG 캡처한다.
# 사용법: python docs/plan/wireframes/make_wireframes.py docs/plan/wireframes
import os, subprocess, sys, tempfile

OUT = sys.argv[1]  # docs/plan/wireframes 절대 경로
HERE = tempfile.gettempdir()  # 중간 HTML은 임시 폴더에
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

CSS = """
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Malgun Gothic',sans-serif;background:#fff;color:#1d1d1f;font-size:14px}
.phone{width:390px;min-height:844px;border:0;display:flex;flex-direction:column;background:#fafafa}
.top{height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;background:#fff;border-bottom:1px solid #e5e5e5}
.top h1{font-size:17px}
.mode{font-size:11px;background:#e8f1ff;color:#2f6fd6;border:1px solid #2f6fd6;border-radius:10px;padding:2px 8px;font-weight:bold}
.body{flex:1;padding:16px;display:flex;flex-direction:column;gap:12px}
.card{background:#fff;border:1px solid #e1e1e1;border-radius:12px;padding:14px}
.card h3{font-size:13px;color:#666;margin-bottom:8px}
.big{font-size:24px;font-weight:bold}
.row{display:flex;justify-content:space-between;align-items:center;padding:6px 0}
.row+.row{border-top:1px solid #f0f0f0}
.muted{color:#888;font-size:12px}
.up{color:#d6336c}.down{color:#2f6fd6}
.input{border:1px solid #ccc;border-radius:8px;padding:12px;background:#fff;color:#999}
.label{font-size:12px;color:#555;margin-bottom:4px}
.btn{border-radius:10px;padding:13px;text-align:center;font-weight:bold;background:#2f6fd6;color:#fff}
.btn.gray{background:#eee;color:#333}.btn.red{background:#fff;color:#d33;border:1px solid #d33}
.btns{display:flex;gap:8px}.btns .btn{flex:1}
.tabs{height:60px;display:flex;background:#fff;border-top:1px solid #e5e5e5}
.tabs div{flex:1;display:flex;align-items:center;justify-content:center;font-size:12px;color:#888}
.tabs .on{color:#2f6fd6;font-weight:bold}
.badge{display:inline-block;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:bold}
.b-ok{background:#e9f8ee;color:#2f9e5a}.b-cond{background:#fff4d6;color:#b7791f}.b-rej{background:#ffe6e6;color:#d33}.b-user{background:#eee;color:#555}
.chip{display:inline-block;border:1px solid #ccc;border-radius:16px;padding:6px 10px;font-size:12px;margin:2px;background:#fff}
.msg{max-width:80%;padding:10px 12px;border-radius:14px;font-size:13px;line-height:1.5}
.me{align-self:flex-end;background:#2f6fd6;color:#fff}
.ai{align-self:flex-start;background:#fff;border:1px solid #e1e1e1}
.steps{font-size:12px;color:#555;background:#f3f6fb;border-radius:8px;padding:8px}
.steps b{color:#2f6fd6}
.seg{display:flex;background:#eee;border-radius:8px;padding:3px}.seg div{flex:1;text-align:center;padding:7px;font-size:12px;border-radius:6px}.seg .on{background:#fff;font-weight:bold}
.tl{border-left:2px solid #cfd8e6;margin-left:6px;padding-left:14px}
.tl div{position:relative;padding:6px 0;font-size:13px}
.tl div:before{content:'';position:absolute;left:-21px;top:11px;width:10px;height:10px;border-radius:50%;background:#2f6fd6}
.note{font-size:12px;background:#fff8e1;border:1px solid #f0d78c;border-radius:8px;padding:8px;color:#7a5b00}
.web{width:1280px;height:800px;display:flex;background:#fafafa}
.side{width:200px;background:#fff;border-right:1px solid #e5e5e5;padding:16px;display:flex;flex-direction:column;gap:6px}
.side div{padding:10px;border-radius:8px;color:#555}.side .on{background:#e8f1ff;color:#2f6fd6;font-weight:bold}
"""

TABS = lambda on: '<div class="tabs">' + "".join(
    f'<div class="{"on" if t == on else ""}">{t}</div>' for t in ["홈", "대화", "승인", "기록", "설정"]) + "</div>"
TOP = lambda title, mode=True: f'<div class="top"><h1>{title}</h1>{"<span class=mode>모의투자</span>" if mode else ""}</div>'

def phone(title, body, tab=None, mode=True):
    return f'<div class="phone">{TOP(title, mode)}<div class="body">{body}</div>{TABS(tab) if tab else ""}</div>'

S = {}

S["s01-login"] = phone("로그인", """
<div style="height:60px"></div>
<div style="text-align:center;font-size:22px;font-weight:bold">자연어 투자 에이전트</div>
<div class="muted" style="text-align:center">말로 묻고, 두 AI가 검증하고, 내가 승인한다</div>
<div style="height:20px"></div>
<div><div class="label">이메일</div><div class="input">name@example.com</div></div>
<div><div class="label">비밀번호</div><div class="input">••••••••</div></div>
<div class="btn">로그인</div>
<div class="muted" style="text-align:center">계정이 없나요? <b style="color:#2f6fd6">회원가입</b></div>
""", mode=False)

S["s02-signup"] = phone("회원가입", """
<div><div class="label">이메일</div><div class="input">name@example.com</div></div>
<div><div class="label">비밀번호</div><div class="input">8자 이상</div></div>
<div><div class="label">비밀번호 확인</div><div class="input">다시 입력</div></div>
<div class="card" style="font-size:12px;line-height:1.6">☑ 이 앱은 투자 판단을 돕는 도구입니다. <b>투자 판단과 결과의 책임은 사용자에게 있습니다.</b><br>☑ 증권사 키는 내 폰에만 저장되고 서버로 보내지 않습니다.</div>
<div style="flex:1"></div>
<div class="btn">가입하고 성향 설문 시작</div>
""", mode=False)

S["s03-survey"] = phone("투자성향 설문", """
<div class="muted">질문 3 / 7</div>
<div style="height:6px;background:#eee;border-radius:3px"><div style="width:43%;height:6px;background:#2f6fd6;border-radius:3px"></div></div>
<div style="font-size:17px;font-weight:bold;margin-top:8px">투자한 돈이 1년 동안 20% 줄어들면 어떻게 하시겠어요?</div>
<div class="card">① 바로 전부 판다</div>
<div class="card">② 일부를 팔고 지켜본다</div>
<div class="card" style="border:2px solid #2f6fd6">③ 그대로 둔다</div>
<div class="card">④ 오히려 더 산다</div>
<div style="flex:1"></div>
<div class="btns"><div class="btn gray">이전</div><div class="btn">다음</div></div>
<div class="card" style="background:#f3f6fb"><h3>결과 예시</h3><b>위험중립형 (3단계)</b><div class="muted">기본 한도: 1회 100만 원 · 1일 200만 원 · 한 종목 최대 40%</div></div>
""", mode=False)

S["s04-broker"] = phone("증권사 연결", """
<div class="seg"><div class="on">KB증권</div><div>KIS 모의 (개발용)</div></div>
<div><div class="label">앱키 (appKey)</div><div class="input">PSxxxxxxxx</div></div>
<div><div class="label">시크리트 (appSecret)</div><div class="input">••••••••••••</div></div>
<div><div class="label">계좌번호</div><div class="input">00000000-01</div></div>
<div class="note">🔒 키와 계좌번호는 이 폰의 보안 저장소에만 저장돼요. 서버로 보내지 않아요.</div>
<div class="btn gray">연결 테스트</div>
<div class="card"><span class="badge b-ok">연결됨</span> 예수금 1,500,000원 <span class="muted">· KB증권 10:32</span></div>
<div style="flex:1"></div>
<div class="btn">저장</div>
<div class="muted" style="text-align:center">나중에 하기</div>
""")

S["s05-home"] = phone("홈", """
<div class="card"><h3>총 평가금액</h3><div class="big">4,514,500원</div>
<div class="row"><span>현금</span><span>1,500,000원</span></div>
<div class="row"><span>오늘 손익</span><span class="up">+32,400원 (+0.8%)</span></div>
<div class="muted">KB증권 · 10:32 기준</div></div>
<div class="card" style="background:#fff4d6;border-color:#f0d78c">⏳ <b>승인 대기 2건</b> <span class="muted">· 가장 빠른 만료 8분 후</span></div>
<div class="card"><h3>보유 종목</h3>
<div class="row"><span>삼성전자 <span class="muted">20주</span></span><span>72,100원 <span class="up">+6.0%</span></span></div>
<div class="row"><span>NAVER <span class="muted">5주</span></span><span>188,500원 <span class="down">-3.4%</span></span></div>
<div class="row"><span>SK하이닉스 <span class="muted">3주</span></span><span>210,000원 <span class="up">+1.2%</span></span></div></div>
<div class="input">💬 무엇이든 물어보세요</div>
""", tab="홈")

S["s06-chat"] = phone("대화", """
<div class="msg me">SK하이닉스 4주 사줘</div>
<div class="steps">✅ KB증권에서 잔고 확인 → ✅ 투자 AI 분석 → ✅ <b>검증 AI 확인</b> → ✅ 정책 검사</div>
<div class="msg ai">처리안이 나왔어요. 검증 AI가 <b>조건부 승인</b>했어요. 주문 후 SK하이닉스 비중이 33%가 돼요 (내 한도 40%). 최근 변동성이 높다는 경고가 있어요.</div>
<div class="card" style="border:2px solid #2f6fd6">
<div class="row"><b>SK하이닉스 매수 4주</b><span class="badge b-cond">조건부 승인</span></div>
<div class="row"><span>지정가</span><span>210,000원</span></div>
<div class="row"><span>예상 금액</span><b>840,000원</b></div>
<div class="muted">수수료 추정 약 130원 별도 · 8분 후 만료</div>
<div class="btns" style="margin-top:8px"><div class="btn gray">자세히</div><div class="btn red">거절</div><div class="btn">승인</div></div></div>
<div style="flex:1"></div>
<div><span class="chip">잔고 보여줘</span><span class="chip">삼성전자 사도 돼?</span><span class="chip">아까 주문 됐어?</span></div>
<div class="input">메시지 입력…</div>
""", tab="대화")

S["s07-proposal"] = f'''<div class="phone" style="min-height:1460px">{TOP("처리안 상세")}<div class="body">
<div class="card"><h3>① 주문 요약</h3>
<div class="row"><b style="font-size:17px">SK하이닉스 매수</b><span>4주</span></div>
<div class="row"><span>지정가</span><span>210,000원</span></div>
<div class="row"><span>예상 금액</span><b>840,000원</b></div>
<div class="row"><span>수수료 추정</span><span>약 130원 (요율 미확인)</span></div>
<div class="row"><span>주문 후 비중</span><span>33%</span></div></div>
<div class="card"><h3>② 검증 판정</h3><span class="badge b-cond" style="font-size:14px">조건부 승인</span>
<div style="margin-top:6px;font-size:13px">최근 변동성이 높아요. 2주로 줄이면 승인이에요.</div></div>
<div class="card"><h3>③ 투자 AI 제안</h3>
<div style="font-size:13px;line-height:1.7">• <b>[계산]</b> 2분기 영업이익 전년 대비 증가 <span class="muted">OpenDART · 2026.08.14</span><br>
• <b>[추론]</b> HBM 수요 지속 가능성<br>
<span class="down">반대 근거</span>: 메모리 가격 하락 시 이익 감소 가능<br>
<span class="muted">무효 조건: 다음 분기 영업이익 감소 전환</span></div></div>
<div class="card"><h3>④ 검증 AI 의견</h3>
<div style="font-size:13px;line-height:1.7">✅ 공시 원문에서 영업이익 수치 일치<br>✅ 지표 재계산 결과 같음<br>⚠️ 최근 20일 변동성 높음<br><b>두 AI 의견 차이</b>: 투자 AI는 4주, 검증 AI는 2주 권고</div></div>
<div class="card"><h3>⑤ 최악의 경우</h3><span class="down">10% 하락 시 -84,000원</span></div>
<div class="card"><h3>⑥ 정책 검사</h3>
<div class="row"><span>1회 한도 840,000 / 1,000,000원</span><span class="b-ok badge">통과</span></div>
<div class="row"><span>한 종목 비중 33% / 40%</span><span class="b-ok badge">통과</span></div>
<div class="row"><span>현금 840,000 / 1,500,000원</span><span class="b-ok badge">통과</span></div>
<div class="row"><span>장 운영 시간</span><span class="b-ok badge">통과</span></div></div>
<div class="note">⑦ 평소 성향(위험중립형)보다 공격적인 주문이에요</div>
<div class="muted" style="text-align:center">⑧ 8분 후 만료</div>
<div class="btns"><div class="btn red">거절</div><div class="btn gray">수정</div></div>
<div class="btn">⑨ 승인하고 실행 (생체인증)</div>
<div class="muted" style="text-align:center">웹에서는 [승인] → "폰 앱에서 실행해 주세요"</div>
</div></div>'''

S["s08-approvals"] = phone("승인", """
<div class="seg"><div class="on">승인 필요 2</div><div>실행 필요 1</div><div>만료·거절</div></div>
<div class="card"><div class="row"><b>SK하이닉스 매수 4주</b><span class="badge b-cond">조건부 승인</span></div><div class="muted">840,000원 · 8분 후 만료</div></div>
<div class="card"><div class="row"><b>NAVER 매도 5주</b><span class="badge b-user">사용자 판단</span></div><div class="muted">942,500원 · 9분 후 만료 · 두 AI 의견이 달라요</div></div>
<div class="card" style="opacity:.6"><div class="row"><b>삼성전자 매수 2주</b><span class="badge b-ok">승인</span></div><div class="muted">실행 필요 탭 · 웹에서 승인됨 → 폰에서 실행</div></div>
""", tab="승인")

S["s09-result"] = phone("주문 결과", """
<div style="height:40px"></div>
<div style="text-align:center;font-size:48px">✅</div>
<div style="text-align:center;font-size:20px;font-weight:bold">주문이 접수됐어요</div>
<div class="card">
<div class="row"><span>주문번호</span><span>0001234567</span></div>
<div class="row"><span>종목</span><span>SK하이닉스 매수</span></div>
<div class="row"><span>수량 · 가격</span><span>4주 · 210,000원</span></div>
<div class="row"><span>시각</span><span>10:35:12</span></div>
<div class="row"><span>계좌</span><span>모의투자</span></div></div>
<div class="note">실패했다면: 이유 + "다시 주문하기 전에 주문 내역을 확인했어요"</div>
<div style="flex:1"></div>
<div class="btns"><div class="btn gray">기록 보기</div><div class="btn">대화로</div></div>
""")

S["s10-history"] = phone("기록", """
<div><span class="chip" style="border-color:#2f6fd6;color:#2f6fd6">전체</span><span class="chip">체결</span><span class="chip">거절</span><span class="chip">반려</span><span class="chip">만료</span></div>
<div class="card"><div class="row"><b>SK하이닉스 매수 4주</b><span class="badge b-ok">체결</span></div><div class="muted">10/6 10:35 · 검증: 조건부 승인</div></div>
<div class="card"><div class="row"><b>NAVER 매도 5주</b><span class="badge b-user">거절</span></div><div class="muted">10/6 10:20 · 검증: 사용자 판단</div></div>
<div class="card"><div class="row"><b>카카오 매수 20주</b><span class="badge b-rej">반려</span></div><div class="muted">10/5 14:02 · 정책: 1일 한도 초과</div></div>
<div class="card"><div class="row"><b>삼성전자 매수 5주</b><span class="badge b-user">만료</span></div><div class="muted">10/5 09:41 · 10분 동안 답 없음</div></div>
""", tab="기록")

S["s11-history-detail"] = phone("기록 상세", """
<div class="card"><b>SK하이닉스 매수 4주</b> <span class="badge b-ok">체결</span></div>
<div class="card tl">
<div><b>요청</b> 10:32 · "SK하이닉스 4주 사줘"</div>
<div><b>투자 AI 제안</b> 10:33 · 매수 4주 ▸ 근거 보기</div>
<div><b>검증 AI 반박</b> · "최근 변동성이 높음, 수량 축소 권고"</div>
<div><b>수정안</b> · 근거 보강</div>
<div><b>검증 판정</b> · 조건부 승인</div>
<div><b>정책 검사</b> · 통과</div>
<div><b>승인</b> 10:35 · 앱</div>
<div><b>주문</b> 10:35 · 주문번호 0001234567</div>
<div><b>체결</b> 10:35 · 4주 210,000원</div>
</div>
""", tab="기록")

S["s12-settings"] = phone("설정", """
<div class="card"><h3>투자 정책</h3>
<div class="row"><span>1회 주문 한도</span><span>1,000,000원 ›</span></div>
<div class="row"><span>1일 주문 한도</span><span>2,000,000원 ›</span></div>
<div class="row"><span>한 종목 최대 비중</span><span>40% ›</span></div></div>
<div class="card"><h3>투자성향</h3><div class="row"><span>위험중립형 (3단계)</span><span>다시 검사 ›</span></div></div>
<div class="card"><h3>증권사 연결 (앱만)</h3><div class="row"><span>KB증권 <span class="badge b-ok">연결됨</span></span><span>수정 · 삭제 ›</span></div></div>
<div class="card"><h3>모드</h3><div class="row"><span>모의투자</span><span class="muted">실전 전환은 4단계</span></div></div>
<div class="card"><h3>계정</h3><div class="row"><span>로그아웃</span></div><div class="row"><span style="color:#d33">탈퇴 (서버 데이터 삭제)</span></div></div>
""", tab="설정")

S["s20-news"] = phone("뉴스·공시", """
<div class="seg"><div class="on">내 종목</div><div>시장</div><div>공시</div></div>
<div class="card"><b>삼성전자</b>
<div style="margin-top:6px;font-size:13px"><b>3분기 반도체 영업이익 전망 상향</b></div>
<div class="muted">OO경제 · 10/6 07:12</div>
<div style="font-size:12px;margin-top:4px">AI 요약: 증권사 3곳이 목표가를 올렸어요 <span class="badge b-ok">공시 확인</span></div>
<div style="font-size:12px;color:#2f6fd6;margin-top:4px">원문 보기 → · 같은 내용 기사 7건</div></div>
<div class="card"><div style="font-size:13px"><b>美 수출규제 추가 검토 보도</b></div>
<div class="muted">△△일보 · 10/5 22:40</div>
<div style="font-size:12px;margin-top:4px"><span class="badge b-cond">미확인 보도</span> 공식 발표 아님</div></div>
<div class="note">기사 본문은 보여주지 않아요. 제목·요약·원문 링크만.</div>
""", tab=None)

S["s21-briefing"] = phone("장 시작 전 브리핑", """
<div class="muted">10/6(월) 08:30 기준</div>
<div class="card"><h3>시장</h3>코스피 <span class="up">+1.2%</span> · 코스닥 <span class="down">-0.4%</span><br>밤사이 나스닥 <span class="up">+0.8%</span> · 환율 1,385원</div>
<div class="card"><h3>크게 움직인 종목</h3><span class="up">▲ OO전자 +15%</span> 수주 공시<br><span class="down">▼ △△바이오 -12%</span> 임상 실패 보도</div>
<div class="card"><h3>내 종목</h3>삼성전자 <span class="up">+2.1%</span><br>NAVER <span class="down">-3.4%</span> ⚠ 어제 공시: 자사주 처분<br>삼성전자 비중 32% <span class="muted">(한도 40%)</span></div>
<div class="card"><h3>오늘 일정</h3>삼성전자 실적 발표 · 미국 CPI (밤 9:30)</div>
<div class="input">💬 "NAVER 공시 자세히 알려줘"</div>
""")

S["web-chat"] = """<div class="web">
<div class="side"><b style="padding:10px">투자 에이전트</b><span class="mode" style="margin:0 10px 10px;align-self:flex-start">모의투자</span>
<div>홈</div><div class="on">대화</div><div>승인</div><div>기록</div><div>설정</div></div>
<div style="flex:1;display:flex;flex-direction:column;padding:20px;gap:12px;border-right:1px solid #e5e5e5">
<div class="muted">폰 동기화 10:32 기준</div>
<div class="msg me">삼성전자 2주 사줘</div>
<div class="steps">✅ 스냅샷 사용 → ✅ 투자 AI → ✅ 검증 AI → ✅ 정책 검사</div>
<div class="msg ai">검증 AI가 <b>승인</b>했어요. 오른쪽 처리안을 확인해 주세요.</div>
<div style="flex:1"></div><div class="input">메시지 입력…</div></div>
<div style="width:420px;padding:20px;display:flex;flex-direction:column;gap:12px">
<div class="card"><div class="row"><b>삼성전자 매수 2주</b><span class="badge b-ok">승인</span></div>
<div class="row"><span>예상 금액</span><b>144,200원</b></div><div class="row"><span>주문 후 비중</span><span>35%</span></div></div>
<div class="card"><h3>근거 · 검증</h3><div style="font-size:13px;line-height:1.7">• 영업이익 증가 (OpenDART)<br>✅ 원문 일치 · 재계산 일치</div></div>
<div class="card"><h3>정책 검사</h3><span class="badge b-ok">모두 통과</span></div>
<div class="btns"><div class="btn red">거절</div><div class="btn gray">수정</div><div class="btn">승인</div></div>
<div class="note">웹에서는 주문이 나가지 않아요. 승인하면 <b>폰 앱의 '실행 필요'</b>에 올라가요.</div>
</div></div>"""

for name, html in S.items():
    w, h = (1280, 800) if name.startswith("web") else (390, 1460 if name == "s07-proposal" else 844)
    path = os.path.join(HERE, name + ".html")
    open(path, "w", encoding="utf-8").write(f"<!doctype html><meta charset=utf-8><style>{CSS}</style>{html}")
    out = os.path.join(OUT, name + ".png")
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=2",
                    f"--window-size={w},{h}", f"--screenshot={out}", "file:///" + path.replace("\\", "/")],
                   check=True, capture_output=True)
    print("ok", name)
