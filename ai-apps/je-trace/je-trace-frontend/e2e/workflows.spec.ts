import { expect, test, type Page } from "@playwright/test";

async function authenticate(page: Page, role: "STUDENT" | "TEACHER" | "ADMIN") {
  await page.addInitScript(({ selectedRole }) => {
    localStorage.setItem("loginId", `${selectedRole.toLowerCase()}1`);
    localStorage.setItem("loginName", selectedRole === "STUDENT" ? "학생1" : "교사1");
    localStorage.setItem("loginRole", selectedRole);
    localStorage.setItem("approved", "true");
    localStorage.setItem("className", "A");
    localStorage.setItem("subject", "수학");
    localStorage.setItem("managedClasses", "A");
  }, { selectedRole: role });
  page.on("dialog", async (dialog) => {
    await dialog.accept().catch(() => undefined);
  });
}

test("학생 승인 계정이 로그인 상태에서 과제를 제출한다", async ({ page }) => {
  await authenticate(page, "STUDENT");
  let submitted = false;
  await page.route("**/student/tasks/1**", async (route) => {
    if (route.request().method() === "PUT") {
      submitted = true;
      await route.fulfill({ status: 200, body: "ok" });
      return;
    }
    await route.fulfill({ json: {
      id: 1, title: "AI 활용 보고서", description: "활용 사례를 정리하세요.",
      dueDate: "2026-08-31", aiAllowed: true, submitted: false, content: "", score: 0,
      teacherComment: "", logs: [],
    }});
  });
  await page.route("**/student/tasks", (route) => route.fulfill({ json: [] }));
  await page.route("**/student/tasks/1/reflection", (route) => route.fulfill({ json: {
    taskId: 1, initialChange: "", verifiedContent: "", unresolvedQuestion: "",
    retryApproach: "", understandingLevel: null, submitted: false,
  }}));

  await page.goto("/student/assignment/1");
  await expect(page.getByRole("heading", { name: "AI 활용 보고서" })).toBeVisible();
  await page.getByPlaceholder("최종 답안을 입력하세요.").fill("학생이 직접 작성한 최종 답안입니다.");
  await page.getByRole("button", { name: "최종 제출" }).click();
  await expect.poll(() => submitted).toBe(true);
});

test("학생이 성찰을 임시 저장하고 최종 제출한다", async ({ page }) => {
  await authenticate(page, "STUDENT");
  let submittedReflection: Record<string, unknown> | undefined;
  await page.route("**/student/tasks/1/reflection", async (route) => {
    if (route.request().method() === "PUT") {
      submittedReflection = route.request().postDataJSON();
      await route.fulfill({ json: { taskId: 1, ...submittedReflection, updatedAt: "2026-08-21T13:00:00" } });
      return;
    }
    await route.fulfill({ json: { taskId: 1, initialChange: "", verifiedContent: "", unresolvedQuestion: "", retryApproach: "", understandingLevel: null, submitted: false } });
  });
  await page.route("**/student/tasks/1?**", (route) => route.fulfill({ json: {
    id: 1, title: "AI 활용 보고서", className: "A", description: "활용 사례를 정리하세요.",
    dueDate: "2026-08-31", aiAllowed: true, submitted: false, content: "", logs: [],
  }}));
  await page.goto("/student/assignment/1");
  await page.getByText("처음 생각과 달라진 점은 무엇인가요?", { exact: true }).locator("..").locator("textarea").fill("처음과 다른 방법을 찾았다");
  await page.getByText("AI 답변 중 직접 확인한 내용은 무엇인가요?", { exact: true }).locator("..").locator("textarea").fill("공식 문서로 검증했다");
  await page.getByText("아직 이해되지 않은 부분은 무엇인가요?", { exact: true }).locator("..").locator("textarea").fill("복잡도 계산이 어렵다");
  await page.getByText("다시 풀면 어떻게 접근할 건가요?", { exact: true }).locator("..").locator("textarea").fill("작은 입력부터 다시 푼다");
  await page.getByRole("button", { name: "이해도 4" }).click();
  await page.getByRole("button", { name: "임시 저장", exact: true }).click();
  await expect.poll(() => submittedReflection).toMatchObject({ submitted: false, understandingLevel: 4 });
  await page.getByRole("button", { name: "성찰 제출", exact: true }).click();
  await expect.poll(() => submittedReflection).toMatchObject({ submitted: true, understandingLevel: 4 });
});

