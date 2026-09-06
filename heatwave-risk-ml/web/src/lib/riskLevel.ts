// model/risk_level.py와 동일한 규칙의 TypeScript 이식본.
// 프로젝트 데이터에 따른 상대적 등급이며 공식 위험 기준은 아니다.

export type RiskLevel = "낮음" | "보통" | "높음" | "매우 높음";

export function getAllAgeLevel(prediction: number): RiskLevel {
  if (prediction < 3) return "낮음";
  if (prediction < 9) return "보통";
  if (prediction < 30) return "높음";
  return "매우 높음";
}

export function getElderlyLevel(prediction: number): RiskLevel {
  if (prediction < 1) return "낮음";
  if (prediction < 3) return "보통";
  if (prediction < 8) return "높음";
  return "매우 높음";
}

// 안내 근거: 질병관리청 온열질환 예방수칙 (12~17시 야외활동 자제)
// 시간대 겹침 계산은 프로젝트 구현이며, 체류시간별 의학적 위험도 계산이 아니다.
export function getOutdoorGuidance(
  target: "전체 연령" | "65세 이상",
  level: RiskLevel,
  startHour: number,
  durationMinutes: number,
): string[] {
  if (!Number.isFinite(startHour) || startHour < 0 || startHour >= 24) {
    throw new Error("시작 시각은 0 이상 24 미만이어야 합니다.");
  }
  if (!Number.isFinite(durationMinutes) || durationMinutes < 0 || durationMinutes > 1440) {
    throw new Error("야외 체류시간은 0~1440분 사이로 입력해 주세요.");
  }

  const guidance = [
    `${target} 예측 환자 수의 상대적 수준은 '${level}'입니다. 개인의 발병 확률이나 외출 안전 판정은 아닙니다.`,
  ];

  if (level === "높음" || level === "매우 높음") {
    guidance.push("과거 데이터 기준으로 예상 환자 수가 많은 구간입니다. 외출 전 지역의 실제 기온과 폭염특보를 확인해 주세요.");
  } else {
    guidance.push("예측 등급이 낮음 또는 보통이어도 더위에 주의해야 합니다. 외출 전 지역의 실제 기온과 폭염특보를 확인해 주세요.");
  }

  if (target === "65세 이상") {
    guidance.push("고령자는 더위에 취약할 수 있으므로 무리한 야외활동을 피하고, 가족이나 주변 사람과 건강 상태를 수시로 확인해 주세요.");
  }

  if (durationMinutes === 0) {
    guidance.push("예정된 야외 체류시간이 0분이므로 외출 시간대 안내는 생략합니다.");
    return guidance;
  }

  const startMinutes = startHour * 60;
  const endMinutes = startMinutes + durationMinutes;
  let overlapMinutes = 0;

  // 자정을 넘는 외출은 다음 날 12~17시도 확인 (최대 24시간 외출이므로 오늘/다음 날만 확인)
  for (const dayOffset of [0, 1440]) {
    const hotStart = dayOffset + 12 * 60;
    const hotEnd = dayOffset + 17 * 60;
    overlapMinutes += Math.max(0, Math.min(endMinutes, hotEnd) - Math.max(startMinutes, hotStart));
  }

  const formatMinutes = (value: number) => (Number.isInteger(value) ? String(value) : value.toString());

  if (overlapMinutes > 0) {
    guidance.push(
      `예정된 야외 체류 ${formatMinutes(durationMinutes)}분 중 ${formatMinutes(overlapMinutes)}분이 12~17시와 겹칩니다. 더운 날에는 이 시간대의 야외활동을 줄이거나 일정을 조정해 주세요.`,
    );
  } else {
    guidance.push("예정된 외출은 12~17시와 겹치지 않습니다. 다른 시간대에도 온열질환이 발생할 수 있으므로 더위에 주의해 주세요.");
  }

  guidance.push(`야외에 머무는 ${formatMinutes(durationMinutes)}분 동안 시원한 곳에서 주기적으로 쉬고, 무더운 날에는 체류시간을 줄여 주세요.`);

  return guidance;
}
