# AI 판단·검증 수정 기록

모의 자동매매에서 드러난 문제와 AI 판단·검증 로직을 어떻게 고쳤는지 모은다.
나중에 고칠 때 **어디를 보면 되는지(파일·함수)**와 **어떤 값으로 조절하는지(상수·설정)**를 함께 적는다.
최신이 위. 성과 숫자는 [README](../README.md) 1장과 `docs/reports/live-*.md`.

## 조절 값 한눈에

| 값 | 지금 | 위치 | 뜻 |
|---|---|---|---|
| `autoReviewGap` | 30분 | `apps/client/lib/features/auto/auto_trader.dart` | 보유 종목 매도 판단 주기 |
| `autoBuyRetryGap` | 30분 | 같은 파일 | "관찰"·오류로 안 산 종목을 다시 묻는 주기 |
| `autoRescanSlots` | 10·11·12·13·14시, 14:35 | 같은 파일 | 매수 후보 다시 찾기 (서버 `REFRESH_GAP_MINUTES` 30분) |
| `autoDropPct` / `autoRisePct` | −3% / +3% | 같은 파일 | 매입가 대비 이만큼 움직이면 30분 안 기다리고 바로 AI에게 |
| `autoMarketDropPct` | −1.5% | 같은 파일 | 코스피가 이만큼 빠지면 보유 종목 전부 바로 AI에게 |
| `autoStopLossPct` | −7% | 같은 파일 | 손절선. 바로 AI에게 묻는다 |
| `autoHardStopPct` / `autoHardStopAllPct` | −10% / −15% | 같은 파일 `hardStop` | 강제 손절: AI에게 묻지 않고 절반 / 남은 것 전부 (주문은 검증 AI를 거침) |
| 하락장 절반 매수 | 코스피 < 지난 20거래일 평균 | 같은 파일 `bearMarket` | 종목당 몫(35%)의 절반만 |
| `autoMaxStockPct` | 35% | 같은 파일 | 한 종목에 쓰는 살 총액 최대 몫 (서버 비중 40% 아래) |
| `autoRiskPct` | 2% | 같은 파일 `buyRoom` | 변동성 기준 수량: 평소 하루 변동(최근 20일 표준편차, 서버 `daily_vol_pct`)의 2배 빠지면 총자산의 이만큼만 잃게 산다 |
| `autoMaxExposurePct` | 70% | 같은 파일 `buyRoom` | 주식 평가액이 총자산의 이만큼을 넘게 사지 않는다 |
| `autoOpeningWaitMin` | 30분 | 같은 파일 | 장 시작 뒤 이 시간까지는 손절선만 묻는다 |
| `buy_portion` (투자 AI) / `buyRoom(half:)` | 전부·절반 | `schemas.py`, `auto_trader.dart` | 절반이면 종목 몫(35%)의 절반만 먼저 산다 |
| `MOVE_PCT` | ±2% | `apps/api/app/scorecard.py` | 관찰 판단 점수의 놓친 기회·피한 손실 기준 |
| `autoMaxReviews` | 20 | 같은 파일 | 종목당 하루 매도 판단 횟수 |
| 매수 시간 | 09:05~15:20 | `tick()` | 매도 판단은 15:28까지 |
| `autoApproves()` | 매수=승인만, 매도=조건부까지 | 같은 파일 | 자동으로 승인할 검증 판정 |
| `MAX_ANALYSES_PER_DAY` / `HOLDING_RESERVE` | 150 / 30 | `apps/api/app/agents/analysis.py` | 하루 AI 분석 한도 (Gemini 비용). 안 가진 종목은 120번까지, 남은 30번은 보유 종목 매도 점검용 |
| `autoGivebackFromPct` / `autoGivebackPct` | +2% / 1.5%p | `auto_trader.dart` `sellReason` | 오늘 매입가 대비 최고가 +2%를 넘은 뒤 거기서 1.5%p 넘게 내려오면 바로 AI에게 (새 최고 전엔 한 번만) |
| `autoCloseCheckMin` | 14:30 | 같은 파일 | 보유 종목마다 하루 한 번 마감 전 점검 |
| `GIVEBACK_PCT` | 1.5%p | `analysis.py` `giveback_text` | 장중 흐름에 오늘 고가·고가 때 수익·지금 수익을 쓰고, 이만큼 넘게 돌려줬으면 "돌려줌"을 붙인다 |
| `MOCK_ORDER_LIMITS` | 끔 | `apps/api/app/config.py` (.env) | 모의에도 금액 한도 적용할지 |
| `AUTO_COLLECT_HOUR` / `MORNING_BRIEF_TIME` | 7,14 / 08:20 | `apps/api/app/config.py` (.env) | 공시·시세 수집(14시는 전 거래일 종가), 아침 브리핑 자동 시각 |
| `moverMaxRisePct` | +10% | `apps/client/lib/broker/broker.dart` | 이만큼 이미 오른 급등 종목은 후보에서 뺀다 |
| 하락 중 매수 차단 | 5분 저가 3번 연속 하락 + VWAP 아래 | `apps/api/app/agents/analysis.py` `falling_now` | 자동매매 매수를 '관찰'만 허용 |
| 반등 중 표시 | 최근 5분 저가 > 오늘 저점, 현재가 ≥ VWAP | 같은 파일 `rebounding` | 장중 흐름에 "반등 중"을 붙여 투자 AI가 반등 매수를 따지게 |
| `autoDipPct` | −3% | `auto_trader.dart` `dipBuy` | 오늘 이만큼 넘게 빠진 종목을 사면 절반만 |
| `MAX_CANDIDATES` / 후보 순서 | 3 / 급등·거래대금 → 관심 → 상승 추세·20일 등락률 강한 순 | `apps/api/app/briefing.py` `pick_candidates`, `trend_ranks` | 2시간 안에 관찰한 종목은 뺀다. 상승 추세인데 관찰이면 `rechecks`로 앱이 실시간 재판단 |

