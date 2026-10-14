-- Read-only preflight for the student stable-identity migration.
-- Every query must return zero rows before automatic backfill is allowed.

USE jetrace;

-- Same name and class mapped to multiple student accounts.
SELECT name, class_name, COUNT(*) AS matchingUsers
FROM users
WHERE role = 'STUDENT'
GROUP BY name, class_name
HAVING COUNT(*) > 1;

-- Requests without exactly one matching account.
SELECT sr.id, sr.studentName, sr.className, COUNT(u.login_id) AS matchingUsers
FROM studentRequest sr
LEFT JOIN users u
  ON u.role = 'STUDENT'
 AND u.name = sr.studentName
 AND UPPER(u.class_name) = UPPER(sr.className)
GROUP BY sr.id, sr.studentName, sr.className
HAVING COUNT(u.login_id) <> 1;

-- Approved student rows without exactly one matching account.
SELECT s.id, s.studentName, s.className, COUNT(u.login_id) AS matchingUsers
FROM student s
LEFT JOIN users u
  ON u.role = 'STUDENT'
 AND u.name = s.studentName
 AND UPPER(u.class_name) = UPPER(s.className)
GROUP BY s.id, s.studentName, s.className
HAVING COUNT(u.login_id) <> 1;

-- Submission rows without exactly one student in the task class.
SELECT ts.id, ts.taskId, ts.studentName, COUNT(s.id) AS matchingStudents
FROM taskSubmission ts
JOIN task t ON t.id = ts.taskId
LEFT JOIN student s
  ON s.studentName = ts.studentName
 AND UPPER(s.className) = UPPER(t.className)
GROUP BY ts.id, ts.taskId, ts.studentName
HAVING COUNT(s.id) <> 1;

-- AI-log rows without exactly one student in the task class.
SELECT al.id, al.taskId, al.studentName, COUNT(s.id) AS matchingStudents
FROM taskAiLog al
JOIN task t ON t.id = al.taskId
LEFT JOIN student s
  ON s.studentName = al.studentName
 AND UPPER(s.className) = UPPER(t.className)
GROUP BY al.id, al.taskId, al.studentName
HAVING COUNT(s.id) <> 1;

-- Similarity source rows without exactly one student in the task class.
SELECT sr.id, sr.taskId, sr.studentName, COUNT(s.id) AS matchingStudents
FROM similarityResult sr
JOIN task t ON t.id = sr.taskId
LEFT JOIN student s
  ON s.studentName = sr.studentName
 AND UPPER(s.className) = UPPER(t.className)
GROUP BY sr.id, sr.taskId, sr.studentName
HAVING COUNT(s.id) <> 1;
