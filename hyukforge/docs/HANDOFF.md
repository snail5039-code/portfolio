# 이어서 작업하기

마지막 갱신: 2026-08-19

다음 세션에서 이 문서부터 읽는다. 무엇이 되고 무엇이 안 되는지, 왜 그렇게 만들었는지가 여기 있다.

---

## 지금 어디까지 됐나

| 영역 | 상태 |
| --- | --- |
| 화면 | 홈·제품 목록·제품 상세·다운로드·공지·개발 기록·소개·로그인·게시판·약관 **전부 있음**. 좁은 화면도 메뉴가 나온다 |
| 약관·방침 | 본문 있음 (ko 기준본 + en, 나머지는 en 폴백). **법률 검토 전** |
| 탈퇴 | `/ko/me` 에서 직접. 이메일 받아적기 + 확인 팝업 두 관문. cascade 로 전부 삭제 |
| 다국어 | 10개 언어, 화면 문구 133개 키 전부 일치. 폴백 `요청 → en → ko` |
| DB | 테이블 14개 + `public_profiles` 뷰, RLS 전부 적용. 마이그레이션 12개 원격 적용 완료 |
| 로그인 | **Google OAuth 동작 확인.** 관리자 1명 지정됨 |
| 관리자 | 제품·공지·개발 기록 작성, 릴리스 등록, 스크린샷 업로드, 게시판 목록. 메뉴 4개 전부 동작 |
| 배포 | **Vercel 배포 완료. 환경 변수 반영 확인** |
| 제품 | 2개 발행. `commute-battle` v0.1.0 (Windows, 217.9MB) · `lastcall` v1.0.0-rc4 (Android, 172.9MB) |
| 다운로드 | **끝까지 검증됨** — 로그인 → 302 → GitHub 자산, 기록·카운터·`/ko/me` 확인 |
| 게시판 | 자유·요청 **목록·상세·작성·댓글·공감 동작.** 관리자 상태/고정/숨김도 있음 |
| 글쓴이 이름 | 닉네임(`/ko/me` 에서 지정). 안 정하면 `#a3f19c`. 구글 실명은 공개되지 않는다 |
| 개발 기록 | 10건 — 출퇴근 생존일지 5건, 살려줌 5건. 둘 다 저장소 기록 날짜 기준 |
| 홈 통계 | "최근 업데이트"가 제품 발행일·릴리스·개발 기록 중 가장 나중을 쓴다 |
| 검색엔진 | `sitemap.xml`·`robots.txt`·`rss.xml` 있음. 10개 언어 hreflang·canonical 붙음 |
| 공유 카드 | 제품별 OG 이미지 자동 생성 (이름·한 줄 소개·버전·환경·용량). 그 외 화면은 기본 카드 |
| 게시판 검색 | 제목·본문. `%`·`_` 는 이스케이프해서 리터럴로 찾는다 (`likeSafe`, `lib/queries/safe.ts`) |
| 사이트 검색 | `/ko/search` — 제품·공지·개발 기록·게시글을 한 번에. 네비게이션에 있다. 색인은 막았다 (robots + noindex) |
| 홈 첫 화면 | 히어로 오른쪽은 **공지 3건 → 대표 제품 스크린샷 → CSS 모형** 순으로 있는 것을 쓴다. 지금은 공지가 나온다 |
| 공지 | 3건 발행 (`all-free` 고정 · `lastcall-test-build` · `how-to-report-bugs`). ko·en |
| 목록 안 검색 | 제품·다운로드 목록에도 상자가 있다 (`?q=`). 제품은 분류와 함께 걸린다 |
| 검색창 | `components/search/SearchBox.tsx` **하나로 다 쓴다** — 검색 화면·제품·다운로드·게시판 |
| 알림 | 내 글에 댓글(사용자) · 새 글·댓글(관리자). 화면 안에서만, 메일은 안 보낸다 |

### 아직 없는 것


---

## 다음에 할 일 (우선순위)

1. **약관·방침 법률 검토** — 본문은 올렸지만 검토를 받지 않았다. 실제 값과 맞게 썼을 뿐
   법률 판단은 하지 않았다. 시행일 2026-08-19 도 확정 전이다
