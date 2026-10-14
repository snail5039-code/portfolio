# Student identity migration plan

## Finding

The current DAO layer contains 42 joins, filters, and updates that use `studentName` or
`targetName` as a relationship key. The affected tables are:

| Table | Current relationship key | Target key |
|---|---|---|
| `studentRequest` | `studentName + className` | `studentLoginId` |
| `student` | `studentName + className` | `loginId` (unique FK to `users.login_id`) |
| `taskSubmission` | `taskId + studentName` | `taskId + studentLoginId` |
| `taskAiLog` | `taskId + studentName` | `taskId + studentLoginId` |
| `similarityResult` | `studentName`, `targetName` | `studentLoginId`, nullable `targetLoginId` |

Names and class names remain display snapshots only. They must no longer determine ownership.
`targetLoginId` remains null for comparisons against an AI-log aggregate rather than another
student.

## Why this cannot be a one-step migration

Existing rows do not contain a stable student identifier. Backfilling by name and class is safe
only where exactly one `STUDENT` user matches. If two accounts share a name in the same class,
automatically choosing either account would permanently mix learning records.

Run [`migrations/002_student_identity_preflight.sql`](migrations/002_student_identity_preflight.sql)
on a read-only production snapshot first. Every result set must be empty before backfill.

## Migration phases

### 1. Expand

Add nullable identifier columns and indexes without removing name columns:

- `studentRequest.studentLoginId VARCHAR(50)`
- `student.loginId VARCHAR(50)`
- `taskSubmission.studentLoginId VARCHAR(50)`
- `taskAiLog.studentLoginId VARCHAR(50)`
- `similarityResult.studentLoginId VARCHAR(50)`
- `similarityResult.targetLoginId VARCHAR(50) NULL`

Add foreign keys to `users(login_id)`. Do not make the columns `NOT NULL` yet.

### 2. Backfill

Backfill `studentRequest` and `student` from the unique `users(name, class_name)` match. Then
backfill submissions and logs through `student` plus the task class. Backfill similarity source
and student-comparison targets the same way. Abort if any source row has zero or multiple matches.

Take row counts before and after every statement and keep a rollback backup. Never use
`LIMIT 1` to hide collisions.

### 3. Dual read and write

Change signup, approval, submission, AI-log, and similarity creation to write stable IDs and
display snapshots together. Reads and updates must filter by stable ID. During one release,
permit a controlled fallback to the legacy name only for rows whose ID is still null and log each
fallback.

### 4. Constrain

After the fallback count reaches zero:

- Make all source student ID columns `NOT NULL`.
- Add `UNIQUE (taskId, studentLoginId)` to `taskSubmission`.
- Add `UNIQUE (loginId)` to `student`.
- Remove `UNIQUE (studentName, className)` because same-name students must be supported.
- Keep display names as non-key snapshots or render names by joining `users`.

### 5. Contract

Remove legacy name-based DAO methods and the manual cascade updates that rename rows in five
tables. A user name or class change should update the profile only; historical ownership remains
attached through the stable ID.

## Required acceptance tests

### Same-name students

1. Create `student-a` and `student-b` with the same name and class.
2. Submit different content for the same task.
3. Verify two distinct `(taskId, studentLoginId)` rows.
4. Verify each session reads only its own submission and AI logs.
5. Verify a teacher can open and score each record independently.

### Name change

1. Create a submission, AI log, and similarity result for `student-a`.
2. Change the user's display name.
3. Verify every historical row remains reachable through `studentLoginId`.
4. Verify no row belonging to `student-b` changes.

### Class change

1. Create records while `student-a` belongs to class `A`.
2. Move the profile to class `B` using the approved policy.
3. Verify historical ownership is unchanged.
4. Verify new task visibility follows class `B` while past submissions are retained.
5. Verify the move does not grant access to another student's records.

## Rollout gate

Do not deploy the contract phase until the preflight queries return no rows, the backfill reports
zero null identifiers, and all acceptance tests pass against a restored production snapshot.
