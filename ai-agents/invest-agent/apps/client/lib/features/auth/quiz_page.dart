// S-03 투자성향 퀴즈 8문항. 문항과 규칙: docs/plan/09-investor-profile.md 3장
// 보기 키는 서버(PUT /api/profile)가 받는 값이고, 화면 문구는 앱이 가진다.

import 'package:flutter/material.dart';

import '../../api/api.dart';
import '../../common/common.dart';
import '../home/main_shell.dart';

typedef Question = ({String key, String group, String text, List<(String, String)> options});

const List<Question> questions = [
  (key: 'money_use', group: '투자 체력', text: '이 돈은 어떤 돈인가요?', options: [
    ('spare', '당분간 쓸 일 없는 여유자금'),
    ('within_3y', '3년 안에 쓸 돈'),
    ('living', '생활비'),
    ('borrowed', '빌린 돈'),
  ]),
  (key: 'emergency', group: '투자 체력', text: '급한 일이 생기면?', options: [
    ('fund', '비상금(3개월 생활비 이상)이 있어요'),
    ('no_fund_no_debt', '비상금은 없지만 빚도 없어요'),
    ('high_interest_debt', '고금리 빚(카드론·현금서비스 등)을 갚는 중이에요'),
  ]),
  (key: 'drop_reaction', group: '상황 고르기', text: '1,000만 원이 한 달 만에 700만 원이 됐어요. 어떻게 할까요?', options: [
    ('sell_all', '전부 판다'),
    ('sell_some', '일부 판다'),
    ('wait', '기다린다'),
    ('buy_more', '더 산다'),
  ]),
  (key: 'portfolio_choice', group: '상황 고르기',
      text: '하나를 고른다면? (2008년 금융위기 때 실제 "최악의 해" 손실)', options: [
    ('A', '원금 보장 · 손실 0%'),
    ('B', '채권 위주 · 약 −7%'),
    ('C', '주식 반, 채권 반 · 약 −20%'),
    ('D', '주식 100% · 약 −40%'),
  ]),
  (key: 'hot_tip', group: '상황 고르기', text: '어제 30% 오른 종목을 친구가 강하게 추천해요', options: [
    ('buy_big', '바로 많이 산다'),
    ('buy_small', '조금 산다'),
    ('research', '알아보고 정한다'),
    ('skip', '안 산다'),
  ]),
  (key: 'quiz_diversify', group: '지식 퀴즈',
      text: '한 종목에 1,000만 원 vs 다른 업종 10종목에 100만 원씩. 한 회사가 망하면 손실이 작은 쪽은?', options: [
    ('one_stock', '한 종목에 1,000만 원'),
    ('ten_stocks', '10종목에 100만 원씩'),
  ]),
  (key: 'quiz_trading_cost', group: '지식 퀴즈',
      text: '1년에 100번 사고판 사람과 1번 산 사람. 주가가 똑같이 움직였다면?', options: [
    ('frequent_earns_more', '100번 거래한 사람이 더 번다'),
    ('same', '같다'),
    ('frequent_earns_less', '100번 거래한 사람이 덜 번다'),
  ]),
];

const flagMessages = {
  'vulnerable': '65세 이상이라 손실 가능성과 불리한 점을 먼저 보여드려요.',
  'no_buy_proposals': '생활비나 빌린 돈이라 AI가 매수를 제안하지 않아요. 정보와 분석만 드려요.',
  'high_interest_debt': '고금리 빚이 있으면 빚을 먼저 갚는 것이 확실한 수익이라고 안내해요.',
  'chases_hot_stocks': '급등 직후 매수하면 한 번 더 확인해요.',
  'quiz_missed': '틀린 개념은 답변에서 짧게 설명해 드려요.',
};

class QuizPage extends StatefulWidget {
  const QuizPage({super.key});

  @override
  State<QuizPage> createState() => _QuizPageState();
}

class _QuizPageState extends State<QuizPage> {
  final _birthYear = TextEditingController();
  final _answers = <String, Object>{};
  bool _adultConfirmed = false;
  int _step = 0; // 0: 태어난 해, 1~7: 나머지 문항
  bool _busy = false;

  int? get _age {
    final year = int.tryParse(_birthYear.text);
    return year == null ? null : DateTime.now().year - year;
  }

  void _pick(String key, String value) {
    _answers[key] = value;
    if (_step < questions.length) {
      setState(() => _step++);
    } else {
      _submit();
    }
  }

