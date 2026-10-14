// 공통: 금액 표시, 색, 시각, 배지 (docs/plan/03-screens.md 3장 공통 규칙)

import 'package:flutter/material.dart';

import '../api/api.dart';
import '../broker/broker.dart';

/// 천 단위 콤마 (1250000 → 1,250,000)
String comma(num value) {
  final digits = value.round().abs().toString();
  final out = StringBuffer(value < 0 ? '-' : '');
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) out.write(',');
    out.write(digits[i]);
  }
  return out.toString();
}

String won(num value) => '${comma(value)}원';

// 디자인 H안 (메신저 + 링): 파랑은 대화, 주황은 코치·한도, 초록은 규칙 지킨 기록
const brandBlue = Color(0xFF1A8CD8);
const coachOrange = Color(0xFFFF5A1F);
const calmGreen = Color(0xFF1FB34A);
const upRed = Color(0xFFE5352B);
const downBlue = Color(0xFF1F5FD1);
const softGray = Color(0xFFF5F6F8);
const ink = Color(0xFF15181C);
const mutedText = Color(0xFF5F6770);
/// 제목·큰 숫자 글꼴 (굵기 하나뿐이라 fontWeight는 주지 않는다)
const displayFont = 'BlackHanSans';

ThemeData appTheme() {
  final pill = RoundedRectangleBorder(borderRadius: BorderRadius.circular(16));
  return ThemeData(
    colorSchemeSeed: brandBlue,
    scaffoldBackgroundColor: Colors.white,
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      titleTextStyle: TextStyle(fontFamily: displayFont, fontSize: 26, color: ink),
    ),
    cardTheme: CardThemeData(
      elevation: 0, color: softGray, margin: const EdgeInsets.symmetric(vertical: 6),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
    ),
    filledButtonTheme: FilledButtonThemeData(style: FilledButton.styleFrom(shape: pill, minimumSize: const Size(0, 48))),
    outlinedButtonTheme: OutlinedButtonThemeData(style: OutlinedButton.styleFrom(shape: pill, minimumSize: const Size(0, 48))),
    chipTheme: const ChipThemeData(shape: StadiumBorder(), side: BorderSide(color: Color(0xFFC9D7E3))),
    navigationBarTheme: const NavigationBarThemeData(backgroundColor: Colors.white, indicatorColor: Color(0xFFE3F1FC)),
    dividerTheme: const DividerThemeData(color: Color(0xFFEEF0F2)),
  );
}

/// 상승·이익 빨강, 하락·손실 파랑
Color? changeColor(num value) => value > 0 ? upRed : value < 0 ? downBlue : null;

/// 서버 시각(ISO) → 한국 시각 "10:32". 장 시간·만료가 한국 기준이라 기기 시간대와 상관없이 KST로 보여준다
String hhmm(String iso) {
  final t = toKst(DateTime.parse(iso));
  return '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';
}

/// 서버 시각(ISO) → 한국 시각 "10/14 10:32"
String ymdHm(String iso) {
  final t = toKst(DateTime.parse(iso));
  return '${t.month}/${t.day} ${hhmm(iso)}';
}

const verdictLabels = {'approve': '승인', 'conditional': '조건부 승인', 'reject': '반려', 'user_judgement': '사용자 판단 필요'};
const verdictColors = {
  'approve': Colors.green,
  'conditional': Colors.amber,
  'reject': Colors.red,
  'user_judgement': Colors.grey,
};
const sideLabels = {'buy': '매수', 'sell': '매도'};
const orderChangeLabels = {'cancel': '취소', 'modify': '정정'};
// 서버와 같은 말을 쓴다 (apps/api/app/agents/analysis.py ACTION_LABELS의 '관찰'). 매수·매도는 직접 지시 주문도 있어 '검토'를 붙이지 않는다
const actionLabels = {'buy': '매수', 'sell': '매도', 'hold': '보유', 'watch': '관찰'};
// 주문 상태 (orders.status). 처리안 목록·기록·장 마감 요약이 같이 쓴다
const orderLabels = {
  'accepted': '접수 (체결 전)', 'filled': '체결', 'partially_filled': '일부 체결', 'failed': '실패', 'unknown_checked': '확인 필요',
};

