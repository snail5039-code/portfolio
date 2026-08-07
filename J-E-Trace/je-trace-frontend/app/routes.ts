import { index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),

  route("auth", "routes/auth.tsx"),

  route("student", "routes/student/page.tsx"),
  route("student/assignments", "routes/student/assignments.tsx"),
  route("student/assignment/:taskId", "routes/student/assignmentDetail.tsx"),

  route("teacher", "routes/teacher/page.tsx"),
  route("teacher/create-task", "routes/teacher/create-task.tsx"),
  route("teacher/tasks/:taskId", "routes/teacher/task-detail.tsx"),
  route("teacher/tasks/:taskId/submissions/:submissionId", "routes/teacher/submission-detail.tsx"),
  route("teacher/tasks/:taskId/submissions/:submissionId/evaluation", "routes/teacher/submission-evaluation.tsx"),
  route("teacher/logs", "routes/teacher/logs.tsx"),
  route("teacher/similarity", "routes/teacher/similarity.tsx"),
  route("teacher/similarity/:similarityId", "routes/teacher/similarity-detail.tsx"),
  route("teacher/students", "routes/teacher/students.tsx"),
  route("teacher/profile", "routes/teacher/profile.tsx"),

  route("admin", "routes/admin/page.tsx"),

  route("signup", "routes/signup.tsx"),
];
