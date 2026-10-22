// 모의투자 자동매매 켜기·끄기, 오늘 계획 승인(살 총액·팔 종목), 오늘 기록 (features/auto/auto_trader.dart)
// 2026-10-20 사용자 요청: 줄글을 한 줄 항목으로, 동작 설명은 접어 둔다

import 'package:flutter/material.dart';

import '../../broker/broker.dart';
import '../../common/common.dart';
import 'auto_trader.dart';

/// 동작 설명 (접힌 칸). 아이콘 · 제목 · 한 줄
const _howItWorks = [
  (Icons.schedule, '언제', '평일 09:05~15:20 매수 · 매도 판단은 15:28까지 · 1분마다 확인'),
  (Icons.shopping_cart_outlined, '사는 것', '오늘 아침 브리핑에서 검증 AI가 승인한 종목'),
  (Icons.sell_outlined, '파는 것', '자동매매로 산 종목을 30분마다 점검 · 검증 AI가 승인한 매도만'),
  (Icons.bolt_outlined, '바로 점검', '−$autoDropPct% 급락 · +$autoRisePct% 급등 · 코스피 −$autoMarketDropPct% · −$autoStopLossPct% 손절선'),
  (Icons.verified_user_outlined, '주문 전 검사', '투자 AI → 검증 AI → 한도 검사 · 1회 한도를 넘으면 나눠 주문'),
  (Icons.front_hand_outlined, '사람 확인', '성향 초과 · 검증 반려 · 급등 재확인 처리안은 자동 승인 안 함'),
];

class AutoTradePage extends StatefulWidget {
  const AutoTradePage({super.key});

  @override
  State<AutoTradePage> createState() => _AutoTradePageState();
}

class _AutoTradePageState extends State<AutoTradePage> {
  int? _budget; // 승인 전 고르는 중인 값 (null이면 지난번 값)
  bool _aiSell = true; // 장중 급락 시 AI 판단 매도 허용

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: topBar('모의 자동매매'),
        body: ListenableBuilder(
          listenable: Listenable.merge([autoTrader, currentBroker]),
          builder: (context, _) {
            final allowed = AutoTrader.allowed(currentBroker.value);
            return ListView(padding: const EdgeInsets.all(16), children: [
              Card(
                color: Colors.white,
                child: SwitchListTile(
                  title: const Text('자동매매', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
                  subtitle: Text(allowed ? '모의투자 전용 · 끄면 바로 멈춰요' : 'KIS 모의 연결에서만 켤 수 있어요'),
                  value: autoTrader.on && allowed,
                  onChanged: allowed ? autoTrader.setOn : null,
                ),
              ),
              if (autoTrader.on && allowed) _planCard(),
              Card(
                color: Colors.white,
                clipBehavior: Clip.antiAlias,
                child: ExpansionTile(
                  shape: const Border(),
                  leading: const Icon(Icons.help_outline, color: brandBlue),
                  title: const Text('어떻게 동작하나요', style: TextStyle(fontWeight: FontWeight.w700)),
                  childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                  children: [for (final (icon, title, text) in _howItWorks) _infoRow(icon, title, text)],
                ),
              ),
              const Padding(
                padding: EdgeInsets.fromLTRB(4, 4, 4, 16),
                child: SourceText('승인하지 않은 날은 사고팔지 않아요 · 수익을 보장하지 않아요 · 수수료와 팔 때 세금(0.2%)이 들어요'),
              ),
              Text('오늘 기록', style: TextStyle(fontFamily: displayFont, fontSize: 20)),
              const SizedBox(height: 8),
              if (autoTrader.log.isEmpty) const Text('아직 없어요', style: TextStyle(color: mutedText)),
              for (final line in autoTrader.log.reversed) _logRow(line),
            ]);
          },
        ),
      );

  static Widget _infoRow(IconData icon, String title, String text) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(icon, size: 20, color: mutedText),
          const SizedBox(width: 10),
          SizedBox(width: 92, child: Text(title, style: const TextStyle(fontWeight: FontWeight.bold))),
          Expanded(child: Text(text, style: const TextStyle(color: Color(0xFF3A4148)))),
        ]),
      );

  /// 기록 한 줄 "HH:MM 내용" → 시각 칸 + 내용
  static Widget _logRow(String line) {
    final timed = RegExp(r'^\d\d:\d\d ').hasMatch(line);
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8),
      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: Color(0xFFE9ECEF)))),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SizedBox(width: 52, child: Text(timed ? line.substring(0, 5) : '', style: const TextStyle(color: mutedText, fontWeight: FontWeight.bold))),
        Expanded(child: Text(timed ? line.substring(6) : line)),
      ]),
    );
  }

  Widget _planCard() {
    final plan = autoTrader.plan;
    final held = autoTrader.positions;
    if (plan != null) {
      return Card(
        color: Colors.white,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 8, 12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              const Text('오늘 계획', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
              const SizedBox(width: 8),
              const Tag('승인함', Color(0xFF137A33)),
              const Spacer(),
              TextButton(onPressed: autoTrader.cancelPlan, child: const Text('계획 취소')),
            ]),
            _infoRow(Icons.shopping_cart_outlined, '매수',
                plan['budget'] == 0 ? '안 함' : '${budgetLabel(plan['budget'] as int)}까지'),
            _infoRow(Icons.sell_outlined, '매도', plan['ai_sell'] == true ? 'AI가 판단 · −$autoStopLossPct% 손절선 포함' : '안 함'),
          ]),
        ),
      );
    }
    final budget = _budget ?? autoTrader.budgetKrw;
    return Card(
      color: const Color(0xFFFFF4E0),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('오늘 계획을 승인해 주세요', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
          const Text('승인하기 전에는 사지도 팔지도 않아요'),
          const SizedBox(height: 8),
          Row(children: [
            const Expanded(child: Text('오늘 살 총액')),
            DropdownButton<int>(
              value: AutoTrader.budgets.contains(budget) ? budget : AutoTrader.budgets[1],
              items: [for (final v in AutoTrader.budgets) DropdownMenuItem(value: v, child: Text(budgetLabel(v)))],
              onChanged: (v) => setState(() => _budget = v),
            ),
          ]),
          const SizedBox(height: 4),
          Text(held.isEmpty ? '보유 종목: 자동매매로 산 종목이 없어요'
              : '보유 종목: ${held.values.map((v) => '${(v as Map)['name']} ${v['qty']}주').join(', ')}'),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: _aiSell,
            title: const Text('보유 종목 매도는 AI가 판단'),
            subtitle: const Text('30분마다, 급락하면 바로 · −$autoStopLossPct% 손절선 포함'),
            onChanged: (v) => setState(() => _aiSell = v),
          ),
          const SizedBox(height: 8),
          FilledButton(
            onPressed: () => autoTrader.approvePlan(budget, aiSell: _aiSell),
            child: const Text('오늘 계획 승인'),
          ),
        ]),
      ),
    );
  }
}
