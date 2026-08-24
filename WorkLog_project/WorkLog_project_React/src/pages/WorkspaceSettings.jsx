import React, { useContext, useEffect, useState } from "react";
import { Button, Input, Select, message } from "antd";
import { API_BASE } from "../config/api";
import { WorkspaceContext } from "../context/WorkspaceContext";

const ROLE_LABEL = { OWNER: "소유자", ADMIN: "관리자", MANAGER: "매니저", MEMBER: "구성원" };

export default function WorkspaceSettings() {
  const { workspaces, currentWorkspace, selectWorkspace, refreshWorkspaces } = useContext(WorkspaceContext);
  const [members, setMembers] = useState([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [inviteLink, setInviteLink] = useState("");
  const [inviteLinkWorkspaceId, setInviteLinkWorkspaceId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState([]);
  const [teamName, setTeamName] = useState("");
  const canManage = ["OWNER", "ADMIN"].includes(currentWorkspace?.myRole);

  const loadMembers = async () => {
    if (!currentWorkspace) {
      setMembers([]);
      return;
    }
    const response = await fetch(`${API_BASE}/api/workspaces/${currentWorkspace.id}/members`, { credentials: "include" });
    if (!response.ok) throw new Error("멤버 목록을 불러오지 못했습니다.");
    setMembers(await response.json());
  };

  const loadTeams = async () => {
    if (!currentWorkspace) { setTeams([]); return; }
    const response = await fetch(`${API_BASE}/api/workspaces/${currentWorkspace.id}/teams`, { credentials: "include" });
    if (!response.ok) throw new Error("팀 목록을 불러오지 못했습니다.");
    setTeams(await response.json());
  };

  useEffect(() => {
    loadMembers().catch((error) => message.error(error.message));
    loadTeams().catch((error) => message.error(error.message));
    // 선택한 워크스페이스가 바뀔 때만 다시 조회한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorkspace?.id]);

  const createTeam = async () => {
    if (!teamName.trim() || !currentWorkspace) return message.warning("팀 이름을 입력해주세요.");
    const response = await fetch(`${API_BASE}/api/workspaces/${currentWorkspace.id}/teams`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ name: teamName.trim() }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return message.error(data.message || "팀 생성에 실패했습니다.");
    setTeamName(""); await loadTeams(); message.success("팀을 만들었습니다.");
  };

  const createWorkspace = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/workspaces`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ name, slug }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "워크스페이스 생성에 실패했습니다.");
      await refreshWorkspaces();
      selectWorkspace(data.id);
      setName(""); setSlug("");
      message.success("워크스페이스를 만들었습니다.");
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const createInvitation = async () => {
    if (!currentWorkspace) return;
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/workspaces/${currentWorkspace.id}/invitations`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ email, role: inviteRole }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "초대 생성에 실패했습니다.");
      setInviteLink(`${window.location.origin}/workspace-invitations/${data.token}`);
      setInviteLinkWorkspaceId(currentWorkspace.id);
      setEmail("");
      message.success("초대 링크를 만들었습니다. 이 화면에서 한 번만 확인할 수 있습니다.");
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const changeRole = async (memberId, role) => {
    const response = await fetch(`${API_BASE}/api/workspaces/${currentWorkspace.id}/members/${memberId}/role`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ role }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return message.error(data.message || "역할 변경에 실패했습니다.");
    message.success("멤버 역할을 변경했습니다.");
    loadMembers().catch((error) => message.error(error.message));
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="rounded-[24px] border border-[#eadfd7] bg-white p-6 shadow-[0_14px_45px_rgba(70,49,35,0.06)] md:p-8">
        <p className="text-xs font-bold tracking-[0.18em] text-[#d95d3b]">WORKSPACE</p>
        <h1 className="mt-2 font-serif text-3xl font-bold text-[#1f2e45]">함께 기록할 공간</h1>
        <p className="mt-2 text-sm text-[#747b87]">개인 기록은 그대로 두고, 필요한 기록만 팀 공간에서 이어갈 수 있습니다.</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="text-sm font-bold text-[#364154]">현재 공간</label>
          <Select aria-label="관리할 워크스페이스" value={currentWorkspace?.id || ""} onChange={selectWorkspace} className="min-w-[240px]" options={[{ value: "", label: "개인 공간" }, ...workspaces.map((item) => ({ value: item.id, label: `${item.name} · ${ROLE_LABEL[item.myRole]}` }))]} />
        </div>
      </section>

      <section className="rounded-[24px] border border-[#eadfd7] bg-white p-6 md:p-8">
        <h2 className="font-serif text-2xl font-bold text-[#1f2e45]">새 워크스페이스</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Input aria-label="워크스페이스 이름" value={name} onChange={(event) => setName(event.target.value)} placeholder="예: 제품 개발팀" maxLength={150} />
          <Input aria-label="워크스페이스 주소" value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} placeholder="예: product-team" maxLength={50} />
          <Button type="primary" onClick={createWorkspace} loading={loading}>공간 만들기</Button>
        </div>
        <p className="mt-2 text-xs text-[#8a817b]">주소는 영문 소문자·숫자·하이픈으로 3~50자입니다.</p>
      </section>

      {currentWorkspace && (
        <section className="rounded-[24px] border border-[#eadfd7] bg-white p-6 md:p-8">
          <h2 className="font-serif text-2xl font-bold text-[#1f2e45]">팀</h2>
          <p className="mt-1 text-xs text-[#8a817b]">팀 공개 기록은 소속 팀 구성원에게만 보입니다.</p>
          {["OWNER", "ADMIN", "MANAGER"].includes(currentWorkspace.myRole) && <div className="mt-4 flex gap-3"><Input aria-label="새 팀 이름" value={teamName} onChange={(event) => setTeamName(event.target.value)} onPressEnter={createTeam} placeholder="예: 프론트엔드 팀" maxLength={150} /><Button type="primary" onClick={createTeam}>팀 만들기</Button></div>}
          <div className="mt-4 flex flex-wrap gap-2">{teams.length ? teams.map((team) => <span key={team.id} className="rounded-full border border-[#eadfd7] bg-[#fffaf6] px-3 py-1.5 text-sm font-bold text-[#596274]">{team.name} · {team.myRole === "LEAD" ? "리드" : "구성원"}</span>) : <span className="text-sm text-[#8a817b]">소속된 팀이 없습니다.</span>}</div>
        </section>
      )}

      {currentWorkspace && (
        <section className="rounded-[24px] border border-[#eadfd7] bg-white p-6 md:p-8">
          <div className="flex items-end justify-between gap-3"><div><h2 className="font-serif text-2xl font-bold text-[#1f2e45]">{currentWorkspace.name} 멤버</h2><p className="mt-1 text-xs text-[#8a817b]">내 역할: {ROLE_LABEL[currentWorkspace.myRole]}</p></div><span className="rounded-full bg-[#fff0e9] px-3 py-1 text-xs font-bold text-[#c84f31]">{members.length}명</span></div>
          {canManage && <div className="mt-5 grid gap-3 rounded-2xl border border-[#eee2da] bg-[#fffaf6] p-4 sm:grid-cols-[1fr_150px_auto]">
            <Input aria-label="초대 이메일" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="동료 이메일" />
            <Select aria-label="초대 역할" value={inviteRole} onChange={setInviteRole} options={[{ value: "MEMBER", label: "구성원" }, { value: "MANAGER", label: "매니저" }, { value: "ADMIN", label: "관리자" }]} />
            <Button type="primary" onClick={createInvitation} loading={loading}>초대 링크 만들기</Button>
            {inviteLink && inviteLinkWorkspaceId === currentWorkspace.id && <div className="sm:col-span-3"><p className="mb-1 text-xs font-bold text-[#596274]">한 번만 표시되는 초대 링크</p><Input.TextArea aria-label="생성된 초대 링크" value={inviteLink} readOnly autoSize /></div>}
          </div>}
          <div className="mt-5 divide-y divide-[#eee8e3]">
            {members.map((member) => <div key={member.memberId} className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center">
              <div><p className="font-bold text-[#26344a]">{member.memberName}</p><p className="mt-1 text-xs text-[#8a817b]">{member.memberEmail}</p></div>
              {canManage && member.role !== "OWNER" ? <Select aria-label={`${member.memberName} 역할`} value={member.role} onChange={(role) => changeRole(member.memberId, role)} className="w-32" options={[{ value: "MEMBER", label: "구성원" }, { value: "MANAGER", label: "매니저" }, { value: "ADMIN", label: "관리자" }]} /> : <span className="rounded-full bg-[#f2f4f7] px-3 py-1 text-xs font-bold text-[#596274]">{ROLE_LABEL[member.role]}</span>}
            </div>)}
          </div>
        </section>
      )}
    </div>
  );
}
