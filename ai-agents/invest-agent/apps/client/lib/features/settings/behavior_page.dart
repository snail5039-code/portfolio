// 내 투자 습관 (docs/plan/12-todo-by-stage.md 2-6): 최근 30일 처리안·주문 기록으로 본 매매 습관.
// 습관은 조심하는 쪽으로만 쓴다. 성향 단계·한도는 바꾸지 않는다.

import 'package:flutter/material.dart';

import '../../api/api.dart';
import '../../common/common.dart';

class BehaviorPage extends StatefulWidget {
  const BehaviorPage({super.key});

  @override
  State<BehaviorPage> createState() => _BehaviorPageState();
}

class _BehaviorPageState extends State<BehaviorPage> {
  late Future<Map<String, dynamic>> _data = _load();

  Future<Map<String, dynamic>> _load() async => await api.get('/api/profile/behavior') as Map<String, dynamic>;

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: topBar('내 투자 습관'),
        body: FutureBuilder(
          future: _data,
          builder: (context, snapshot) {
            if (snapshot.hasError) return ErrorRetry(snapshot.error!, () => setState(() { _data = _load(); }));
            if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
            final b = snapshot.data!;
            final notes = (b['notes'] as List).cast<String>();
            Widget row(String label, Object value) => ListTile(
                  dense: true,
                  title: Text(label),
                  trailing: Text('$value', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                );
            return ListView(padding: const EdgeInsets.all(16), children: [
              Card(
                color: Colors.white,
                child: Column(children: [
                  row('처리안', '${b['records']}건'),
                  row('체결된 주문', '${b['fills']}건'),
                  row('급등 경고를 받고도 산 주문', '${b['hot_buys']}건'),
                  row('오른 종목만 먼저 판 주문', '${b['winner_sells']}건'),
                  row('성향 초과·검증 반려를 확인하고 진행', '${b['risky_confirms']}건'),
                ]),
              ),
              const SizedBox(height: 12),
              if (b['enough'] != true)
                _note('아직 기록이 적어요. 처리안이 ${b['min_records']}건 이상 쌓이면 습관을 알려드려요.')
              else if (notes.isEmpty)
                _note('눈에 띄는 위험한 습관이 없어요.')
              else
                for (final n in notes)
                  Card(
                    color: const Color(0xFFFFF4EC),
                    child: ListTile(leading: const Icon(Icons.lightbulb_outline, color: coachOrange), title: Text(n)),
                  ),
              const SizedBox(height: 12),
              SourceText('최근 ${b['days']}일 처리안·주문 기록으로 계산했어요. 습관은 더 조심하는 쪽으로만 쓰고, '
                  '성향 단계와 한도는 바꾸지 않아요.'),
            ]);
          },
        ),
      );

  Widget _note(String text) => Card(
        color: Colors.white,
        child: Padding(padding: const EdgeInsets.all(16), child: Text(text, style: const TextStyle(color: mutedText))),
      );
}
