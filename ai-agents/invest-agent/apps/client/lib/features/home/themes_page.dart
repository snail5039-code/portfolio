// 종목 탭: 주제별(반도체, 2차전지 …) 분석 대상 종목. 주제는 직접 나눈 것이고 가격은 전 거래일 종가 (GET /api/themes).
// 맨 위 검색창에 이름·코드를 넣으면 주제와 상관없이 찾는다. 종목을 누르면 그 종목 대화방.

import 'package:flutter/material.dart';

import '../../api/api.dart';
import '../../common/common.dart';
import '../chat/chat_page.dart';
import '../chat/conversation.dart';
import 'equity_chart.dart';

/// 등락률 표시: +1.23% / -0.10% / 미확인
String changeText(num? pct) => pct == null ? '미확인' : '${pct > 0 ? '+' : ''}${pct.toStringAsFixed(2)}%';

/// 검색: 이름(대소문자 무시) 또는 코드 앞자리가 맞는 종목. 주제 이름을 같이 붙인다
List<(String, Map<String, dynamic>)> searchThemes(List<Map<String, dynamic>> themes, String query) {
  final q = query.trim().toLowerCase();
  return [
    for (final t in themes)
      for (final s in (t['stocks'] as List).cast<Map<String, dynamic>>())
        if ((s['name'] as String).toLowerCase().contains(q) || (s['code'] as String).startsWith(q)) (t['theme'] as String, s),
  ];
}

class ThemesPage extends StatefulWidget {
  const ThemesPage({super.key});

  @override
  State<ThemesPage> createState() => _ThemesPageState();
}

class _ThemesPageState extends State<ThemesPage> {
  late Future<List<Map<String, dynamic>>> _themes = _load();
  int _picked = 0;
  String _query = '';

  Future<List<Map<String, dynamic>>> _load() async => (await api.get('/api/themes') as List).cast<Map<String, dynamic>>();

  Future<void> _openRoom(String code, String name) async {
    final room = Conversation(stockCode: code, stockName: name);
    try {
      await room.loadRoom();
    } on ApiError catch (error) {
      if (mounted) showError(context, error);
      return;
    }
    if (mounted) await Navigator.of(context).push(pageRoute(ChatPage(room)));
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: topBar('종목'),
        body: FutureBuilder(
          future: _themes,
          builder: (context, snapshot) {
            if (snapshot.hasError) return ErrorRetry(snapshot.error!, () => setState(() { _themes = _load(); }));
            final themes = snapshot.data;
            if (themes == null) return const Center(child: CircularProgressIndicator());
            if (themes.isEmpty) return const Center(child: Text('분석 대상 종목이 아직 없어요', style: TextStyle(color: mutedText)));
            final searching = _query.trim().isNotEmpty;
            final picked = themes[_picked.clamp(0, themes.length - 1)];
            final rows = searching
                ? searchThemes(themes, _query)
                : [for (final s in (picked['stocks'] as List).cast<Map<String, dynamic>>()) (picked['theme'] as String, s)];
            final stocks = [for (final (_, s) in rows) s];
            final day = stocks.map((s) => s['trade_date'] as String?).whereType<String>().fold<String?>(
                null, (a, b) => a == null || b.compareTo(a) > 0 ? b : a);
            return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 4, 14, 8),
                child: TextField(
                  decoration: InputDecoration(
                    hintText: '종목 이름 또는 코드',
                    prefixIcon: const Icon(Icons.search),
                    isDense: true,
                    filled: true,
                    fillColor: softGray,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide.none),
                  ),
                  onChanged: (text) => setState(() => _query = text),
                ),
              ),
              if (!searching) SizedBox(
                height: 48,
                child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 12), children: [
                  for (final (i, theme) in themes.indexed)
                    Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: ChoiceChip(
                        label: Text('${theme['theme']} ${(theme['stocks'] as List).length}'),
                        selected: i == _picked,
                        onSelected: (_) => setState(() => _picked = i),
                      ),
                    ),
                ]),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 2, 16, 6),
                child: SourceText('주제는 직접 나눈 것 · 가격은 ${day == null ? '미확인' : '${monthDay(day)} 종가'}'
                    ' (금융위원회, 실시간 아님) · 전 거래일 대비'),
              ),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: () async {
                    final next = _load();
                    setState(() { _themes = next; });
                    await next;
                  },
                  child: ListView(children: [
                    if (searching && rows.isEmpty)
                      const Padding(
                        padding: EdgeInsets.all(24),
                        child: Center(child: Text('분석 대상 150종목 중에 없어요', style: TextStyle(color: mutedText))),
                      ),
                    for (final (theme, s) in rows)
                      ListTile(
                        title: Text(s['name'] as String, style: const TextStyle(fontWeight: FontWeight.bold)),
                        subtitle: Text('${s['market'] == 'KOSDAQ' ? '코스닥' : '코스피'} · ${s['code']}${searching ? ' · $theme' : ''}'),
                        trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
                          Text(s['close'] == null ? '미확인' : '${comma(s['close'] as int)}원', style: const TextStyle(fontWeight: FontWeight.bold)),
                          Text(changeText(s['change_pct'] as num?),
                              style: TextStyle(fontSize: 12, color: changeColor((s['change_pct'] as num?) ?? 0) ?? mutedText)),
                        ]),
                        onTap: () => _openRoom(s['code'] as String, s['name'] as String),
                      ),
                  ]),
                ),
              ),
            ]);
          },
        ),
      );
}
