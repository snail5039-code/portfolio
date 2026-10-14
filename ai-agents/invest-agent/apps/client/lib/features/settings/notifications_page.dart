// 알림 (docs/plan/12-todo-by-stage.md 2-1): 폰 푸시 등록과 알림 목록.
// Firebase 설정(android/app/google-services.json)이 없으면 푸시는 꺼진 채로 두고, 서버에 쌓인 알림을 이 목록에서 본다.

import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../api/api.dart';
import '../../common/common.dart';

/// 로그인 뒤 한 번: Firebase가 설정돼 있으면 알림 권한을 묻고 이 폰의 토큰을 서버에 등록한다. 없으면 조용히 넘어간다
Future<void> registerPush() async {
  if (kIsWeb) return;
  try {
    await Firebase.initializeApp(); // google-services.json이 없으면 여기서 실패한다
    final messaging = FirebaseMessaging.instance;
    await messaging.requestPermission();
    Future<void> send(String token) =>
        api.put('/api/devices', {'token': token, 'platform': Platform.isIOS ? 'ios' : 'android'});
    final token = await messaging.getToken();
    if (token != null) await send(token);
    messaging.onTokenRefresh.listen(send);
  } catch (error) {
    debugPrint('푸시 알림 꺼짐 (Firebase 설정 전): $error');
  }
}

class NotificationsPage extends StatefulWidget {
  const NotificationsPage({super.key});

  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  List<Map<String, dynamic>>? _items;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final items = (await api.get('/api/notifications') as List).cast<Map<String, dynamic>>();
      setState(() { _items = items; _error = null; });
    } on ApiError catch (error) {
      setState(() { _error = error; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final items = _items;
    return Scaffold(
      appBar: topBar('알림'),
      body: _error != null
          ? ErrorRetry(_error!, _load)
          : items == null
              ? const Center(child: CircularProgressIndicator())
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(children: [
                    if (items.isEmpty) const Padding(padding: EdgeInsets.all(16), child: Text('아직 알림이 없어요', style: TextStyle(color: mutedText))),
                    for (final n in items)
                      ListTile(
                        title: Text(n['title'] as String, style: const TextStyle(fontWeight: FontWeight.bold)),
                        subtitle: Text('${n['body']}\n${hhmm(n['created_at'] as String)}'
                            '${n['pushed'] == true ? ' · 폰 알림 보냄' : ''}'),
                        isThreeLine: true,
                      ),
                  ]),
                ),
    );
  }
}
