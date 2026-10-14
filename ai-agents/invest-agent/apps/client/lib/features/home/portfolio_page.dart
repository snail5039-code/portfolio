// 5단계 포트폴리오 점검·리밸런싱 제안 (서버 app/functions/portfolio.py). 코드가 계산한 비중·쏠림·현금 비율과 제안만 보여주고,
// 주문은 만들지 않는다. 바꾸려면 채팅에서 말하면 같은 검증 흐름을 거친다

import 'package:flutter/material.dart';

import '../../api/api.dart';
import '../../common/common.dart';

class PortfolioPage extends StatefulWidget {
  const PortfolioPage({super.key});

  @override
  State<PortfolioPage> createState() => _PortfolioPageState();
}

class _PortfolioPageState extends State<PortfolioPage> {
  Map<String, dynamic>? _data;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await api.get('/api/portfolio/analysis') as Map<String, dynamic>;
      setState(() { _data = data; _error = null; });
    } on ApiError catch (error) {
      setState(() { _error = error; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = _data;
    return Scaffold(
      appBar: topBar('포트폴리오 점검'),
      body: _error != null
          ? ErrorRetry(_error!, _load)
          : d == null
              ? const Center(child: CircularProgressIndicator())
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(padding: const EdgeInsets.all(16), children: [
                    Text('총 ${won(d['total_krw'] as int)} · 현금 ${d['cash_pct']}% · 쏠림 지수 ${d['concentration']}',
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                    SourceText('계좌 요약 ${hhmm(d['fetched_at'] as String)} 기준, 평가는 ${d['price_date'] ?? '최근'} 종가(공개 데이터, 다음 영업일 오후에 나와요). '
                        '쏠림 지수는 종목 비중의 제곱합(0~1)이에요. 1에 가까울수록 한 종목에 몰려 있어요.'),
                    const SizedBox(height: 12),
                    Text('제안', style: TextStyle(fontFamily: displayFont, fontSize: 20)),
                    if ((d['suggestions'] as List).isEmpty)
                      const Padding(padding: EdgeInsets.all(8), child: Text('지금 눈에 띄는 문제는 없어요', style: TextStyle(color: mutedText))),
                    for (final s in (d['suggestions'] as List).cast<Map<String, dynamic>>())
                      Card(child: ListTile(leading: const Icon(Icons.tips_and_updates_outlined, color: coachOrange), title: Text(s['text'] as String))),
                    const SourceText('제안은 규칙으로 계산한 참고 정보예요. 주문은 만들지 않아요. 바꾸려면 채팅에서 말하면 투자 AI → 검증 AI → 한도 검사를 거쳐요.'),
                    const SizedBox(height: 12),
                    Text('비중', style: TextStyle(fontFamily: displayFont, fontSize: 20)),
                    for (final h in (d['holdings'] as List).cast<Map<String, dynamic>>())
                      ListTile(
                        dense: true,
                        title: Text('${h['stock_name']} ${comma(h['qty'] as int)}주'),
                        subtitle: LinearProgressIndicator(value: double.parse('${h['weight_pct']}') / 100),
                        trailing: Text('${h['weight_pct']}%\n${h['gain_pct'] == null ? '' : '${h['gain_pct']}%'}', textAlign: TextAlign.right),
                      ),
                  ]),
                ),
    );
  }
}
