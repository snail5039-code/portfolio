// S-01 로그인, S-02 회원가입

import 'package:flutter/material.dart';

import '../../api/api.dart';
import '../../common/common.dart';
import '../home/main_shell.dart';
import 'quiz_page.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  String? _error;
  bool _busy = false;

  Future<void> _login() async {
    setState(() => _busy = true);
    try {
      await api.login(_email.text, _password.text);
      await refreshProfileMode();
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(pageRoute(const MainShell(), full: true), (_) => false);
    } on ApiError catch (error) {
      setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('로그인')),
        body: ListView(padding: const EdgeInsets.all(24), children: [
          TextField(controller: _email, decoration: const InputDecoration(labelText: '이메일'),
              keyboardType: TextInputType.emailAddress),
          TextField(controller: _password, decoration: const InputDecoration(labelText: '비밀번호'),
              obscureText: true, onSubmitted: (_) => _login()),
          if (_error != null) Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text(_error!, style: const TextStyle(color: Colors.red)),
          ),
          const SizedBox(height: 24),
          FilledButton(onPressed: _busy ? null : _login, child: const Text('로그인')),
          TextButton(
            onPressed: () => Navigator.of(context).push(pageRoute(const SignupPage())),
            child: const Text('회원가입'),
          ),
        ]),
      );
}

class SignupPage extends StatefulWidget {
  const SignupPage({super.key});

  @override
  State<SignupPage> createState() => _SignupPageState();
}

class _SignupPageState extends State<SignupPage> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _agreed = false;
  String? _error;
  bool _busy = false;

  Future<void> _signup() async {
    if (_password.text != _confirm.text) {
      setState(() => _error = '비밀번호가 서로 달라요');
      return;
    }
    setState(() => _busy = true);
    try {
      await api.post('/api/auth/signup', {'email': _email.text, 'password': _password.text, 'agreed_terms': _agreed});
      await api.login(_email.text, _password.text);
      profileMode.value = 'general';
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(pageRoute(const QuizOfferPage()), (_) => false);
    } on ApiError catch (error) {
      setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('회원가입')),
        body: ListView(padding: const EdgeInsets.all(24), children: [
          TextField(controller: _email, decoration: const InputDecoration(labelText: '이메일'),
              keyboardType: TextInputType.emailAddress),
          TextField(controller: _password, obscureText: true,
              decoration: const InputDecoration(labelText: '비밀번호', helperText: '8자 이상')),
          TextField(controller: _confirm, obscureText: true, decoration: const InputDecoration(labelText: '비밀번호 확인')),
          const SizedBox(height: 16),
          CheckboxListTile(
            value: _agreed,
            onChanged: (value) => setState(() => _agreed = value ?? false),
            controlAffinity: ListTileControlAffinity.leading,
            title: const Text('이용 안내에 동의해요'),
            subtitle: const Text('이 앱은 정보와 분석을 제공해요. 투자 판단과 그 결과의 책임은 나에게 있어요.'),
          ),
          if (_error != null) Text(_error!, style: const TextStyle(color: Colors.red)),
          const SizedBox(height: 24),
          FilledButton(onPressed: _busy || !_agreed ? null : _signup, child: const Text('가입하기')),
        ]),
      );
}

/// 가입 직후: 퀴즈 하기 또는 나중에(일반 모드)
class QuizOfferPage extends StatelessWidget {
  const QuizOfferPage({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: topBar('투자성향 퀴즈'),
        body: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Text('1분 퀴즈로 내게 맞는 한도를 정해요', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            const Text('8문항이에요. 퀴즈를 하지 않으면 일반 모드로 시작해요.\n'
                '일반 모드는 정보와 분석만 보여주고, 가장 낮은 한도(1회 30만 원)를 써요.'),
            const Spacer(),
            FilledButton(
              onPressed: () => Navigator.of(context).pushReplacement(pageRoute(const QuizPage())),
              child: const Text('퀴즈 하기'),
            ),
            TextButton(
              onPressed: () => Navigator.of(context).pushReplacement(pageRoute(const MainShell(), full: true)),
              child: const Text('나중에 (일반 모드로 시작)'),
            ),
          ]),
        ),
      );
}