  Future<void> _submit() async {
    setState(() => _busy = true);
    try {
      final result = await api.put('/api/profile', {
        'birth_year': int.parse(_birthYear.text),
        'adult_confirmed': _adultConfirmed,
        ..._answers,
      });
      profileMode.value = 'custom';
      if (!mounted) return;
      Navigator.of(context).pushReplacement(pageRoute(QuizResultPage(result)));
    } on ApiError catch (error) {
      if (mounted) showError(context, error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final total = questions.length + 1;
    return Scaffold(
      appBar: topBar('투자성향 퀴즈 ${_step + 1}/$total'),
      body: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        LinearProgressIndicator(value: (_step + 1) / total),
        Expanded(child: _step == 0 ? _birthYearStep() : _questionStep(questions[_step - 1])),
        if (_step > 0)
          TextButton(onPressed: _busy ? null : () => setState(() => _step--), child: const Text('이전 문항')),
      ]),
    );
  }

  Widget _birthYearStep() {
    final age = _age;
    final ok = age != null && age >= 19 && (age > 19 || _adultConfirmed);
    return ListView(padding: const EdgeInsets.all(24), children: [
      const Text('투자 체력', style: TextStyle(color: Colors.grey)),
      const Text('태어난 해는?', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
      TextField(
        controller: _birthYear,
        keyboardType: TextInputType.number,
        maxLength: 4,
        decoration: const InputDecoration(hintText: '예: 1990'),
        onChanged: (_) => setState(() {}),
      ),
      if (age == 19)
        CheckboxListTile(
          value: _adultConfirmed,
          onChanged: (value) => setState(() => _adultConfirmed = value ?? false),
          title: const Text('만 19세 이상입니다'),
        ),
      if (age != null && age < 19) const Text('만 19세 이상만 이용할 수 있어요', style: TextStyle(color: Colors.red)),
      const SizedBox(height: 16),
      FilledButton(onPressed: ok ? () => setState(() => _step = 1) : null, child: const Text('다음')),
    ]);
  }

  Widget _questionStep(Question q) => ListView(padding: const EdgeInsets.all(24), children: [
        Text(q.group, style: const TextStyle(color: Colors.grey)),
        Text(q.text, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
        const SizedBox(height: 16),
        for (final (value, label) in q.options)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: OutlinedButton(
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.all(16),
                backgroundColor: _answers[q.key] == value ? Colors.teal.withValues(alpha: 0.1) : null,
              ),
              onPressed: _busy ? null : () => _pick(q.key, value),
              child: Align(alignment: Alignment.centerLeft, child: Text(label)),
            ),
          ),
      ]);
}

class QuizResultPage extends StatelessWidget {
  const QuizResultPage(this.result, {super.key});
  final Map<String, dynamic> result;

  @override
  Widget build(BuildContext context) {
    final policy = result['policy'] as Map<String, dynamic>;
    return Scaffold(
      appBar: topBar('퀴즈 결과'),
      body: ListView(padding: const EdgeInsets.all(24), children: [
        Text('${result['label']} (${result['risk_level']}단계)',
            style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        Text('1회 주문 ${won(policy['max_order_krw'] as num)} · 1일 ${won(policy['max_daily_krw'] as num)}'
            ' · 한 종목 최대 ${policy['max_weight_pct']}%'),
        const SourceText('한도는 설정에서 바꿀 수 있어요. 결과는 24개월 동안 유효해요.'),
        for (final notice in (result['notices'] as List).cast<String>()) ...[
          const SizedBox(height: 12),
          Text('다시 확인해 주세요: $notice', style: const TextStyle(color: Colors.orange)),
        ],
        const Divider(height: 32),
        const Text('지식 퀴즈 해설', style: TextStyle(fontWeight: FontWeight.bold)),
        for (final item in (result['quiz_feedback'] as List).cast<Map<String, dynamic>>())
          ListTile(
            leading: Icon(item['correct'] == true ? Icons.check_circle : Icons.cancel,
                color: item['correct'] == true ? Colors.green : Colors.red),
            title: Text(item['explanation'] as String),
          ),
        for (final flag in (result['flags'] as List).cast<String>())
          if (flagMessages[flag] != null) ListTile(leading: const Icon(Icons.info_outline), title: Text(flagMessages[flag]!)),
        const SizedBox(height: 24),
        FilledButton(
          onPressed: () {
            final navigator = Navigator.of(context);
            if (navigator.canPop()) {
              navigator.popUntil((route) => route.isFirst); // 설정에서 다시 한 경우
            } else {
              navigator.pushReplacement(pageRoute(const MainShell(), full: true));
            }
          },
          child: const Text('확인'),
        ),
      ]),
    );
  }
}
