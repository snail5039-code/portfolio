import React, { useEffect, useState, useContext, useRef } from "react";
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
import { TEMPLATE_MAIN_PLACEHOLDER } from "../config/templateSummaryConfig";

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
  { value: "TPL1", label: "템플릿1 - 주간 업무일지" },
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
  // Context에서 로그인 ID를 가져옵니다.
  const { isLoginedId, authLoaded } = useContext(AuthContext);
  // 메인 콘텐츠 TextArea에 접근하기 위한 Ref
  const mainContentRef = useRef(null);

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

  const handleTemplateChange = (value) => {
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
          "http://localhost:8081/api/usr/work/simplePost",
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
    formData.append("sideContent", values.sideContent);
    formData.append("templateId", values.templateId || "TPL1");

    if (values.files && values.files.length > 0) {
      values.files.forEach((fileObj) => {
        formData.append("files", fileObj.originFileObj);
      });
    }

    try {
      const response = await fetch(
        "http://localhost:8081/api/usr/work/workLog",
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
          openModal("등록이 완료되었습니다. (AI 요약 포함!)");
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
    <div className="app-container max-w-2xl mx-auto p-6 space-y-4">
      <div className="flex justify-between">
        <div className="text-xl font-bold p-2 border-b text-start">
          WorkLog Write
        </div>
      </div>
      <Form
        form={form}
        layout="vertical"
        className="space-y-4"
        onFinish={handleSubmit}
        disabled={isSubmitLoading}
      >
        {/* ✅ 게시판 선택 */}
        <Form.Item
          label={
            <span className="text-lg font-semibold text-gray-700">게시판</span>
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
            <span className="text-lg font-semibold text-gray-700">Title</span>
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
            initialValue="TPL1"
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

        {/* MainContent 입력 영역: 레이블을 Form.Item 밖으로 분리 */}
        <div className="text-lg font-semibold text-gray-700 mb-2">
          MainContent
        </div>
        <Form.Item
          name="mainContent"
          rules={[
            { required: true, message: "메인 작성 내용을 입력해주세요." },
          ]}
          // 배경색, 테두리, 그림자 추가하여 Toast UI와 유사한 시각적 효과 부여
          className="bg-gray-50 border border-gray-200 rounded-lg shadow-md transition duration-200"
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

        <Form.Item className="mt-8">
          <Button
            type="primary"
            htmlType="submit"
            className="w-full bg-blue-500 hover:bg-blue-600"
            disabled={isSubmitLoading}
          >
            {isSubmitLoading ? (
              <div className="flex items-center justify-center">
                <Spin size="small" className="mr-2" />
                AI 요약 처리 중...
              </div>
            ) : (
              "등록하기"
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
    </div>
  );
}

export default Write;
