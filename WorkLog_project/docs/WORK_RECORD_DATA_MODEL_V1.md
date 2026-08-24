# WorkLog 업무 기록 데이터 모델 v1

> 상태: 설계 확정
>
> 작성일: 2026-08-24
> 다음 작업: 이 설계를 기준으로 DB 마이그레이션 SQL 작성

## 1. 설계 목표

기존 `workLog` 게시글 구조를 유지하면서 일일 업무 기록에 다음 맥락을 추가한다.

- 어떤 프로젝트의 업무인가?
- 현재 상태와 우선순위는 무엇인가?
- 언제 시작했고 언제까지 해야 하는가?
- 무엇이 진행을 막고 있는가?
- 다음에 해야 할 행동은 무엇인가?
- 어떤 기록에서 이어졌고 어떤 기록으로 이어지는가?
- 누가 함께 작업했는가?

게시판 1~3과 자동 생성되는 주간·월간 보고서 5~6은 기존 방식으로 동작해야 한다. 새 필드는 모두 nullable 또는 안전한 기본값으로 추가해 기존 데이터와 API의 하위 호환을 유지한다.

## 2. 관계 구조

```text
member 1 ─── N project
member 1 ─── N workLog
project 1 ─── N workLog
workLog N ─── N member       (workLogCollaborator)
workLog 1 ─── N workLog      (previousWorkLogId 자기 참조)
```

## 3. project 테이블

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|---|---|---:|---|---|
| `id` | INT | Y | AUTO_INCREMENT | 프로젝트 식별자 |
| `regDate` | DATETIME | Y | CURRENT_TIMESTAMP | 생성일 |
| `updateDate` | DATETIME | Y | CURRENT_TIMESTAMP | 수정일 |
| `ownerMemberId` | INT | Y | - | 현재 프로젝트 소유자. 팀 기능 전까지 접근 기준으로 사용 |
| `name` | VARCHAR(150) | Y | - | 프로젝트명 |
| `description` | TEXT | N | NULL | 프로젝트 설명 |
| `status` | VARCHAR(20) | Y | `ACTIVE` | 프로젝트 상태 |
| `color` | VARCHAR(20) | N | NULL | UI 구분 색상 |
| `startDate` | DATE | N | NULL | 시작일 |
| `dueDate` | DATE | N | NULL | 목표 종료일 |
| `archivedAt` | DATETIME | N | NULL | 보관 처리 시각 |

### 프로젝트 상태

| 저장값 | 화면 표시 | 의미 |
|---|---|---|
| `ACTIVE` | 진행 중 | 현재 사용 중인 프로젝트 |
| `ON_HOLD` | 보류 | 일시 중단된 프로젝트 |
| `COMPLETED` | 완료 | 종료된 프로젝트 |
| `ARCHIVED` | 보관 | 일반 목록에서 숨김 |

### 제약과 인덱스

- `ownerMemberId`는 `member.id`를 참조한다.
- 같은 사용자가 동일한 프로젝트명을 중복 생성하지 못하게 `(ownerMemberId, name)` 유니크 인덱스를 둔다.
- 목록 조회용 `(ownerMemberId, status, updateDate)` 인덱스를 둔다.
- 프로젝트는 바로 삭제하지 않고 기본적으로 보관 처리한다.

## 4. workLog 확장 필드

| 필드 | 타입 | 필수 | 기본값 | 적용 범위 | 설명 |
|---|---|---:|---|---|---|
| `projectId` | INT | N | NULL | 업무일지 | 연결 프로젝트 |
| `workStatus` | VARCHAR(20) | Y | `PLANNED` | 업무일지 | 업무 상태 |
| `priority` | VARCHAR(20) | Y | `NORMAL` | 업무일지 | 우선순위 |
| `startDate` | DATE | N | NULL | 업무일지 | 업무 시작일 |
| `dueDate` | DATE | N | NULL | 업무일지 | 업무 마감일 |
| `blocker` | TEXT | N | NULL | 업무일지 | 장애물·이슈 |
| `nextAction` | TEXT | N | NULL | 업무일지 | 다음 행동 |
| `previousWorkLogId` | INT | N | NULL | 업무일지 | 이전 기록 |

`boardId != 4`인 게시글과 자동 보고서는 새 필드를 사용하지 않아도 된다. DB 기본값은 기존 입력 경로가 실패하지 않도록 보수적으로 둔다.

### 업무 상태

| 저장값 | 화면 표시 | 다음 상태 |
|---|---|---|
| `PLANNED` | 예정 | `IN_PROGRESS`, `ON_HOLD`, `COMPLETED` |
| `IN_PROGRESS` | 진행 중 | `ON_HOLD`, `COMPLETED` |
| `ON_HOLD` | 보류 | `IN_PROGRESS`, `COMPLETED` |
| `COMPLETED` | 완료 | `IN_PROGRESS` |

상태 전이는 UI 권장 흐름이며, v1 API에서는 사용자가 상태를 되돌릴 수 있다. 감사 로그가 도입되면 상태 변경 이력을 별도 테이블로 저장한다.

### 우선순위

| 저장값 | 화면 표시 |
|---|---|
| `HIGH` | 높음 |
| `NORMAL` | 보통 |
| `LOW` | 낮음 |

### 날짜 규칙

- `dueDate`가 존재하면 `startDate`보다 빠를 수 없다.
- 일일 기록의 작성일 `regDate`와 업무 시작일 `startDate`는 서로 다른 개념으로 유지한다.
- 사용자가 날짜를 지정하지 않으면 자동으로 오늘을 강제하지 않고 NULL로 둔다.

