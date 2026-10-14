import React, { useEffect, useState, useContext } from "react";
import {
  Link,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { message, Pagination } from "antd";
import { AuthContext } from "../context/AuthContext";
import { API_BASE } from "../config/api";

const LOGIN_REQUIRED_KEY = "login_required_message";
// 디자인은 차후 수정 예정
const BOARD_NAME_MAP = {
  1: "공지사항 게시판",
  2: "자유게시판",
  3: "질문과 답변 게시판",
  4: "일일 업무일지 게시판",
  5: "주간 업무일지 게시판",
  6: "월간 업무일지 게시판",
  7: "템플릿 등록 게시판",
  8: "자주 묻는 질문 게시판",
  9: "오류사항 접수 게시판",
};
const WORK_STATUS_LABELS = { PLANNED: "예정", IN_PROGRESS: "진행 중", ON_HOLD: "보류", COMPLETED: "완료" };
const EMPTY_FILTERS = { keyword: "", projectId: "", workStatus: "", priority: "" };

function List() {
  const navigate = useNavigate();
  const { isLoginedId, authLoaded } = useContext(AuthContext);

  const [searchParams] = useSearchParams();
  const boardIdParam = searchParams.get("boardId");
  const boardId = boardIdParam ? Number(boardIdParam) : null;
  const boardTitle = boardId ? BOARD_NAME_MAP[boardId] || "게시글" : "게시글";
  const [articles, setArticles] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [projects, setProjects] = useState([]);
  const [filterDraft, setFilterDraft] = useState(EMPTY_FILTERS);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  useEffect(() => {
    if (!authLoaded) return; // 세션 아직 로딩 중이면 아무것도 안 함

    if (isLoginedId === 0) {
      message.error({
        content: "목록 보기는 로그인 후 이용 가능합니다.",
        key: LOGIN_REQUIRED_KEY,
        duration: 5,
      });
      navigate("/login");
    }
  }, [authLoaded, isLoginedId, navigate]);

  useEffect(() => {
    setPage(1);
    setFilterDraft(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
  }, [boardIdParam]);

  useEffect(() => {
    if (!authLoaded || isLoginedId === 0 || boardId !== 4) return;
    const controller = new AbortController();
    fetch(`${API_BASE}/api/projects`, { credentials: "include", signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("프로젝트 목록 조회 실패");
        return res.json();
      })
      .then(setProjects)
      .catch((error) => {
        if (error.name !== "AbortError") message.error(error.message);
      });
    return () => controller.abort();
  }, [authLoaded, isLoginedId, boardId]);

  useEffect(() => {
    if (!authLoaded) return;

    // 로그인 안 된 상태면 X
    if (isLoginedId === 0) return;

    // 게시판을 바꾸면 setPage(1) 과 이 fetch 가 같은 커밋에서 돌아 요청이 두 개
    // 나간다. 취소를 안 걸면 늦게 온 응답이 나중 것을 덮어써서, 방금 고른 게시판이
    // 아니라 이전 게시판 목록이 보이는 일이 생겼다.
    const controller = new AbortController();

    async function fetchList() {
      try {
        const params = new URLSearchParams({ page: String(page), size: String(pageSize) });
        if (boardIdParam != null) {
          params.set("boardId", boardIdParam);
        }
        if (boardId === 4) {
          Object.entries(filters).forEach(([key, value]) => {
            if (value) params.set(key, value);
          });
        }
        const url = `${API_BASE}/api/usr/work/list?${params.toString()}`;

        const res = await fetch(url, {
          credentials: "include",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("목록 조회 실패");

        const data = await res.json();
        setArticles(data.items);
        setTotalCount(data.totalCount);
      } catch (error) {
        // 취소된 요청은 실패가 아니다.
        if (error.name === "AbortError") return;

        console.error(error);
        message.error(error.message);
      }
    }
    fetchList();
    return () => controller.abort();
  }, [authLoaded, isLoginedId, boardId, boardIdParam, filters, page, pageSize]);

  const updateFilter = (key, value) => {
    setFilterDraft((current) => ({ ...current, [key]: value }));
  };

  const applyFilters = (event) => {
    event.preventDefault();
    setPage(1);
    setFilters({ ...filterDraft, keyword: filterDraft.keyword.trim() });
  };

  const resetFilters = () => {
    setFilterDraft(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  if (!authLoaded) {
    return (
      <div className="p-6 max-w-4xl mx-auto bg-white shadow-lg rounded-xl">
        세션 확인 중...
      </div>
    );
  }

  // 🔹 세션 확인 끝났는데 비로그인이면 렌더 안 함 (위에서 /login으로 날아감)
  if (isLoginedId === 0) {
    return null;
  }
  return (
    <div className="mx-auto max-w-5xl rounded-[24px] border border-[#eadfd7] bg-white p-6 shadow-[0_14px_45px_rgba(70,49,35,0.06)] md:p-8">
      <div className="mb-4"></div>

      <p className="text-xs font-bold tracking-[0.18em] text-[#d95d3b]">WORK RECORDS</p>
      <h2 className="mb-6 mt-2 border-b border-[#eee5de] pb-5 font-serif text-3xl font-bold text-[#1f2e45]">
        {boardTitle} 목록
      </h2>

      {boardId === 4 && (
        <form onSubmit={applyFilters} className="mb-6 grid gap-3 rounded-2xl border border-[#eee2da] bg-[#fffaf6] p-4 md:grid-cols-[minmax(190px,1fr)_repeat(3,minmax(130px,0.6fr))_auto]">
          <input
            value={filterDraft.keyword}
            onChange={(event) => updateFilter("keyword", event.target.value)}
            placeholder="제목·내용·다음 할 일 검색"
            aria-label="업무 기록 검색어"
            className="rounded-xl border border-[#dfd5ce] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#d95d3b]"
          />
          <select value={filterDraft.projectId} onChange={(event) => updateFilter("projectId", event.target.value)} aria-label="프로젝트 필터" className="rounded-xl border border-[#dfd5ce] bg-white px-3 py-2.5 text-sm">
            <option value="">모든 프로젝트</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          <select value={filterDraft.workStatus} onChange={(event) => updateFilter("workStatus", event.target.value)} aria-label="업무 상태 필터" className="rounded-xl border border-[#dfd5ce] bg-white px-3 py-2.5 text-sm">
            <option value="">모든 상태</option>
            {Object.entries(WORK_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={filterDraft.priority} onChange={(event) => updateFilter("priority", event.target.value)} aria-label="우선순위 필터" className="rounded-xl border border-[#dfd5ce] bg-white px-3 py-2.5 text-sm">
            <option value="">모든 우선순위</option>
            <option value="HIGH">높음</option>
            <option value="NORMAL">보통</option>
            <option value="LOW">낮음</option>
          </select>
          <div className="flex gap-2">
            <button type="submit" className="rounded-xl bg-[#d95d3b] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#c84f31]">적용</button>
            <button type="button" onClick={resetFilters} className="rounded-xl border border-[#dfd5ce] bg-white px-4 py-2.5 text-sm font-semibold text-[#596274] hover:bg-[#f7f2ee]">초기화</button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full overflow-hidden rounded-xl border border-[#eadfd7]">
          <thead>
            <tr className="bg-[#fff8f3]">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-1/12">
                번호
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-6/12">
                제목
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-2/12">
                작성자
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-3/12">
                작성일
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {articles && articles.length > 0 ? (
              articles.map((article) => (
                <tr
                  key={article.id}
                  className="transition duration-150 ease-in-out hover:bg-[#fffaf6]"
                >
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {article.id}
                  </td>
                  <td className="px-4 py-3 whitespace-normal text-sm font-medium">
                    <Link
                      to={`/detail/${article.id}`}
                      className="font-semibold text-[#26344a] transition duration-150 hover:text-[#c84f31]"
                    >
                      {article.title}
                    </Link>
                    {boardId === 4 && (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-[#fff0e9] px-2 py-0.5 text-[11px] font-bold text-[#c84f31]">{WORK_STATUS_LABELS[article.workStatus] || "예정"}</span>
                        {article.projectName && <span className="rounded-full bg-[#f2f4f7] px-2 py-0.5 text-[11px] text-[#596274]">{article.projectName}</span>}
                        {article.nextAction && <span className="max-w-[320px] truncate text-[11px] text-[#7a746f]">다음: {article.nextAction}</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {article.writerName}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {article.regDate}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan="4"
                  className="px-4 py-6 text-center text-gray-500 text-base font-medium"
                >
                  등록된 게시글이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {/* 페이징 + 글쓰기 버튼 줄 */}
        <div className="mt-4 flex items-center justify-between">
          {/* 왼쪽: 페이지네이션 */}
          <div className="flex-1 flex justify-center">
            <Pagination
              current={page}
              pageSize={pageSize}
              total={totalCount}
              onChange={(p, size) => {
                setPage(p);
                setPageSize(size);
              }}
              showSizeChanger
              showTotal={(total) => `총 ${total}건`}
            />
          </div>

          {/* 오른쪽: 템플릿 게시판(7번)일 때만 글쓰기 버튼 */}
          {[7, 8, 9].includes(boardId) && (
            <button
              type="button"
              onClick={() => navigate(`/write?boardId=${boardId}`)}
              className="ml-4 rounded-xl bg-[#d95d3b] px-5 py-2 text-sm font-semibold text-white shadow hover:bg-[#c84f31]"
            >
              글쓰기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default List;