## 10/18 주말 (수량 규칙, 1년 백테스트로)

| 드러난 문제 (근거) | 고친 것 | 위치 | 테스트 |
|---|---|---|---|
| 모든 종목을 같은 몫(35%)으로 사서 1년 백테스트 최대 낙폭 −51%, 조건에 따라 −4%~+134%로 들쭉날쭉. 10/16 첫 반등날 현금 92% 사용 | 변동성 기준 수량(2σ에 총자산 2%) + 전체 주식 비중 70%. 백테스트 중앙값 +37%·낙폭 −33%, 6개 조건 모두 이익 (사용자 결정) | 서버 `briefing.py` `daily_vol_pct`·`pick_entry`, 앱 `auto_trader.dart` `buyRoom`·`_buy` | `test_daily_vol_pct_from_last_twenty_returns`, `client_test` 매수 금액 |
| 하루 매수 한도 검토 | 넣지 않음: 며칠에 걸쳐 비중이 다 차서 효과 없음 (중앙값 +6%, 낙폭 −49%) | — | — |
| 14:30 이후 매수 금지 검토 | 보류 (사용자 결정): 6일 동안 해당 매수 0건 | — | — |

백테스트는 AI 판단을 되돌리지 못해 후보는 다 산다고 보고, 매수·매도 모두 종가, 매도는 보유 기간과 강제 손절로 흉내 냈다. 하락장 절반 규칙은 넣지 않았다.

## 10/16 장 마감 뒤 (6일차 기록으로)

