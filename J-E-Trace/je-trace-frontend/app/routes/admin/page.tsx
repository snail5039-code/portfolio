import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import api from "~/lib/axios";

type PendingTeacher = {
  loginId: string;
  email: string;
  name: string;
  approved: boolean;
  subject: string;
  managedClasses: string;
  createdAt: string;
};

type TeacherProfileChangeRequest = {
  id: number;
  loginId: string;
  name: string;
  subject: string;
  managedClasses: string;
  status: string;
  requestedAt: string;
};

export default function AdminPage() {
  const navigate = useNavigate();

  const loginId =
    typeof window !== "undefined" ? localStorage.getItem("loginId") ?? "" : "";
  const loginRole =
    typeof window !== "undefined" ? localStorage.getItem("loginRole") ?? "" : "";

  const [teachers, setTeachers] = useState<PendingTeacher[]>([]);
  const [changeRequests, setChangeRequests] = useState<TeacherProfileChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingTeacherId, setProcessingTeacherId] = useState<string | null>(null);
  const [processingChangeId, setProcessingChangeId] = useState<number | null>(null);

  useEffect(() => {
    if (!loginId) {
      alert("로그인이 필요합니다.");
      navigate("/auth?mode=ADMIN");
      return;
    }

    if (loginRole !== "ADMIN") {
      alert("관리자 계정만 접근할 수 있습니다.");
      navigate("/");
      return;
    }
  }, [loginId, loginRole, navigate]);

  const fetchAdminData = async () => {
    try {
      setLoading(true);

      const [teacherResponse, changeResponse] = await Promise.all([
        api.get("/admin/teachers/pending"),
        api.get("/admin/teacher-profile-changes/pending"),
      ]);

      setTeachers(teacherResponse.data ?? []);
      setChangeRequests(changeResponse.data ?? []);
    } catch (error) {
      console.error("관리자 데이터 조회 실패:", error);
      alert("관리자 데이터 조회 실패");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (loginRole === "ADMIN") {
      fetchAdminData();
    }
  }, [loginRole]);

  const handleApproveTeacher = async (targetLoginId: string) => {
    try {
      setProcessingTeacherId(targetLoginId);
      await api.post(`/admin/teachers/${targetLoginId}/approve`);
      alert("교사 승인 완료");
      await fetchAdminData();
    } catch (error) {
      console.error("교사 승인 실패:", error);
      alert("교사 승인 실패");
    } finally {
      setProcessingTeacherId(null);
    }
  };

  const handleApproveChange = async (id: number) => {
    try {
      setProcessingChangeId(id);
      await api.post(`/admin/teacher-profile-changes/${id}/approve`);
      alert("교사 정보 수정 승인 완료");
      await fetchAdminData();
    } catch (error) {
      console.error("교사 정보 수정 승인 실패:", error);
      alert("교사 정보 수정 승인 실패");
    } finally {
      setProcessingChangeId(null);
    }
  };

  const handleRejectChange = async (id: number) => {
    try {
      setProcessingChangeId(id);
      await api.post(`/admin/teacher-profile-changes/${id}/reject`);
      alert("교사 정보 수정 반려 완료");
      await fetchAdminData();
    } catch (error) {
      console.error("교사 정보 수정 반려 실패:", error);
      alert("교사 정보 수정 반려 실패");
    } finally {
      setProcessingChangeId(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("loginId");
    localStorage.removeItem("loginName");
    localStorage.removeItem("loginRole");
    localStorage.removeItem("className");
    localStorage.removeItem("subject");
    localStorage.removeItem("managedClasses");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-8 text-white sm:px-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold tracking-[0.24em] text-slate-300">
                  ADMIN
                </p>
                <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                  교사 승인 관리
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                  신규 교사 승인과 교사 정보 수정 승인 및 반려를 처리하는 관리자 페이지입니다.
                </p>
              </div>

              <button
                onClick={handleLogout}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-white/15 bg-white/10 px-5 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                로그아웃
              </button>
            </div>
          </div>

          <div className="space-y-8 p-6 sm:p-8">
            <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5 sm:p-6">
              <div className="mb-5 flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-1 rounded-full bg-slate-900" />
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                      신규 교사 승인
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      회원가입 후 승인 대기 중인 교사 목록입니다.
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                  <div className="min-w-[980px]">
                    <div className="grid grid-cols-[140px_1.5fr_1fr_1fr_1fr_150px] border-b border-slate-200 bg-slate-900 text-sm font-semibold text-white">
                      <div className="px-5 py-4">아이디</div>
                      <div className="px-5 py-4">이메일</div>
                      <div className="px-5 py-4">이름</div>
                      <div className="px-5 py-4">과목</div>
                      <div className="px-5 py-4">관리 반</div>
                      <div className="px-5 py-4 text-center">승인</div>
                    </div>

                    {loading ? (
                      <div className="flex h-28 items-center justify-center text-sm text-slate-500">
                        불러오는 중...
                      </div>
                    ) : teachers.length === 0 ? (
                      <div className="flex h-28 items-center justify-center text-sm text-slate-500">
                        승인 대기 중인 교사가 없습니다.
                      </div>
                    ) : (
                      teachers.map((teacher, index) => (
                        <div
                          key={teacher.loginId}
                          className={`grid grid-cols-[140px_1.5fr_1fr_1fr_1fr_150px] text-sm text-slate-700 ${
                            index !== teachers.length - 1 ? "border-b border-slate-100" : ""
                          } hover:bg-slate-50`}
                        >
                          <div className="px-5 py-4 font-medium text-slate-900">
                            {teacher.loginId}
                          </div>
                          <div className="px-5 py-4">{teacher.email}</div>
                          <div className="px-5 py-4">{teacher.name}</div>
                          <div className="px-5 py-4">{teacher.subject || "-"}</div>
                          <div className="px-5 py-4">
                            {teacher.managedClasses
                              ? teacher.managedClasses
                                  .split(",")
                                  .map((value) => `${value.trim()}반`)
                                  .join(", ")
                              : "-"}
                          </div>
                          <div className="flex items-center justify-center px-5 py-4">
                            <button
                              onClick={() => handleApproveTeacher(teacher.loginId)}
                              disabled={processingTeacherId === teacher.loginId}
                              className="inline-flex min-w-[84px] items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {processingTeacherId === teacher.loginId ? "처리 중..." : "승인"}
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5 sm:p-6">
              <div className="mb-5 flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-1 rounded-full bg-slate-900" />
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                      교사 정보 수정 요청
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      교사가 요청한 이름, 담당 과목, 관리 반 수정 요청입니다.
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                  <div className="min-w-[1080px]">
                    <div className="grid grid-cols-[110px_150px_1fr_1fr_1fr_1.2fr_220px] border-b border-slate-200 bg-slate-900 text-sm font-semibold text-white">
                      <div className="px-5 py-4">요청 ID</div>
                      <div className="px-5 py-4">아이디</div>
                      <div className="px-5 py-4">이름</div>
                      <div className="px-5 py-4">과목</div>
                      <div className="px-5 py-4">관리 반</div>
                      <div className="px-5 py-4">요청일</div>
                      <div className="px-5 py-4 text-center">처리</div>
                    </div>

                    {loading ? (
                      <div className="flex h-28 items-center justify-center text-sm text-slate-500">
                        불러오는 중...
                      </div>
                    ) : changeRequests.length === 0 ? (
                      <div className="flex h-28 items-center justify-center text-sm text-slate-500">
                        승인 대기 중인 정보 수정 요청이 없습니다.
                      </div>
                    ) : (
                      changeRequests.map((request, index) => (
                        <div
                          key={request.id}
                          className={`grid grid-cols-[110px_150px_1fr_1fr_1fr_1.2fr_220px] text-sm text-slate-700 ${
                            index !== changeRequests.length - 1
                              ? "border-b border-slate-100"
                              : ""
                          } hover:bg-slate-50`}
                        >
                          <div className="px-5 py-4 font-medium text-slate-900">
                            {request.id}
                          </div>
                          <div className="px-5 py-4">{request.loginId}</div>
                          <div className="px-5 py-4">{request.name}</div>
                          <div className="px-5 py-4">{request.subject}</div>
                          <div className="px-5 py-4">
                            {request.managedClasses
                              .split(",")
                              .map((value) => `${value.trim()}반`)
                              .join(", ")}
                          </div>
                          <div className="px-5 py-4">{request.requestedAt}</div>
                          <div className="flex items-center justify-center gap-2 px-5 py-4">
                            <button
                              onClick={() => handleApproveChange(request.id)}
                              disabled={processingChangeId === request.id}
                              className="inline-flex min-w-[72px] items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              승인
                            </button>
                            <button
                              onClick={() => handleRejectChange(request.id)}
                              disabled={processingChangeId === request.id}
                              className="inline-flex min-w-[72px] items-center justify-center rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              반려
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}