// 로그인 뒤 하단 탭 (디자인 H안): 채팅 / 자산 / 기록 / 더보기
// 대화는 채팅 탭의 "투자 비서" 방에서 연다 (폰은 새 화면, 넓은 화면은 목록 오른쪽).

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../common/common.dart';
import '../auto/auto_page.dart';
import '../auto/auto_trader.dart';
import '../auto/reservations.dart';
import '../chat/chat_page.dart';
import '../chat/conversation.dart';
import '../history/history_page.dart';
import '../settings/notifications_page.dart';
import '../settings/settings_page.dart';
import 'home_page.dart';
import 'rooms_page.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _tab = 0;
  final _conversation = Conversation(); // 탭을 바꿔도 대화가 남게 여기서 가진다

  @override
  void initState() {
    super.initState();
    if (!kIsWeb) autoTrader.load().then((_) => autoTrader.start()).then((_) => _askPlan()); // 모의투자 자동매매
    registerPush(); // 폰 푸시 알림 (Firebase 설정 전이면 조용히 넘어간다)
    if (!kIsWeb) reservationWatcher.start(); // 예약·분할 주문 조건 확인 (장중 1분마다)
  }

  /// 자동매매가 켜져 있는데 오늘 계획을 승인하지 않았으면 앱을 열 때 묻는다
  void _askPlan() {
    if (!mounted || !autoTrader.needsPlan) return;
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('오늘 자동매매 계획'),
        content: const Text('오늘 얼마를 사고 무엇을 팔지 승인해야 자동매매가 시작돼요.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(), child: const Text('나중에')),
          FilledButton(
            onPressed: () {
              Navigator.of(dialogContext).pop();
              Navigator.of(context).push(pageRoute(const AutoTradePage()));
            },
            child: const Text('계획 정하기'),
          ),
        ],
      ),
    );
  }

  /// 투자 비서 대화 열기. text가 있으면 바로 보낸다 (오늘 탭의 추천 질문)
  void _openChat([String? text]) {
    if (text != null) _conversation.send(text);
    if (isWide(context)) {
      setState(() => _tab = 0);
    } else {
      Navigator.of(context).push(pageRoute(ChatPage(_conversation), full: true));
    }
  }

  static const _menu = [
    (Icons.chat_bubble_outline, Icons.chat_bubble, '채팅'),
    (Icons.account_balance_wallet_outlined, Icons.account_balance_wallet, '자산'),
    (Icons.bar_chart_outlined, Icons.bar_chart, '기록'),
    (Icons.menu, Icons.menu, '더보기'),
  ];

  @override
  Widget build(BuildContext context) {
    final pages = IndexedStack(index: _tab, children: [
      // 채팅은 넓은 화면에서 목록 + 대화를 나란히 쓰므로 폭을 줄이지 않는다
      RoomsPage(conversation: _conversation, active: _tab == 0, onOpenChat: _openChat,
          onOpenToday: () => setState(() => _tab = 1), onAsk: _openChat),
      readable(HomePage(onAsk: _openChat, active: _tab == 1)),
      readable(HistoryPage(active: _tab == 2)),
      readable(const SettingsPage()),
    ]);
    void select(int index) => setState(() => _tab = index);

    if (isWide(context)) {
      // 넓은 화면(웹): 왼쪽 메뉴 + 본문
      return Scaffold(
        body: Row(children: [
          NavigationRail(
            selectedIndex: _tab,
            onDestinationSelected: select,
            labelType: NavigationRailLabelType.all,
            indicatorColor: const Color(0xFFE3F1FC),
            destinations: [
              for (final (icon, selected, label) in _menu)
                NavigationRailDestination(icon: Icon(icon), selectedIcon: Icon(selected, color: brandBlue), label: Text(label)),
            ],
          ),
          const VerticalDivider(width: 1),
          Expanded(child: pages),
        ]),
      );
    }
    return Scaffold(
      body: pages,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: select,
        destinations: [
          for (final (icon, selected, label) in _menu)
            NavigationDestination(icon: Icon(icon), selectedIcon: Icon(selected, color: brandBlue), label: label),
        ],
      ),
    );
  }
}