| 드러난 문제 (근거) | 고친 것 | 위치 | 테스트 |
|---|---|---|---|
| 하루 분석 한도 100을 14:32에 다 써서, 14:32~15:27 분석 26번 거절 (보유 종목 매도 판단 17번, 매수 9번, 서버 기록). 그 사이 계좌 +0.76% → −0.93% | 한도 150 (사용자 결정), 그중 30번은 보유 종목 전용. 보유 여부는 마지막 잔고 기록이나 오늘 체결된 매수로 본다 | `analysis.py` `check_target_node`, `HOLDING_RESERVE` | `test_holding_reserve_keeps_room_for_sell_checks` |
| +2~3%까지 갔다가 내려온 4종목에 질문이 없었다 (매입가 기준 ±3%만 봄) | 오늘 최고 +2% 넘은 뒤 1.5%p 내려오면 바로 묻기, 14:30 마감 전 점검 | `auto_trader.dart` `sellReason` (`giveback`, `close`) | `client_test` 매도 판단 |
| 오후 보유 판단 10건을 새 지시로 다시 돌려도 모두 보유 (그때는 VWAP 위·반등 중). 하락은 판단이 막힌 14:32 뒤 | 투자 AI 지시를 "판다·든다를 같은 무게로 비교, 보유는 기본값 아님, 확신 없으면 절반"으로. 작은 이익 매매 회피는 "비용보다 작은 이익"으로 좁힘. 앱 질문에도 같은 말 (사용자: 숫자 규칙보다 AI가 판단) | `llm.py` `INVEST_PROMPT`, `auto_trader.dart` `sellQuestion` | 재현 스크립트 (투자 AI만, 10회) |
| 1분봉이 최근 30분뿐이라 "오전에 오르고 오후 내내 밀림"이 안 보임 | 폰이 잔고·현재가 조회 때 본 현재가를 하루 동안 쌓고(메모리), 시가와 함께 보냄. 서버가 시간마다 마지막 값·오늘 본 최고 대비를 장중 흐름에 씀 | `kis_mock_broker.dart` `_see`, `interrupts.py` `Intraday`, `analysis.py` `day_flow_text` | `test_day_flow_text_and_phone_fields_accepted`, `client_test` 장중 흐름 |
| AI 자료에 30분 1분봉만 있어 오늘 고가·돌려준 이익이 안 보임 | 폰이 KIS 현재가 조회의 오늘 고가(`stck_hgpr`)를 장중 흐름에 붙이고, 서버가 고가 때·지금 매입가 대비 수익과 돌려준 폭을 계산. 투자 AI 지시에 "이익을 지킬지" 양쪽 기준 추가 | `kis_mock_broker.dart` `price`·`intraday`, `analysis.py` `giveback_text`, `llm.py` | `test_giveback_text_from_day_high`, `client_test` 장중 흐름 |

`stck_hgpr`·`stck_oprc`가 KIS 모의 응답에 실제로 오는지는 다음 장중에 확인 (문서 기준, 미확인). 이익 쪽 코드 규칙(+5% 절반 등)은 사용자 결정으로 넣지 않았다.

## 10/16 장중 (6일차, 코스피 +2.05%, [리포트](reports/live-20261016.md))

| 드러난 문제 (근거) | 고친 것 | 위치 | 테스트 |
|---|---|---|---|
| 09:05 피에스케이홀딩스: 실행 직전 가격 1% 넘게 변동 → 서버가 고친 처리안으로 다시 승인 요청 → 앱이 체결로 보고 "7주 매수" 기록 (주문 없음) | 다시 온 처리안도 같은 기준(검증 승인·확인 항목 없음)으로 최대 2번 더 승인, 계속 바뀌면 주문 안 함 | `auto_trader.dart` `_order` | (앱 테스트 추가 예정) |
| 서버가 08:20에 꺼져 아침 브리핑을 놓침 | 거래일 08:20~15:20에 서버가 켜졌는데 오늘 브리핑이 없으면 바로 만듦. 로그인 시 Docker·DB·서버 자동 시작 | `briefing.py` `missed_morning`, `apps/api/scripts/autostart.ps1` | `test_missed_morning_only_on_trading_day_after_time_without_briefing` |
| 삼성SDI 보유 판단 6번 반려: 흑자 전환이라 값이 없는 `op_income_yoy`를 AI가 계속 붙임 (어제 고친 지표의 부작용) | 값이 없는 지표 ID는 코드가 떼고, 지표가 안 남은 계산 근거는 출처 원문 사실 근거로 | `analysis.py` `drop_uncomputable_metrics` | `test_uncomputable_metric_ids_dropped_and_prefix_fixed` |
| "(출처: 지표: volatility_60d)"로 반려 2번 | "지표:" 앞말을 뗌 | `analysis.py` `fix_source_id` | 같은 테스트 |

