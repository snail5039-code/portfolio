import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "./AuthContext";
import { API_BASE } from "../config/api";

const STORAGE_KEY = "worklog:current-workspace-id";

// eslint-disable-next-line react-refresh/only-export-components
export const WorkspaceContext = createContext({
  workspaces: [], currentWorkspace: null, workspaceLoaded: false,
  selectWorkspace: () => {}, refreshWorkspaces: async () => {},
});

export function WorkspaceProvider({ children }) {
  const { isLoginedId, authLoaded } = useContext(AuthContext);
  const [workspaces, setWorkspaces] = useState([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState(null);
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);

  const refreshWorkspaces = useCallback(async () => {
    if (!authLoaded || isLoginedId === 0) return [];
    const response = await fetch(`${API_BASE}/api/workspaces`, { credentials: "include" });
    if (!response.ok) throw new Error("워크스페이스 목록을 불러오지 못했습니다.");
    const data = await response.json();
    setWorkspaces(data);
    const savedId = Number(localStorage.getItem(STORAGE_KEY));
    if (data.some((item) => item.id === savedId)) setCurrentWorkspaceId(savedId);
    else {
      setCurrentWorkspaceId(null);
      localStorage.removeItem(STORAGE_KEY);
    }
    return data;
  }, [authLoaded, isLoginedId]);

  useEffect(() => {
    if (!authLoaded) return;
    if (isLoginedId === 0) {
	  Promise.resolve().then(() => {
		setWorkspaces([]);
		setCurrentWorkspaceId(null);
		setWorkspaceLoaded(true);
	  });
	  return;
    }
    let active = true;
	Promise.resolve().then(() => {
	  if (active) setWorkspaceLoaded(false);
	  return refreshWorkspaces();
	}).catch((error) => console.error(error)).finally(() => {
	  if (active) setWorkspaceLoaded(true);
	});
    return () => { active = false; };
  }, [authLoaded, isLoginedId, refreshWorkspaces]);

  const selectWorkspace = (workspaceId) => {
    const normalized = workspaceId ? Number(workspaceId) : null;
    setCurrentWorkspaceId(normalized);
    if (normalized) localStorage.setItem(STORAGE_KEY, String(normalized));
    else localStorage.removeItem(STORAGE_KEY);
  };

  const currentWorkspace = workspaces.find((item) => item.id === currentWorkspaceId) || null;
  const value = useMemo(() => ({ workspaces, currentWorkspace, workspaceLoaded, selectWorkspace, refreshWorkspaces }),
    [workspaces, currentWorkspace, workspaceLoaded, refreshWorkspaces]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
