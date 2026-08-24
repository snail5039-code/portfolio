import React, { useEffect, useState, useContext, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Button,
  Input,
  Form,
  Modal,
  message,
  Spin,
  Select,
  Upload,
} from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { AuthContext } from "../context/AuthContext";
import { WorkspaceContext } from "../context/WorkspaceContext";
import { FIELD_LABELS, FIELD_ORDER, TEMPLATE_MAIN_PLACEHOLDER } from "../config/templateSummaryConfig";
import { API_BASE } from "../config/api";

const LOGIN_REQUIRED_KEY = "login_required_message";
// 로그인 후 이용가능 메세지 두번 출력하지 않기 위해 만든 변수
const BOARD_OPTIONS = [
  { id: 1, label: "공지사항" },
  { id: 2, label: "자유게시판" },
  { id: 3, label: "질문과 답변" },
  { id: 4, label: "일일업무일지" },
  // 주간/월간은 자동 생성이니 여기서 빼고,
  // 나중에 필요하면 5,6도 넣을 수 있음
];

const TEMPLATE_OPTIONS = [
  { value: "TPL3", label: "템플릿3 - 일일 보고(간단)" },
  { value: "TPL4", label: "템플릿4 - 부서/작성자/계획형" },
  { value: "TPL5", label: "템플릿5 - 업무 리스트형" },
  { value: "TPL6", label: "템플릿6 - 오늘 업무/이슈/내일 계획" },
  { value: "TPL7", label: "템플릿7 - 현장/프로젝트 상세형" },
  // 나중에 템플릿 늘어나면 여기만 추가하면 됨
  // { value: 'TPL2', label: '템플릿2 - 월간 보고서' },
];

