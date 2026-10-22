// 자산 탭 총자산 그래프: 오늘(장중, 자동매매가 5분마다·자산 탭을 열 때) / 날짜별(그날 마지막 값).
// 값은 폰이 현재가로 계산해 스냅샷과 함께 서버에 올린 것 (GET /api/equity). 서버엔 실시간 시세가 없다.

import 'package:flutter/material.dart';

import '../../api/api.dart';
import '../../broker/broker.dart';
import '../../common/common.dart';
import 'overview.dart';
import '../../secure/key_store.dart';

/// 그래프에 쓸 (이름표, 총자산) 목록. 장중은 "HH:MM", 날짜별은 "M/D"
List<(String, int)> equitySeries(Map<String, dynamic> data, {required bool daily}) => daily
    ? [
        for (final d in (data['days'] as List).cast<Map<String, dynamic>>())
          (monthDay(d['date'] as String), d['total_krw'] as int),
      ]
    : [
        for (final p in ((data['intraday'] as Map)['points'] as List).cast<Map<String, dynamic>>())
          (p['time'] as String, p['total_krw'] as int),
      ];

/// 시작 금액은 폰에만 둔다 (증권사 잔고엔 처음 넣은 돈이 없다). 모의·실전을 따로
String startKey() => 'start_krw:${realMode.value ? 'real' : 'mock'}';

/// 날짜별 표 한 줄: 그날 마지막 기록과 전 거래일 대비 손익 (첫 날은 null = 미확인). 최근 날이 위
List<({String date, String time, int total, int cost, int? value, int? change})> dailyRows(Map<String, dynamic> data) {
  final days = (data['days'] as List).cast<Map<String, dynamic>>();
  return [
    for (var i = days.length - 1; i >= 0; i--)
      (
        date: days[i]['date'] as String,
        time: days[i]['time'] as String? ?? '',
        total: days[i]['total_krw'] as int,
        cost: days[i]['cost_krw'] as int? ?? 0,
        value: _value(days[i]),
        change: i == 0 ? null : (days[i]['total_krw'] as int) - (days[i - 1]['total_krw'] as int),
      ),
  ];
}

/// 주식 평가금액 = 총자산 − 현금. 기록의 현금이 이상하면(10/14 현금 15,493,152원 > 총자산) null = 미확인
int? _value(Map<String, dynamic> day) {
  final cash = day['cash_krw'] as int?, total = day['total_krw'] as int;
  return cash == null || cash < 0 || cash > total ? null : total - cash;
}

/// "2026-10-19" → "10/19"
String monthDay(String ymd) => '${int.parse(ymd.substring(5, 7))}/${int.parse(ymd.substring(8, 10))}';

class EquityCard extends StatefulWidget {
  const EquityCard({super.key});

  @override
  State<EquityCard> createState() => _EquityCardState();
}

class _EquityCardState extends State<EquityCard> {
  late Future<Map<String, dynamic>> _data = _load(null);
  int? _start; // 시작 금액 (자산 탭 위에서 넣은 것)
  static bool _tableOpen = false; // 날짜별 표는 접어 두고 누르면 편다
  // 자산 탭을 새로 읽을 때마다 카드가 새로 만들어져서, 고른 보기는 앱이 켜져 있는 동안 기억한다
  static bool _daily = false;
  int? _touched; // 그래프에서 누르거나 마우스를 올린 점

  Future<Map<String, dynamic>> _load(String? day) async {
    _start = int.tryParse(await secureBox.read(startKey()) ?? '');
    return await api.get(day == null ? '/api/equity' : '/api/equity?day=$day') as Map<String, dynamic>;
  }