test("학생 대시보드에서 마감 임박 과제를 이어서 연다", async ({ page }) => {
  await authenticate(page, "STUDENT");
  await page.route("**/student/tasks/summary**", (route) => route.fulfill({ json: {
    submittedCount: 1,
    notSubmittedCount: 2,
    recentLogs: [],
    upcomingTasks: [{
      id: 7,
      title: "알고리즘 풀이 기록",
      className: "A",
      dueDate: "2026-08-24T18:00:00",
      submitted: false,
      progress: 60,
      currentStep: "EXPLORING",
      nextAction: "탐색을 정리해 풀이 작성하기",
      questionCount: 3,
    }],
  }}));

  await page.goto("/student");
  const taskLink = page.getByRole("link", { name: /알고리즘 풀이 기록/ }).filter({ hasText: "60% 진행" });
  await expect(taskLink).toContainText("60% 진행");
  await expect(taskLink).toContainText("추가 탐색");
  await expect(taskLink).toContainText("탐색을 정리해 풀이 작성하기");
  await taskLink.click();
  await expect(page).toHaveURL(/\/student\/assignment\/7$/);
});

test("학생이 주간 학습 행동 변화를 확인한다", async ({ page }) => {
  await authenticate(page, "STUDENT");
  await page.route("**/student/tasks/summary**", (route) => route.fulfill({ json: {
    submittedCount: 1, notSubmittedCount: 1, recentLogs: [], upcomingTasks: [], feedbacks: [], unreadFeedbackCount: 0,
    weeklyLearning: {
      questionCount: 4, revisionCount: 2, reflectionCount: 1, feedbackAppliedCount: 1,
      feedbackApplicationRate: 50, previousQuestionCount: 2, previousRevisionCount: 1,
      previousReflectionCount: 0, previousFeedbackAppliedCount: 0, previousFeedbackApplicationRate: 0,
      frequentBlockedKeyword: "재귀", summaryMessage: "지난주보다 질문과 수정·성찰 활동이 늘었어요.",
    },
  }}));

  await page.goto("/student");
  await expect(page.getByRole("heading", { name: "이번 주 학습 변화" })).toBeVisible();
  await expect(page.getByText("지난주보다 질문과 수정·성찰 활동이 늘었어요.")).toBeVisible();
  await expect(page.getByText("재귀", { exact: true })).toBeVisible();
  await expect(page.getByText("50%", { exact: true })).toBeVisible();
});

test("학생이 개인정보 공개 범위와 기록 통제 기능을 확인한다", async ({ page }) => {
  await authenticate(page, "STUDENT");
  let deletionRequested = false;
  await page.route("**/student/tasks/summary**", (route) => route.fulfill({ json: { submittedCount: 0, notSubmittedCount: 0, recentLogs: [], upcomingTasks: [], feedbacks: [] } }));
  await page.route("**/student/tasks/privacy/deletion-request", async (route) => { deletionRequested = true; await route.fulfill({ status: 200, body: "ok" }); });
  await page.goto("/student");
  await expect(page.getByRole("heading", { name: "내 기록은 이렇게 사용됩니다" })).toBeVisible();
  const expandButton = page.getByRole("button", { name: "펼치기" });
  await expect(expandButton).toBeEnabled();
  await page.waitForTimeout(150);
  await expandButton.click();
  await expect(page.getByText("공개", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "접기" })).toBeVisible();
  await page.getByRole("button", { name: "기록 삭제 요청" }).click();
  await expect.poll(() => deletionRequested).toBe(true);
});