2. **살려줌 스크린샷** — 출퇴근 생존일지는 6장 올라갔고 홈 히어로·대표 제품 카드에
   실제 화면이 걸렸다. 살려줌은 아직 없어서 상세의 큰 자리가 "준비 중" 이다.
   대체 텍스트(`alt_ko`·`alt_en`)도 6장 다 비어 있다 — 지금은 제품명으로 대체된다
3. **내용 채우기** — 제품 2개, 공지 3건, 개발 기록 10건, 게시글 0건이다.
   검색·RSS·OG 는 내용이 있어야 값어치가 생긴다

---

## 지금은 안 만들기로 한 것

없어서 아쉬운 게 아니라, 지금 만들면 손해라 미룬 것들이다.
마음이 바뀌면 근거부터 다시 보고 정한다.

| 항목 | 왜 미뤘나 | 언제 다시 볼까 |
| --- | --- | --- |
| 알림 **메일** | **안 하기로 정했다(2026-08-19).** 화면 안 알림으로 충분하고, 메일은 발송 수단·키·수신거부까지 딸려온다. 방침에서도 알림 문구를 뺐다. `profiles.notify_updates` 컬럼만 남겨뒀다 | 사용자가 먼저 요청할 때. 그 전엔 다시 꺼내지 않는다 |
| 다크/라이트 토글 | `docs/DESIGN.md` 가 "다크 전용은 선택이 아니라 정체성"이라고 못박았다 | 원칙을 바꿀 때만 |
| 결제 | 스키마(`is_free`·`price_krw`·`checkout_url`·`entitlements`)는 이미 있다. 매출이 생긴 뒤 검토하기로 했다 | 유료 제품을 낼 때 |
| `next/font/local` 전환 | 재보니 손해다. 위 "설계 원칙" 참고 | 서브셋을 안 쓰게 될 때 |
| 이미지 최적화(`remotePatterns`) | 스크린샷 몇 장에 Vercel 최적화 횟수를 쓸 값어치가 없다 | 이미지가 수십 장이 될 때 |

---

## 계정과 주소

| 항목 | 값 |
| --- | --- |
| 레포 | https://github.com/snail5039-code/hyukforge |
| 배포 | https://hyukforge.vercel.app |
| Vercel 프로젝트 | `snail5039-aiagent/hyukforge` |
| Supabase ref | `vqogaaqgtgpfofqqksit` (서울, `snail2483` 계정) |
| 관리자 | `snail5039@gmail.com` (Google 로그인, `profiles.role = 'admin'`) |

**Supabase 계정이 두 개다.** 원래 계정(`snail5039`)은 무료 프로젝트 2개 한도가 차서
새 계정(`snail2483`)으로 이 프로젝트를 만들었다.
그래서 **Supabase MCP 도구는 이 프로젝트에 접근할 수 없다** — MCP 는 원래 계정에 OAuth 로 붙어 있고
세션 안에서 계정을 바꿀 수 없다. 마이그레이션은 CLI, 검증은 스크립트로 한다.

---

## 작업 흐름

### 마이그레이션 올리기

사용자가 직접 실행해야 한다 (토큰이 필요하다).

```bash
cd "C:\Users\snail\OneDrive\바탕 화면\hyukforge"
npx supabase db push
```

`SUPABASE_DB_PASSWORD` 는 `setx` 로 저장돼 있어서, 프로젝트가 링크된 상태면
에이전트가 실행해도 붙는다 (`SUPABASE_ACCESS_TOKEN` 은 없어도 `db push` 는 된다 —
그건 API 작업에 필요한 값이다).
PowerShell 을 새로 열면 작업 폴더가 `system32` 로 돌아가므로 `cd` 가 반드시 필요하다 —
이걸 세 번 놓쳤다. `Cannot find project ref` 오류가 나면 폴더를 확인한다.

### 검증 명령

```bash
npx tsc --noEmit              # 타입
npm run i18n:check            # 번역 키 10개 언어 일치 (빌드에 걸려 있음)
node scripts/db-check.mjs     # 원격 스키마와 접근 제어
npm run test:role-guard       # 자가 승격이 막히는지 실제로 시도
npm run build                 # 정적/동적 분포까지 확인
```

**RLS 를 건드렸으면 `db-check` 를 반드시 돌린다.** 화면을 만든 뒤에 발견하면 원인 찾기가 훨씬 어렵다.

### 로그인이 필요한 화면을 도구로 검증하기

