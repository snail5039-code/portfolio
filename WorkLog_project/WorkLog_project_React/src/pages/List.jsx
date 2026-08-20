import React, { useEffect, useState, useContext } from "react";
import {
  Link,
  useNavigate,
  useSearchParams,
  useParams,
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

function List() {
  const navigate = useNavigate();
  const { isLoginedId, authLoaded } = useContext(AuthContext);

  const [searchParams] = useSearchParams();
  const boardIdParam = searchParams.get("boardId");
  const boardId = boardIdParam ? Number(boardIdParam) : null;
  const boardTitle = boardId ? BOARD_NAME_MAP[boardId] || "게시글" : "게시글";
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);

  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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
  }, [boardIdParam]);

  useEffect(() => {
    if (!authLoaded) return;

    // 로그인 안 된 상태면 X
    if (isLoginedId === 0) return;

    // 게시판을 바꾸면 setPage(1) 과 이 fetch 가 같은 커밋에서 돌아 요청이 두 개
    // 나간다. 취소를 안 걸면 늦게 온 응답이 나중 것을 덮어써서, 방금 고른 게시판이
    // 아니라 이전 게시판 목록이 보이는 일이 생겼다.
    const controller = new AbortController();

    async function fetchList() {
      setLoading(true);
      try {
        let url = `${API_BASE}/api/usr/work/list?page=${page}&size=${pageSize}`;
        if (boardIdParam != null) {
          url += `&boardId=${boardIdParam}`;
        }

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
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }
    fetchList();

    return () => controller.abort();
  }, [authLoaded, isLoginedId, boardIdParam, page, pageSize]);

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
    <div className="p-6 max-w-4xl mx-auto bg-white shadow-lg rounded-xl">
      <div className="mb-4"></div>

      <h2 className="text-3xl font-bold mb-6 text-gray-800 border-b pb-2">
        {boardTitle} 목록
      </h2>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
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
                  className="hover:bg-gray-50 transition duration-150 ease-in-out"
                >
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {article.id}
                  </td>
                  <td className="px-4 py-3 whitespace-normal text-sm font-medium">
                    <Link
                      to={`/detail/${article.id}`}
                      className="text-gray-800 hover:text-indigo-600 transition duration-150"
                    >
                      {article.title}
                    </Link>
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
              className="ml-4 px-5 py-2 rounded  text-white text-sm font-semibold shadow hover:border"
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
