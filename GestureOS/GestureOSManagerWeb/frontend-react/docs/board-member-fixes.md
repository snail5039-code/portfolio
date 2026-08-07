# Board & Member Fixes

## Summary
- Board list now respects board type links, search, sorting, and page size changes.
- Board view count is updated when a detail page is opened.
- Error report board type is added across header and board lists.
- MyPage email field allows changes and uses the verification flow.

## Files Changed

### Board
- src/pages/board/Board.jsx
  - Added sort control and API param (`sortType`).
  - Search now submits input and triggers fetch.
  - Page size changes reset pagination and update page counts.
  - Board type dropdown syncs with `type` query param.
  - Board type is persisted in session storage when navigating away.
  - Write button passes `boardId` to `/board/write`.

- src/pages/board/BoardDetail.jsx
  - Calls `/boards/{id}/hit` (PATCH) to update view count and reflects the new value.
  - Board labels updated to match new board types.
  - Redirects with replace on delete and 404 to avoid stale history.

- src/pages/board/BoardTypes.js
  - Added `오류사항접수` board type and corrected names/keys.

### Backend Board
- backend-spring/src/main/java/com/example/demo/controller/ArticleController.java
  - Added `pageSize` and `sortType` params to `/api/boards`.
  - Added `PATCH /api/boards/{id}/hit` for view count updates.

- backend-spring/src/main/java/com/example/demo/dao/ArticleDao.java
  - Added hit increment and hit 조회.
  - Added comment count and sort-aware list query.
  - Initializes hit to 0 on insert.
  - Orders by `COALESCE(hit, 0)` when sorting by views.

- backend-spring/src/main/java/com/example/demo/service/ArticleService.java
  - Passed `sortType` into list query and exposed hit increment method.

- backend-spring/src/main/java/com/example/demo/dto/Article.java
  - Added `hit` and `commentCount` fields.

### Backend Schema
- backend-spring/src/main/resources/schema.sql
  - Added `hit` column to `article` table (default 0) and a safe ALTER.

- backend-spring/schema.sql
  - Added `hit` column to `article` table (default 0) and a safe ALTER.

### Header
- src/components/layout/AppHeader.jsx
  - Board menu links use query params (`type=notice/free/qna/error`).
  - Added `오류사항접수` menu entry.
  - Cleaned navigation labels and language names.

### Member
- src/pages/member/MyPage.jsx
  - Email input is editable to enable re-verification on change.

### Frontend Infra
- src/context/ModalContext.jsx
  - Memoized modal handlers to prevent repeated effect triggers on modal state updates.
