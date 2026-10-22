import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

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

/// 앱을 열 때 갈 곳. 서버에 연결하지 못하면 로그인 화면이 아니라 다시 시도 화면
/// (2026-10-20: 서버가 꺼져 있었는데 로그인 화면이 떠서 로그인이 풀린 줄 알았다. 토큰은 그대로였다)
enum StartState { home, login, offline }

/// 토큰 확인 결과 → 갈 곳. 401만 로그인 화면 (토큰은 api가 지운다), 연결 실패·서버 오류는 다시 시도
StartState startStateFor({required bool hasToken, ApiError? error}) =>
    !hasToken ? StartState.login : error == null ? StartState.home : error.status == 401 ? StartState.login : StartState.offline;

class InvestApp extends StatelessWidget {
  const InvestApp({super.key});

  @override
  Widget build(BuildContext context) {
    api.onLoggedOut = () => navigatorKey.currentState
        ?.pushAndRemoveUntil(pageRoute(const LoginPage()), (_) => false);
    return MaterialApp(
      title: '투자 에이전트',
      navigatorKey: navigatorKey,
      theme: appTheme(),
      // 기록 탭 달력 등 기본 화면 글자를 한국어로
      locale: const Locale('ko'),
      supportedLocales: const [Locale('ko')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      home: const _Start(),
    );
  }
}

class _Start extends StatefulWidget {
  const _Start();

  @override
  State<_Start> createState() => _StartState();
}

class _StartState extends State<_Start> {
  late Future<StartState> _state = _check();
  Timer? _retry;

  Future<StartState> _check() async {
    if (!await api.loadToken()) return StartState.login;
    try {
      await refreshProfileMode();
      return StartState.home;
    } on ApiError catch (error) {
      final state = startStateFor(hasToken: true, error: error);
      if (state == StartState.offline) _retry = Timer(const Duration(seconds: 10), _again); // 서버가 켜지면 저절로 들어간다
      return state;
    }
  }

  void _again() {
    _retry?.cancel();
    if (mounted) setState(() { _state = _check(); });
  }

  @override
  void dispose() {
    _retry?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => FutureBuilder(
        future: _state,
        builder: (context, snapshot) => switch (snapshot.data) {
          null => const Scaffold(body: Center(child: CircularProgressIndicator())),
          StartState.home => const MainShell(),
          StartState.login => readable(const LoginPage()),
          StartState.offline => Scaffold(
              body: Center(
                child: Padding(
                  padding: const EdgeInsets.all(32),
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    const Icon(Icons.cloud_off, size: 48, color: mutedText),
                    const SizedBox(height: 12),
                    const Text('서버에 연결할 수 없어요', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
                    const SizedBox(height: 4),
                    const Text('로그인은 그대로예요. 서버가 켜지면 10초마다 다시 연결해요', textAlign: TextAlign.center,
                        style: TextStyle(color: mutedText)),
                    const SizedBox(height: 16),
                    FilledButton(onPressed: _again, child: const Text('지금 다시 시도')),
                  ]),
                ),
              ),
            ),
        },
      );
}
