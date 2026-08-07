// src/pages/Modify.jsx
import React, { useState, useContext, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { message } from "antd";
import { AuthContext } from "../context/AuthContext";

const LOGIN_REQUIRED_KEY = "login_required_message";

function Modify() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [mainContent, setMainContent] = useState("");
  const [sideContent, setSideContent] = useState("");

  const { isLoginedId, authLoaded } = useContext(AuthContext);

  // 로그인 체크
  useEffect(() => {
    if (!authLoaded) return;

    if (isLoginedId === 0) {
      message.error({
        content: "수정은 로그인 후 이용 가능합니다.",
        key: LOGIN_REQUIRED_KEY,
        duration: 5,
      });
      navigate("/login");
    }
  }, [authLoaded, isLoginedId, navigate]);

  // 상세 데이터 불러오기
  useEffect(() => {
    if (!authLoaded) return;
    if (isLoginedId === 0) return;

    const API_URL = `http://localhost:8081/api/usr/work/detail/${id}`;

    const fetchDetail = async () => {
      try {
        const res = await fetch(API_URL, { credentials: "include" });
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        const fetchedData = await res.json();
        setArticle(fetchedData);
        setTitle(fetchedData.title || "");
        setMainContent(fetchedData.mainContent || "");
        setSideContent(fetchedData.sideContent || "");
      } catch (error) {
        console.error("데이터 불러오기 실패:", error);
        message.error("게시글을 불러오는 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [authLoaded, isLoginedId, id]);

  if (!authLoaded || isLoginedId === 0) return null;
  if (loading) return <div className="text-center mt-10">게시글 로딩 중...</div>;
  if (!article || Object.keys(article).length === 0)
    return <div className="text-center mt-10">게시글이 없습니다.</div>;

  const handleSubmit = async () => {
    const modifyData = {
      title,
      mainContent,
      sideContent,
    };

    try {
      const response = await fetch(
        `http://localhost:8081/api/usr/work/modify/${id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(modifyData),
        }
      );

      if (response.ok) {
        await response.text();
        message.success("수정이 완료되었습니다.");
        navigate(`/detail/${id}`);
      } else {
        message.error("수정 실패! 코드 : " + response.status);
      }
    } catch (error) {
      console.error("통신오류", error);
      message.error("서버와 통신할 수 없습니다.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        {/* 상단 네비 + 제목 영역 */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Link
              to="/"
              className="hover:text-blue-600 transition-colors duration-150"
            >
              홈
            </Link>
            <span>/</span>
            <Link
              to="/list"
              className="hover:text-blue-600 transition-colors duration-150"
            >
              목록
            </Link>
            <span>/</span>
            <span className="text-gray-700 font-medium">수정</span>
          </div>

          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-100">
            게시글 ID&nbsp;#{id}
          </span>
        </div>

        {/* 메인 카드 */}
        <div className="bg-white shadow-xl rounded-2xl border border-gray-200 overflow-hidden">
          {/* 카드 헤더 */}
          <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-red-50 to-orange-50">
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
              게시글 수정
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              작성한 내용을 수정한 뒤, 아래의{" "}
              <span className="font-semibold text-red-500">[수정 완료]</span>{" "}
              버튼을 눌러 저장하세요.
            </p>
          </div>

          {/* 카드 바디 */}
          <div className="px-6 py-6 space-y-8">
            {/* 메타 정보 */}
            <section>
              <h2 className="text-sm font-semibold text-gray-500 mb-3">
                기본 정보
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex flex-col">
                  <span className="text-gray-500 mb-1">작성자</span>
                  <span className="font-medium text-gray-900">
                    {article.writerName}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-gray-500 mb-1">작성일</span>
                  <span className="text-gray-800">{article.regDate}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-gray-500 mb-1">마지막 수정일</span>
                  <span className="text-gray-800">
                    {article.updateDate || "-"}
                  </span>
                </div>
              </div>
            </section>

            {/* 제목 입력 */}
            <section className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                제목
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="게시글 제목을 입력하세요."
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-gray-900 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition"
              />
            </section>

            {/* 주요 업무 내용 */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold text-gray-700">
                  주요 업무 내용
                </label>
                <span className="text-xs text-gray-400">
                  실제 근무 내용을 자세히 적어주세요.
                </span>
              </div>
              <textarea
                value={mainContent}
                onChange={(e) => setMainContent(e.target.value)}
                placeholder="오늘 수행한 업무, 진행 상황, 특이사항 등을 작성하세요."
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition min-h-[140px] resize-y"
              />
            </section>

            {/* 비고 */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold text-gray-700">
                  비고
                </label>
                <span className="text-xs text-gray-400">
                  선택 사항 – 전달사항, 메모 등을 적을 수 있어요.
                </span>
              </div>
              <textarea
                value={sideContent}
                onChange={(e) => setSideContent(e.target.value)}
                placeholder="추가로 남기고 싶은 내용이 있다면 작성하세요."
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition min-h-[80px] resize-y"
              />
            </section>
          </div>

          {/* 카드 푸터 - 버튼 영역 */}
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex flex-col md:flex-row gap-3 md:gap-2 md:items-center md:justify-between">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="w-full md:w-auto inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl shadow-sm hover:bg-gray-100 transition"
            >
              취소하고 돌아가기
            </button>

            <button
              onClick={handleSubmit}
              className="w-full md:w-auto inline-flex items-center justify-center px-6 py-2.5 text-white text-sm font-semibold rounded-xl shadow-lg hover:border-2 transition transform hover:translate-y-[1px]"
            >
              수정 완료
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Modify;
