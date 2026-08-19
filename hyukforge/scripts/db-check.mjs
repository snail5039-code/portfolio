/**
 * 원격 DB가 마이그레이션대로 올라갔는지 확인한다.
 *
 * 두 가지를 본다.
 *  1. 스키마 — 테이블 11개가 다 있는가 (service_role로 조회)
 *  2. 접근 제어 — 공개돼야 할 것만 공개인가 (anon으로 조회)
 *
 * 키 값은 출력하지 않는다.
 *
 *   node scripts/db-check.mjs
 */

import { readFileSync } from "node:fs";

/* ── .env.local 읽기 ──────────────────────────────────── */

let env;
try {
  env = Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      }),
  );
} catch {
  console.error(".env.local이 없습니다.");
  process.exit(1);
}

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

const unset = Object.entries({
  NEXT_PUBLIC_SUPABASE_URL: URL_,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE,
})
  .filter(([, v]) => !v || v.includes("여기에"))
  .map(([k]) => k);

if (unset.length) {
  console.error(`아직 채우지 않은 값: ${unset.join(", ")}`);
  process.exit(1);
}

/* ── 조회 ─────────────────────────────────────────────── */

async function query(table, key, params = "select=*&limit=1") {
  const res = await fetch(`${URL_}/rest/v1/${table}?${params}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "count=exact",
    },
  });
  const range = res.headers.get("content-range"); // "0-4/5"
  const count = range ? Number(range.split("/")[1]) : null;
  return { status: res.status, count, body: await res.text() };
}

const TABLES = [
  "categories",
  "products",
  "product_translations",
  "product_images",
  "releases",
  "release_notes",
  "changelog_entries",
  "changelog_translations",
  "profiles",
  "downloads",
  "entitlements",
];

let failed = false;
const ok = (cond, label, detail = "") => {
  if (!cond) failed = true;
  console.log(`  ${cond ? "✓" : "✗"} ${label}${detail ? `  ${detail}` : ""}`);
};

// 206 Partial Content 도 정상이다. limit 을 걸고 전체 개수를 함께 요청하면
// PostgREST 가 "일부만 돌려준다"는 뜻으로 206 을 준다.
const fetched = (status) => status === 200 || status === 206;

console.log("스키마 — 테이블이 다 있는가 (service_role)\n");
for (const t of TABLES) {
  const r = await query(t, SERVICE);
  ok(fetched(r.status), t.padEnd(24), fetched(r.status) ? `${r.count}행` : `HTTP ${r.status}`);
}

console.log("\n접근 제어 — anon이 볼 수 있는 범위\n");

// 분류는 공개다. 시드가 들어갔으면 5개.
{
  const r = await query("categories", ANON, "select=slug&order=sort_order");
  ok(fetched(r.status) && r.count === 5, "분류 5개가 공개로 조회됨", `${r.count}개`);
  if (fetched(r.status))
    console.log(`      ${JSON.parse(r.body).map((c) => c.slug).join(", ")}`);
}

// anon 에게는 발행된 제품만 보여야 한다.
// 개수를 박아두지 않는다 — 제품이 늘어도 이 검사는 계속 뜻이 있어야 한다.
{
  const all = await query("products", SERVICE, "select=id&status=eq.published&limit=1");
  const seen = await query("products", ANON, "select=id&limit=1");
  ok(
    fetched(seen.status) && seen.count === all.count,
    "anon 에게 발행된 제품만 보임",
    `발행 ${all.count}개 / anon ${seen.count}개`,
  );

  // 초안·보관은 한 건도 새어나가면 안 된다
  const hidden = await query("products", ANON, "select=id&status=neq.published&limit=1");
  ok(hidden.count === 0, "초안·보관 제품은 anon 에게 0행", `${hidden.count}행`);
}

// 개인 데이터는 anon에게 보이면 안 된다.
for (const t of ["profiles", "downloads", "entitlements"]) {
  const r = await query(t, ANON);
  ok(r.count === 0, `${t} 는 anon에게 0행`, `${r.count}행`);
}

// 다운로드 기록 함수는 anon이 호출할 수 없어야 한다.
{
  const res = await fetch(`${URL_}/rest/v1/rpc/record_download`, {
    method: "POST",
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_product_id: "00000000-0000-0000-0000-000000000000",
      p_release_id: "00000000-0000-0000-0000-000000000000",
    }),
  });
  // 42501 permission denied = 실행 권한 자체가 없는 상태. 이게 정답이다.
  // 400(P0001)이면 함수가 실행은 됐고 내부 검사에서 막힌 것이라 통과로 치지 않는다.
  // 이중 방어의 바깥쪽 자물쇠가 잠겨 있어야 한다. (20260817000004 참고)
  const body = await res.text();
  const blocked = body.includes("42501");
  ok(
    blocked,
    "record_download 는 anon 실행 권한 없음",
    blocked ? `HTTP ${res.status} · 42501` : `HTTP ${res.status} — ${body.slice(0, 60)}`,
  );
}

console.log(failed ? "\n확인 실패" : "\n전부 통과");
process.exit(failed ? 1 : 0);