test("학생 대시보드가 행동 우선순서로 탐색된다", async ({ page }) => {
  await authenticate(page, "STUDENT");
  await page.route("**/student/tasks/summary**", (route) => route.fulfill({ json: {
    submittedCount: 0, notSubmittedCount: 1,
    upcomingTasks: [{ id: 7, title: "사고 과정 과제", className: "A", dueDate: "2026-08-24T18:00:00", submitted: false, progress: 40, currentStep: "FIRST_QUESTION", nextAction: "질문을 확장하기", questionCount: 1 }],
    recentLogs: [{ id: 1, taskId: 7, studentName: "학생1", question: "첫 질문", answer: "AI 답변", createdAt: "2026-08-21T12:00:00", status: "정상" }],
    feedbacks: [{ submissionId: 2, taskId: 7, taskTitle: "사고 과정 과제", teacherComment: "근거를 보완하세요.", feedbackStatus: "REVIEWED", feedbackCreatedAt: "2026-08-21T13:00:00", feedbackReadAt: "2026-08-21T14:00:00" }],
    weeklyLearning: { questionCount: 1, revisionCount: 0, reflectionCount: 0, feedbackApplicationRate: 0, previousQuestionCount: 0, previousRevisionCount: 0, previousReflectionCount: 0, previousFeedbackApplicationRate: 0, frequentBlockedKeyword: null, summaryMessage: "첫 기록을 남겼어요." },
  }}));
  await page.goto("/student");
  const expected = ["과제 이어가기", "진행 단계", "성찰 이어쓰기", "최근 생각의 흔적", "새 피드백", "이번 주 학습 변화"];
  const positions = await Promise.all(expected.map(async (title) => (await page.getByRole("heading", { name: title }).boundingBox())?.y ?? -1));
  positions.forEach((position) => expect(position).toBeGreaterThanOrEqual(0));
  for (let index = 1; index < positions.length; index += 1) expect(positions[index - 1]).toBeLessThan(positions[index]);
});

