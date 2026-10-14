// src/components/work/CommentBox.jsx
import React, { useCallback, useEffect, useState, useContext } from "react";
import { Input, Button, message, Popconfirm, Spin, Typography } from "antd";
import { AuthContext } from "../../context/AuthContext";
import { API_BASE } from "../../config/api";

const { TextArea } = Input;
const { Text } = Typography;

function CommentBox({ workLogId }) {
  const { isLoginedId } = useContext(AuthContext); // 0이면 비로그인, 그 외 회원 id
  const [replies, setReplies] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [content, setContent] = useState("");

  // ✅ 수정 관련 상태
  const [editingId, setEditingId] = useState(null);      // 어느 댓글을 수정 중인지
  const [editingContent, setEditingContent] = useState(""); // 수정 textarea 내용

  // 댓글 목록 가져오기
  const fetchReplies = useCallback(async () => {
    if (!workLogId) return;
    try {
      setLoadingList(true);
      const res = await fetch(
        `${API_BASE}/api/usr/work/${workLogId}/replies`,
        {
          method: "GET",
          credentials: "include",
        }
      );
      if (!res.ok) {
        throw new Error("댓글 목록 조회 실패");
      }
      const data = await res.json();
      console.log("🎯 댓글 응답:", data);
      setReplies(data || []);
    } catch (error) {
      console.error(error);
      message.error("댓글 목록을 불러오는 중 오류 발생");
    } finally {
      setLoadingList(false);
    }
  }, [workLogId]);

  useEffect(() => {
    fetchReplies();
  }, [fetchReplies]);

  // 작성
  const handleSubmit = async () => {
    if (!content.trim()) {
      message.warning("댓글 내용을 입력하세요.");
      return;
    }

    if (!isLoginedId || isLoginedId === 0) {
      message.error("로그인 후 댓글을 작성할 수 있습니다.");
      return;
    }
    if (submitting) return;

    try {
      setSubmitting(true);
      const res = await fetch(
        `${API_BASE}/api/usr/work/${workLogId}/replies`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ content }),
        }
      );
      if (!res.ok) {
        throw new Error("댓글 등록 실패");
      }
      await fetchReplies();
      setContent("");
    } catch (error) {
      console.error(error);
      message.error("댓글 등록 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  // 삭제
  const handleDelete = async (replyId) => {
    try {
      console.log("삭제 요청 replyId:", replyId);
      const res = await fetch(
        `${API_BASE}/api/usr/work/replies/${replyId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );
      if (!res.ok) {
        throw new Error("댓글 삭제 실패");
      }
      message.success("댓글이 삭제되었습니다.");
      setReplies((prev) => prev.filter((r) => r.id !== replyId)); // 삭제한거 빼고 리로드
    } catch (error) {
      console.error(error);
      message.error("댓글 삭제 중 오류가 발생했습니다.");
    }
  };

  // ✅ 수정 시작(수정 버튼 클릭 시)
  const startEdit = (item) => {
    setEditingId(item.id);        // 지금 수정할 댓글 id
    setEditingContent(item.content); // 기존 내용 복사
  };

  // ✅ 수정 취소
  const cancelEdit = () => {
    setEditingId(null);
    setEditingContent("");
  };

  // ✅ 수정 요청 보내기
  const handleUpdate = async () => {
    if (!editingContent.trim()) {
      message.warning("수정할 내용을 입력하세요.");
      return;
    }
    if (!editingId) return;

    try {
      const res = await fetch(
        `${API_BASE}/api/usr/work/replies/${editingId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ content: editingContent }),
        }
      );

      if (!res.ok) {
        throw new Error("댓글 수정 실패");
      }

      // 프론트 상태만 수정
      setReplies((prev) =>
        prev.map((r) =>
          r.id === editingId ? { ...r, content: editingContent } : r
        )
      );

      message.success("댓글이 수정되었습니다.");
      setEditingId(null);
      setEditingContent("");
    } catch (error) {
      console.error(error);
      message.error("댓글 수정 중 오류가 발생했습니다.");
    }
  };

  return (
    <div style={{ marginTop: 16 }}>
      {/* 댓글 목록 */}
      {loadingList ? <div className="py-6 text-center"><Spin /></div> : replies.length === 0 ? <p className="py-5 text-center text-sm text-[#8b8f96]">등록된 댓글이 없습니다.</p> : <div>{replies.map((item) => <article key={item.id} className="border-b border-[#f0ebe6] py-4">
        <div className="flex items-center justify-between gap-3 text-xs"><span className="font-semibold">{item.writerName || "작성자"}<Text type="secondary" className="ml-1">({item.memberId})</Text></span><Text type="secondary">{item.regDate}</Text></div>
        {editingId === item.id ? <div className="mt-3"><TextArea rows={3} value={editingContent} onChange={(e) => setEditingContent(e.target.value)} maxLength={500} showCount style={{ resize: "none" }} /><div className="mt-6 flex justify-end gap-2"><Button size="small" onClick={cancelEdit}>취소</Button><Button type="primary" size="small" onClick={handleUpdate}>수정 완료</Button></div></div> : <div className="mt-2 whitespace-pre-wrap text-sm text-[#4f5868]">{item.content}</div>}
        {isLoginedId === item.memberId && <div className="mt-2 flex justify-end gap-1">{editingId !== item.id && <Button type="link" size="small" onClick={() => startEdit(item)}>수정</Button>}<Popconfirm title="댓글 삭제" description="이 댓글을 삭제하시겠습니까?" okText="삭제" cancelText="취소" onConfirm={() => handleDelete(item.id)}><Button type="link" size="small" danger>삭제</Button></Popconfirm></div>}
      </article>)}</div>}

      {/* 댓글 입력창 */}
      <div style={{ marginTop: 16 }}>
        <TextArea
          rows={3}
          placeholder="댓글을 입력하세요."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={500}
          showCount
          style={{ resize: "none" }}
        />
        <div
          style={{
            marginTop: 24,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <Button
            type="primary"
            onClick={handleSubmit}
            loading={submitting}
            disabled={isLoginedId === 0}
          >
            댓글 등록
          </Button>
        </div>
      </div>
    </div>
  );
}

export default CommentBox;