/// 성향 모드. 일반 모드면 모든 화면 위에 배지를 띄운다. 로그인·퀴즈·설정에서 갱신한다
final profileMode = ValueNotifier<String>('general');

Future<void> refreshProfileMode() async {
  final profile = await api.get('/api/profile');
  profileMode.value = profile['mode'] as String;
}

class Tag extends StatelessWidget {
  const Tag(this.label, this.color, {super.key});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(999)),
        child: Text(label, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.bold)),
      );
}

/// 모든 화면 맨 위: 모의투자 배지(MVP는 항상 모의) + 일반 모드 배지. avatar·subtitle은 대화방 머리글
AppBar topBar(String title, {List<Widget> actions = const [], Widget? avatar, String? subtitle}) => AppBar(
      titleSpacing: avatar == null ? null : 0,
      title: avatar == null
          ? Text(title)
          : Row(children: [
              avatar,
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(title, overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: ink)),
                  if (subtitle != null)
                    Text(subtitle, overflow: TextOverflow.ellipsis, // 제목 글꼴을 물려받지 않게
                        style: const TextStyle(inherit: false, fontSize: 12, color: brandBlue)),
                ]),
              ),
            ]),
      actions: [
        ValueListenableBuilder(
          valueListenable: profileMode,
          builder: (_, mode, _) => mode == 'general' ? const Tag('일반 모드', Colors.blueGrey) : const SizedBox(),
        ),
        const SizedBox(width: 6),
        ValueListenableBuilder(
          valueListenable: realMode,
          builder: (_, real, _) => real ? const Tag('실전투자', Color(0xFFC62828)) : const Tag('모의투자', Color(0xFFB07800)),
        ),
        const SizedBox(width: 8),
        ...actions,
      ],
    );

/// 출처·기준 시각 ("가짜 증권사 · 10:32 기준")
class SourceText extends StatelessWidget {
  const SourceText(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) =>
      Text(text, style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.outline));
}

void showError(BuildContext context, Object error) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
}

/// 실패를 정직하게 보여주고 다시 시도 버튼을 둔다 (가짜 숫자 없이)
class ErrorRetry extends StatelessWidget {
  const ErrorRetry(this.error, this.onRetry, {super.key});
  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(error.toString(), textAlign: TextAlign.center),
          const SizedBox(height: 8),
          OutlinedButton(onPressed: onRetry, child: const Text('다시 시도')),
        ]),
      );
}

/// PC 웹처럼 넓은 화면 (왼쪽 메뉴 + 오른쪽 상세 패널을 쓴다)
bool isWide(BuildContext context) => MediaQuery.sizeOf(context).width >= 900;

/// 넓은 화면에서 글이 옆으로 너무 늘어나지 않게 가운데 읽기 좋은 폭으로 둔다. 폰에서는 그대로
Widget readable(Widget child) => Center(
      child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 820), child: child),
    );

/// 다음 화면으로 이동. 넓은 화면에서는 읽기 좋은 폭으로, full이면 화면 전체 (메뉴가 있는 메인 화면)
MaterialPageRoute<T> pageRoute<T>(Widget page, {bool full = false}) =>
    MaterialPageRoute<T>(builder: (_) => full ? page : readable(page));

/// 대화방 동그라미(둥근 네모) 아이콘: 글자 또는 아이콘
class RoomAvatar extends StatelessWidget {
  const RoomAvatar({super.key, this.text, this.icon, required this.color, this.foreground = Colors.white, this.size = 50});
  final String? text;
  final IconData? icon;
  final Color color;
  final Color foreground;
  final double size;

  @override
  Widget build(BuildContext context) => Container(
        width: size, height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(size * 0.36)),
        child: icon != null
            ? Icon(icon, color: foreground, size: size * 0.5)
            : Text(text ?? '', maxLines: 1, overflow: TextOverflow.clip,
                style: TextStyle(color: foreground, fontWeight: FontWeight.w900, fontSize: size * 0.3)),
      );
}

/// 안 읽은 개수 빨간 동그라미
class CountBadge extends StatelessWidget {
  const CountBadge(this.count, {super.key});
  final int count;

