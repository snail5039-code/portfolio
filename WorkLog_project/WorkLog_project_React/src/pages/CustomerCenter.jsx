// src/pages/CustomerCenter.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Layout,
  Card,
  Typography,
  Row,
  Col,
} from "antd";
import {
  MessageOutlined,
  CustomerServiceOutlined,
  QuestionCircleOutlined,
  BugOutlined,
} from "@ant-design/icons";

const { Content } = Layout;
const { Title, Text } = Typography;

// 색상은 기존 페이지랑 비슷하게
const PAGE_BG = "#f5f5f5";
const CARD_BG = "#ffffff";
const BORDER_COLOR = "#e5e5e5";
const PRIMARY_TEXT = "#111827";
const SECONDARY_TEXT = "#6b7280";

function CustomerCenter() {
  const navigate = useNavigate();

  return (
    <Layout
      style={{
        minHeight: "100vh",
        backgroundColor: PAGE_BG,
        padding: "32px 16px",
      }}
    >
      <Content
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        {/* 🔹 상단 큰 네모영역 */}
        <Card
          style={{
            backgroundColor: CARD_BG,
            borderColor: BORDER_COLOR,
            borderRadius: 16,
            marginBottom: 32,
            boxShadow: "0 16px 40px rgba(15,23,42,0.08)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 24,
              minHeight: 140,
              justifyContent: "center",
            }}
          >
            {/* 상단 이미지 느낌 아이콘 */}
            <MessageOutlined
              style={{ fontSize: 56, color: "#2563eb" }}
            />
            <div style={{ textAlign: "left" }}>
              <Title
                level={3}
                style={{
                  margin: 0,
                  color: PRIMARY_TEXT,
                  fontWeight: 600,
                }}
              >
                무엇을 도와드릴까요?
              </Title>
              <Text style={{ color: SECONDARY_TEXT }}>
                아래 메뉴에서 원하시는 도움말을 선택해주세요.
              </Text>
            </div>
          </div>
        </Card>

        {/* 🔹 아래 작은 네모 3개 */}
        <Row gutter={[24, 24]} justify="center">
          
          <Col xs={24} sm={8}>
            <Card
              hoverable
              style={{
                backgroundColor: CARD_BG,
                borderColor: BORDER_COLOR,
                borderRadius: 14,
                textAlign: "center",
                minHeight: 150,
              }}
              onClick={() => {
                navigate("/list?boardId=7");
              }}
            >
              <CustomerServiceOutlined
                style={{ fontSize: 40, color: "#2563eb", marginBottom: 12 }}
              />
              <Title level={5} style={{ marginBottom: 4, color: PRIMARY_TEXT }}>
                템플릿 등록
              </Title>
              <Text style={{ color: SECONDARY_TEXT, fontSize: 13 }}>
                새로운 템플릿을 <br /> 등록하고 싶어요.
              </Text>
            </Card>
          </Col>

          {/* 자주 묻는 질문 */}
          <Col xs={24} sm={8}>
            <Card
              hoverable
              style={{
                backgroundColor: CARD_BG,
                borderColor: BORDER_COLOR,
                borderRadius: 14,
                textAlign: "center",
                minHeight: 150,
              }}
              onClick={() => {
                navigate("/list?boardId=8");
              }}
            >
              
              <QuestionCircleOutlined
                style={{ fontSize: 40, color: "#10b981", marginBottom: 12 }}
              />
              <Title level={5} style={{ marginBottom: 4, color: PRIMARY_TEXT }}>
                자주 묻는 질문
              </Title>
              <Text style={{ color: SECONDARY_TEXT, fontSize: 13 }}>
                자주 들어오는 질문과<br />답변을 한 번에 확인해요.
              </Text>
            </Card>
          </Col>

          {/* 오류사항 접수 */}
          <Col xs={24} sm={8}>
            <Card
              hoverable
              style={{
                backgroundColor: CARD_BG,
                borderColor: BORDER_COLOR,
                borderRadius: 14,
                textAlign: "center",
                minHeight: 150,
              }}
              onClick={() => {
                navigate("/list?boardId=9");
              }}
            >
              <BugOutlined
                style={{ fontSize: 40, color: "#f97316", marginBottom: 12 }}
              />
              <Title level={5} style={{ marginBottom: 4, color: PRIMARY_TEXT }}>
                오류사항 접수
              </Title>
              <Text style={{ color: SECONDARY_TEXT, fontSize: 13 }}>
                화면 버그, 오류, 불편한 점을<br />개발자에게 남겨주세요.
              </Text>
            </Card>
          </Col>
        </Row>
      </Content>
    </Layout>
  );
}

export default CustomerCenter;
