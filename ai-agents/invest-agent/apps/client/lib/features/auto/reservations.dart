// 예약·조건부 주문(3-2)과 분할 주문(3-3). 서버는 조건만 저장하고, 앱이 장중 1분마다 조건(가격 도달·시각)을 확인한다.
// 조건이 되면 서버에 trigger(한 번만)를 알리고, 사람이 채팅에 말한 것과 같은 주문 흐름(투자 AI → 검증 AI → 정책 → 처리안)을 돌린다.
// 자동매매가 켜져 있고 오늘 계획을 승인했으면 자동매매와 같은 규칙으로 자동 승인, 아니면 처리안이 사람 승인을 기다린다 (알림도 감).

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../api/api.dart';
import '../../broker/broker.dart';
import '../../common/common.dart';
import 'auto_trader.dart';

/// 조건이 됐는지: split은 시각이 지났으면, price는 below면 현재가 ≤ 조건가, above면 현재가 ≥ 조건가
bool reservationDue(Map<String, dynamic> r, DateTime now, int? price) {
  if (r['kind'] == 'split') return !DateTime.parse(r['due_at'] as String).isAfter(now);
  if (price == null || price <= 0) return false;
  final trigger = r['trigger_price'] as int;
  return r['direction'] == 'below' ? price <= trigger : price >= trigger;
}

class ReservationWatcher {
  ReservationWatcher({DateTime Function()? now}) : _now = now ?? DateTime.now;
  final DateTime Function() _now;
  Timer? _timer;
  bool _busy = false;

  void start() {
    _timer ??= Timer.periodic(const Duration(minutes: 1), (_) => tick());
  }

  Future<void> tick() async {
    final broker = currentBroker.value;
    if (_busy || kIsWeb || broker == null) return;
    final k = toKst(_now());
    final minutes = k.hour * 60 + k.minute;
    if (k.weekday > 5 || minutes < 9 * 60 + 5 || minutes > 15 * 60 + 20) return; // 휴장일은 서버 정책 검사가 막는다
    _busy = true;
    try {
      final list = (await api.get('/api/reservations') as List).cast<Map<String, dynamic>>();
      final prices = <String, int?>{};
      for (final r in list) {
        final code = r['stock_code'] as String;
        if (r['kind'] == 'price' && !prices.containsKey(code)) {
          try {
            prices[code] = await broker.price(code);
          } catch (_) {
            prices[code] = null; // 현재가를 못 받으면 이번에는 넘어간다
          }
        }
        if (!reservationDue(r, _now(), prices[code])) continue;
        try {
          await api.post('/api/reservations/${r['id']}/trigger', {}); // 한 번만. 이미 처리됐으면 409
        } on ApiError {
          continue;
        }
        await autoTrader.runOrder(r['stock_name'] as String, r['qty'] as int, r['side'] as String, why: '예약');
      }
    } catch (error) {
      debugPrint('예약 확인 실패: $error');
    } finally {
      _busy = false;
    }
  }
}

final reservationWatcher = ReservationWatcher();

class ReservationsPage extends StatefulWidget {
  const ReservationsPage({super.key});

  @override
  State<ReservationsPage> createState() => _ReservationsPageState();
}

class _ReservationsPageState extends State<ReservationsPage> {
  List<Map<String, dynamic>>? _items;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final items = (await api.get('/api/reservations') as List).cast<Map<String, dynamic>>();
      setState(() { _items = items; _error = null; });
    } on ApiError catch (error) {
      setState(() { _error = error; });
    }
  }

  Future<void> _cancel(Map<String, dynamic> r) async {
    try {
      await api.delete('/api/reservations/${r['id']}');
      await _load();
    } on ApiError catch (error) {
      if (mounted) showError(context, error);
    }
  }

  static String _condition(Map<String, dynamic> r) => r['kind'] == 'split'
      ? '${hhmm(r['due_at'] as String)}에 (분할 주문)'
      : '현재가가 ${won(r['trigger_price'] as int)} ${r['direction'] == 'below' ? '이하로 내려오면' : '이상으로 오르면'}';

  @override
  Widget build(BuildContext context) {
    final items = _items;
    return Scaffold(
      appBar: topBar('예약 주문'),
      body: _error != null
          ? ErrorRetry(_error!, _load)
          : items == null
              ? const Center(child: CircularProgressIndicator())
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(padding: const EdgeInsets.symmetric(vertical: 8), children: [
                    const Padding(
                      padding: EdgeInsets.fromLTRB(16, 4, 16, 8),
                      child: SourceText('채팅에서 "현대건설 5주 10만원 되면 사줘", "10주 3번에 나눠 사줘"처럼 예약해요. '
                          '장중(평일 09:05~15:20) 앱이 켜져 있으면 1분마다 확인하고, 조건이 되면 투자 AI → 검증 AI → 한도 검사를 거쳐 처리안을 만들어요. '
                          '자동매매가 켜져 있고 오늘 계획을 승인했으면 자동으로 승인하고, 아니면 처리안 모아보기에서 직접 승인해요.'),
                    ),
                    if (items.isEmpty) const Padding(padding: EdgeInsets.all(16), child: Text('기다리는 예약이 없어요', style: TextStyle(color: mutedText))),
                    for (final r in items)
                      ListTile(
                        title: Text('${r['stock_name']} ${comma(r['qty'] as int)}주 ${sideLabels[r['side']]}'),
                        subtitle: Text(_condition(r)),
                        trailing: TextButton(onPressed: () => _cancel(r), child: const Text('취소')),
                      ),
                  ]),
                ),
    );
  }
}
