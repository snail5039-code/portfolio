import React, { useContext, useState } from "react";
import { Button, message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE } from "../config/api";
import { WorkspaceContext } from "../context/WorkspaceContext";

export default function WorkspaceInvitationAccept() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { refreshWorkspaces, selectWorkspace } = useContext(WorkspaceContext);
  const [loading, setLoading] = useState(false);

  const accept = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/workspaces/invitations/${token}/accept`, { method: "POST", credentials: "include" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "초대를 수락할 수 없습니다.");
      await refreshWorkspaces();
      selectWorkspace(data.workspaceId);
      message.success("워크스페이스에 참여했습니다.");
      navigate("/workspaceSettings");
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return <div className="mx-auto max-w-xl rounded-[24px] border border-[#eadfd7] bg-white p-8 text-center shadow-[0_14px_45px_rgba(70,49,35,0.06)]">
    <p className="text-xs font-bold tracking-[0.18em] text-[#d95d3b]">WORKSPACE INVITATION</p>
    <h1 className="mt-3 font-serif text-3xl font-bold text-[#1f2e45]">함께 기록할 준비가 됐나요?</h1>
    <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#747b87]">초대받은 이메일 계정으로 로그인되어 있다면 워크스페이스에 참여할 수 있습니다.</p>
    <Button type="primary" size="large" onClick={accept} loading={loading} className="mt-7">초대 수락하기</Button>
  </div>;
}
