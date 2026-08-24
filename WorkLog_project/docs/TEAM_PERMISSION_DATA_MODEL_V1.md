# WorkLog 팀·권한 데이터 모델 v1

## 목표

개인 업무 기록 중심의 기존 WorkLog를 유지하면서 회사·팀 단위 협업을 추가한다. 기존 데이터는 마이그레이션 후에도 워크스페이스에 자동 공개되지 않으며 `PRIVATE`로 남는다.

## 구조

```text
member
  └─ workspaceMember ─ workspace
       ├─ workspaceInvitation
       ├─ team ─ teamMember
       └─ workspaceAuditLog

workLog / project / handoverLog
  ├─ workspaceId (선택)
  ├─ teamId (선택)
  └─ visibility (PRIVATE | TEAM | WORKSPACE)
```

## 핵심 테이블

### `workspace`

회사 또는 독립 협업 공간이다. `ownerMemberId`는 소유권 이전과 최종 복구를 위한 명시적 소유자다.

| 필드 | 설명 |
|---|---|
| `id`, `name`, `slug` | 식별자, 표시 이름, URL용 고유 문자열 |
| `ownerMemberId` | 워크스페이스 소유 회원 |
| `status` | `ACTIVE`, `ARCHIVED` |

### `workspaceMember`

회원과 워크스페이스의 다대다 관계이자 권한의 기준이다.

| 필드 | 값 |
|---|---|
| `role` | `OWNER`, `ADMIN`, `MANAGER`, `MEMBER` |
| `status` | `INVITED`, `ACTIVE`, `SUSPENDED`, `LEFT` |
| `joinedAt` | 실제 참여 시각 |
| `invitedByMemberId` | 초대한 회원 |

### `team`, `teamMember`

팀은 반드시 하나의 워크스페이스에 속한다. 팀 역할은 `LEAD`, `MEMBER`만 사용하고 회사 관리자 권한과 섞지 않는다.

### `workspaceInvitation`

초대 토큰 원문은 저장하지 않고 해시만 저장한다. 만료·수락·취소 시각을 남겨 재사용을 막는다.
현재 API는 권한이 있는 초대자에게 원문 토큰을 생성 응답에서 한 번만 돌려준다. 운영 단계에서는 이 값을 서버 메일 발송으로 전달하고 API 응답에서는 제거한다.

### `workspaceAuditLog`

역할 변경, 초대, 공개 범위 변경, 인수인계 완료처럼 중요한 동작을 append-only 방식으로 기록한다. `detailsJson`에는 변경 전후 값 등 부가 정보를 JSON으로 저장한다.

## 공개 범위

| 값 | 읽을 수 있는 사람 |
|---|---|
| `PRIVATE` | 작성자와 명시적 협업자 |
| `TEAM` | 같은 워크스페이스의 해당 팀 활성 멤버 |
| `WORKSPACE` | 같은 워크스페이스의 모든 활성 멤버 |

`workspaceId`가 없는 기존 데이터는 `visibility` 값과 관계없이 개인 데이터로 취급한다. `TEAM`은 `workspaceId`와 `teamId`가 모두 있어야 하며, `WORKSPACE`는 `workspaceId`가 있어야 한다.

애플리케이션은 팀 멤버를 추가하기 전에 활성 워크스페이스 멤버인지 확인하고, 리소스의 `teamId`가 같은 `workspaceId`에 속하는지도 검증해야 한다. 이 교차 테이블 규칙은 권한 서비스의 트랜잭션 안에서 강제한다.

## 역할별 기본 권한

| 동작 | OWNER | ADMIN | MANAGER | MEMBER |
|---|:---:|:---:|:---:|:---:|
| 워크스페이스 설정·소유권 이전 | O | - | - | - |
| 회원 초대·역할 변경 | O | O | - | - |
| 팀 생성·팀장 지정 | O | O | O | - |
| 팀 기록 조회 | O | O | 담당 팀 | 소속 팀 |
| 워크스페이스 공개 기록 조회 | O | O | O | O |
| 개인 기록 조회 | 본인 | 본인 | 본인 | 본인 |

모든 쓰기·수정·삭제는 조회 권한과 별개로 리소스 소유자 또는 명시된 관리자 정책을 다시 검사한다.

## 권한 판정 순서

1. 로그인 여부와 리소스 존재 여부를 확인한다.
2. `PRIVATE`이면 작성자·협업자인지 확인한다.
3. 워크스페이스 멤버십이 `ACTIVE`인지 확인한다.
4. `TEAM`이면 활성 팀 멤버십을 추가 확인한다.
5. 수정 작업은 역할과 리소스 소유권을 별도로 확인한다.
6. 중요 변경은 `workspaceAuditLog`에 남긴다.

## 마이그레이션 원칙

- 기존 `workLog`, `project`, `handoverLog` 행의 `workspaceId`, `teamId`는 `NULL`이다.
- 기존 기록의 `visibility` 기본값은 `PRIVATE`이다.
- 이름 문자열 기반 인수자는 유지하되 향후 계정 연결 시 `toMemberId`를 사용한다.
- 애플리케이션이 새 필드를 사용하기 전에도 기존 쿼리와 저장 기능은 그대로 동작한다.

## 다음 구현 순서

1. ~~워크스페이스 생성·초대 API와 멤버십 권한 서비스~~
2. 현재 워크스페이스 선택 UI
3. 업무 기록 작성 시 공개 범위·팀 선택
4. 목록/상세 권한 쿼리 적용
5. 역할별 API 통합 테스트와 감사 로그 기록
