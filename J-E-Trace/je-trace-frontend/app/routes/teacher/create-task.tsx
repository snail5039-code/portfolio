import { ArrowLeft, FilePlus2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import api from "../../lib/axios";

type TeacherProfileResponse = {
  name?: string;
  subject?: string;
  managedClasses?: string;
  className?: string;
};

export default function TeacherCreateTaskPage() {
  const navigate = useNavigate();

  const loginId =
    typeof window !== "undefined" ? localStorage.getItem("loginId") ?? "" : "";
  const loginRole =
    typeof window !== "undefined" ? localStorage.getItem("loginRole") ?? "" : "";

  const [teacherName, setTeacherName] = useState(
    typeof window !== "undefined" ? localStorage.getItem("loginName") ?? "" : ""
  );
  const [teacherSubject, setTeacherSubject] = useState(
    typeof window !== "undefined" ? localStorage.getItem("subject") ?? "" : ""
  );

  const [managedClasses, setManagedClasses] = useState<string[]>([]);

  const [form, setForm] = useState({
    title: "",
    className: "",
    description: "",
    dueDate: "",
    aiAllowed: true,
  });

  const parseManagedClasses = (data: TeacherProfileResponse) => {
    const raw = data?.managedClasses?.trim();

    if (raw) {
      return raw
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
    }

    if (data?.className?.trim()) {
      return [data.className.trim()];
    }

    return [];
  };

  useEffect(() => {
    if (!loginId) {
      alert("로그인이 필요합니다.");
      navigate("/auth?mode=TEACHER");
      return;
    }

    if (loginRole !== "TEACHER") {
      alert("교사 계정만 접근할 수 있습니다.");
      navigate("/");
      return;
    }
  }, [loginId, loginRole, navigate]);

  useEffect(() => {
    const fetchTeacherProfile = async () => {
      if (!loginId || loginRole !== "TEACHER") return;

      try {
        const response = await api.get<TeacherProfileResponse>(
          "/teacher/profile",
          {
            params: { loginId },
          }
        );

        const data = response.data ?? {};

        setTeacherName(data.name ?? "");
        setTeacherSubject(data.subject ?? "");

        localStorage.setItem("loginName", data.name ?? "");
        localStorage.setItem("subject", data.subject ?? "");

        const classes = parseManagedClasses(data);
        setManagedClasses(classes);

        setForm((prev) => ({
          ...prev,
          className:
            classes.length > 0
              ? classes.includes(prev.className)
                ? prev.className
                : classes[0]
              : "",
        }));
      } catch (error) {
        console.error("교사 프로필 조회 실패:", error);
        alert("교사 정보를 불러오지 못했습니다.");
      }
    };

    fetchTeacherProfile();
  }, [loginId, loginRole]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;

    if (type === "checkbox") {
      const target = e.target as HTMLInputElement;
      setForm((prev) => ({
        ...prev,
        [name]: target.checked,
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!form.className) {
      alert("담당 반 정보를 확인할 수 없습니다.");
      return;
    }

    if (managedClasses.length > 0 && !managedClasses.includes(form.className)) {
      alert("담당 반의 과제만 등록할 수 있습니다.");
      return;
    }

    try {
      await api.post("/teacher/tasks", {
        loginId,
        title: form.title,
        className: form.className,
        description: form.description,
        dueDate: form.dueDate,
        aiAllowed: form.aiAllowed,
      });

      alert("과제 등록 완료");
      navigate("/teacher");
    } catch (error) {
      console.error("과제 등록 실패:", error);
      alert("과제 등록 실패");
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-800">
      <div className="border-b border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">과제 등록</h1>
            <p className="text-sm text-slate-500">새로운 과제를 생성합니다.</p>
          </div>

          <button
            onClick={() => navigate("/teacher")}
            className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            목록으로
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-slate-100 text-slate-700 font-bold">
                T
              </div>
              <p className="mt-3 font-semibold text-slate-900">
                {teacherName || "교사"}
              </p>
              <p className="text-sm text-slate-500">
                {teacherSubject || "과목 미설정"}
              </p>
            </div>

            <div className="mt-6 space-y-2">
              <button
                onClick={() => navigate("/teacher")}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                <ArrowLeft size={16} />
                과제 목록
              </button>

              <button className="flex w-full items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white">
                <FilePlus2 size={16} />
                과제 등록
              </button>
            </div>
          </aside>

          <main className="space-y-6">
            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b bg-slate-50 px-5 py-4">
                <h2 className="text-lg font-semibold text-slate-900">
                  새 과제 정보 입력
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  과제 기본 정보를 설정하세요.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="p-5">
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <div className="grid border-b md:grid-cols-[180px_1fr]">
                    <div className="border-r bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-700">
                      과제명
                    </div>
                    <div className="px-4 py-3">
                      <input
                        type="text"
                        name="title"
                        value={form.title}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid border-b md:grid-cols-[180px_1fr]">
                    <div className="border-r bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-700">
                      대상 반
                    </div>
                    <div className="px-4 py-3">
                      <select
                        name="className"
                        value={form.className}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        required
                        disabled={managedClasses.length <= 1}
                      >
                        {managedClasses.length === 0 ? (
                          <option value="">반 정보 없음</option>
                        ) : (
                          managedClasses.map((className) => (
                            <option key={className} value={className}>
                              {className}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="grid border-b md:grid-cols-[180px_1fr]">
                    <div className="border-r bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-700">
                      과제 설명
                    </div>
                    <div className="px-4 py-3">
                      <textarea
                        name="description"
                        value={form.description}
                        onChange={handleChange}
                        rows={6}
                        className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid border-b md:grid-cols-[180px_1fr]">
                    <div className="border-r bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-700">
                      마감일
                    </div>
                    <div className="px-4 py-3">
                      <input
                        type="date"
                        name="dueDate"
                        value={form.dueDate}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-[180px_1fr]">
                    <div className="border-r bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-700">
                      AI 사용
                    </div>
                    <div className="px-4 py-3">
                      <label className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                        <span className="text-sm text-slate-800">AI 사용 허용</span>
                        <input
                          type="checkbox"
                          name="aiAllowed"
                          checked={form.aiAllowed}
                          onChange={handleChange}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => navigate("/teacher")}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    등록
                  </button>
                </div>
              </form>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b px-5 py-4">
                <h2 className="text-base font-semibold text-slate-900">안내</h2>
              </div>
              <div className="px-5 py-4 text-sm text-slate-600">
                <ul className="list-disc space-y-1 pl-5">
                  <li>반과 마감일은 필수입니다.</li>
                  <li>담당 반에만 과제를 등록할 수 있습니다.</li>
                </ul>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}