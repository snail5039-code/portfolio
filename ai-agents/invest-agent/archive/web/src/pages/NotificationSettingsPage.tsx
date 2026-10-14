import { useState } from "react";
import { applyNotificationSettings, getNotificationSettings } from "../api/notificationSettings";
import { ApiError } from "../api/client";
import { AppShell } from "../components/AppShell";
import { renderFixtureFallback } from "../components/FixtureFallback";
import { useFixture } from "../lib/useFixture";
import type {
  NotificationChannel,
  NotificationChannelId,
  NotificationSettingsData,
  NotificationSeverity,
  NotificationType,
  NotificationTypeId,
  PageKey
} from "../types/dashboard";
import "./NotificationSettingsPage.css";

function severityLabel(severity: NotificationSeverity) {
  if (severity === "중대") return "중대만";
  if (severity === "보통") return "보통 포함";
  return "높음 이상";
}

function formatAppliedAt(appliedAt: string | null): string {
  if (!appliedAt) return "저장된 설정 없음 · 화면 기본값 표시 중";
  const time = new Date(appliedAt).toLocaleString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  return `저장됨 (${time}, 재시작해도 유지)`;
}

interface NotificationSettingsPageProps {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
}

export function NotificationSettingsPage({ activePage, onNavigate }: NotificationSettingsPageProps) {
  const state = useFixture<NotificationSettingsData>(() => getNotificationSettings(), "notification-settings");
  const [selectedChannelId, setSelectedChannelId] = useState<NotificationChannelId | null>(null);
  const [severity, setSeverity] = useState<NotificationSeverity | null>(null);
  const [types, setTypes] = useState<NotificationType[] | null>(null);
  const [channels, setChannels] = useState<NotificationChannel[] | null>(null);
  const [preview, setPreview] = useState({ title: "대기 중", body: "버튼을 누르면 화면 안에서만 예시 알림을 표시합니다." });
  // `undefined` means "not saved this page session — trust the server's own
  // appliedAt from the initial GET", same pattern as PolicySettingsPage.
  const [appliedAt, setAppliedAt] = useState<string | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fallback = renderFixtureFallback(state, "알림 설정");
  if (fallback) return fallback;

  const envelope = state.envelope;
  if (!envelope) return null;

  const defaultTypes = envelope.data.types;
  const defaultChannels = envelope.data.channels;
  const activeSeverity = severity ?? envelope.data.defaultSeverity;
  const activeTypes = types ?? defaultTypes;
  const activeChannels = channels ?? defaultChannels;
  const currentAppliedAt = appliedAt === undefined ? envelope.data.appliedAt : appliedAt;
  const selectedChannel = activeChannels.find((channel) => channel.id === selectedChannelId) ?? activeChannels[0];
  const activeTypeCount = activeTypes.filter((type) => type.enabled).length;
  const hasUnsavedChanges =
    (severity !== null && severity !== envelope.data.defaultSeverity) ||
    (types ?? []).some((type) => type.enabled !== defaultTypes.find((t) => t.id === type.id)?.enabled) ||
    (channels ?? []).some((channel) => channel.enabled !== defaultChannels.find((c) => c.id === channel.id)?.enabled);

  async function saveNotificationSettings() {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const channelsById = Object.fromEntries(activeChannels.map((channel) => [channel.id, channel.enabled])) as Record<
        NotificationChannelId,
        boolean
      >;
      const typesById = Object.fromEntries(activeTypes.map((type) => [type.id, type.enabled])) as Record<
        NotificationTypeId,
        boolean
      >;
      const result = await applyNotificationSettings({
        channels: channelsById,
        types: typesById,
        defaultSeverity: activeSeverity
      });
      setAppliedAt(result.data.appliedAt);
    } catch (err) {
      setSaveError(err instanceof ApiError ? `저장 실패: ${err.message}` : "설정 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  function toggleType(target: NotificationType) {
    setTypes((current) => (current ?? defaultTypes).map((type) => (type.id === target.id ? { ...type, enabled: !type.enabled } : type)));
  }

  function toggleChannel(target: NotificationChannel) {
    setChannels((current) =>
      (current ?? defaultChannels).map((channel) => (channel.id === target.id ? { ...channel, enabled: !channel.enabled } : channel))
    );
  }

  const main = (
    <section className="notification-main" aria-labelledby="notification-title">
      <header className="notification-summary">
        <div>
          <span className="eyebrow">수신 정책</span>
          <h1 id="notification-title">확인 알림만 화면에서 미리보기</h1>
          <p>리스크 이벤트가 생겼을 때 어떤 채널과 기준으로 보여줄지 정합니다.</p>
        </div>
        <div className="notification-summary-grid" aria-label="알림 설정 요약">
          <div><span>활성 채널</span><strong>{activeChannels.filter((channel) => channel.enabled).length}개</strong></div>
          <div><span>유형</span><strong>{activeTypeCount}개</strong></div>
          <div><span>심각도</span><strong>{severityLabel(activeSeverity)}</strong></div>
          <div><span>외부 발송</span><strong>0건</strong></div>
        </div>
      </header>

      <section className="settings-area">
        <div className="setting-block channels-block">
          <div className="setting-block-head"><h2>알림 채널</h2><span>활성화는 화면용 가상 표시 · 실제 권한 요청 없음</span></div>
          <div className="channel-list" role="listbox" aria-label="알림 채널">
            {activeChannels.map((channel) => (
              <button
                className={channel.id === (selectedChannelId ?? selectedChannel.id) ? "channel-card selected" : "channel-card"}
                data-state={channel.state}
                data-enabled={channel.enabled}
                key={channel.id}
                type="button"
                role="option"
                aria-selected={channel.id === (selectedChannelId ?? selectedChannel.id)}
                onClick={() => setSelectedChannelId(channel.id)}
              >
                <span className="channel-card-head">
                  <strong>{channel.name}</strong>
                  <span className={channel.enabled ? "channel-enabled-dot on" : "channel-enabled-dot"} aria-hidden="true" />
                </span>
                <span>{channel.state}</span>
                <small>{channel.summary}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="setting-block type-block">
          <div className="setting-block-head"><h2>알림 유형</h2><span>화면용 토글</span></div>
          <div className="type-list" aria-label="알림 유형">
            {activeTypes.map((type) => (
              <button className={type.enabled ? "type-toggle enabled" : "type-toggle"} key={type.id} type="button" aria-pressed={type.enabled} onClick={() => toggleType(type)}>
                <strong>{type.name}</strong>
                <span className="switch" aria-hidden="true" />
                <p>{type.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="setting-block rules-block">
          <div className="setting-block-head">
            <h2>수신 기준</h2>
            <span>{saving ? "저장하는 중..." : saveError ?? formatAppliedAt(currentAppliedAt)}</span>
          </div>
          <div className="rule-row">
            <span>심각도 기준</span>
            <div className="segments" role="group" aria-label="심각도 기준">
              {[
                ["중대", "중대만"],
                ["높음", "높음 이상"],
                ["보통", "보통 포함"]
              ].map(([value, label]) => (
                <button className={activeSeverity === value ? "selected" : ""} key={value} type="button" aria-pressed={activeSeverity === value} onClick={() => setSeverity(value as NotificationSeverity)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="quiet-row">
            <span>조용한 시간</span>
            <strong>22:00-08:00</strong>
            <small>이 시간에는 앱 내부 배지만 표시하는 예시입니다.</small>
          </div>
          <div className="notification-save-row">
            <button
              className="preview-button"
              type="button"
              onClick={() => setPreview({ title: "화면용 테스트 알림", body: "확인이 필요한 리스크 이벤트가 있습니다. 실제 발송·권한 요청·매수/매도 지시는 없습니다." })}
            >
              화면용 테스트 알림 미리보기
            </button>
            <button className="save-button" type="button" disabled={!hasUnsavedChanges || saving} onClick={saveNotificationSettings}>
              {saving ? "저장 중..." : "채널·유형·심각도 설정 저장"}
            </button>
          </div>
        </div>
      </section>
      <footer className="notification-disclaimer">{envelope.data.safetyCopy}</footer>
    </section>
  );

  const inspector = (
    <aside className="notification-inspector" aria-live="polite" aria-atomic="false">
      <div className="inspector-scroll">
        <header>
          <span className="eyebrow">설정 인스펙터</span>
          <div className="notification-inspector-title">
            <h2>{selectedChannel.name}</h2>
            <span>{selectedChannel.state}</span>
          </div>
          <p>{selectedChannel.summary}</p>
        </header>
        <section>
          <h3>현재 적용 예시</h3>
          <dl>
            <div><dt>채널 상태</dt><dd>{selectedChannel.state}</dd></div>
            <div>
              <dt>가상 활성화</dt>
              <dd>
                <button
                  className={selectedChannel.enabled ? "channel-toggle-button on" : "channel-toggle-button"}
                  type="button"
                  aria-pressed={selectedChannel.enabled}
                  onClick={() => toggleChannel(selectedChannel)}
                >
                  {selectedChannel.enabled ? "켜짐" : "꺼짐"}
                </button>
              </dd>
            </div>
            <div><dt>심각도 기준</dt><dd>{severityLabel(activeSeverity)}</dd></div>
            <div><dt>활성 유형</dt><dd>{activeTypeCount}개</dd></div>
          </dl>
        </section>
        <section>
          <h3>테스트 미리보기</h3>
          <div className="preview-card"><strong>{preview.title}</strong><p>{preview.body}</p></div>
        </section>
        <section>
          <h3>금지 경계</h3>
          <dl>
            <div><dt>실제 알림 발송</dt><dd>없음</dd></div>
            <div><dt>브라우저 권한 요청</dt><dd>없음</dd></div>
            <div><dt>이메일·메신저 연결</dt><dd>미연결</dd></div>
            <div><dt>매수·매도 지시</dt><dd>금지</dd></div>
          </dl>
        </section>
        <nav className="notification-related-links" aria-label="관련 화면">
          <h3>관련 화면</h3>
          <button type="button" onClick={() => onNavigate("risks")}>리스크 알림 보기<span>›</span></button>
          <button type="button" onClick={() => onNavigate("policy")}>투자 정책 보기<span>›</span></button>
          <button type="button" onClick={() => onNavigate("data")}>데이터 연결 보기<span>›</span></button>
        </nav>
      </div>
      <footer>{envelope.data.safetyCopy}</footer>
    </aside>
  );

  return <AppShell title="알림 설정" accountLabel="시뮬레이션 계좌" lastSync="화면용" activePage={activePage} onNavigate={onNavigate} main={main} inspector={inspector} />;
}
