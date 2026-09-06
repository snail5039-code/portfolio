import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// Vercel에는 process.env.KMA_API_KEY로 설정한다.
// 로컬 개발에서는 기존 Streamlit 설정(.streamlit/secrets.toml)도 그대로 지원한다.
export function loadKmaKey(): string {
  if (process.env.KMA_API_KEY) return process.env.KMA_API_KEY.trim();

  const secretsPath = path.resolve(process.cwd(), "..", ".streamlit", "secrets.toml");
  if (!existsSync(secretsPath)) return "";

  const match = readFileSync(secretsPath, "utf8").match(/KMA_API_KEY\s*=\s*"([^"]*)"/);
  return match?.[1]?.trim() ?? "";
}