Google 로그인은 사람이 눌러야 한다. 로그인 뒤 동작(`받기`, `/ko/me`)을
자동으로 확인해야 할 때는 service_role 키로 매직링크를 만들어 세션을 얻는다.

```
POST {SUPABASE_URL}/auth/v1/admin/generate_link
  { "type": "magiclink", "email": "snail5039@gmail.com",
    "redirect_to": "http://localhost:3000/auth/callback" }
→ 응답의 hashed_token 을
POST {SUPABASE_URL}/auth/v1/verify   { "type":"magiclink", "token_hash": ... }
→ access_token / refresh_token
```

두 가지를 놓치기 쉽다.

- `redirect_to` 는 **최상위**에 넣는다. JS 클라이언트처럼 `options` 안에 넣으면
  조용히 무시되고 Site URL 로 대체된다 — 허용 목록 문제로 잘못 진단하기 딱 좋다.
- 허용 목록은 **정확히 일치**해야 한다. `?next=...` 를 붙이면 거부된다.

쿠키는 직접 만들지 말고 `@supabase/ssr` 의 `createServerClient` 에
메모리 쿠키 어댑터를 물린 뒤 `auth.setSession()` 을 불러서 받아온다
(청크 분할·`base64-` 접두사를 알아서 처리한다). 끝나면
`POST /auth/v1/logout?scope=global` 로 세션을 폐기한다.

### 배포 환경 변수 확인

`NEXT_PUBLIC_` 값이 빌드에 박혔는지 보는 방법.
**청크 경로는 `/_next/static/immutable/chunks/` 다** (`/_next/static/chunks/` 가 아니다).
이걸 틀려서 "환경 변수가 없다"고 두 번 잘못 진단했다.

```bash
curl -s https://hyukforge.vercel.app/ko/login -o /tmp/d.html
for u in $(grep -oE '/_next/static/immutable/chunks/[^"]+[.]js' /tmp/d.html | sort -u); do
  curl -s "https://hyukforge.vercel.app$u" | grep -q vqogaaqgtgpfofqqksit && echo "박힘: $u"
done
```

브라우저로 볼 때는 콘솔 오류를 확인한다. 값이 없으면 `supabaseUrl is required` 가 뜬다.

---

## 반복해서 걸린 함정

같은 실수를 두 번 하지 않기 위해 적어둔다. 자세한 설명은 `docs/ARCHITECTURE.md` 에 있다.

**날짜는 서버 시간대로 찍힌다** — `getFullYear()`·`getMonth()` 류는 실행 환경의 시간대를 쓴다.
로컬은 KST 라서 맞았는데 Vercel 은 UTC 라, 밤 9시 이후에 올린 것이 배포본에서 하루 앞으로 보였다.
오늘 올린 공지가 어제 것으로 뜨는 식이다. 로컬에서는 절대 재현되지 않는다.
`lib/format.ts` 는 `Intl.DateTimeFormat` 에 `timeZone: 'Asia/Seoul'` 을 박아 고정했다.
날짜를 새로 찍는 코드를 쓸 때는 `shortDate`·`monthDay` 를 쓴다.

**함수 실행 권한** — Postgres 는 함수를 만들 때 `EXECUTE` 를 `PUBLIC` 에 자동으로 준다.
`revoke ... from anon` 만으로는 아무 효과가 없고 `revoke ... from public` 부터 해야 한다.
그런데 전부 잠그면 안 된다 — `is_admin()` 은 RLS 정책 자신이 부르므로 `anon` 에게도 권한이 필요하다.
이걸 잠갔다가 공개 제품 조회가 통째로 막혔다.

**`SECURITY DEFINER` 와 `current_user`** — `SECURITY DEFINER` 함수 안에서는 `current_user` 가
함수 소유자로 바뀐다. 접근 주체를 판단하는 트리거에서는 쓰지 않는다.
이 때문에 첫 관리자를 만들 수 없는 상태였다.

**쿠키를 읽으면 정적 생성이 깨진다** — 공개 화면 조회에는 `lib/supabase/public.ts`(쿠키 없음)를 쓴다.
`lib/supabase/server.ts`(세션 읽음)를 공개 화면에서 쓰면 홈까지 요청마다 렌더된다.
네비게이션의 로그인 상태(`AuthButton`)와 관리자 버튼(`AdminOnly`)을
클라이언트에서 판단하는 이유도 같다.

