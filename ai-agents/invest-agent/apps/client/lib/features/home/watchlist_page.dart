// 관심 종목 고르기 (docs/plan/12-todo-by-stage.md 2-3). 별을 누르면 바로 넣고 뺀다.
// 관심 종목은 채팅 탭 동그라미와 아침 브리핑(소식·매수 후보)에 쓰인다.

import 'package:flutter/material.dart';

import '../../api/api.dart';
import '../../common/common.dart';

class WatchlistPage extends StatefulWidget {
  const WatchlistPage({super.key});

  @override
  State<WatchlistPage> createState() => _WatchlistPageState();
}

class _WatchlistPageState extends State<WatchlistPage> {
  List<Map<String, dynamic>>? _stocks;
  Object? _error;
  String _filter = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final stocks = (await api.get('/api/stocks') as List).cast<Map<String, dynamic>>();
      setState(() { _stocks = stocks; _error = null; });
    } on ApiError catch (error) {
      setState(() { _error = error; });
    }
  }

  Future<void> _toggle(Map<String, dynamic> stock) async {
    final watching = stock['watching'] == true;
    setState(() { stock['watching'] = !watching; }); // 먼저 바꾸고, 실패하면 되돌린다
    try {
      if (watching) {
        await api.delete('/api/watchlist/${stock['code']}');
      } else {
        await api.put('/api/watchlist/${stock['code']}', {});
      }
    } on ApiError catch (error) {
      setState(() { stock['watching'] = watching; });
      if (mounted) showError(context, error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final stocks = _stocks;
    return Scaffold(
      appBar: topBar('관심 종목'),
      body: _error != null
          ? ErrorRetry(_error!, _load)
          : stocks == null
              ? const Center(child: CircularProgressIndicator())
              : Column(children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
                    child: TextField(
                      decoration: InputDecoration(
                        hintText: '종목 이름 찾기',
                        prefixIcon: const Icon(Icons.search),
                        filled: true,
                        fillColor: softGray,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide.none),
                      ),
                      onChanged: (text) => setState(() { _filter = text.trim(); }),
                    ),
                  ),
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                    child: SourceText('지금은 분석 대상(코스피 시가총액 상위 100 · 코스닥 상위 50)만 고를 수 있어요'),
                  ),
                  Expanded(
                    child: ListView(children: [
                      for (final stock in stocks.where((s) => _filter.isEmpty || (s['name'] as String).contains(_filter)))
                        ListTile(
                          title: Text(stock['name'] as String, style: const TextStyle(fontWeight: FontWeight.bold)),
                          subtitle: Text('${stock['market'] == 'KOSDAQ' ? '코스닥' : '코스피'} · ${stock['code']}'),
                          trailing: Icon(stock['watching'] == true ? Icons.star : Icons.star_border,
                              color: stock['watching'] == true ? const Color(0xFFFFB020) : mutedText),
                          onTap: () => _toggle(stock),
                        ),
                    ]),
                  ),
                ]),
    );
  }
}
