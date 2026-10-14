// 서버 API 호출 (docs/plan/06-api-spec.md).
// 로그인 토큰은 기기 보안 저장소에 둔다. 증권사 키는 이 파일과 상관없고 서버로 보내지 않는다.

import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

// 빌드할 때 --dart-define=API_URL=... 로 바꾼다. 에뮬레이터에서 10.0.2.2는 내 PC(localhost)다
const apiBase = String.fromEnvironment(
  'API_URL',
  defaultValue: kIsWeb ? 'http://localhost:8000' : 'http://10.0.2.2:8000',
);
// 서버에 알리는 "지금 답하는 쪽". 증권사 조회·주문 실행은 app만 할 수 있다
const clientKind = kIsWeb ? 'web' : 'app';

class ApiError implements Exception {
  ApiError(this.status, this.message);
  final int status; // 0이면 서버에 연결하지 못함
  final String message;

  @override
  String toString() => message;
}

/// 대화 API가 흘려보내는 이벤트 하나 (progress / interrupt / message / error / done)
class SseEvent {
  SseEvent(this.event, this.data);
  final String event;
  final Map<String, dynamic> data;
}

/// 이벤트 스트림(SSE) 줄을 이벤트로 묶는다. 빈 줄이 이벤트 하나의 끝이다.
Stream<SseEvent> parseSse(Stream<String> lines) async* {
  String? event;
  final data = StringBuffer();
  await for (final line in lines) {
    if (line.isEmpty) {
      if (event != null) yield SseEvent(event, jsonDecode(data.toString()) as Map<String, dynamic>);
      event = null;
      data.clear();
    } else if (line.startsWith('event:')) {
      event = line.substring(6).trim();
    } else if (line.startsWith('data:')) {
      data.write(line.substring(5).trim());
    }
  }
}

class Api {
  final _storage = const FlutterSecureStorage();
  final _http = http.Client();
  String? _token;

  /// 토큰이 만료되거나 폐기돼 401을 받으면 부른다 (로그인 화면으로)
  VoidCallback? onLoggedOut;

  Future<bool> loadToken() async {
    _token = await _storage.read(key: 'token');
    return _token != null;
  }

  Future<void> login(String email, String password) async {
    final result = await post('/api/auth/login', {'email': email, 'password': password});
    _token = result['token'] as String;
    await _storage.write(key: 'token', value: _token);
  }

  Future<void> logout() async {
    try {
      await post('/api/auth/logout');
    } on ApiError {
      // 서버가 이미 토큰을 지웠어도 이 기기에서는 로그아웃한다
    }
    await _clearToken();
  }

  Future<void> _clearToken() async {
    _token = null;
    await _storage.delete(key: 'token');
  }

  Future<dynamic> get(String path) => _send('GET', path);
  Future<dynamic> post(String path, [Object? body]) => _send('POST', path, body);
  Future<dynamic> put(String path, Object body) => _send('PUT', path, body);
  Future<dynamic> delete(String path, [Object? body]) => _send('DELETE', path, body);

  http.Request _request(String method, String path, Object? body) {
    final request = http.Request(method, Uri.parse('$apiBase$path'))
      ..headers['Content-Type'] = 'application/json';
    if (_token != null) request.headers['Authorization'] = 'Bearer $_token';
    if (body != null) request.body = jsonEncode(body);
    return request;
  }

  Future<http.StreamedResponse> _open(http.Request request) async {
    try {
      return await _http.send(request);
    } catch (_) {
      throw ApiError(0, '서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.');
    }
  }

  Future<dynamic> _send(String method, String path, [Object? body]) async {
    final response = await _open(_request(method, path, body));
    return _decode(response.statusCode, await response.stream.bytesToString());
  }

  dynamic _decode(int status, String text) {
    final data = text.isEmpty ? null : jsonDecode(text);
    if (status >= 400) {
      if (status == 401 && _token != null) {
        _clearToken();
        onLoggedOut?.call();
      }
      final detail = data is Map && data['detail'] is String ? data['detail'] as String : null;
      throw ApiError(status, detail ?? '요청이 실패했어요 ($status)');
    }
    return data;
  }

  /// 대화 API (POST /api/chat, /api/chat/resume): 진행 상황을 이벤트로 받는다
  Stream<SseEvent> stream(String path, Map<String, dynamic> body) async* {
    final response = await _open(_request('POST', path, body));
    if (response.statusCode >= 400) {
      _decode(response.statusCode, await response.stream.bytesToString()); // ApiError를 던진다
    }
    yield* parseSse(response.stream.transform(utf8.decoder).transform(const LineSplitter()));
  }
}

final api = Api();
