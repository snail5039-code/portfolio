/**
 * 화면 문구 번역 검사.
 *
 * ko.json을 기준으로 나머지 언어에 누락·잉여 키가 없는지 본다.
 * 제품 설명은 DB에 있고 폴백이 있지만, 버튼·라벨은 10개 언어 모두 채워야 한다.
 * (docs/PRD.md "언어" 절)
 *
 *   npm run i18n:check
 */

import { readdirSync, readFileSync } from "node:fs";
import { locales, defaultLocale } from "../i18n/routing.ts";

const DIR = "messages";

/** 중첩 객체를 "a.b.c" 형태의 평평한 키 목록으로 */
function flatten(obj, prefix = "") {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object"
      ? flatten(v, `${prefix}${k}.`)
      : [[`${prefix}${k}`, v]],
  );
}

function load(locale) {
  try {
    return Object.fromEntries(
      flatten(JSON.parse(readFileSync(`${DIR}/${locale}.json`, "utf8"))),
    );
  } catch (err) {
    return { __error: err.message };
  }
}

const base = load(defaultLocale);
const baseKeys = Object.keys(base);
let failed = false;

console.log(`기준 ${defaultLocale} · 키 ${baseKeys.length}개\n`);

for (const locale of locales) {
  const messages = load(locale);

  if (messages.__error) {
    console.log(`${locale.padEnd(6)} 읽기 실패 — ${messages.__error}`);
    failed = true;
    continue;
  }

  const keys = Object.keys(messages);
  const missing = baseKeys.filter((k) => !keys.includes(k));
  const blank = keys.filter((k) => String(messages[k]).trim() === "");
  const extra = keys.filter((k) => !baseKeys.includes(k));

  const problems = [
    missing.length && `누락 ${missing.length}: ${missing.join(", ")}`,
    blank.length && `비어 있음 ${blank.length}: ${blank.join(", ")}`,
    extra.length && `기준에 없는 키 ${extra.length}: ${extra.join(", ")}`,
  ].filter(Boolean);

  if (problems.length) {
    failed = true;
    console.log(`${locale.padEnd(6)} ✗`);
    for (const p of problems) console.log(`       ${p}`);
  } else {
    console.log(`${locale.padEnd(6)} ✓ ${keys.length}개`);
  }
}

// messages/ 에 있는데 routing.ts에 없는 파일 (지원 목록에서 빠진 언어)
const orphans = readdirSync(DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(".json", ""))
  .filter((l) => !locales.includes(l));

if (orphans.length) {
  failed = true;
  console.log(`\n지원 목록에 없는 파일: ${orphans.join(", ")}`);
  console.log("i18n/routing.ts의 locales에 추가하거나 파일을 지우세요.");
}

if (failed) {
  console.log("\n번역 검사 실패");
  process.exit(1);
}
console.log("\n번역 검사 통과");
