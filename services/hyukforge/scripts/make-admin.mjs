/**
 * 사용자를 관리자로 올린다.
 *
 * RLS가 쓰기에 is_admin() 을 요구하므로, 관리자 화면에 들어가려면
 * profiles.role 이 'admin' 이어야 한다. 그 값은 본인이 바꿀 수 없게
 * 트리거로 막아뒀기 때문에(20260817000002_rls.sql) 여기서 service_role 로 바꾼다.
 *
 *   node scripts/make-admin.mjs you@example.com
 *
 * 먼저 그 주소로 한 번 로그인해서 계정이 만들어져 있어야 한다.
 */

import { readFileSync } from "node:fs";

const email = process.argv[2];
if (!email) {
  console.error("사용법: node scripts/make-admin.mjs <이메일>");
  process.exit(1);
}

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
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) {
  console.error(".env.local 에 NEXT_PUBLIC_SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.");
  process.exit(1);
}

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

// 1. auth 사용자 찾기
const listed = await fetch(
  `${URL_}/auth/v1/admin/users?per_page=200`,
  { headers: H },
).then((r) => r.json());

const users = listed.users ?? [];
const user = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

if (!user) {
  console.error(`${email} 계정을 찾지 못했습니다.`);
  console.error("먼저 그 주소로 한 번 로그인해서 계정을 만들어 주세요.");
  if (users.length) {
    console.error(`\n등록된 계정 ${users.length}개:`);
    for (const u of users) console.error(`  ${u.email}`);
  }
  process.exit(1);
}

// 2. profiles.role 을 admin 으로
const res = await fetch(`${URL_}/rest/v1/profiles?id=eq.${user.id}`, {
  method: "PATCH",
  headers: { ...H, Prefer: "return=representation" },
  body: JSON.stringify({ role: "admin" }),
});

const body = await res.json();
if (!res.ok) {
  console.error(`실패 (HTTP ${res.status}):`, body);
  process.exit(1);
}
if (!body.length) {
  console.error("profiles 행이 없습니다. 가입 트리거가 동작했는지 확인하세요.");
  process.exit(1);
}

// 반환된 값을 반드시 확인한다.
// profiles_protect_role 트리거가 변경을 되돌려도 PATCH 자체는 200을 준다.
// 검증하지 않으면 "성공"을 찍고 실제로는 안 바뀐 채 넘어간다.
if (body[0].role !== "admin") {
  console.error(`실패 — role 이 여전히 '${body[0].role}' 입니다.`);
  console.error("profiles_protect_role 트리거가 변경을 되돌렸을 가능성이 큽니다.");
  console.error("supabase/migrations/20260818000001_fix_role_guard.sql 이 적용됐는지 확인하세요.");
  process.exit(1);
}

console.log(`${email} → 관리자로 변경했습니다. (role=${body[0].role})`);
