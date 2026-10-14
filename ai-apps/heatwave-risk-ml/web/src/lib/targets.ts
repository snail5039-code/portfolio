export type Target = "전체 연령" | "65세 이상";

export const TARGET_SLUGS: Record<Target, "all-ages" | "elderly"> = {
  "전체 연령": "all-ages",
  "65세 이상": "elderly",
};

export function isTarget(value: string): value is Target {
  return value === "전체 연령" || value === "65세 이상";
}