**정할 것** (리포트 5·6장): 이익 실현 선, 하루 매수 한도(오늘 현금 92%를 하루에 씀), 늦은 시각·이미 많이 오른 종목 매수 제한, 잘못 남은 매수 기록을 실제 잔고에 맞추기

## 10/15 장중 (5일차, 코스피 −7.57%, [리포트](reports/live-20261015.md))

| 드러난 문제 (근거) | 고친 것 | 위치 | 테스트 |
|---|---|---|---|
| 후보를 "최근 3일 공시 종목"으로 골라, 다시 찾을 때마다 하락 추세 종목(현대건설·포스코퓨처엠)을 또 보고 또 관찰 (5번) | 상승 추세 종목을 20거래일 등락률이 강한 순으로, 2시간 안에 관찰한 종목은 빼고 (13:28 반영) | `briefing.py` `trend_ranks`, `pick_candidates` | `test_candidates_prefer_uptrend_and_skip_recent_watch` |
| 13:01 삼성SDI 매수 검토를 뉴스 인용으로 3번 반려 → 결론 없음 | 검증 AI: "보도에 따르면"으로 밝힌 뉴스, 다른 근거와 함께 쓴 뉴스는 문제 삼지 않음 | `llm.py` `VERIFY_PROMPT` 7번 | (프롬프트, 14:00 이후 뉴스 반려 0) |
| 11:13 AI가 출처를 `snapshot:`으로 써서 "없는 출처" 반려 | `snapshot…`은 `snapshot`으로 고쳐 받음 | `analysis.py` `news_as_inference` | 기존 테스트 |
| 급락일에 상승 추세 종목도 "시장 급락"만으로 관찰, 반등해도 살 길이 없음 (사용자 요청) | 반등 확인 절반 매수: 코드가 "반등 중" 표시, 투자 AI 지시 추가, 검증 AI 일관성 규칙 예외, 앱은 −3% 넘게 빠진 종목을 절반만 (14:20 반영) | `analysis.py` `rebounding`, `llm.py`, `auto_trader.dart` `dipBuy` | `test_rebounding_needs_higher_recent_low_and_vwap`, `client_test` 매수 금액 |

### 10/15 장 마감 뒤

| 드러난 문제 (근거) | 고친 것 | 위치 | 테스트 |
|---|---|---|---|
| 반등 신호(1분봉·VWAP)는 앱의 실시간 재확인에만 있는데, 14:35 후보 셋을 서버 브리핑(실시간 시세 없음)이 뉴스 제목만 보고 관찰로 끝냄 | 상승 추세인데 관찰한 후보는 `rechecks`로 앱에 넘겨 실시간으로 다시 판단, 사면 절반 | `briefing.py` `build_briefing`, `auto_trader.dart` `_buy` | `test_uptrend_watch_goes_to_rechecks_for_live_check` |
| 삼성SDI 영업이익 적자 −8,319억 → 흑자 +482억을 `op_income_yoy` +105.79%로 계산 → "왜곡"으로 4번 반려 | 전년이 적자면 증가율 없이 "흑자 전환"·"적자 지속" | `functions/metrics.py` `yoy_growth` | `test_yoy_from_loss_says_turnaround` |
| 출처 ID 오타로 반려 3번 (`snapshot:`, `market:KDAQ`, `market:KOSDAQD`) | 코드가 바로잡음 (근거·반대 근거·위험) | `analysis.py` `fix_source_ids` | `test_fix_source_ids_corrects_common_typos` |
| 보유 종목 판단이 '관찰'로 나오면 "'관찰' 대신 '관찰'로" | 보유 종목은 '보유'로 | `analysis.py` `invest_agent_node` | `test_held_stock_watch_becomes_hold` |

| 손절선이 AI 판단에 막힘: NH투자증권 −9.16%에서 AI가 매번 "공포 매도 피하기"로 보유 (사용자 결정) | 강제 손절: −10%면 AI에게 묻지 않고 절반, −15%면 남은 것 전부. 주문은 검증 AI를 거치고 반려면 사람에게 | `auto_trader.dart` `hardStop`, `_review` | `client_test` 매도 판단 |
| 하락장에서도 상승장과 같은 수량으로 삼 (사용자 결정, Faber 추세 필터) | 코스피가 지난 20거래일 평균 아래면 종목당 몫 절반 | `auto_trader.dart` `bearMarket`, `_buy` | `client_test` 매도 판단 |