  /// 날짜별 표: 날짜 · 총자산 · 주식(매입 → 평가) · 그날 손익 · 시작 대비. 줄을 누르면 그날 장중 그래프
  Widget _table(Map<String, dynamic> data) {
    final rows = dailyRows(data);
    const small = TextStyle(fontSize: 11, color: mutedText);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const SizedBox(height: 6),
      InkWell(
        onTap: () => setState(() { _tableOpen = !_tableOpen; }),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(children: [
            Text('날짜별 기록 ${rows.length}일', style: const TextStyle(fontWeight: FontWeight.bold)),
            const Spacer(),
            Text(_tableOpen ? '접기' : '펼치기', style: const TextStyle(fontSize: 12, color: mutedText)),
            Icon(_tableOpen ? Icons.expand_less : Icons.expand_more, color: mutedText),
          ]),
        ),
      ),
      if (_tableOpen)
      for (final r in rows)
        InkWell(
          onTap: () => setState(() {
            _daily = false;
            _touched = null;
            _data = _load(r.date);
          }),
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 8),
            decoration: const BoxDecoration(border: Border(top: BorderSide(color: Color(0x14000000)))),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              SizedBox(
                width: 46,
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(monthDay(r.date), style: const TextStyle(fontWeight: FontWeight.bold)),
                  Text(r.time, style: small),
                ]),
              ),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(won(r.total), style: const TextStyle(fontWeight: FontWeight.bold)),
                  Text('주식 ${comma(r.cost)} → ${r.value == null ? '미확인' : won(r.value!)}', style: small),
                ]),
              ),
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text(r.change == null ? '미확인' : '${signedWon(r.change!)} (${rateText(r.change!, r.total - r.change!)})',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: changeColor(r.change ?? 0) ?? mutedText)),
                if (_start case final start?)
                  Text('시작 대비 ${rateText(r.total - start, start)}', style: small),
              ]),
            ]),
          ),
        ),
      if (_tableOpen) const SourceText('그날 마지막 기록 (폰이 올린 값) · 주식은 매입 → 평가 · 그날 손익은 전 거래일 대비, 판 종목 손익 포함 · 줄을 누르면 그날 장중'),
    ]);
  }

  /// 달력에서 기록이 있는 날만 고를 수 있다. 고르면 그날 장중 그래프
  Future<void> _pickDay(Map<String, dynamic> data) async {
    final days = {for (final d in (data['days'] as List).cast<Map<String, dynamic>>()) d['date'] as String};
    if (days.isEmpty) return;
    final shown = (data['intraday'] as Map)['date'] as String? ?? days.last;
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.parse(shown),
      firstDate: DateTime.parse(days.first),
      lastDate: DateTime.parse(days.last),
      selectableDayPredicate: (d) => days.contains(d.toIso8601String().substring(0, 10)),
      helpText: '장중 그래프를 볼 날짜',
    );
    if (picked == null || !mounted) return;
    setState(() {
      _daily = false;
      _touched = null;
      _data = _load(picked.toIso8601String().substring(0, 10));
    });
  }

  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
          child: FutureBuilder(
            future: _data,
            builder: (context, snapshot) {
              final data = snapshot.data;
              final day = (data?['intraday'] as Map?)?['date'] as String?;
              return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  const Text('총자산 흐름', style: TextStyle(fontWeight: FontWeight.bold)),
                  const Spacer(),
                  for (final (label, daily) in [(day == null ? '장중' : '${monthDay(day)} 장중', false), ('날짜별', true)])
                    Padding(
                      padding: const EdgeInsets.only(left: 6),
                      child: ChoiceChip(
                        label: Text(label, style: const TextStyle(fontSize: 12)),
                        visualDensity: VisualDensity.compact,
                        selected: _daily == daily,
                        onSelected: (_) => setState(() { _daily = daily; _touched = null; }),
                      ),
                    ),
                  IconButton(
                    tooltip: '날짜 고르기',
                    visualDensity: VisualDensity.compact,
                    icon: const Icon(Icons.calendar_month_outlined, size: 20),
                    onPressed: data == null ? null : () => _pickDay(data),
                  ),
                ]),
                const SizedBox(height: 8),
                if (snapshot.hasError)
                  const Text('기록을 불러오지 못했어요', style: TextStyle(color: mutedText))
                else if (data == null)
                  const SizedBox(height: 140, child: Center(child: CircularProgressIndicator()))
                else ...[
                  _chart(equitySeries(data, daily: _daily)),
                  if (_daily) _table(data),
                ],
              ]);
            },
          ),
        ),
      );

  Widget _chart(List<(String, int)> series) {
    if (series.length < 2) {
      return const SizedBox(
        height: 80,
        child: Center(child: Text('기록이 두 개 이상 쌓이면 그래프가 보여요', style: TextStyle(color: mutedText))),
      );
    }
    final first = series.first.$2, last = series.last.$2;
    final color = changeColor(last - first) ?? brandBlue;
    final touched = _touched == null ? null : series[_touched!.clamp(0, series.length - 1)];
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(
          touched == null
              ? '${series.first.$1} 대비 ${signedWon(last - first)} (${rateText(last - first, first)})'
              : '${touched.$1} · ${won(touched.$2)} (${series.first.$1} 대비 ${rateText(touched.$2 - first, first)})',
          style: TextStyle(
              fontSize: 13, fontWeight: FontWeight.bold, color: touched == null ? color : changeColor(touched.$2 - first) ?? brandBlue)),
      const SizedBox(height: 8),
      LayoutBuilder(builder: (context, box) {
        // 누른(마우스를 올린) x 위치에서 가장 가까운 점
        void touch(Offset at) => setState(() {
              _touched = (at.dx / box.maxWidth * (series.length - 1)).round().clamp(0, series.length - 1);
            });
        return MouseRegion(
          onHover: (e) => touch(e.localPosition),
          onExit: (_) => setState(() { _touched = null; }),
          child: GestureDetector(
            onTapDown: (d) => touch(d.localPosition),
            onHorizontalDragUpdate: (d) => touch(d.localPosition),
            child: SizedBox(
              height: 140,
              width: double.infinity,
              child: CustomPaint(painter: _Line([for (final (_, v) in series) v], color, touched: _touched)),
            ),
          ),
        );
      }),
      const SizedBox(height: 4),
      Row(children: [
        Text(series.first.$1, style: const TextStyle(fontSize: 11, color: mutedText)),
        const Spacer(),
        Text('${series.last.$1} · ${won(last)}', style: const TextStyle(fontSize: 11, color: mutedText)),
      ]),
    ]);
  }
}

