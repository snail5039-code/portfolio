import type { Tone } from "../types/dashboard";

const toneLabels: Record<Tone, string> = {
  neutral: "중립",
  info: "정보",
  success: "통과",
  warning: "주의",
  danger: "차단"
};

interface StatusPillProps {
  children: string;
  tone?: Tone;
}

export function StatusPill({ children, tone = "neutral" }: StatusPillProps) {
  return (
    <span className={`status-pill ${tone}`} aria-label={`${toneLabels[tone]}: ${children}`}>
      {children}
    </span>
  );
}
