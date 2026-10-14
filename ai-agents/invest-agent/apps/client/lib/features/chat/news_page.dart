// 뉴스·공시 탭 (docs/plan/12-todo-by-stage.md 2-2, FR-40). 종목 대화방 위의 신문 버튼으로 연다.
// 뉴스는 제목·언론사·시각·원문 링크만 (본문 없음, AGENTS.md 5장). 같은 무렵 이 종목 공시가 있으면 함께 보여준다.
// ponytail: 링크는 길게 눌러 복사한다. 앱 안에서 바로 열기는 url_launcher를 넣을 때

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api/api.dart';
import '../../common/common.dart';

class NewsPage extends StatefulWidget {
  const NewsPage(this.stockCode, this.stockName, {super.key});
  final String stockCode;
  final String stockName;

  @override
  State<NewsPage> createState() => _NewsPageState();
}

class _NewsPageState extends State<NewsPage> {
  Map<String, dynamic>? _feed;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final feed = await api.get('/api/stocks/${widget.stockCode}/feed') as Map<String, dynamic>;
      setState(() { _feed = feed; _error = null; });
    } on ApiError catch (error) {
      setState(() { _error = error; });
    }
  }

  void _copy(String url) {
    Clipboard.setData(ClipboardData(text: url));
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('원문 링크를 복사했어요')));
  }

  Widget _item(String title, String sub, String url, {Widget? extra}) => ListTile(
        title: Text(title),
        subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(sub, style: const TextStyle(color: mutedText)),
          ?extra,
        ]),
        onLongPress: () => _copy(url),
        trailing: IconButton(tooltip: '원문 링크 복사', icon: const Icon(Icons.link), onPressed: () => _copy(url)),
      );

  @override
  Widget build(BuildContext context) {
    final feed = _feed;
    final news = ((feed?['news'] as List?) ?? []).cast<Map<String, dynamic>>();
    final disclosures = ((feed?['disclosures'] as List?) ?? []).cast<Map<String, dynamic>>();
    return Scaffold(
      appBar: topBar('${widget.stockName} 뉴스·공시'),
      body: _error != null
          ? ErrorRetry(_error!, _load)
          : feed == null
              ? const Center(child: CircularProgressIndicator())
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(padding: const EdgeInsets.symmetric(vertical: 8), children: [
                    const Padding(
                      padding: EdgeInsets.fromLTRB(16, 8, 16, 0),
                      child: SourceText('뉴스는 Google 뉴스에서 찾은 최근 3일 기사 제목이에요. 공시로 확인되지 않은 보도일 수 있어요. '
                          '같은 무렵 이 종목 공시가 있으면 함께 보여줘요 (내용이 같은지는 공시 원문으로 확인해 주세요).'),
                    ),
                    _header('뉴스'),
                    if (news.isEmpty) const Padding(padding: EdgeInsets.all(16), child: Text('최근 3일 뉴스가 없어요', style: TextStyle(color: mutedText))),
                    for (final n in news)
                      _item(n['title'] as String, '${n['press'] ?? '언론사 미확인'} · ${ymdHm(n['published_at'] as String)}', n['url'] as String,
                          extra: n['disclosure'] == null
                              ? const Text('공시로 확인되지 않은 보도', style: TextStyle(fontSize: 12, color: mutedText))
                              : Text('같은 무렵 공시: ${(n['disclosure'] as Map)['title']}',
                                  style: const TextStyle(fontSize: 12, color: brandBlue))),
                    _header('공시 (최근 30일, OpenDART)'),
                    if (disclosures.isEmpty) const Padding(padding: EdgeInsets.all(16), child: Text('최근 30일 공시가 없어요', style: TextStyle(color: mutedText))),
                    for (final d in disclosures) _item(d['title'] as String, '${d['filed_at']}', d['url'] as String),
                  ]),
                ),
    );
  }

  Widget _header(String text) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
        child: Text(text, style: TextStyle(fontFamily: displayFont, fontSize: 18)),
      );
}