## 10/14 장 마감 뒤 (4일차 기록으로, [리포트](reports/live-20261014.md))

| 드러난 문제 (근거) | 고친 것 | 위치 | 테스트 |
|---|---|---|---|
| 장중: 추세 자료로 쓴 계산 근거가 "지표 ID 없음", 반대 근거의 지표 ID가 "없는 출처"로 반려 (9건) | 코드가 계산한 자료(추세·장중·지수·계좌)를 출처로 단 계산 근거는 지표 ID 없이 통과, 지표 ID 출처 표시도 인정 (10:08 반영) | `claim_check`, `code_checks`, `CODE_COMPUTED` | `test_calc_from_code_computed_sources_needs_no_metric_id` |
| 셀트리온 보유 판단 9번 반려 "금액 560,853배 다름". AI는 맞게 썼고 공시 표 숫자에 "원"이 없어 검사가 못 읽음 | 원문의 쉼표 숫자도 원문 값으로 본다 (단위 오류는 계속 잡음) | `amount_check`, `COMMA_NUMBER` | `test_amount_check_reads_table_numbers_without_won` |
| 후보 다시 찾기 11·13·14:35시 거절 (429). 서버 60분 간격 vs 앱 매시 → 59분 차이 | 서버 간격 30분 | `routers/briefings.py` `REFRESH_GAP_MINUTES` | `test_refresh_rebuilds_today_briefing_once_per_gap` |
| KIS 모의 일별 지수가 며칠 늦게 와서(10/14에 10/12까지) "1거래일 등락"이 틀림 | 날짜로 오늘 것을 빼고 지난 종가로 계산, 기준일 표시 | `past_closes`, `market_source`, `trend_source` | `test_market_source_uses_dates_when_daily_index_lags` |
| "보도에 따르면 보도에 따르면" 중복 | 문장에 "보도"가 있으면 붙이지 않음 | `news_as_inference` | `test_news_inference_prefix_not_doubled` |
| 상승 추세 삼성SDI(+5.00%)를 변동성·PER·미확인 보도로 통째로 관찰. 선택지가 전부 사기/안 사기뿐 | 절반 매수 `buy_portion`: 앱은 종목 몫의 절반만 먼저, 다음 판단이 '전부'면 나머지 | `schemas.py`, `briefing.py` `pick_entry`, `auto_trader.dart` `buyRoom(half:)` | `test_half_buy_pick_tells_app_to_buy_half`, `client_test` 매수 금액 |
| 투자 AI 지시가 위험 쪽으로만 치우침 (LG에너지솔루션은 미확인 배임 보도가 크게 작용) | 관찰도 비용이 있다, 추세·실적이 좋으면 위험은 수량으로. 미확인 보도는 호재·악재 모두 가볍게, 공식 확인된 악재는 무겁게 | `llm.py` `INVEST_PROMPT` | (프롬프트, 10/15 장에서 확인) |
| AI가 너무 조심스러운지 볼 숫자가 없음 | 관찰 판단 점수: 관찰한 후보의 그날 등락, 놓친 기회·피한 손실 | `app/scorecard.py` | `test_score_counts_missed_and_avoided` |

## 10/14 장중 점검 (웹 조사 기준과 비교, [점검 보고서](reports/ai-audit-20261014.md))

장 마감 뒤 서버·앱을 다시 켜서 10/15부터 적용.

