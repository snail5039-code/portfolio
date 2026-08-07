import React, { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DatePicker, Card, Typography, Spin, message, Button } from "antd";
import { AuthContext } from "../context/AuthContext";
import dayjs from "dayjs";

const { Title, Text, Paragraph } = Typography;
const LOGIN_REQUIRED_KEY = "login_required_message";
 
function MonthlyWrite() {
  const [month, setMonth] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const { isLoginedId, authLoaded } = useContext(AuthContext);

  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoaded) return;
    if (isLoginedId === 0) {
      message.error({
        content: "월간 업무일지는 로그인 후 이용 가능합니다.",
        key: LOGIN_REQUIRED_KEY,
        duration: 5,
      });
      navigate("/login");
    }
  }, [authLoaded, isLoginedId, navigate]);
  if (!authLoaded || isLoginedId === 0) {
    return null;
  }

  const getRangeStrings = () => {
    if (!month) return null;
    const start = month.startOf("month");
    const end = month.endOf("month");
    return {
      startStr: start.format("YYYY-MM-DD"),
      endStr: end.format("YYYY-MM-DD"),
    };
  };

  const handleMonthChange = async (value) => {
    setMonth(value);
    setSummary("");

    if (!value) {
      setLogs([]);
      return;
    }

    try {
      setLoading(true);

      const start = value.startOf("month");
      const end = value.endOf("month");

      const startStr = start.format("YYYY-MM-DD");
      const endStr = end.format("YYYY-MM-DD");

      const res = await fetch(
        `http://localhost:8081/api/workLog/range?startDate=${startStr}&endDate=${endStr}`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      if (!res.ok) {
        throw new Error("서버가 응답하지 않습니다.");
      }

      const data = await res.json();
      setLogs(data);
    } catch (error) {
      console.error(error);
      message.error("업무일지를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewSummary = async () => {
    if (!month) {
      message.warning("먼저 월를 선택해주세요.");
      return;
    }

    const range = getRangeStrings();
    if (!range) return;
    const { startStr, endStr } = range;

    try {
      setSummaryLoading(true);

      const res = await fetch(
        `http://localhost:8081/api/workLog/monthly/summary?startDate=${startStr}&endDate=${endStr}`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      if (!res.ok) {
        if (res.status === 400) {
          const text = await res.text();
          message.error(text || "해당 기간에 업무일지가 없습니다.");
        } else if (res.status === 401) {
          message.error("로그인이 필요합니다.");
        } else {
          message.error("월간 요약을 불러오는 중 오류가 발생했습니다.");
        }
        return;
      }

      const data = await res.json(); // { summary: "..." }
      setSummary(data.summary || "");
    } catch (error) {
      console.error(error);
      message.error("월간 요약을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setSummaryLoading(false);
    }
  };

  // 📌 "요약 등록하기" 버튼
  const handleRegisterMonthly = async () => {
    if (!month) {
      message.warning("먼저 월를 선택해주세요.");
      return;
    }

    const range = getRangeStrings();
    if (!range) return;
    const { startStr, endStr } = range;

    try {
      setRegistering(true);

      const res = await fetch(
        "http://localhost:8081/api/usr/work/monthly/register",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            startDate: startStr,
            endDate: endStr,
          }),
        }
      );

      if (!res.ok) {
        if (res.status === 400) {
          const text = await res.text();
          message.error(text || "해당 기간에 업무일지가 없습니다.");
        } else if (res.status === 401) {
          message.error("로그인이 필요합니다.");
        } else {
          message.error("월간 업무일지 등록 중 오류가 발생했습니다.");
        }
        return;
      }

      const data = await res.json(); // { id, message }
      message.success(data.message || "월간 업무일지가 등록되었습니다.");
      navigate(`/detail/${data.id}`);
    } catch (error) {
      console.error(error);
      message.error("월간 업무일지 등록 중 오류가 발생했습니다.");
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="p-6 weekly-write-page">
      <Title level={3}>월간 업무일지 작성</Title>

      <Card className="mb-4">
        <Text strong>월 선택</Text>
        <br />
        <DatePicker
          picker="month"
          value={month}
          onChange={handleMonthChange}
          placeholder="월를 선택해주세요."
          style={{ marginTop: 8 }}
        />

        {/* 버튼!!! */}
        <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
          <Button onClick={handlePreviewSummary} loading={summaryLoading}>
            월간 요약 미리보기
          </Button>
          <Button
            type="primary"
            onClick={handleRegisterMonthly}
            loading={registering}
          >
            요약 등록하기
          </Button>
        </div>
      </Card>

      {/* 조회 결과 카드임 */}
      <Card>
        <Title level={5}>선택한 월의 일일 업무일지</Title>
        {loading ? (
          <Spin />
        ) : (
          <>
            {logs.length === 0 ? (
              <Text type="secondary">
                선택한 월에 해당하는 업무일지가 없거나 아직 월을 선택하지
                않았습니다.
              </Text>
            ) : (
              <ul>
                {logs.map((log) => (
                  <li key={log.id}>
                    [{log.regDate?.substring(0, 10)}] {log.title}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Card>
      <Card>
        <Title level={5}>월간 요약 미리보기</Title>
        {summaryLoading ? (
          <Spin />
        ) : summary ? (
          <Paragraph style={{ whiteSpace: "pre-line" }}>{summary}</Paragraph>
        ) : (
          <Text type="secondary">
            &quot;월간 요약 미리보기&quot; 버튼을 눌러 AI 요약을 확인해보세요.
          </Text>
        )}
      </Card>
    </div>
  );
}
export default MonthlyWrite;