function Write() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [form] = Form.useForm(); // 이 넘이 관리함!

  // ✅ 1) URL 쿼리에서 boardId 먼저 뽑고
  const boardIdFromQuery = Number(searchParams.get("boardId") || 4);

  const selectedBoardId = Form.useWatch("boardId", form) ?? boardIdFromQuery; // 셀렉트에서 고른거 실시간 감시
  const isDailyBoard = selectedBoardId === 4;
  const isTemplateBoard = selectedBoardId === 7;
  const isFaqBoard = selectedBoardId === 8;
  const isErrorBoard = selectedBoardId === 9;
  const isFixedBoard = isTemplateBoard || isFaqBoard || isErrorBoard;

  const [isSubmitLoading, setIsSubmitLoading] = useState(false); // 얘가 요약할때 로딩 창임
  const [projects, setProjects] = useState([]);
  const [previousLogs, setPreviousLogs] = useState([]);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [projectCreating, setProjectCreating] = useState(false);
  const [aiSummaryPreview, setAiSummaryPreview] = useState("");
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [teams, setTeams] = useState([]);
  // Context에서 로그인 ID를 가져옵니다.
  const { isLoginedId, authLoaded } = useContext(AuthContext);
  const { currentWorkspace } = useContext(WorkspaceContext);
  const selectedVisibility = Form.useWatch("visibility", form) || "PRIVATE";
  // 메인 콘텐츠 TextArea에 접근하기 위한 Ref
  const mainContentRef = useRef(null);

  const loadStructuredOptions = useCallback(async () => {
    try {
      const [projectRes, logRes] = await Promise.all([
        fetch(`${API_BASE}/api/projects`, { credentials: "include" }),
        fetch(`${API_BASE}/api/usr/work/list?boardId=4&page=1&size=100`, { credentials: "include" }),
      ]);
      if (projectRes.ok) setProjects(await projectRes.json());
      if (logRes.ok) {
        const data = await logRes.json();
        setPreviousLogs(data.items || []);
      }
    } catch (error) {
      console.error("구조화 업무 옵션 조회 실패:", error);
    }
  }, []);

  useEffect(() => {
    form.setFieldsValue({ boardId: boardIdFromQuery });
  }, [boardIdFromQuery, form]);
  useEffect(() => {
    // isLoginedId가 0일 때만 로그인 검증 로직을 수행합니다.
    // 타입 비교를 위해 === 대신 ==을 사용하던 부분을 ===으로 수정합니다.
    if (!authLoaded) return;
    if (isLoginedId === 0) {
      message.error({
        content: "글쓰기는 로그인 후 이용 가능합니다.",
        key: LOGIN_REQUIRED_KEY,
        duration: 5,
      });
      navigate("/login");
    }
  }, [authLoaded, isLoginedId, navigate]);

  useEffect(() => {
    if (authLoaded && isLoginedId !== 0) loadStructuredOptions();
  }, [authLoaded, isLoginedId, loadStructuredOptions]);

  useEffect(() => {
    form.setFieldsValue({ workspaceId: currentWorkspace?.id || null, teamId: null, visibility: "PRIVATE" });
    if (!currentWorkspace) { setTeams([]); return; }
    fetch(`${API_BASE}/api/workspaces/${currentWorkspace.id}/teams`, { credentials: "include" })
      .then((res) => res.ok ? res.json() : Promise.reject(new Error("팀 목록을 불러오지 못했습니다.")))
      .then(setTeams).catch((error) => message.error(error.message));
  }, [currentWorkspace, form]);

  const createProject = async () => {
    if (!newProjectName.trim()) {
      message.warning("프로젝트명을 입력해주세요.");
      return;
    }
    try {
      setProjectCreating(true);
      const res = await fetch(`${API_BASE}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newProjectName.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      const created = await res.json();
      setProjects((prev) => [created, ...prev]);
      form.setFieldValue("projectId", created.id);
      setNewProjectName("");
      setProjectModalOpen(false);
      message.success("프로젝트가 생성되었습니다.");
    } catch (error) {
      message.error(error.message || "프로젝트 생성에 실패했습니다.");
    } finally {
      setProjectCreating(false);
    }
  };

  const handleTemplateChange = (value) => {
    setAiSummaryPreview("");
    // 지금 메인 내용에 뭐가 써져 있는지 확인
    const currentContent = form.getFieldValue("mainContent");

    // 아무것도 안 써져 있으면 → 예시 텍스트로 채워줌
    if (!currentContent || !currentContent.trim()) {
      form.setFieldsValue({
        // 쉽게 생각하셈 안티 디자인 폼 때문에 이렇게 한거!
        templateId: value,
        mainContent: TEMPLATE_MAIN_PLACEHOLDER[value] || "",
      });
    } else {
      // 이미 글이 있으면 내용은 그대로 두고 템플릿만 변경
      form.setFieldsValue({
        templateId: value,
      });
    }
  };

  const generateAiPreview = async () => {
    try {
      const values = await form.validateFields(["title", "mainContent", "templateId"]);
      setIsAiGenerating(true);
      const response = await fetch(`${API_BASE}/api/usr/work/ai-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: values.title,
          mainContent: values.mainContent,
          sideContent: form.getFieldValue("sideContent") || "",
          templateId: values.templateId || "TPL3",
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.error || "AI 요약 생성에 실패했습니다.");
      setAiSummaryPreview(JSON.stringify(JSON.parse(data.summaryContent), null, 2));
      message.success("AI 초안을 만들었습니다. 확인 후 자유롭게 수정하세요.");
    } catch (error) {
      if (error?.errorFields) return;
      message.error(error.message || "AI 요약 생성에 실패했습니다. 요약 없이도 저장할 수 있습니다.");
    } finally {
      setIsAiGenerating(false);
    }
  };

  const previewObject = (() => {
    try {
      return aiSummaryPreview ? JSON.parse(aiSummaryPreview) : null;
    } catch {
      return null;
    }
  })();

  const updateAiSummaryField = (key, value) => {
    setAiSummaryPreview(JSON.stringify({ ...previewObject, [key]: value }, null, 2));
  };

  if (!authLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spin size="large" />
        <p className="mt-2 text-gray-600">로그인 상태 확인 중...</p>
      </div>
    );
  }

  const openModal = (message) => {
    setModalMessage(message);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setModalMessage("");
    setIsModalOpen(false);
    const boardId = form.getFieldValue("boardId") || 4;
    navigate(`/list?boardId=${boardId}`);
  };

  const handleSubmit = async (values) => {
    setIsSubmitLoading(true);

    // 첨부파일을 포함하기 위해 FormData 사용
    const formData = new FormData();

    const boardId = values.boardId;
    const mainContentMarkdown = values.mainContent;

    if (!mainContentMarkdown || !mainContentMarkdown.trim()) {
      message.error("메인 작성 내용을 입력해주세요.");
      setIsSubmitLoading(false);
      return;
    }

    if ([1, 2, 3].includes(boardId)) {
      try {
        const res = await fetch(
          `${API_BASE}/api/usr/work/simplePost`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              boardId,
              title: values.title,
              mainContent: values.mainContent,
            }),
          }
        );
        if (!res.ok) {
          throw new Error(`등록 실패 (HTTP ${res.status})`);
        }
        const data = await res.json();
        message.success("게시글이 등록되었습니다.");
        navigate(`/detail/${data.id}`);
      } catch (error) {
        console.error(error);
        message.error("등록 중 오류 발생");
      } finally {
        setIsSubmitLoading(false);
      }
      return;
    }

    formData.append("boardId", values.boardId);
    formData.append("title", values.title);
    formData.append("mainContent", mainContentMarkdown);
    // 값이 없으면 빈 문자열로 보낸다. undefined 를 그대로 넣으면 FormData 가
    // 문자열 "undefined" 로 바꿔서, 보조내용을 안 쓴 글의 DB 에 그 글자가 들어갔다.
    formData.append("sideContent", values.sideContent ?? "");
    formData.append("templateId", values.templateId || "TPL3");
    if (boardId === 4) {
      ["projectId", "workStatus", "priority", "startDate", "dueDate", "blocker", "nextAction", "previousWorkLogId"].forEach((key) => {
        const value = values[key];
        if (value !== undefined && value !== null && value !== "") formData.append(key, value);
      });
      formData.append("visibility", values.visibility || "PRIVATE");
      if (currentWorkspace?.id) formData.append("workspaceId", currentWorkspace.id);
      if (values.visibility === "TEAM" && values.teamId) formData.append("teamId", values.teamId);
      if (aiSummaryPreview.trim()) formData.append("summaryContent", aiSummaryPreview.trim());
    }

    if (values.files && values.files.length > 0) {
      values.files.forEach((fileObj) => {
        formData.append("files", fileObj.originFileObj);
      });
    }

    try {
      const response = await fetch(
        `${API_BASE}/api/usr/work/workLog`,
        {
          method: "post",
          body: formData,
          credentials: "include",
        }
      );
      if (response.ok) {
        if (boardId === 7) {
          // 템플릿 게시판에서 작성한 경우
          openModal("템플릿이 등록되었습니다.");
        } else {
          // 나머지 게시판(일일업무 등)
          openModal(aiSummaryPreview.trim() ? "확인한 AI 요약과 함께 기록했습니다." : "업무 기록을 저장했습니다.");
        }
      } else {
        // 서버 응답 상태는 OK가 아니지만, 응답을 받은 경우 (4xx, 5xx)
        openModal(`등록을 실패했습니다. (HTTP Code: ${response.status})`);
      }
    } catch (error) {
      console.error("통신 오류:", error);
      // fetch 자체가 실패한 경우 (네트워크 오류, CORS 문제 등)
      openModal("통신 오류가 발생했습니다. 백엔드 서버 상태를 확인해주세요.");
    } finally {
      setIsSubmitLoading(false);
    }
  };

  return (
    <div className="app-container mx-auto max-w-3xl space-y-4 rounded-[24px] border border-[#eadfd7] bg-white p-6 shadow-[0_14px_45px_rgba(70,49,35,0.06)] md:p-8">
      <div className="flex justify-between">
        <div><p className="text-xs font-bold tracking-[0.18em] text-[#d95d3b]">NEW RECORD</p><h1 className="mt-2 font-serif text-3xl font-bold text-[#1f2e45]">오늘의 업무 기록</h1><p className="mt-2 text-sm text-[#747b87]">완벽하게 정리하기보다, 오늘의 맥락을 짧고 솔직하게 남겨보세요.</p></div>
      </div>
      <Form
        form={form}
        layout="vertical"
        className="space-y-4"
        onFinish={handleSubmit}
        onValuesChange={(changedValues) => {
          if (aiSummaryPreview && ["title", "mainContent", "sideContent", "templateId"].some((key) => key in changedValues)) {
            setAiSummaryPreview("");
            message.info("원문이 변경되어 기존 AI 초안을 제외했습니다. 필요하면 다시 만들어주세요.");
          }
        }}
        disabled={isSubmitLoading}
      >
        {/* ✅ 게시판 선택 */}
        <Form.Item
          label={
            <span className="text-sm font-semibold text-[#364154]">기록 유형</span>
          }
          name="boardId"
          rules={[{ required: true, message: "게시판을 선택해 주세요." }]}
          className="mb-2"
        >
          {isFixedBoard  ? (
            // ⭐ 7, 8, 9번은 셀렉트 숨기고 고정 텍스트만 표시
            <div className="px-3 py-2 rounded border bg-gray-100 text-gray-700">
              {selectedBoardId === 7 && "템플릿 등록 게시판"}
              {selectedBoardId === 8 && "자주 묻는 질문 게시판"}
              {selectedBoardId === 9 && "오류사항 접수 게시판"}
            </div>
          ) : (
            // ⭐ 나머지 게시판에서는 기존처럼 Select 사용
            <Select
              style={{ maxWidth: 320 }}
              options={(isLoginedId === 1
                ? BOARD_OPTIONS
                : BOARD_OPTIONS.filter((b) => b.id !== 1)
              ).map((b) => ({
                value: b.id,
                label: b.label,
              }))}
            />
          )}
        </Form.Item>
        {/* ⭐ 템플릿 게시판 전용: 첨부파일 등록 */}
        {isTemplateBoard && (
          <Form.Item
            label={
              <span className="text-lg font-semibold text-gray-700">
                첨부파일 등록
              </span>
            }
            name="files"
            valuePropName="fileList"
            getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}
            rules={[
              { required: true, message: "템플릿 파일을 업로드해 주세요." },
            ]}
            className="mb-0"
          >
            <Upload multiple beforeUpload={() => false}>
              <Button icon={<UploadOutlined />}>파일 선택</Button>
            </Upload>
          </Form.Item>
        )}
        <Form.Item
          label={
            <span className="text-sm font-semibold text-[#364154]">제목</span>
          }
          name="title"
          rules={[{ required: true, message: "제목을 입력해주세요" }]}
          className="mb-0"
        >
          <Input placeholder={"제목을 입력하세요."} className="w-full" />
        </Form.Item>
        {isDailyBoard && (
          <Form.Item
            label={
              <span className="text-lg font-semibold text-gray-700">
                문서 양식
              </span>
            }
            name="templateId"
            initialValue="TPL3"
            rules={[
              { required: true, message: "사용할 양식을 선택해 주세요." },
            ]}
            className="mb-2"
          >
            <Select
              options={TEMPLATE_OPTIONS}
              style={{ maxWidth: 320 }}
              onChange={handleTemplateChange}
            />
          </Form.Item>
        )}

        {isDailyBoard && (
          <section className="rounded-2xl border border-[#eadfd7] bg-[#fffaf6] p-4 md:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div><p className="text-sm font-bold text-[#26344a]">업무 흐름 정보</p><p className="mt-1 text-xs text-[#7a746f]">프로젝트와 다음 행동을 연결하면 보고서와 인수인계가 더 정확해집니다.</p></div>
              <Button type="default" onClick={() => setProjectModalOpen(true)}>+ 프로젝트</Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2 rounded-xl border border-[#eee2da] bg-white p-4">
                <p className="text-sm font-bold text-[#26344a]">공개 범위</p>
                <p className="mt-1 text-xs text-[#8a817b]">{currentWorkspace ? `${currentWorkspace.name}에서 이 기록을 볼 수 있는 사람을 정합니다.` : "개인 공간 기록은 나만 볼 수 있습니다."}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Form.Item name="visibility" initialValue="PRIVATE" className="mb-0">
                    <Select aria-label="공개 범위" options={currentWorkspace ? [{ value: "PRIVATE", label: "나만 보기" }, { value: "WORKSPACE", label: "워크스페이스 전체" }, { value: "TEAM", label: "선택한 팀" }] : [{ value: "PRIVATE", label: "나만 보기" }]} />
                  </Form.Item>
                  {selectedVisibility === "TEAM" && <Form.Item name="teamId" rules={[{ required: true, message: "팀을 선택해주세요." }]} className="mb-0"><Select aria-label="공개할 팀" placeholder="팀 선택" options={teams.map((team) => ({ value: team.id, label: team.name }))} /></Form.Item>}
                </div>
              </div>
              <Form.Item label="프로젝트" name="projectId" className="mb-0">
                <Select allowClear placeholder="프로젝트 선택" options={projects.map((project) => ({ value: project.id, label: project.name }))} />
              </Form.Item>
              <Form.Item label="이전 기록" name="previousWorkLogId" className="mb-0">
                <Select allowClear showSearch optionFilterProp="label" placeholder="이어지는 이전 기록" options={previousLogs.map((log) => ({ value: log.id, label: log.title }))} />
              </Form.Item>
              <Form.Item label="업무 상태" name="workStatus" initialValue="PLANNED" className="mb-0">
                <Select options={[{ value: "PLANNED", label: "예정" }, { value: "IN_PROGRESS", label: "진행 중" }, { value: "ON_HOLD", label: "보류" }, { value: "COMPLETED", label: "완료" }]} />
              </Form.Item>
              <Form.Item label="우선순위" name="priority" initialValue="NORMAL" className="mb-0">
                <Select options={[{ value: "HIGH", label: "높음" }, { value: "NORMAL", label: "보통" }, { value: "LOW", label: "낮음" }]} />
              </Form.Item>
              <Form.Item label="시작일" name="startDate" className="mb-0"><Input type="date" /></Form.Item>
              <Form.Item label="마감일" name="dueDate" className="mb-0"><Input type="date" /></Form.Item>
              <Form.Item label="장애물·이슈" name="blocker" className="mb-0 md:col-span-2"><Input placeholder="진행을 막는 이슈가 있다면 적어주세요." /></Form.Item>
              <Form.Item label="다음 행동" name="nextAction" className="mb-0 md:col-span-2"><Input placeholder="이 기록 다음에 이어서 할 일을 적어주세요." /></Form.Item>
            </div>
          </section>
        )}

        {/* MainContent 입력 영역: 레이블을 Form.Item 밖으로 분리 */}
        <div className="mb-2 text-sm font-semibold text-[#364154]">
          업무 내용
        </div>
        <Form.Item
          name="mainContent"
          rules={[
            { required: true, message: "메인 작성 내용을 입력해주세요." },
          ]}
          // 배경색, 테두리, 그림자 추가하여 Toast UI와 유사한 시각적 효과 부여
          className="rounded-xl border border-[#e7ddd6] bg-[#fffdfb] transition duration-200"
        >
          <Input.TextArea
            ref={mainContentRef} // ref 연결
            rows={15} // 충분히 큰 높이
            placeholder="(예시를 참고해서, 실제 업무 내용을 자유롭게 수정/추가해서 작성해 주세요.)"
            // Input.TextArea 자체의 테두리와 포커스 스타일을 제거하고 배경을 투명하게 설정하여 컨테이너 스타일과 통합
            className="border-none focus:ring-0 focus:border-0 bg-transparent text-base p-2"
            style={{ resize: "none" }} 
          />
        </Form.Item>
        {isDailyBoard && (
          <div className="flex gap-4 items-center">
            <Form.Item
              label={
                <span className="text-lg font-semibold text-gray-700">
                  비고
                </span>
              }
              name="sideContent"
              rules={[{ required: true, message: "내용을 입력해주세요" }]}
              className="flex-1"
            >
              <Input placeholder={"내용을 입력하세요."} className="w-full" />
            </Form.Item>
          </div>
        )}

		{isDailyBoard && (
		  <section className="rounded-2xl border border-[#eadfd7] bg-[#fffaf6] p-4 md:p-5">
			<div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
			  <div>
				<p className="text-sm font-bold text-[#26344a]">AI 요약 초안</p>
				<p className="mt-1 text-xs leading-5 text-[#7a746f]">원문은 그대로 두고 보고서용 초안만 만듭니다. 내용을 확인하고 수정한 경우에만 함께 저장됩니다.</p>
			  </div>
			  <Button type="default" onClick={generateAiPreview} loading={isAiGenerating} disabled={isSubmitLoading}>
				{aiSummaryPreview ? "초안 다시 만들기" : "AI 초안 만들기"}
			  </Button>
			</div>
			{previewObject ? (
			  <div className="mt-4">
				<div className="grid gap-3 md:grid-cols-2">
				  {(FIELD_ORDER[form.getFieldValue("templateId") || "TPL3"] || Object.keys(previewObject)).filter((key) => key in previewObject).map((key) => (
					<label key={key} className="block text-xs font-semibold text-[#596274]">
					  {FIELD_LABELS[form.getFieldValue("templateId") || "TPL3"]?.[key] || key}
					  <Input.TextArea
						aria-label={`AI 요약 ${FIELD_LABELS[form.getFieldValue("templateId") || "TPL3"]?.[key] || key}`}
						value={typeof previewObject[key] === "string" ? previewObject[key] : JSON.stringify(previewObject[key])}
						onChange={(event) => updateAiSummaryField(key, event.target.value)}
						autoSize={{ minRows: 2, maxRows: 6 }}
						className="mt-1 text-sm leading-6"
					  />
					</label>
				  ))}
				</div>
				<button type="button" onClick={() => setAiSummaryPreview("")} className="mt-2 text-xs font-semibold text-[#a06a55] hover:text-[#d95d3b]">요약 제외하기</button>
			  </div>
			) : (
			  <p className="mt-4 rounded-xl border border-dashed border-[#e5d7ce] bg-white px-4 py-3 text-xs text-[#8a817b]">AI 초안을 만들지 않아도 업무 기록은 정상적으로 저장됩니다.</p>
			)}
		  </section>
		)}

        <Form.Item className="mt-8">
          <Button
            type="primary"
            htmlType="submit"
            className="w-full !border-[#d95d3b] !bg-[#d95d3b] !text-white hover:!border-[#c84f31] hover:!bg-[#c84f31]"
            disabled={isSubmitLoading}
          >
            {isSubmitLoading ? (
              <div className="flex items-center justify-center">
                <Spin size="small" className="mr-2" />
                AI 요약 처리 중...
              </div>
            ) : (
              "기록 저장하기"
            )}
          </Button>
        </Form.Item>
      </Form>

      <Modal
        title="알림"
        open={isModalOpen}
        onCancel={closeModal}
        footer={[
          <Button key="confirm" type="primary" onClick={closeModal}>
            확인
          </Button>,
        ]}
      >
        <p>{modalMessage}</p>
      </Modal>
      <Modal title="새 프로젝트" open={projectModalOpen} onCancel={() => setProjectModalOpen(false)} onOk={createProject} confirmLoading={projectCreating} okText="생성" cancelText="취소">
        <Input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} onPressEnter={createProject} placeholder="프로젝트명을 입력하세요." maxLength={150} />
      </Modal>
    </div>
  );
}

export default Write;
