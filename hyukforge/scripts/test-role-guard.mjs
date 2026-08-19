/**
 * 권한 자가 승격이 막히는지 실제로 시도해본다.
 *
 * 20260818000001 에서 protect_profile_role 에 service_role 예외를 넣었으므로,
 * 일반 로그인 사용자가 여전히 막히는지 확인해야 한다.
 *
 * 시험용 계정을 만들고 → 로그인해서 토큰을 받고 → 스스로 admin 을 시도하고 →
 * 결과를 확인하고 → 계정을 지운다.
 */

import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SVC = env.SUPABASE_SERVICE_ROLE_KEY;

const svcH = { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json" };

const email = "role-guard-test@example.com";
const password = "TestOnly-" + "a1b2c3d4e5";
let userId = null;
let failed = false;

const ok = (cond, label, detail = "") => {
  if (!cond) failed = true;
  console.log(`  ${cond ? "✓" : "✗"} ${label}${detail ? `  ${detail}` : ""}`);
};

try {
  // 1. 시험용 계정 생성
  const created = await fetch(`${URL_}/auth/v1/admin/users`, {
    method: "POST",
    headers: svcH,
    body: JSON.stringify({ email, password, email_confirm: true }),
  }).then((r) => r.json());

  if (!created.id) {
    console.error("시험용 계정을 만들지 못했습니다:", created);
    process.exit(1);
  }
  userId = created.id;
  console.log(`시험용 계정 생성 ${email}\n`);

  // 2. 로그인해서 사용자 토큰 받기
  const signIn = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  }).then((r) => r.json());

  const token = signIn.access_token;
  ok(!!token, "일반 사용자로 로그인", token ? "" : JSON.stringify(signIn).slice(0, 80));
  if (!token) throw new Error("stop");

  const userH = { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // 3. 본인 프로필이 보이는지 (RLS 확인)
  const mine = await fetch(`${URL_}/rest/v1/profiles?select=id,role`, { headers: userH }).then((r) => r.json());
  ok(Array.isArray(mine) && mine.length === 1, "본인 프로필만 조회됨", `${mine.length ?? "?"}행`);
  ok(mine[0]?.role === "user", "시작 role 은 user", `role=${mine[0]?.role}`);

  // 4. 스스로 admin 으로 올려보기 — 막혀야 한다
  const attempt = await fetch(`${URL_}/rest/v1/profiles?id=eq.${userId}`, {
    method: "PATCH",
    headers: { ...userH, Prefer: "return=representation" },
    body: JSON.stringify({ role: "admin" }),
  });
  const after = await attempt.json();
  const roleAfter = Array.isArray(after) ? after[0]?.role : undefined;

  ok(roleAfter !== "admin", "자가 승격 차단됨", `HTTP ${attempt.status} · role=${roleAfter ?? "(응답없음)"}`);

  // 5. 서버에서 다시 읽어 확인 (응답만 믿지 않는다)
  const reread = await fetch(`${URL_}/rest/v1/profiles?id=eq.${userId}&select=role`, { headers: svcH }).then((r) => r.json());
  ok(reread[0]?.role === "user", "DB에 저장된 값도 user", `role=${reread[0]?.role}`);

  // 6. 다른 사람 프로필을 건드릴 수 있는지
  const others = await fetch(`${URL_}/rest/v1/profiles?id=neq.${userId}&select=id`, { headers: userH }).then((r) => r.json());
  ok(Array.isArray(others) && others.length === 0, "남의 프로필은 보이지 않음", `${others.length ?? "?"}행`);
} finally {
  // 7. 정리
  if (userId) {
    const del = await fetch(`${URL_}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: svcH });
    console.log(`\n시험용 계정 삭제 HTTP ${del.status}`);
  }
}

console.log(failed ? "\n확인 실패" : "\n전부 통과 — 자가 승격은 막혀 있다");
process.exit(failed ? 1 : 0);