/// 선 그래프: 첫 값 높이에 점선(기준선), 마지막 값에 점. 위아래 끝에 최고·최저 금액
class _Line extends CustomPainter {
  _Line(this.values, this.color, {this.touched});
  final List<int> values;
  final Color color;
  final int? touched; // 세로선과 점을 그릴 위치

  @override
  void paint(Canvas canvas, Size size) {
    final hi = values.reduce((a, b) => a > b ? a : b), lo = values.reduce((a, b) => a < b ? a : b);
    final span = hi == lo ? 1 : hi - lo;
    const top = 14.0, bottom = 14.0;
    Offset at(int i) => Offset(size.width * i / (values.length - 1),
        top + (size.height - top - bottom) * (hi - values[i]) / span);

    final base = at(0).dy;
    final dash = Paint()..color = mutedText.withValues(alpha: 0.4)..strokeWidth = 1;
    for (var x = 0.0; x < size.width; x += 8) {
      canvas.drawLine(Offset(x, base), Offset(x + 4, base), dash);
    }
    final path = Path()..moveTo(at(0).dx, at(0).dy);
    for (var i = 1; i < values.length; i++) {
      path.lineTo(at(i).dx, at(i).dy);
    }
    canvas.drawPath(path, Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..strokeJoin = StrokeJoin.round);
    canvas.drawCircle(at(values.length - 1), 4, Paint()..color = color);
    if (touched case final i? when i >= 0 && i < values.length) {
      canvas.drawLine(Offset(at(i).dx, 0), Offset(at(i).dx, size.height), Paint()..color = mutedText.withValues(alpha: 0.6));
      canvas.drawCircle(at(i), 5, Paint()..color = color);
      canvas.drawCircle(at(i), 2.5, Paint()..color = Colors.white);
    }
    for (final (value, y) in [(hi, 0.0), (lo, size.height - 12)]) {
      (TextPainter(text: TextSpan(text: won(value), style: const TextStyle(fontSize: 10, color: mutedText)),
              textDirection: TextDirection.ltr)
            ..layout())
          .paint(canvas, Offset(0, y));
    }
  }

  @override
  bool shouldRepaint(_Line old) => old.values != values || old.color != color || old.touched != touched;
}
