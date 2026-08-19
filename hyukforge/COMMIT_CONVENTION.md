# 커밋 메시지 컨벤션

[Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)을 따르고,
타입 목록은 [Angular 커밋 가이드라인](https://github.com/angular/angular/blob/main/contributing-docs/commit-message-guidelines.md)을 기준으로 합니다.
메시지는 한국어로 씁니다.

## 기본 형식

```
<타입>(<범위>): <제목>

<본문>

<꼬리말>
```

`<타입>`과 `<제목>`은 필수, 나머지는 선택입니다.

- **제목** — 무엇을 했는지 한 줄로. **마침표를 찍지 않습니다.**
- **빈 줄** — 제목과 본문 사이는 반드시 한 줄 띄웁니다. 안 띄우면 `git log --oneline`에서 본문이 제목에 붙어버립니다.
- **본문** — 무엇을(what)보다 **왜(why)** 바꿨는지 씁니다. 무엇을 바꿨는지는 diff를 보면 됩니다.
- **꼬리말** — `Co-Authored-By:` 처럼 `토큰: 값` 형태. 토큰의 띄어쓰기는 하이픈으로 대체합니다.

## 타입

| 타입 | 의미 | 쓰는 때 |
| --- | --- | --- |
| `feat` | 기능 추가 | 새 기능·화면·API를 더했을 때 |
| `fix` | 버그 수정 | 잘못 동작하던 것을 고쳤을 때 |
| `docs` | 문서 | 문서만 더하거나 고쳤을 때 |
| `style` | 표기 | 포맷·들여쓰기 등 동작에 영향 없는 변경 |
| `refactor` | 구조 개선 | 동작은 그대로 두고 코드를 정리했을 때 |
| `perf` | 성능 | 동작은 같고 더 빨라졌을 때 |
| `test` | 테스트 | 테스트를 더하거나 고쳤을 때 |
| `build` | 빌드 | 빌드 설정·의존성 변경 |
| `ci` | 배포 자동화 | GitHub Actions, Vercel 설정 등 |
| `chore` | 잡무 | 위 어디에도 안 들어가는 것 |
| `revert` | 되돌리기 | 이전 커밋을 되돌렸을 때 |

`feat`과 `fix`만 필수 규격이고 나머지는 관례입니다. **고민되면 `feat`이냐 `fix`냐만 정확히 가르면 됩니다.**

> 이전 포트폴리오 저장소에서 쓰던 `comm`(주석) 타입은 여기서 쓰지 않습니다. 표준에 없는 타입이라
> 도구 지원을 못 받습니다. 주석만 고쳤다면 `docs`, 코드 정리 겸이면 `refactor`로 씁니다.

## 범위 (선택)

어느 부분을 건드렸는지 명사로 적습니다. 이 프로젝트에서 쓰는 범위:

| 범위 | 해당하는 곳 |
| --- | --- |
| `db` | `supabase/migrations/`, 스키마, RLS |
| `i18n` | `i18n/`, `messages/`, 번역 |
| `ui` | `components/`, `app/globals.css` |
| `brand` | `public/brand/`, 로고, 파비콘 |
| `admin` | 관리자 화면 |
| `auth` | 로그인, 세션, 권한 |
| `deps` | 의존성 |

범위가 애매하거나 여러 곳에 걸치면 **생략합니다.** 억지로 붙이면 오히려 헷갈립니다.

## 되돌릴 수 없는 변경

기존 동작이나 데이터 구조가 깨지면 표시합니다. 둘 중 하나를 씁니다.

```
feat(db)!: 다운로드 기록을 릴리스 단위로 분리
```

```
feat(db): 다운로드 기록을 릴리스 단위로 분리

BREAKING CHANGE: downloads.product_id 만 보던 코드는 동작하지 않습니다.
release_id 를 함께 봐야 합니다.
```

`BREAKING CHANGE`는 **반드시 대문자**입니다.

## 예시

실제 이 저장소의 커밋입니다.

```
docs: HyukForge 기획·아키텍처·디자인 문서 추가
```

```
feat(i18n): 10개 언어 라우팅 골격 추가

- i18n/request.ts — 폴백 체인 (요청 → en → ko), 빈 문자열도 폴백 대상
  · 요청 언어를 항상 마지막에 겹쳐 ko 페이지에서 en이 ko를 덮는 문제를 막음
- proxy.ts — Next 16에서 middleware.ts가 proxy.ts로 바뀌어 이름을 맞춤
- scripts/i18n-check.mjs — 빌드 앞에 걸어 미번역 배포 차단
```

```
fix(db): is_admin 실행 권한을 anon 에게 되돌림

RLS 정책 자신이 부르는 함수라 회수하면 공개 제품 조회가 막힌다.
or 의 오른쪽을 건너뛴다는 보장이 없어 published 조회도 실패했다.
```

**본문에 왜를 남기는 게 핵심입니다.** 마지막 예시는 제목만 봐서는 왜 되돌렸는지 알 수 없지만,
본문이 있어서 몇 달 뒤에도 같은 실수를 반복하지 않습니다.

## 권장

- 한 커밋에 한 가지 작업만. 기능 추가와 버그 수정을 섞지 않습니다.
- 제목이 길어지면 커밋을 쪼갤 신호입니다.
- 되돌릴 만한 단위로 자릅니다. `git revert` 했을 때 딱 그 변경만 사라져야 합니다.

## 커밋 전 확인

- [ ] **비밀값이 섞이지 않았는지** — `.env.local`, API 키, 토큰, DB 비밀번호. `git status`로 올라갈 파일을 눈으로 확인합니다. 한 번 커밋되면 히스토리에서 지우기 어렵습니다.
- [ ] **마이그레이션을 고쳤다면** 이미 올린 파일을 수정하지 않았는지. 원격에 적용된 마이그레이션은 새 파일로 덧붙입니다.
- [ ] **번역 키를 추가했다면** `npm run i18n:check` 통과 여부. 빌드에 걸려 있어서 실패하면 배포도 실패합니다.
- [ ] **RLS를 건드렸다면** `node scripts/db-check.mjs` 통과 여부.
- [ ] 타입 검사 `npx tsc --noEmit`.

## 참고

- [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)
- [Angular 커밋 메시지 가이드라인](https://github.com/angular/angular/blob/main/contributing-docs/commit-message-guidelines.md)
