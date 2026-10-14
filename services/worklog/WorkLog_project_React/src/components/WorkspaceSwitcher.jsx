import React, { useContext } from "react";
import { Link } from "react-router-dom";
import { WorkspaceContext } from "../context/WorkspaceContext";

export default function WorkspaceSwitcher() {
  const { workspaces, currentWorkspace, workspaceLoaded, selectWorkspace } = useContext(WorkspaceContext);
  return (
    <div className="flex items-center gap-1 rounded-full border border-[#e5d8cf] bg-white px-2 py-1 shadow-sm">
      <span className="hidden text-[#d95d3b] sm:inline">◈</span>
      <select
        aria-label="현재 워크스페이스"
        value={currentWorkspace?.id || ""}
        onChange={(event) => selectWorkspace(event.target.value)}
        disabled={!workspaceLoaded}
        className="max-w-[145px] bg-transparent py-1 text-xs font-bold text-[#364154] outline-none"
      >
        <option value="">개인 공간</option>
        {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
      </select>
      <Link to="/workspaceSettings" aria-label="워크스페이스 관리" className="rounded-full px-1.5 py-1 text-xs text-[#8a817b] hover:bg-[#fff0e9] hover:text-[#c84f31]">⚙</Link>
    </div>
  );
}
