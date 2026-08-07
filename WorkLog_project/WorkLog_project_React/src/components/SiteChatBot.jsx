// src/components/SiteChatBot.jsx
import React, { useState, useEffect, useRef } from "react";

function SiteChatBot() {
  const [messages, setMessages] = useState([
    { from: "bot", text: "WorkLog 사용법과 양식, 인수인계 작성까지 뭐든 물어보세요 😊" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const sendMessage = async () => {
    const question = input.trim();
    if (!question || loading) return;

    // 내 메시지 먼저 추가
    setMessages((prev) => [...prev, { from: "user", text: question }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("http://localhost:8081/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ question }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "서버 오류");
      }

      const data = await res.json();
      const answer = data.answer || "서버에서 내용이 비어있게 왔어요.";

      setMessages((prev) => [...prev, { from: "bot", text: answer }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { from: "bot", text: `에러가 발생했습니다: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="wl-chatbot">
      {/* 헤더 */}
      <div className="wl-chatbot-header">
        <div className="wl-chatbot-header-title">WorkLog 챗봇</div>
        <div className="wl-chatbot-header-sub">
          업무일지 · 인수인계 · 양식 예시를 도와드려요
        </div>
      </div>

      {/* 메시지 영역 */}
      <div className="wl-chatbot-messages">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={
              m.from === "user" ? "wl-chatbot-row user" : "wl-chatbot-row bot"
            }
          >
            {m.from === "bot" && (
              <div className="wl-chatbot-avatar bot">W</div>
            )}
            <div
              className={
                m.from === "user"
                  ? "wl-chatbot-bubble user"
                  : "wl-chatbot-bubble bot"
              }
            >
              {m.text}
            </div>
            {m.from === "user" && (
              <div className="wl-chatbot-avatar user">나</div>
            )}
          </div>
        ))}
        {loading && (
          <div className="wl-chatbot-row bot">
            <div className="wl-chatbot-avatar bot">W</div>
            <div className="wl-chatbot-bubble bot wl-chatbot-typing">
              답변 생성 중...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 입력 영역 */}
      <div className="wl-chatbot-input-area">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          className="wl-chatbot-input"
          placeholder="무엇이 궁금하신가요? Enter로 전송, Shift+Enter로 줄바꿈"
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          className="wl-chatbot-send-btn"
        >
          보내기
        </button>
      </div>
    </div>
  );
}

export default SiteChatBot;