  @override
  Widget build(BuildContext context) => Container(
        constraints: const BoxConstraints(minWidth: 20),
        height: 20,
        padding: const EdgeInsets.symmetric(horizontal: 6),
        alignment: Alignment.center,
        decoration: BoxDecoration(color: upRed, borderRadius: BorderRadius.circular(999)),
        child: Text('$count', style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
      );
}

// ---------- AI 제안·검증 표시 (2026-10-12: 근거·위험·조건을 읽기 쉽게) ----------

const claimLabels = {'fact': '사실', 'calc': '계산', 'inference': '추론', 'opinion': '의견'};
// 색은 한글 이름으로 찾는다 (브리핑은 유형을 이미 한글로 준다)
const _claimColors = {'사실': Color(0xFF137A33), '계산': brandBlue, '추론': Color(0xFF7A4FD8), '의견': mutedText};

/// 출처 제목을 짧게: "기사 제목 (연합뉴스)" → "연합뉴스", "OpenDART 주요 재무 (2026년 반기보고서, 연결)" → "OpenDART 주요 재무"
String shortSource(String title) {
  final paren = RegExp(r'\(([^()]+)\)$').firstMatch(title.trim());
  if (paren != null && !RegExp(r'\d|보고서|연결|별도').hasMatch(paren.group(1)!)) return paren.group(1)!;
  final head = title.split(RegExp(r' \(| · ')).first.trim();
  return head.length > 22 ? '${head.substring(0, 22)}…' : head;
}

/// 근거 한 줄: [사실] 배지 + 문장(maxLines까지) + 아래에 짧은 출처
class ClaimLine extends StatelessWidget {
  const ClaimLine(this.claim, {super.key, this.maxLines});
  final Map<String, dynamic> claim;
  final int? maxLines;

  @override
  Widget build(BuildContext context) {
    final label = claimLabels['${claim['type']}'] ?? '${claim['type']}';
    final sources = {for (final s in (claim['sources'] as List? ?? [])) shortSource('$s')};
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          margin: const EdgeInsets.only(top: 2, right: 8),
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
          decoration: BoxDecoration(color: (_claimColors[label] ?? mutedText).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(4)),
          child: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: _claimColors[label] ?? mutedText)),
        ),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${claim['text']}', maxLines: maxLines, overflow: maxLines == null ? null : TextOverflow.ellipsis,
                style: const TextStyle(height: 1.35)),
            if (sources.isNotEmpty) Text(sources.join(' · '), style: const TextStyle(fontSize: 12, color: mutedText)),
          ]),
        ),
      ]),
    );
  }
}

/// 위험·조건·반대 근거 같은 목록을 색 박스로 묶는다
class NoteBox extends StatelessWidget {
  const NoteBox(this.title, this.items, {super.key, required this.color, required this.icon, this.maxLines});
  final String title;
  final List<String> items;
  final Color color;
  final IconData icon;
  final int? maxLines;

  static NoteBox risks(List<String> items, {int? maxLines}) =>
      NoteBox('위험', items, color: downBlue, icon: Icons.warning_amber_rounded, maxLines: maxLines);
  static NoteBox conditions(List<String> items, {int? maxLines}) =>
      NoteBox('검증 조건', items, color: const Color(0xFF8A5A00), icon: Icons.rule, maxLines: maxLines);
  static NoteBox counters(List<String> items, {int? maxLines}) =>
      NoteBox('반대 근거', items, color: coachOrange, icon: Icons.compare_arrows, maxLines: maxLines);

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: 6),
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.07), borderRadius: BorderRadius.circular(10)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 6),
          Text(title, style: TextStyle(fontWeight: FontWeight.bold, color: color, fontSize: 13)),
        ]),
        const SizedBox(height: 4),
        for (final item in items)
          Padding(
            padding: const EdgeInsets.only(bottom: 3),
            child: Text('• $item', maxLines: maxLines, overflow: maxLines == null ? null : TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 14, height: 1.35)),
          ),
      ]),
    );
  }
}

/// 검증 AI 한 줄 결론 (카드 맨 위)
class VerdictSummary extends StatelessWidget {
  const VerdictSummary(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        margin: const EdgeInsets.symmetric(vertical: 8),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(color: const Color(0xFFF1F3F5), borderRadius: BorderRadius.circular(10)),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Icon(Icons.verified_user_outlined, size: 16, color: mutedText),
          const SizedBox(width: 6),
          Expanded(child: Text(text, style: const TextStyle(fontSize: 13, height: 1.35))),
        ]),
      );
}
