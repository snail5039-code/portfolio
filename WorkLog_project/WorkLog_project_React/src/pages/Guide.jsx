// src/pages/HowToUse.jsx
import React from "react";
import { Layout, Row, Col, Card, Typography, Tag } from "antd";

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;

const PAGE_BG = "#f5f5f5";
const CARD_BG = "#ffffff";
const BORDER_COLOR = "#e5e5e5";
const PRIMARY_TEXT = "#111827";
const SECONDARY_TEXT = "#6b7280";

// 각 모드별 사진
const dailyImage =
  "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=900&q=80";
const weeklyImage =
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80";
const monthlyImage =
  "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=900&q=80";
const handoverImage =
  "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=900&q=80";

function Guide() {
  return (
    <Layout
      style={{
        minHeight: "100vh",
        backgroundColor: PAGE_BG,
        padding: "32px 16px 60px",
      }}
    >
      <Content
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          width: "100%",
        }}
      >
        {/* 상단 타이틀 */}
        <div
          style={{
            marginBottom: 28,
            textAlign: "left",
          }}
        >
          <Title
            level={2}
            style={{
              color: PRIMARY_TEXT,
              marginBottom: 4,
              wordBreak: "keep-all",
            }}
          >
            WorkLog 이용 방법
          </Title>
          <Text style={{ color: SECONDARY_TEXT, fontSize: 14 }}>
            모든 모드의 공통점: <b>“하루 업무만 꼼꼼히 적으면 된다”</b>는 점이에요.
            WorkLog가 나머지를 자동으로 정리합니다.
          </Text>
        </div>

        {/* 4가지 모드 카드 */}
        <Row gutter={[24, 24]}>
          {/* 일일 */}
          <Col xs={24} md={12}>
            <Card
              style={{
                backgroundColor: CARD_BG,
                borderRadius: 20,
                borderColor: BORDER_COLOR,
                overflow: "hidden",
                height: "100%",
              }}
              bodyStyle={{ padding: 0 }}
            >
              <div
                style={{
                  height: 140,
                  backgroundImage: `url("${dailyImage}")`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              <div style={{ padding: "16px 18px 18px" }}>
                <Tag color="blue" style={{ marginBottom: 8 }}>
                  일일 업무일지
                </Tag>
                <Title
                  level={4}
                  style={{ marginBottom: 8, color: PRIMARY_TEXT }}
                >
                  오늘 하루, 핵심만 빠르게 기록하기
                </Title>
                <Paragraph
                  style={{
                    color: SECONDARY_TEXT,
                    fontSize: 14,
                    lineHeight: 1.7,
                    marginBottom: 8,
                  }}
                >
                  매일 퇴근 전에 3~5분 정도 투자해서 오늘 한 일을 정리합니다.
                </Paragraph>
                <ul
                  style={{
                    paddingLeft: 18,
                    margin: 0,
                    color: SECONDARY_TEXT,
                    fontSize: 13,
                    lineHeight: 1.7,
                  }}
                >
                  <li>메뉴에서 <b>일일 업무일지</b>를 선택하고 새 글 작성</li>
                  <li>진행한 업무, 진행 상태, 이슈 사항을 간단히 적기</li>
                  <li>필요하면 첨부파일(보고서, 캡처) 같이 업로드</li>
                  <li>저장하면 AI가 요약 내용을 함께 생성 (설정에 따라)</li>
                </ul>
              </div>
            </Card>
          </Col>

          {/* 주간 */}
          <Col xs={24} md={12}>
            <Card
              style={{
                backgroundColor: CARD_BG,
                borderRadius: 20,
                borderColor: BORDER_COLOR,
                overflow: "hidden",
                height: "100%",
              }}
              bodyStyle={{ padding: 0 }}
            >
              <div
                style={{
                  height: 140,
                  backgroundImage: `url("${weeklyImage}")`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              <div style={{ padding: "16px 18px 18px" }}>
                <Tag color="green" style={{ marginBottom: 8 }}>
                  주간 보고
                </Tag>
                <Title
                  level={4}
                  style={{ marginBottom: 8, color: PRIMARY_TEXT }}
                >
                  한 주의 성과를 자동으로 정리하기
                </Title>
                <Paragraph
                  style={{
                    color: SECONDARY_TEXT,
                    fontSize: 14,
                    lineHeight: 1.7,
                    marginBottom: 8,
                  }}
                >
                  한 주 동안 작성한 일일 업무일지를 기반으로 주간 보고서를
                  생성합니다.
                </Paragraph>
                <ul
                  style={{
                    paddingLeft: 18,
                    margin: 0,
                    color: SECONDARY_TEXT,
                    fontSize: 13,
                    lineHeight: 1.7,
                  }}
                >
                  <li>메뉴에서 <b>주간 보고</b>를 선택</li>
                  <li>주차(예: 2024년 2주차)를 선택하면 해당 기간 일지가 자동 조회</li>
                  <li>AI가 주요 이슈·성과·다음 주 계획을 요약해서 보여줌</li>
                  <li>DOCX로 내려받아 팀 주간회의 자료로 활용</li>
                </ul>
              </div>
            </Card>
          </Col>

          {/* 월간 */}
          <Col xs={24} md={12}>
            <Card
              style={{
                backgroundColor: CARD_BG,
                borderRadius: 20,
                borderColor: BORDER_COLOR,
                overflow: "hidden",
                height: "100%",
              }}
              bodyStyle={{ padding: 0 }}
            >
              <div
                style={{
                  height: 140,
                  backgroundImage: `url("${monthlyImage}")`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              <div style={{ padding: "16px 18px 18px" }}>
                <Tag color="purple" style={{ marginBottom: 8 }}>
                  월간 보고
                </Tag>
                <Title
                  level={4}
                  style={{ marginBottom: 8, color: PRIMARY_TEXT }}
                >
                  한 달치 업무를 리포트로 변환
                </Title>
                <Paragraph
                  style={{
                    color: SECONDARY_TEXT,
                    fontSize: 14,
                    lineHeight: 1.7,
                    marginBottom: 8,
                  }}
                >
                  월 단위로 주요 프로젝트, 지표 변화, 업무량을 정리할 때
                  사용합니다.
                </Paragraph>
                <ul
                  style={{
                    paddingLeft: 18,
                    margin: 0,
                    color: SECONDARY_TEXT,
                    fontSize: 13,
                    lineHeight: 1.7,
                  }}
                >
                  <li>메뉴에서 <b>월간 보고</b> 선택 후 대상 월 지정</li>
                  <li>해당 월의 일일·주간 데이터를 자동 집계</li>
                  <li>프로젝트별/카테고리별로 정리된 요약 확인</li>
                  <li>경영 보고용 Word 양식으로 바로 다운로드</li>
                </ul>
              </div>
            </Card>
          </Col>

          {/* 인수인계 */}
          <Col xs={24} md={12}>
            <Card
              style={{
                backgroundColor: CARD_BG,
                borderRadius: 20,
                borderColor: BORDER_COLOR,
                overflow: "hidden",
                height: "100%",
              }}
              bodyStyle={{ padding: 0 }}
            >
              <div
                style={{
                  height: 140,
                  backgroundImage: `url("${handoverImage}")`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              <div style={{ padding: "16px 18px 18px" }}>
                <Tag color="orange" style={{ marginBottom: 8 }}>
                  인수인계
                </Tag>
                <Title
                  level={4}
                  style={{ marginBottom: 8, color: PRIMARY_TEXT }}
                >
                  교대·퇴사 시 인수인계 문서 자동 생성
                </Title>
                <Paragraph
                  style={{
                    color: SECONDARY_TEXT,
                    fontSize: 14,
                    lineHeight: 1.7,
                    marginBottom: 8,
                  }}
                >
                  특정 기간의 업무일지에서 중요한 정보만 뽑아서 인수인계
                  문서로 만들어 줍니다.
                </Paragraph>
                <ul
                  style={{
                    paddingLeft: 18,
                    margin: 0,
                    color: SECONDARY_TEXT,
                    fontSize: 13,
                    lineHeight: 1.7,
                  }}
                >
                  <li>메뉴에서 <b>인수인계</b> 선택</li>
                  <li>인수인계 대상자와 기간(예: 최근 2개월) 지정</li>
                  <li>AI가 주요 업무, 시스템, 주의사항, 미해결 이슈 정리</li>
                  <li>회사 양식 DOCX 템플릿에 자동 채워서 다운로드</li>
                </ul>
              </div>
            </Card>
          </Col>
        </Row>
      </Content>
    </Layout>
  );
}

export default Guide;
