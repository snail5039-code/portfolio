import 'package:flutter/material.dart';

import 'api/api.dart';
import 'common/common.dart';
import 'features/auth/login_page.dart';
import 'features/home/main_shell.dart';
import 'features/settings/broker_page.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await loadBroker(); // 저장된 증권사 선택 (키는 폰 보안 저장소에만)
  runApp(const InvestApp());
}

final navigatorKey = GlobalKey<NavigatorState>();

class InvestApp extends StatelessWidget {
  const InvestApp({super.key});

  /// 저장된 토큰이 있고 아직 유효하면 바로 홈으로
  Future<bool> _loggedIn() async {
    if (!await api.loadToken()) return false;
    try {
      await refreshProfileMode();
      return true;
    } on ApiError {
      return false; // 만료(401)면 로그인 화면, 서버 연결 실패도 로그인 화면에서 다시 시도
    }
  }

  @override
  Widget build(BuildContext context) {
    api.onLoggedOut = () => navigatorKey.currentState
        ?.pushAndRemoveUntil(pageRoute(const LoginPage()), (_) => false);
    return MaterialApp(
      title: '투자 에이전트',
      navigatorKey: navigatorKey,
      theme: appTheme(),
      home: FutureBuilder(
        future: _loggedIn(),
        builder: (context, snapshot) => switch (snapshot.data) {
          null => const Scaffold(body: Center(child: CircularProgressIndicator())),
          true => const MainShell(),
          false => readable(const LoginPage()),
        },
      ),
    );
  }
}