**쓰기는 쓰고 나서 읽어본다** — PostgREST 는 트리거가 값을 되돌려도 200 을 준다.
`make-admin` 스크립트가 실패를 성공으로 보고한 적이 있다. 이제 되읽어서 확인한다.

**안전망이 문제를 가린다** — `orEmpty` 로 조회 실패를 삼키게 해뒀는데,
빌드 때 조회가 실패하는 걸 그게 가려서 빈 화면이 배포됐다. 서버 로그를 꼭 본다.

**언어 접두사와 API 라우트** — next-intl 의 `Link` 는 내부 주소로 보이면 전부 접두사를 붙인다.
`/api/download/...` 가 `/ko/api/download/...` 가 되어 받기 버튼이 404 였다.
라우트를 직접 curl 하면 302 라서 통과한다 — **화면이 실제로 거는 주소를 봐야 드러난다.**
`[locale]` 밖의 주소에는 `Btn` 의 `unlocalized` 를 쓰거나 평범한 `a` 를 쓴다.

**클라이언트 번들에 서버 모듈이 딸려간다** — 클라이언트 컴포넌트가 값(타입 아님)을 가져오는 모듈이
`lib/supabase/server.ts` 를 import 하면 `next/headers` 가 클라이언트로 끌려가 500 이 난다.
그래서 게시판은 순수 타입·상수를 `lib/board.ts` 로 빼고 조회만 `lib/queries/board.ts` 에 뒀다.

**어두운 바탕에서는 대비를 재고 정한다** — `--color-dim` 이 2.8:1 이라 라벨이 안 보였다.
눈으로 "좀 어둡네" 하고 넘어갔던 값이다. 색을 바꿀 때는 계산해서 4.5:1 을 넘기고 바꾼다.

**캐시 카운터는 지울 때도 맞춰야 한다** — `products.download_count` 는 record_download 가
올리기만 했다. 탈퇴 기능이 생기자 기록은 cascade 로 사라지는데 카운터만 남아 부풀었다.
넣는 경로만 보고 지우는 경로를 안 본 것이다. 캐시값을 둘 때는 양쪽을 다 본다.
(20260819000003)

**Storage 공개 URL 은 CDN 이 캐시한다** — 파일을 지운 뒤에도 공개 URL 이 한동안 200 을 준다
(`cf-cache: HIT`). 지워졌는지 보려면 캐시를 안 타는 인증 경로나 쿼리를 붙인 주소로 확인한다.
파일 이름에 시각을 붙이는 이유이기도 하다 — 같은 주소를 재사용하지 않으면 캐시가 문제되지 않는다.

**네비게이션에서 서버 쿠키를 읽지 않는다** — 알림 개수를 서버 컴포넌트로 세려다
사이트 전체가 요청마다 렌더될 뻔했다. 네비게이션은 모든 화면에 있어서
여기서 쿠키를 읽으면 홈까지 정적 생성이 깨진다.
`AuthButton`·`AdminOnly`·`NotificationBell` 이 전부 클라이언트인 이유가 같다.

**번역 문구는 HTML 에 통째로 실린다** — next-intl 이 messages 전체를 페이지에 심는다.
그래서 `grep '찾은 글이 없습니다'` 같은 검사는 화면에 안 그려져도 걸린다.
이걸로 멀쩡한 검색 기능을 "깨졌다"고 두 번 잘못 읽었다.
렌더 결과를 볼 때는 `<main>` 안만 보고 `<script>` 를 걷어낸다.

**자기 자신을 부를 때는 `selfOrigin()`** — `siteUrl()` 은 검색엔진용 정식 주소라
로컬에서도 프로덕션을 가리킨다. 그 주소로 자기 파일을 받으면 아직 배포 안 된 걸
받으려다 404 HTML 을 집는다. OG 폰트에서 `Unsupported OpenType signature <!DO` 로 나왔다.

**진단할 때** — 화면이 200이라고 정상이 아니다. 정적 파일만 200이고 페이지가 500이면
proxy 를 타는 경로만 죽은 것이고, 그 차이가 원인을 가리킨다.
그리고 "없다"는 결론을 내리기 전에 찾는 방법이 맞는지 먼저 확인한다.

---

## 설계 원칙 (바꾸기 전에 읽기)

