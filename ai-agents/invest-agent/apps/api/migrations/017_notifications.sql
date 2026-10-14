-- 2-1 폰 푸시 알림: 폰의 FCM 토큰과 보낼(보낸) 알림. Firebase를 연결하기 전에는 알림이 쌓이기만 하고 앱의 알림 목록에서 본다
CREATE TABLE devices (
    token      text PRIMARY KEY,
    user_id    uuid NOT NULL REFERENCES users ON DELETE CASCADE,
    platform   text NOT NULL CHECK (platform IN ('android', 'ios')),
    created_at timestamptz NOT NULL DEFAULT now(),
    seen_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON devices (user_id);

CREATE TABLE notifications (
    id         bigserial PRIMARY KEY,
    user_id    uuid NOT NULL REFERENCES users ON DELETE CASCADE,
    kind       text NOT NULL,
    title      text NOT NULL,
    body       text NOT NULL,
    data       jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    sent_at    timestamptz,          -- FCM으로 보낸 시각. Firebase가 없으면 NULL로 남는다
    error      text                  -- 보내기 실패 사유
);
CREATE INDEX ON notifications (user_id, created_at DESC);