| 드러난 문제 (근거) | 고친 것 | 위치 | 테스트 |
|---|---|---|---|
| AI가 이동평균·추세·시장 대비 없이 사고팖 (지표는 PER·PBR·부채·실적·변동성뿐) | 코드가 20·60일 평균 대비, 20일 평균 방향, 20일 등락률(시장 대비), 20일 고점 대비를 계산해 출처 `trend:`로 | `analysis.py` `trend_text`·`trend_source` | `test_trend_text_moving_averages_and_relative_strength` |
| 시장 국면(지수가 평균 위·아래)을 모름 | 지수 20거래일 평균 대비 | `market_source` | `test_market_source_twenty_day_average` |
| 10/8 하락 중 매수. "떨어지는 중"을 AI가 짐작 | VWAP와 5분 저가 연속 하락을 코드가 계산. 둘 다면 자동매매 매수는 '관찰'만 허용 | `lows_falling`·`falling_now`·`gather_node`, `kis_mock_broker.dart` `intraday` | `test_intraday_vwap_and_falling_knife`, `test_auto_buy_is_blocked_while_falling_intraday`, `client_test` VWAP |
| 급등 순위를 그대로 후보로 (한국은 급등 뒤 되돌림 우세) | 전일 대비 +10% 이상은 후보에서 뺌 | `broker.dart` `chasing` | `client_test` 급등 후보 |
| 세금·수수료 없이 손익 판단 | 보유 종목에 "지금 다 팔면 손익 (세금·수수료 뺀 추정)" | `net_sell_text` | `test_net_sell_text_subtracts_tax_and_fees` |
| DB 종가가 이틀 묵음 (공공데이터는 다음 영업일 오후 갱신, 수집은 07시뿐) | 07시·14시 두 번 수집 | `config.py` `AUTO_COLLECT_HOUR` | (14시 수집 로그로 확인 예정) |
| **보류**: ATR 손절, +1R 절반 이익 실현, 위험 기준 수량 | 고가·저가 일봉이 없고, 손익을 크게 바꾸는 규칙이라 며칠 더 본 뒤 | — | — |

## 10/14 (4일차 장 전, 3일차 기록으로)

| 드러난 문제 (근거) | 고친 것 | 위치 | 테스트 |
|---|---|---|---|
| 10/13 검증 반려 48건 중 35건이 "뉴스를 사실로". 투자 AI가 반복해 최종 55건 중 33건이 결론 없이 끝남 | 뉴스는 계속 근거로 쓰되, 뉴스만 출처인 '사실' 근거는 코드가 '추론'으로 낮추고 "보도에 따르면"을 붙인다 (반려 대신) | `analysis.py` `news_as_inference`, `invest_agent_node` | `test_news_only_fact_becomes_reported_inference` |
| 10/13 시초가 급락 때 판 3종목 모두 종가가 더 높았다 (약 7.9만 원) | 장 시작 30분은 손절선만 묻는다. 매도 질문에 "오늘 저점 근처인지, 회복 중인지"를 보게 | `auto_trader.dart` `sellReason`, `autoOpeningWaitMin`, `sellQuestion` | `client_test` 장 시작 30분 |

## 10/13 (3일차)