- **설치파일은 사이트에 올리지 않는다.** GitHub Releases 에 두고 주소만 저장한다.
  Supabase 무료 대역폭이 5GB/월인데 설치파일 하나가 217MB 다.
  받기 버튼은 파일을 프록시하지 않고 302 로 넘긴다.
- **검색은 어느 언어로 맞아도 찾고, 보여줄 때는 보고 있는 언어로 고른다.**
  한국어 화면에서 "emergency" 를 찾아도 나와야 한다. 그래서 번역 표를 두 번 임베드한다 —
  화면용으로 전부, 그리고 `hit:..!inner` 로 맞은 것만 (`lib/queries/search.ts`).
  `!inner` 라서 맞은 번역이 없는 행은 아예 빠진다. id 를 모아 다시 읽는 방법도 있지만 왕복이 두 배다.
- **검색어를 주소로 받으면 그 화면은 정적 생성을 잃는다.** `searchParams` 를 읽는 순간
  요청마다 렌더된다. 제품 목록은 분류 필터 때문에 이미 그랬고, 검색을 붙이면서
  다운로드도 그렇게 됐다. 공유·뒤로가기가 되는 값이 그만큼 값어치가 있다고 보고 받아들였다.
  되돌리려면 목록을 클라이언트에서 거르는 쪽으로 바꿔야 하는데, 그러면 다른 언어 번역에만
  있는 말은 못 찾는다.
- **검색 결과는 색인하지 않는다.** 검색어마다 주소가 생기는데 내용은 다른 화면의 조각이다.
  `robots.txt` 의 `/*/search` 와 화면의 `robots: { index: false }` 를 **둘 다** 둔다 —
  robots.txt 는 크롤링을 막고 noindex 는 이미 아는 주소의 색인을 막는다.
- **테스트 빌드도 `stable` 채널로 넣는다.** 화면은 `is_latest` 와 `channel='stable'` 인 릴리스만
  최신으로 잡는다(`lib/queries/products.ts`). `beta` 로 넣으면 받기 버튼이 안 나오고 "곧 공개" 가 된다.
  그래서 `lastcall` 의 `v1.0.0-rc4` 도 stable 로 넣고, 테스트용 APK 라는 사실은
  버전 문자열과 제품 소개에 적었다. 채널을 실제로 쓰려면 화면이 beta 를 다루게 먼저 고쳐야 한다.
- **살려줌은 이 사이트 밖의 서버에 매여 있다.** 앱이 `https://api.lastcall.kro.kr`(EC2 t3.micro)를
  부른다. 그 서버가 멈추면 받기는 되는데 앱 안이 비어 보인다. 제품을 내려야 할 상황이면
  `products.status` 를 `archived` 로 바꾼다.
- **사용자 글은 번역하지 않는다.** 그래서 `notices`(내가 씀, 10개 언어)와
  `posts`(사용자가 씀, 작성 언어 그대로)를 분리했다.
- **관리자 화면 문구는 한국어로 박아둔다.** 쓰는 사람이 한 명이라 번역이 낭비다.
  사용자에게 보이는 화면은 전부 `messages/*.json` 을 쓴다.
- **숫자는 진짜만.** 0이면 0을 보여준다. 예시 데이터는 `/preview` 화면에만 쓰고 DB 에 넣지 않는다.
- **디자인 금지 목록이 `docs/DESIGN.md` 1장에 있다.** 화면을 추가할 때 먼저 읽는다.
  3D 렌더·보라 그라데이션·이모지 타일·균등 카드 그리드·스톡 사진은 쓰지 않는다.
- **`next/font/local` 로 바꾸지 않는다.** 재보고 내린 결론이다.
  Pretendard 는 unicode-range 가 붙은 `@font-face` 92개짜리 동적 서브셋이고,
  한글 페이지 하나가 그중 16개 약 375KB 만 받는다. `next/font/local` 의 `src` 는
  unicode-range 를 표현할 수 없어 통짜 2.0MB 를 통째로 넘기게 된다.
  lint 경고는 그 줄에서만 껐다 — 규칙이 틀린 게 아니라 이 경우가 예외다.
- **결제는 아직 없다.** 스키마에 `is_free`·`price_krw`·`checkout_url`·`entitlements` 가
  이미 있으니 유료 전환 시 값만 채우면 된다. 사업자등록은 매출이 생긴 뒤에 검토한다.