### 이전·후속 기록 규칙

- `previousWorkLogId`는 같은 사용자의 `boardId=4` 기록만 연결할 수 있다.
- 자기 자신을 이전 기록으로 지정할 수 없다.
- 이전 기록 삭제 시 연결은 `SET NULL` 처리한다.
- 후속 기록은 별도 컬럼으로 중복 저장하지 않고 `previousWorkLogId` 역조회로 구한다.

## 5. workLogCollaborator 테이블

| 필드 | 타입 | 필수 | 설명 |
|---|---|---:|---|
| `workLogId` | INT | Y | 업무일지 식별자 |
| `memberId` | INT | Y | 협업자 식별자 |
| `role` | VARCHAR(20) | Y | 협업 역할. v1은 `COLLABORATOR` 사용 |
| `regDate` | DATETIME | Y | 연결 시각 |

### 제약과 인덱스

- 기본키는 `(workLogId, memberId)` 복합키로 둔다.
- 업무일지 삭제 시 협업자 연결도 `CASCADE` 삭제한다.
- 회원 삭제 정책이 생기기 전까지 `memberId`는 삭제를 제한한다.
- 현재 작성자는 `workLog.memberId`에 있으므로 협업자 테이블에 중복 저장하지 않는다.

## 6. DTO 초안

```java
public class Project {
    private int id;
    private String regDate;
    private String updateDate;
    private int ownerMemberId;
    private String name;
    private String description;
    private String status;
    private String color;
    private String startDate;
    private String dueDate;
    private String archivedAt;
}
```

기존 `WorkLog` DTO에는 다음 필드를 추가한다.

```java
private Integer projectId;
private String projectName;
private String workStatus;
private String priority;
private String startDate;
private String dueDate;
private String blocker;
private String nextAction;
private Integer previousWorkLogId;
private String previousWorkLogTitle;
private List<MemberSummary> collaborators;
```

외래키는 연결되지 않은 상태를 표현해야 하므로 원시 타입 `int`가 아니라 `Integer`를 사용한다.

## 7. API 계약 초안

### 프로젝트

| 메서드 | 경로 | 목적 |
|---|---|---|
| GET | `/api/projects` | 내 프로젝트 목록 |
| POST | `/api/projects` | 프로젝트 생성 |
| GET | `/api/projects/{id}` | 프로젝트 상세 |
| PATCH | `/api/projects/{id}` | 프로젝트 수정 |
| POST | `/api/projects/{id}/archive` | 프로젝트 보관 |

### 업무일지

기존 `/api/usr/work/workLog` multipart 요청에 아래 선택 필드를 추가한다.

```text
projectId
workStatus
priority
startDate
dueDate
blocker
nextAction
previousWorkLogId
collaboratorMemberIds
```

기존 클라이언트가 필드를 보내지 않아도 정상 등록되어야 한다.

목록 API의 확장 검색 조건:

```text
projectId
workStatus
priority
memberId
startDate
endDate
keyword
```

## 8. 권한 규칙

v1은 현재 개인 사용자 모델에 맞춰 다음 규칙을 적용한다.

- 프로젝트 생성·수정·보관은 `ownerMemberId` 본인만 가능하다.
- 업무일지 작성자는 본인 소유 프로젝트만 연결할 수 있다.
- 이전 기록은 본인 기록만 선택할 수 있다.
- 협업자는 존재하는 회원만 선택할 수 있다.
- 협업자로 지정되었다는 이유만으로 원문 수정 권한을 부여하지 않는다.

팀 워크스페이스 도입 시 `ownerMemberId` 기반 검사를 `workspaceId + role` 기반 정책으로 교체한다. 테이블을 다시 만들지 않도록 프로젝트 식별자와 업무일지 연결 구조는 그대로 유지한다. 구체적인 멤버십·역할·공개 범위 정책은 [팀·권한 데이터 모델 v1](./TEAM_PERMISSION_DATA_MODEL_V1.md)을 따른다.

## 9. 하위 호환과 마이그레이션 원칙

- 기존 `workLog` 행의 `projectId`, 날짜, 텍스트 필드는 NULL로 둔다.
- 기존 행의 `workStatus`는 `COMPLETED`로 일괄 추정하지 않고 `PLANNED` 기본값을 사용한다. 과거 상태를 임의로 만들지 않기 위함이다.
- 기존 작성·수정 API는 새 필드 없이 계속 동작해야 한다.
- 주간·월간·인수인계 생성 쿼리는 기존 `boardId=4` 조건을 유지한다.
- 새 필드는 AI 프롬프트에 선택적으로 포함하되 비어 있는 값은 전달하지 않는다.
- 운영 적용 전 개발자 스키마와 별도 마이그레이션 SQL을 모두 준비한다.
- 마이그레이션은 재실행 가능 여부를 확인하고 적용 전 백업 절차를 문서화한다.

## 10. 다음 구현 작업의 완료 조건

다음 작업인 DB 마이그레이션 SQL은 아래 조건을 만족해야 한다.

- `project`, `workLogCollaborator` 테이블을 생성한다.
- 기존 `workLog`에 새 컬럼과 인덱스, 외래키를 추가한다.
- 기존 데이터 5건 이상이 있는 DB에서도 손실 없이 실행된다.
- 같은 SQL을 실수로 다시 실행했을 때의 처리 방침이 명확하다.
- 개발자용 초기 스키마를 새 구조와 동일하게 갱신한다.
- 마이그레이션 전후 행 개수와 외래키 무결성을 검증하는 쿼리를 제공한다.