| 드러난 문제 (근거) | 고친 것 | 위치 | 테스트 |
|---|---|---|---|
| 셀트리온 매수 3건이 "숫자를 고쳐라" 같은 **조건부 승인**인데 자동매매가 샀다 | 자동 매수는 "승인"만, 매도는 조건부까지. 검증 AI: 고쳐야 하면 조건부가 아니라 반려 | `auto_trader.dart` `autoApproves`, `llm.py` `VERIFY_PROMPT` | `client_test` 자동 승인 |
| 제안 36건 중 21건이 **뉴스만 출처인 사실 근거** | 코드가 반려 (투자 AI가 고쳐 다시 냄) | `analysis.py` `claim_check` | `test_news_only_fact_claim_fails` |
| 3거래일 묵은 종가로 분석해도 통과 (신선도 경고 0건) | 오늘 시세 없이 평일 2일 넘게 묵으면 warn | `analysis.py` `freshness_checks` | `test_freshness_and_today_data_checks` |
| 보유 판단이 오늘 가격·시장을 안 봄 | 보유 종목 보유·매도 판단에 오늘 자료(quote·intraday·market) 미인용이면 fail | 같은 함수 | 같은 테스트 |
| 반대 근거에 "하락 중"을 적고도 매수 (10/8) | 검증 항목 9 "결론 일관성" | `llm.py` `VERIFY_PROMPT` | (프롬프트, 실제 분석으로 확인) |
| 보유 종목에 "관찰" (모호) | 보유 종목은 보유·매도만 | `suitability.py` `allowed_actions` | `test_sell_and_hold_only_when_holding` |
| −7% 손절만 AI 없이 팔았다 | 손절선도 AI 판단 + 검증 후에만 판다 | `auto_trader.dart` `sellReason`·`_review` | `client_test` 매도 판단 |
| 오를 때 이익을 지킬 기회가 30분 주기뿐 | +3% 급등이면 바로 AI에게 | `sellReason` 'rise', `sellQuestion` | 같은 테스트 |
| 아침 브리핑·공시 수집을 사람이 돌림 | 서버가 매일 07:00 수집, 08:20 브리핑 | `config.py` | 10/13 08:20 자동 동작 확인 |
| 모의에도 1일 한도 → 판 돈으로 못 갈아탐 | 모의는 금액 한도 없음, 살 총액 "주문 가능 금액 전부" (`autoAllCash`) | `orders.py` `policy_check(mock=)`, `auto_trader.dart` | `test_mock_has_no_amount_limits` |
| "관찰"이 한 번 나오면 그날 끝, 후보 다시 찾기 2번뿐 | 사는 판단 30분 주기, 다시 찾기 매시 | `_buy` `settled()`, `autoRescanSlots` | (장중 확인 예정) |
| Gemini 429 오류가 재시도 횟수를 다 씀 | 오류도 30분 뒤 다시 | `_buy` | 14:28 재시도 확인 |
| 후보가 공시 종목 몇 개뿐 | 폰이 KIS 거래대금·상승률 상위를 받아 후보로 | `kis_mock_broker.dart` `movers`, `briefing.py` `pick_candidates(movers)` | `test_refresh_rebuilds...` |
| 하루 새 종목 3개 제한, 매수 15:00 정지 | 개수 제한 없음(종목당 35%), 매수 15:20까지 | `buyRoom`, `tick()` | `client_test` 매수 금액 |
| ~~남은 과제~~ 시초가 급락 때 판 3종목 모두 종가가 더 높았다 (약 7.9만 원) | → 10/14 장 시작 30분 규칙, VWAP·추세로 해결 | — | — |
| ~~남은 과제~~ 검증 반려 48건 중 35건이 "뉴스를 사실로" | → 10/14 `news_as_inference`로 해결 | — | — |

## 10/12 (2일차)

| 드러난 문제 | 고친 것 | 위치 |
|---|---|---|
| AI가 시장 전체를 못 봄 (10/8 −2.62%, 10/12 −3.65% 날 손실) | 폰이 KIS 지수(현재·일별)를 보내고, 서버가 1·5·20거래일 흐름·연속 하락을 계산해 출처 `market:KOSPI`로 | `kis_mock_broker.dart` `market`, `analysis.py` `market_source`, `interrupts.py` `MarketIndex` |
| 시장 급락에도 30분 기다림 | 코스피 −1.5%면 보유 전부 즉시 재판단 | `marketDropped`, `sellReason(marketDrop:)` |
| 매도는 전부 아니면 0 | 투자 AI가 `sell_portion` (전부/절반) | `schemas.py` `ProposalDraft`, `sellQty` |
| 하루 분석 한도 20이 10:44에 차서 3시간 판단 정지, 실패를 "보유"로 기록 | 한도 100, 한도 실패는 따로 기록하고 횟수에서 뺌 | `analysis.py`, `_review` |
| −3% 아래 종목을 11분마다 다시 물음 | 지난번보다 1%p 더 빠졌을 때만 | `sellReason` |
| 팔 종목을 사람이 고름, 정해진 시각에만 | 30분마다 AI가 "곧 떨어질 것 같으면 미리 판다" | `sellQuestion`, `autoReviewGap` |

## 10/8 (1일차)

자세한 원인 분석은 README 1장. 장중 하락 중 매수 → 자동 주문은 투자 AI가 "관찰"로 거절할 수 있게, 뉴스 출처 추가, 매도 나눠 팔기.