test("학생이 새 피드백을 읽고 수정 과제로 이동한다", async ({ page }) => {
  await authenticate(page, "STUDENT");
  let readSubmissionId: string | undefined;
  await page.route("**/student/tasks/summary**", (route) => route.fulfill({ json: {
    submittedCount: 1, notSubmittedCount: 0, recentLogs: [], upcomingTasks: [], unreadFeedbackCount: 1,
    feedbacks: [{ submissionId: 21, taskId: 7, taskTitle: "알고리즘 과제", teacherComment: "근거를 보완해 주세요.", feedbackStatus: "REVISION_REQUESTED", feedbackCreatedAt: "2026-08-21T13:00:00", feedbackReadAt: null }],
  }}));
  await page.route("**/student/tasks/feedback/*/read", async (route) => {
    readSubmissionId = route.request().url().match(/feedback\/(\d+)\/read/)?.[1];
    await route.fulfill({ status: 200, body: "ok" });
  });
  await page.goto("/student");
  await expect(page.getByText("읽지 않음 1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /알고리즘 과제/ }).click();
  await expect.poll(() => readSubmissionId).toBe("21");
  await expect(page).toHaveURL(/\/student\/assignment\/7$/);
});

test("교사가 학생별 사고 과정 진행 단계를 확인한다", async ({ page }) => {
  await authenticate(page, "TEACHER");
  await page.route("**/teacher/profile**", (route) => route.fulfill({ json: {
    name: "교사1", subject: "수학", managedClasses: "A",
  }}));
  await page.route("**/teacher/tasks/3/taskSubmissions**", (route) => route.fulfill({ json: [{
    id: 30,
    taskId: 3,
    studentName: "학생1",
    submitted: false,
    submittedAt: null,
    aiUsed: true,
    result: null,
    content: null,
    score: 0,
    teacherComment: null,
    approvedStudent: true,
    learningProgress: 60,
    currentStep: "EXPLORING",
    questionCount: 3,
  }] }));
  await page.route("**/teacher/tasks/3?**", (route) => route.fulfill({ json: {
    id: 3,
    title: "알고리즘 과제",
    className: "A",
    description: "풀이 과정을 기록하세요.",
    dueDate: "2026-08-24T18:00:00",
    aiAllowed: true,
  }}));

  await page.goto("/teacher/tasks/3");
  await expect(page.getByText("학생1", { exact: true })).toBeVisible();
  await expect(page.getByText("추가 탐색", { exact: true })).toBeVisible();
  await expect(page.getByText("60% · 질문 3회", { exact: true })).toBeVisible();
});

test("승인된 교사가 담당 반 과제를 생성한다", async ({ page }) => {
  await authenticate(page, "TEACHER");
  let created = false;
  await page.route("**/teacher/profile**", (route) => route.fulfill({ json: {
    loginId: "teacher1", name: "교사1", email: "teacher@example.com",
    subject: "수학", managedClasses: "A",
  }}));
  await page.route("**/teacher/tasks", async (route) => {
    if (route.request().method() === "POST") created = true;
    await route.fulfill({ status: 200, json: [] });
  });

  await page.goto("/teacher/create-task");
  await expect(page.locator('select[name="className"]')).toHaveValue("A");
  await page.locator('input[name="title"]').fill("새 수학 과제");
  await page.locator('textarea[name="description"]').fill("풀이 과정을 작성하세요.");
  await page.locator('input[name="dueDate"]').fill("2026-08-31");
  await page.getByRole("button", { name: "등록", exact: true }).click();
  await expect.poll(() => created).toBe(true);
});

test("교사가 제출물 평가와 피드백을 저장한다", async ({ page }) => {
  await authenticate(page, "TEACHER");
  let evaluation: unknown;
  await page.route("**/teacher/profile**", (route) => route.fulfill({ json: {
    name: "교사1", subject: "수학", managedClasses: "A",
  }}));
  await page.route("**/teacher/tasks/1?**", (route) => route.fulfill({ json: {
    id: 1, title: "수학 과제", className: "A", description: "풀이", dueDate: "2026-08-31",
  }}));
  await page.route("**/teacher/tasks/submissions/10?**", (route) => route.fulfill({ json: {
    id: 10, taskId: 1, studentName: "학생1", submitted: true, content: "풀이 내용", score: 0,
    teacherComment: "", approvedStudent: true,
  }}));
  await page.route("**/teacher/tasks/1/logs**", (route) => route.fulfill({ json: [] }));
  await page.route("**/teacher/tasks/submissions/10/evaluation**", async (route) => {
    evaluation = route.request().postDataJSON();
    await route.fulfill({ status: 200, body: "ok" });
  });

  await page.goto("/teacher/tasks/1/submissions/10/evaluation");
  await page.getByText("평가 입력").waitFor();
  await page.locator('input[type="number"]').fill("92");
  await page.locator("textarea").last().fill("논리적인 풀이입니다.");
  await page.locator("select").selectOption("REVISION_REQUESTED");
  await page.getByRole("button", { name: "평가 저장" }).click();
  await expect.poll(() => evaluation).toMatchObject({ score: 92, teacherComment: "논리적인 풀이입니다.", feedbackStatus: "REVISION_REQUESTED" });
});

test("유사도 분석 목록에서 상세 결과를 확인한다", async ({ page }) => {
  await authenticate(page, "TEACHER");
  await page.route("**/teacher/profile**", (route) => route.fulfill({ json: {
    name: "교사1", subject: "수학", managedClasses: "A",
  }}));
  await page.route("**/teacher/tasks/similarity?**", (route) => route.fulfill({ json: [{
    id: 7, taskId: 1, taskTitle: "수학 과제", studentName: "학생1", targetName: "학생2",
    comparisonType: "STUDENT_TO_STUDENT", similarity: 78, judge: "위험", reason: "표현이 유사합니다.",
  }] }));
  await page.route("**/teacher/tasks/similarity/7?**", (route) => route.fulfill({ json: {
    id: 7, taskId: 1, taskTitle: "수학 과제", studentName: "학생1", targetName: "학생2",
    comparisonType: "STUDENT_TO_STUDENT", similarity: 78, judge: "위험", reason: "표현이 유사합니다.",
    studentContent: "첫 번째 풀이", targetContent: "두 번째 풀이",
  }}));
  await page.route("**/teacher/tasks/1/logs**", (route) => route.fulfill({ json: [] }));

  await page.goto("/teacher/similarity");
  await page.getByRole("button", { name: "상세", exact: true }).click();
  await expect(page).toHaveURL(/\/teacher\/similarity\/7$/);
  await expect(page.getByText("78%", { exact: true })).toBeVisible();
  await expect(page.getByText("표현이 유사합니다.")).toBeVisible();
});
