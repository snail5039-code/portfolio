// src/pages/About.jsx
import React from "react";
import { Layout, Row, Col, Card, Typography, Timeline, Divider } from "antd";

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;

const PAGE_BG = "#f5f5f5";
const CARD_BG = "#ffffff";
const BORDER_COLOR = "#e5e5e5";
const PRIMARY_TEXT = "#111827";
const SECONDARY_TEXT = "#6b7280";

// 사진 URL (원하면 나중에 이것만 교체하면 됨)
const heroImage =
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=80";
const teamImage =
  "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80";
const workspaceImage =
  "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80";

function About() {
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
        {/* 상단 히어로 섹션 */}
        <Card
          style={{
            borderRadius: 24,
            border: "none",
            marginBottom: 32,
            overflow: "hidden",
          }}
          bodyStyle={{ padding: 0 }}
        >
          <div
            style={{
              position: "relative",
              minHeight: 260,
              backgroundImage: `url("${heroImage}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(90deg, rgba(15,23,42,0.75), rgba(15,23,42,0.3))",
              }}
            />
            <div
              style={{
                position: "relative",
                padding: "40px 32px 48px",
                maxWidth: 640,
              }}
            >
              <Title
                level={2}
                style={{
                  color: "#f9fafb",
                  marginBottom: 12,
                  letterSpacing: "-0.03em",
                  wordBreak: "keep-all",
                }}
              >
                업무를 효율적으로, WorkLog와 함께
              </Title>
              <Paragraph
                style={{
                  margin: 0,
                  color: "#e5e7eb",
                  fontSize: 15,
                  lineHeight: 1.7,
                  wordBreak: "keep-all",
                }}
              >
                WorkLog는 반복적인 업무일지·보고서 작성을 줄이고, 팀이 더 중요한
                업무에 집중할 수 있도록 돕는 문서 자동화 플랫폼입니다.
              </Paragraph>
            </div>
          </div>
        </Card>

        {/* 소개 카드 2개 */}
        <Row gutter={[24, 24]} style={{ marginBottom: 40 }}>
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
                  height: 160,
                  backgroundImage: `url("${teamImage}")`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              <div style={{ padding: "18px 20px 20px" }}>
                <Title
                  level={4}
                  style={{
                    color: PRIMARY_TEXT,
                    marginBottom: 8,
                    wordBreak: "keep-all",
                  }}
                >
                  WorkLog가 지향하는 가치
                </Title>
                <Paragraph
                  style={{
                    marginBottom: 0,
                    color: SECONDARY_TEXT,
                    fontSize: 14,
                    lineHeight: 1.7,
                    wordBreak: "keep-all",
                  }}
                >
                  단순한 &quot;업무일지 사이트&quot;가 아니라, 팀의 지식과
                  노하우가 자연스럽게 쌓이는 업무 기록 플랫폼을 목표로 합니다.
                  AI 요약과 템플릿을 통해 보고 문서를 자동으로 만들어 주어,
                  보고서 작성 스트레스를 줄여 줍니다.
                </Paragraph>
              </div>
            </Card>
          </Col>

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
                  height: 160,
                  backgroundImage: `url("${workspaceImage}")`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              <div style={{ padding: "18px 20px 20px" }}>
                <Title
                  level={4}
                  style={{
                    color: PRIMARY_TEXT,
                    marginBottom: 8,
                    wordBreak: "keep-all",
                  }}
                >
                  이런 팀을 위해 만들어졌어요
                </Title>
                <Paragraph
                  style={{
                    marginBottom: 0,
                    color: SECONDARY_TEXT,
                    fontSize: 14,
                    lineHeight: 1.7,
                    wordBreak: "keep-all",
                  }}
                >
                  • 일일 업무일지 / 주간·월간 보고가 많은 조직
                  <br />
                  • 잦은 인수인계, 교대 근무로 정보 공유가 중요한 팀
                  <br />
                  • 기존 문서 양식은 유지하면서 자동화만 도입하고 싶은 회사
                </Paragraph>
              </div>
            </Card>
          </Col>
        </Row>

        {/* 연혁 섹션 */}
        <Card
          style={{
            backgroundColor: CARD_BG,
            borderRadius: 20,
            borderColor: BORDER_COLOR,
          }}
        >
          <Title
            level={4}
            style={{
              color: PRIMARY_TEXT,
              marginBottom: 8,
              wordBreak: "keep-all",
            }}
          >
            WorkLog 연혁
          </Title>
          <Text style={{ color: SECONDARY_TEXT, fontSize: 13 }}>
            우리의 날들
          </Text>

          <Divider style={{ margin: "16px 0 18px" }} />

          <Timeline
            items={[
              {
                label: "2024.03",
                children: (
                  <Text style={{ color: PRIMARY_TEXT }}>
                    업무일지 자동화 사이드 프로젝트로 WorkLog 초기 버전 개발
                  </Text>
                ),
              },
              {
                label: "2024.06",
                children: (
                  <Text style={{ color: PRIMARY_TEXT }}>
                    일일 업무일지 · 주간/월간 보고 템플릿 기능 추가
                  </Text>
                ),
              },
              {
                label: "2024.09",
                children: (
                  <Text style={{ color: PRIMARY_TEXT }}>
                    AI 요약 기반 인수인계 문서 자동 생성 기능 출시
                  </Text>
                ),
              },
              {
                label: "2024.12",
                children: (
                  <Text style={{ color: PRIMARY_TEXT }}>
                    개인/팀 단위 베타 운영 및 UI 개편 (현재 버전)
                  </Text>
                ),
              },
            ]}
          />
        </Card>
      </Content>
    </Layout>
  );
}

export default About;
