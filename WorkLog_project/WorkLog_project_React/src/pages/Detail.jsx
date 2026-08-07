import React, { useEffect, useState, useContext } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Button,
  message,
  Typography,
  Layout,
  Card,
  Row,
  Col,
  Divider,
  Modal,
} from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { AuthContext } from "../context/AuthContext";
import SummaryTable from "../components/summary/SummaryTable";
import CommentBox from "../components/work/CommentBox";

const { Content } = Layout;
const { Title, Text } = Typography;

const LOGIN_REQUIRED_KEY = "login_required_message";

// === 디자인 변수 (Minimal, Professional, Light) ===
const PAGE_BG = "#f5f5f5"; // 전체 배경 (밝은 회색)
const CARD_BG = "#ffffff"; // 카드 배경 (흰색)
const BORDER_COLOR = "#e5e5e5"; // 구분선 및 테두리 색상 (옅은 회색)
const PRIMARY_TEXT = "#111827"; // 기본 텍스트 색상 (진한 회색)
const SECONDARY_TEXT = "#6b7280"; // 보조 텍스트 색상 (중간 회색)
const ACCENT_COLOR = "#2563eb"; // 버튼 및 링크 강조 색상 (파란색)
const MUTED_BG = "#f9fafb"; // 박스용 연한 배경

// 디자인은 차후 수정 예정
function Detail() {
  const navigate = useNavigate();
  const { isLoginedId, authLoaded } = useContext(AuthContext);

  const { id } = useParams();
  const [workLog, setWorkLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fileAttaches, setFileAttaches] = useState([]); // 파일들임

  const [summaryJsonData, setSummaryJsonData] = useState(null);
  const [summaryContentMarkdown, setSummaryContentMarkdown] = useState(null); // JSON이 아닌 원본 내용을 표시하기 위해 유지

  const boardId = workLog?.boardId; //옵셔널 체이닝 문법이라 ? 붙임
  const isDailyBoard = boardId === 4;
  const isWorkLogBoard = boardId === 4 || boardId === 5 || boardId === 6;
  const isOwner = isLoginedId !== 0 && workLog?.memberId === isLoginedId;
  const isTemplateBoard = boardId === 7;

  useEffect(() => {
    if (!authLoaded) return; // 세션 확인 전에는 아무것도 안 함

    if (isLoginedId === 0) {
      message.error({
        content: "게시글 보기는 로그인 후 이용 가능합니다.",
        key: LOGIN_REQUIRED_KEY,
        duration: 5,
      });
      navigate("/login");
    }
  }, [authLoaded, isLoginedId, navigate]);

  // 🚨 [수정된 로직] JSON 문자열에서 불필요한 마크다운 백틱(`)이나 설명 텍스트를 제거하고 순수한 JSON을 추출합니다.
  const extractPureJson = (text) => {
    if (!text) return null;

    // 1. JSON 시작 문자 ({ 또는 [)의 인덱스를 찾습니다.
    const startIndex = text.search(/[\{\[]/);
    if (startIndex === -1) {
      console.warn("JSON 시작 문자({ 또는 [)를 찾을 수 없습니다.");
      return null;
    }

    // 2. 시작 인덱스부터 문자열의 끝까지의 서브스트링을 준비합니다.
    let pureJsonCandidate = text.substring(startIndex).trim();

    // 3. JSON의 끝 인덱스를 찾습니다. (가장 마지막에 나오는 } 또는 ]의 위치를 찾습니다)
    let lastBrace = pureJsonCandidate.lastIndexOf("}");
    let lastBracket = pureJsonCandidate.lastIndexOf("]");
    let endIndex = -1;

    // 가장 뒤에 나오는 닫는 괄호나 대괄호를 JSON의 끝으로 간주합니다.
    if (lastBrace > lastBracket) {
      endIndex = lastBrace;
    } else if (lastBracket > -1) {
      endIndex = lastBracket;
    }

    // 4. 끝 인덱스를 찾았다면 (그리고 시작 인덱스보다 뒤에 있다면),
    // 시작부터 끝까지 (+1을 하여 닫는 괄호 포함) 잘라냅니다.
    if (endIndex !== -1 && endIndex > 0) {
      pureJsonCandidate = pureJsonCandidate.substring(0, endIndex + 1).trim();
    } else {
      // 끝을 찾지 못했다면 파싱을 시도하지 않습니다. (JSON이 제대로 닫히지 않음)
      console.warn("JSON 닫는 문자(} 또는 ])를 찾을 수 없습니다.");
      return null;
    }

    // 5. 최종 추출된 순수한 JSON 후보 문자열을 반환합니다.
    return pureJsonCandidate;
  };
  // 🚨 [수정된 로직 끝]

  useEffect(() => {
    if (!authLoaded) return;
    if (!isLoginedId) return;

    const API_URL = `http://localhost:8081/api/usr/work/detail/${id}`;

    async function fetchDetail() {
      try {
        setLoading(true);
        const response = await fetch(API_URL, {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const fetchedData = await response.json();
        setWorkLog(fetchedData);
        setFileAttaches(fetchedData.fileAttaches || []);

        // ✅ 요약 파싱
        if (fetchedData.summaryContent) {
          setSummaryContentMarkdown(fetchedData.summaryContent);
          try {
            const parsed = JSON.parse(fetchedData.summaryContent);
            setSummaryJsonData(parsed);
          } catch (e) {
            console.warn(
              "summaryContent JSON 파싱 실패, 일반 텍스트로 처리:",
              e
            );
            setSummaryJsonData(null);
          }
        } else {
          setSummaryJsonData(null);
          setSummaryContentMarkdown(null);
        }
      } catch (error) {
        console.error("데이터 불러오기 실패:", error);
        message.error("게시글을 불러오는 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }

    fetchDetail();
  }, [authLoaded, isLoginedId, id]);

  const handleDelete = () => {
    Modal.confirm({
      title: "게시글 삭제",
      content: "정말 이 게시글을 삭제하시겠습니까?",
      okText: "삭제",
      cancelText: "취소",
      okButtonProps: {
        style: {
          backgroundColor: ACCENT_COLOR,
          borderColor: ACCENT_COLOR,
        },
      },
      cancelButtonProps: {
        style: {
          borderRadius: 999,
        },
      },
      async onOk() {
        try {
          const res = await fetch(`http://localhost:8081/api/usr/work/${id}`, {
            method: "DELETE",
            credentials: "include",
          });

          if (!res.ok) {
            throw new Error("삭제에 실패했습니다.");
          }

          message.success("게시글이 삭제되었습니다.");

          // 삭제 후 이동: 같은 게시판 목록으로
          if (workLog.boardId) {
            navigate(`/list?boardId=${workLog.boardId}`);
          } else {
            navigate("/list");
          }
        } catch (error) {
          console.error(error);
          message.error(error.message || "삭제 중 오류가 발생했습니다.");
        }
      },
    });
  };

  // 렌더링 오류 방지 코드임 (밝은 테마로 변경)
  if (loading) {
    return (
      <Layout style={{ minHeight: "100vh", backgroundColor: PAGE_BG }}>
        <Content
          style={{
            maxWidth: 600,
            margin: "0 auto",
            paddingTop: "120px",
            textAlign: "center",
          }}
        >
          <Card
            style={{
              backgroundColor: CARD_BG,
              borderColor: BORDER_COLOR,
              borderRadius: 16,
              boxShadow: "0 10px 25px rgba(15, 23, 42, 0.06)",
            }}
          >
            <Text style={{ color: SECONDARY_TEXT, fontSize: 15 }}>
              게시글 로딩 중...
            </Text>
          </Card>
        </Content>
      </Layout>
    );
  }

  if (!workLog || Object.keys(workLog).length === 0) {
    return (
      <Layout style={{ minHeight: "100vh", backgroundColor: PAGE_BG }}>
        <Content
          style={{
            maxWidth: 600,
            margin: "0 auto",
            paddingTop: "120px",
            textAlign: "center",
          }}
        >
          <Card
            style={{
              backgroundColor: CARD_BG,
              borderColor: BORDER_COLOR,
              borderRadius: 16,
              boxShadow: "0 10px 25px rgba(15, 23, 42, 0.06)",
            }}
          >
            <Text style={{ color: SECONDARY_TEXT, fontSize: 15 }}>
              게시글이 없습니다.
            </Text>
          </Card>
        </Content>
      </Layout>
    );
  }

  const handleDownloadTemplate = () => {
    const templateId = workLog.templateId || "TPL1";
    const url = `http://localhost:8081/api/worklogs/${id}/download/${templateId}`;
    window.open(url, "_blank");
  };

  return (
    // 전체 레이아웃 (밝은 배경 적용)
    <Layout
      style={{
        minHeight: "100vh",
        backgroundColor: PAGE_BG,
        padding: "32px 16px",
      }}
    >
      {/* 2. 메인 콘텐츠 영역 */}
      <Content
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        <Card
          style={{
            backgroundColor: CARD_BG,
            borderColor: BORDER_COLOR,
            color: PRIMARY_TEXT,
            borderRadius: 16,
            boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
          }}
          styles={{ body: { padding: "32px" } }}
          variant="outlined"
        >
          {/* 제목 영역 */}
          <Title
            level={2}
            style={{
              color: PRIMARY_TEXT,
              marginTop: 0,
              borderBottom: `1px solid ${BORDER_COLOR}`,
              paddingBottom: "16px",
              marginBottom: "24px",
              fontWeight: 600,
              letterSpacing: "-0.02em",
            }}
          >
            <span
              style={{
                color: SECONDARY_TEXT,
                fontSize: "0.85em",
                marginRight: "10px",
              }}
            >
              제목
            </span>
            <span>{workLog.title}</span>
          </Title>

          {/* 메타 정보 (작성자, 작성일) - DB 원본 */}
          <Row gutter={[16, 16]} style={{ marginBottom: "28px" }}>
            <Col xs={24} sm={12}>
              <Text style={{ color: SECONDARY_TEXT, fontSize: "14px" }}>
                작성자
              </Text>
              <div>
                <Text
                  style={{
                    color: PRIMARY_TEXT,
                    marginTop: 4,
                    fontWeight: 500,
                    fontSize: 15,
                  }}
                >
                  {workLog.memberName} ({workLog.writerName})
                </Text>
              </div>
            </Col>
            <Col xs={24} sm={12}>
              <Text style={{ color: SECONDARY_TEXT, fontSize: "14px" }}>
                작성일
              </Text>
              <div>
                <Text
                  style={{
                    color: PRIMARY_TEXT,
                    marginTop: 4,
                    fontWeight: 400,
                    fontSize: 15,
                  }}
                >
                  {workLog.regDate}
                </Text>
              </div>
            </Col>
          </Row>

          {/* 주요 업무 내용 */}
          {isWorkLogBoard && (
            <Divider
              titlePlacement="start"
              style={{
                color: SECONDARY_TEXT,
                borderColor: BORDER_COLOR,
                margin: "32px 0 16px 0",
                fontSize: "15px",
              }}
            >
              주요 업무 내용
            </Divider>
          )}
          <div
            style={{
              whiteSpace: "pre-wrap",
              color: PRIMARY_TEXT,
              lineHeight: 1.8,
              fontSize: "15px",
              backgroundColor: MUTED_BG,
              borderRadius: 12,
              padding: "16px 18px",
              border: `1px solid ${BORDER_COLOR}`,
            }}
          >
            {workLog.mainContent}
          </div>

          {/* 🧩 템플릿 게시판(7번) 전용: 첨부 템플릿 파일 다운로드 버튼 */}
          {isTemplateBoard && (
            <>
              <Divider
                titlePlacement="start"
                style={{
                  color: SECONDARY_TEXT,
                  borderColor: BORDER_COLOR,
                  margin: "32px 0 16px 0",
                  fontSize: "15px",
                }}
              >
                템플릿 파일
              </Divider>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                  flexWrap: "wrap",
                  marginBottom: "12px",
                  padding: "12px 16px",
                  borderRadius: 12,
                  backgroundColor: MUTED_BG,
                  border: `1px dashed ${BORDER_COLOR}`,
                }}
              >
                <Text style={{ color: SECONDARY_TEXT, fontSize: "13px" }}>
                  이 게시글에 첨부된 DOCX 템플릿 파일을 다운로드합니다.
                </Text>

                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={() => {
                    window.location.href = `http://localhost:8081/api/usr/work/${id}/template-download`;
                  }}
                  style={{
                    backgroundColor: ACCENT_COLOR,
                    borderColor: ACCENT_COLOR,
                    height: "40px",
                    padding: "0 18px",
                    fontWeight: 500,
                    fontSize: "14px",
                  }}
                >
                  템플릿 다운로드
                </Button>
              </div>
            </>
          )}

          {/* 📄 AI 요약 DOCX 다운로드 (첨부파일 리스트는 제거) */}
          {isWorkLogBoard && (
            <>
              <Divider
                titlePlacement="start"
                style={{
                  color: SECONDARY_TEXT,
                  borderColor: BORDER_COLOR,
                  margin: "40px 0 16px 0",
                  fontSize: "15px",
                }}
              >
                보고서 다운로드
              </Divider>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                  flexWrap: "wrap",
                  marginBottom: "12px",
                  padding: "12px 16px",
                  borderRadius: 12,
                  backgroundColor: MUTED_BG,
                  border: `1px dashed ${BORDER_COLOR}`,
                }}
              >
                <Text style={{ color: SECONDARY_TEXT, fontSize: "13px" }}>
                  선택한 템플릿(
                  <span style={{ fontWeight: 600, color: PRIMARY_TEXT }}>
                    {workLog.templateId || "TPL1"}
                  </span>
                  ) 기준으로 AI 요약 내용을 채운 Word 파일(DOCX)을
                  다운로드합니다.
                </Text>

                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={handleDownloadTemplate}
                  style={{
                    backgroundColor: ACCENT_COLOR,
                    borderColor: ACCENT_COLOR,
                    height: "40px",
                    padding: "0 18px",
                    fontWeight: 500,
                    fontSize: "14px",
                  }}
                >
                  {(workLog.templateId || "TPL1") + " DOCX 다운로드"}
                </Button>
              </div>
            </>
          )}
          {/* 비고 */}
          {isWorkLogBoard && (
            <>
              <Divider
                titlePlacement="start"
                style={{
                  color: SECONDARY_TEXT,
                  borderColor: BORDER_COLOR,
                  margin: "40px 0 16px 0",
                  fontSize: "15px",
                }}
              >
                비고
              </Divider>
              <div
                style={{
                  whiteSpace: "pre-wrap",
                  color: PRIMARY_TEXT,
                  lineHeight: 1.8,
                  fontSize: "15px",
                  minHeight: "50px",
                  backgroundColor: MUTED_BG,
                  borderRadius: 12,
                  padding: "12px 14px",
                  border: `1px solid ${BORDER_COLOR}`,
                }}
              >
                {workLog.sideContent || (
                  <Text type="secondary" style={{ color: SECONDARY_TEXT }}>
                    -
                  </Text>
                )}
              </div>
            </>
          )}

          {/* 요약 내용 (조건부 렌더링) */}
          {isDailyBoard && workLog.summaryContent && (
            <>
              <Divider
                titlePlacement="start"
                style={{
                  color: SECONDARY_TEXT,
                  borderColor: BORDER_COLOR,
                  margin: "40px 0 16px 0",
                  fontSize: "15px",
                }}
              >
                AI 분석 요약 내용
              </Divider>

              {/* 순수 JSON 파싱이 실패했을 경우, 원본 텍스트를 마크다운이 아닌 일반 텍스트로 표시 */}
              {!summaryJsonData && (
                <pre
                  style={{
                    whiteSpace: "pre-wrap",
                    color: SECONDARY_TEXT,
                    backgroundColor: MUTED_BG,
                    padding: "15px",
                    borderRadius: "8px",
                    border: `1px solid ${BORDER_COLOR}`,
                    fontSize: 13,
                  }}
                >
                  AI 보고서 파싱 실패 또는 JSON 형식이 아님. 원본 내용:
                  {"\n\n"}
                  {summaryContentMarkdown}
                </pre>
              )}

              {/* JSON 파싱 성공 시에만 SummaryTable을 호출하여 모든 JSON 데이터를 출력 */}
              {summaryJsonData && (
                <Card
                  title={
                    <span
                      style={{
                        color: PRIMARY_TEXT,
                        fontWeight: 500,
                        fontSize: 15,
                      }}
                    >
                      AI 분석 결과
                    </span>
                  }
                  variant="outlined"
                  style={{
                    backgroundColor: "#ffffff",
                    borderColor: BORDER_COLOR,
                    borderRadius: 12,
                  }}
                  styles={{
                    header: {
                      borderBottom: `1px solid ${BORDER_COLOR}`,
                      backgroundColor: "#f9fafb",
                    },
                  }}
                >
                  <SummaryTable
                    summaryJson={summaryJsonData}
                    templateId={workLog.templateId || "TPL1"}
                    primaryText={PRIMARY_TEXT}
                    secondaryText={SECONDARY_TEXT}
                    borderColor={BORDER_COLOR}
                  />
                </Card>
              )}
            </>
          )}
          {/* 댓글 영역 */}
          <Divider
            titlePlacement="start"
            style={{
              color: SECONDARY_TEXT,
              borderColor: BORDER_COLOR,
              margin: "40px 0 16px 0",
              fontSize: "15px",
            }}
          >
            댓글
          </Divider>

          <CommentBox workLogId={id} currentUserId={isLoginedId} />
          {/* 하단: 수정하기 버튼만 */}
          {isOwner && (
            <div
              style={{
                marginTop: "40px",
                display: "flex",
                justifyContent: "flex-end",
                gap: "8px",
              }}
            >
                <Button
                  onClick={handleDelete}
                  type="primary"
                  style={{
                    height: "44px",
                    padding: "0 18px",
                    fontWeight: 500,
                    fontSize: "16px",
                    borderRadius: 999,
                  }}
                >
                  삭제하기
                </Button>
              <Link to={`/Modify/${id}`}>
                <Button
                  type="primary"
                  style={{
                    backgroundColor: ACCENT_COLOR,
                    borderColor: ACCENT_COLOR,
                    height: "44px",
                    padding: "0 24px",
                    fontWeight: 500,
                    fontSize: "16px",
                    borderRadius: 999,
                  }}
                >
                  수정하기
                </Button>
              </Link>
            </div>
          )}
        </Card>
      </Content>
    </Layout>
  );
}

export default Detail;
