"use client";

import {
  Activity, AlertTriangle, BarChart3, CalendarDays, ChevronRight,
  Clock3, CloudSun, Droplets, Gauge, MapPin, Pin, ShieldCheck, Sun,
  ThermometerSun, Users, Wind,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from "recharts";
import analysisAllAges from "@/data/analysis-all-ages.json";
import analysisElderly from "@/data/analysis-elderly.json";

const cities = ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "수원", "춘천", "청주", "전주", "목포", "안동", "창원", "제주"];
type View = "forecast" | "model" | "analysis";
type Weather = Record<string, number>;
type PredictionResponse = {
  target: string;
  date: string;
  city: string;
  startHour: number;
  durationMinutes: number;
  national: { prediction: number; level: string; weather: Weather };
  cityResult: { prediction: number; level: string; weather: Weather };
  guidance: string[];
  warning: { status: string; level?: string; message: string };
};
type AnalysisResponse = {
  target: string;
  rowCount: number;
  weatherColumns: string[];
  preview: { columns: string[]; rows: Record<string, string | number>[] };
  timeSeries: { date: string; patients: number }[];
  scatter: { temperature: number; patients: number }[];
  importance: { feature: string; value: number }[];
};

export default function Dashboard() {
  const [view, setView] = useState<View>("forecast");
  const [target, setTarget] = useState("전체 연령");
  const [city, setCity] = useState("대구");
  const [date, setDate] = useState(() => {
    const now = new Date();
    const localTime = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
    return localTime.toISOString().slice(0, 10);
  });
  const [startHour, setStartHour] = useState(14);
  const [durationMinutes, setDurationMinutes] = useState(100);
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handlePredict() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, date, city, startHour, durationMinutes }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "예측에 실패했습니다.");
      setResult(data);
      setView("forecast");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "예측에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="portal-shell">
      <div className="utility-bar"><div><span>기상·보건 데이터 서비스</span><span>데이터 기준 2022–2025</span></div></div>
      <header className="site-header">
        <div className="site-brand"><span className="site-symbol"><Sun size={24} /></span><div><strong>온열질환 예측정보</strong><small>기상정보 기반 환자 수 예측 서비스</small></div></div>
        <div className="data-status"><span></span> 기상 예보 연결</div>
      </header>
      <nav className="tabs" aria-label="대시보드 화면">
          <button className={view === "forecast" ? "active" : ""} onClick={() => setView("forecast")}>예측 결과</button>
          <button className={view === "model" ? "active" : ""} onClick={() => setView("model")}>모델 정보</button>
          <button className={view === "analysis" ? "active" : ""} onClick={() => setView("analysis")}>데이터 분석</button>
      </nav>
      <section className="workspace">
        <div className="page-heading"><p>온열질환 예측</p><h1>기상 조건별 온열질환자 수 예측</h1><span>전국 기상정보와 선택한 외출 시간대의 기상 조건을 비교해 예상 환자 수를 제공합니다.</span></div>
        <section className="search-panel">
          <div className="search-title"><strong>예측 조건 조회</strong><span>조회 조건을 선택한 후 예측 버튼을 눌러주세요.</span></div>
          <div className="search-fields">
            <label className="field"><span><Users size={15} /> 예측 대상</span><select value={target} onChange={(event) => setTarget(event.target.value)}><option>전체 연령</option><option>65세 이상</option></select></label>
            <label className="field"><span><CalendarDays size={15} /> 예측 날짜</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
            <label className="field"><span><MapPin size={15} /> 외출 지역</span><select value={city} onChange={(event) => setCity(event.target.value)}>{cities.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="field"><span><Clock3 size={15} /> 시작 시각</span><select value={startHour} onChange={(event) => setStartHour(Number(event.target.value))}>{Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{hour}시</option>)}</select></label>
            <label className="field"><span><Activity size={15} /> 체류시간(분)</span><input type="number" value={durationMinutes} min="0" max="1440" step="10" onChange={(event) => setDurationMinutes(Number(event.target.value))} /></label>
            <button className="predict-button" type="button" onClick={handlePredict} disabled={loading}>{loading ? "조회 중..." : "예측 조회"} {!loading && <ChevronRight size={17} />}</button>
          </div>
          {error && <p className="form-error">{error}</p>}
        </section>
        {view === "forecast" && <ForecastView city={city} target={target} date={date} startHour={startHour} durationMinutes={durationMinutes} result={result} loading={loading} />}
        {view === "model" && <ModelView />}
        {view === "analysis" && <AnalysisView key={target} target={target} />}
      </section>
    </main>
  );
}

function ForecastView({ city, target, date, startHour, durationMinutes, result, loading }: { city: string; target: string; date: string; startHour: number; durationMinutes: number; result: PredictionResponse | null; loading: boolean }) {
  const national = result?.national;
  const local = result?.cityResult;
  const shownCity = result?.city ?? city;
  const shownDate = result?.date ?? date;
  const shownHour = result?.startHour ?? startHour;
  const shownDuration = result?.durationMinutes ?? durationMinutes;
  const weather = local?.weather;

  return (
    <div className="view-content">
      <div className="section-intro"><div><span className="section-kicker">{shownDate}</span><h2>{result?.target ?? target} 예측 결과</h2></div><span className="updated">{result ? "예보 조회 완료" : "조건을 선택해 주세요"}</span></div>
      <div className="result-grid">
        <article className="result-card national">
          <div className="card-topline"><span>전국 하루 평균</span><RiskBadge level={national?.level} /></div>
          <div className="result-number">{national ? Math.round(national.prediction) : "—"}{national && <small>명</small>}</div>
          <p>전국 대표 지역의 하루 평균 기상 조건을 반영했습니다.</p>
          <div className="temp-line"><ThermometerSun size={19} /> 평균기온 <strong>{national ? `${national.weather["평균기온(°C)"].toFixed(1)}°C` : "대기 중"}</strong></div>
        </article>
        <article className="result-card local">
          <div className="card-topline"><span>{shownCity} · {shownHour}시부터 {shownDuration}분</span><RiskBadge level={local?.level} /></div>
          <div className="result-number">{local ? Math.round(local.prediction) : "—"}{local && <small>명</small>}</div>
          <p>선택한 외출 시간대의 기온·습도·풍속을 반영한 참고값입니다.</p>
          <div className="temp-line"><ThermometerSun size={19} /> 시간대 평균기온 <strong>{weather ? `${weather["평균기온(°C)"].toFixed(1)}°C` : "대기 중"}</strong></div>
        </article>
      </div>
      <section className="weather-panel">
        <div className="panel-title"><div><CloudSun size={20} /><strong>{shownCity} 외출 시간대 날씨</strong></div><WarningChip warning={result?.warning} /></div>
        <div className="weather-grid">
          <WeatherItem icon={<ThermometerSun />} label="평균기온" value={weather ? `${weather["평균기온(°C)"].toFixed(1)}°C` : "—"} />
          <WeatherItem icon={<Droplets />} label="평균습도" value={weather ? `${weather["평균 상대습도(%)"].toFixed(0)}%` : "—"} />
          <WeatherItem icon={<Wind />} label="평균풍속" value={weather ? `${weather["평균 풍속(m/s)"].toFixed(1)} m/s` : "—"} />
          <WeatherItem icon={<Gauge />} label="최고 / 최저" value={weather ? `${weather["최고기온(°C)"].toFixed(1)}° / ${weather["최저기온(°C)"].toFixed(1)}°` : "—"} />
        </div>
      </section>
      <GuidancePanel result={result} loading={loading} />
    </div>
  );
}

function severityClass(level?: string) {
  if (level === "매우 높음") return "severe";
  if (level === "높음") return "high";
  if (level === "보통") return "normal";
  if (level === "낮음") return "low";
  return "";
}

function GuidancePanel({ result, loading }: { result: PredictionResponse | null; loading: boolean }) {
  const level = result?.cityResult.level;
  return (
    <section className={`guidance-panel ${severityClass(level)}`}>
      <div className="guidance-icon"><ShieldCheck size={24} /></div>
      <div>
        <div className="guidance-headline"><span>외출 안내</span>{level && <RiskBadge level={level} />}</div>
        <h3>{loading ? "예보를 확인하고 있습니다." : level ? guidanceTitle(level) : "예측 결과 확인을 눌러주세요."}</h3>
        <p>{result?.guidance.slice(1).join(" ") ?? "선택한 지역과 외출 시간에 맞춰 안내해 드립니다."}</p>
      </div>
    </section>
  );
}

function RiskBadge({ level }: { level?: string }) {
  if (!level) return <span className="risk-badge pending">예측 전</span>;
  const className = level === "매우 높음" ? "severe" : level === "높음" ? "high" : level === "보통" ? "normal" : "low";
  return <span className={`risk-badge ${className}`}>{level}</span>;
}

function WarningChip({ warning }: { warning?: PredictionResponse["warning"] }) {
  if (!warning) return <span className="warning-chip muted"><AlertTriangle size={15} /> 특보 조회 전</span>;
  const alert = warning.status === "active";
  return <span className={`warning-chip ${alert ? "active" : ""}`}><AlertTriangle size={15} /> {warning.level ?? warning.message}</span>;
}

function guidanceTitle(level: string) {
  if (level === "매우 높음") return "외출 시간을 조정하는 편이 좋습니다.";
  if (level === "높음") return "한낮 야외활동을 줄여주세요.";
  return "더위에 대비해 외출을 준비하세요.";
}

function WeatherItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="weather-item"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></div>;
}

function ModelView() {
  return (
    <div className="view-content">
      <div className="section-intro"><div><span className="section-kicker">RANDOM FOREST</span><h2>두 모델을 함께 비교합니다.</h2></div></div>
      <div className="model-grid">
        <ModelCard title="전체 연령 모델" r2="0.846" mae="9.700" rmse="14.871" r2Year="0.686" importance={analysisAllAges.importance} />
        <ModelCard title="65세 이상 모델" r2="0.837" mae="3.209" rmse="4.917" r2Year="0.687" importance={analysisElderly.importance} />
      </div>
      <div className="info-strip"><BarChart3 size={20} /><p>테스트 결과는 데이터를 무작위로 80:20 분리한 평가입니다. 2025년 평가는 연도 분리 보조 실험이며 테스트 결과와 조건이 다릅니다. R²는 정확도 퍼센트가 아닙니다.</p></div>
      <div className="section-intro" style={{ marginTop: 32 }}><div><h2>모델 입력 정보</h2></div></div>
      <div className="insight-grid">
        <article className="insight-card">
          <h3><CloudSun size={16} /> 입력 기상 변수 8개</h3>
          <ul>{analysisAllAges.weatherColumns.map((column) => <li key={column}>{column}</li>)}</ul>
        </article>
        <article className="insight-card">
          <h3><Pin size={16} /> 예측값의 의미</h3>
          <p>전체 연령 모델: 전국 하루 전체 연령 예상 환자 수</p>
          <p>65세 이상 모델: 전국 하루 65세 이상 예상 환자 수</p>
          <p>두 모델은 서로 별도로 학습된 Random Forest 모델입니다.</p>
        </article>
      </div>
      <div className="notice-banner">모델 결과는 전국 하루 예상 신고 환자 수입니다. 특정 지역의 실제 환자 수나 개인의 발병 확률을 의미하지 않습니다.</div>
    </div>
  );
}

function ModelCard({ title, r2, mae, rmse, r2Year, importance }: { title: string; r2: string; mae: string; rmse: string; r2Year: string; importance: { feature: string; value: number }[] }) {
  return (
    <article className="model-card">
      <div className="model-title"><span><Users size={19} /></span><h3>{title}</h3></div>
      <div className="model-score"><small>테스트 R²</small><strong>{r2}</strong></div>
      <dl><div><dt>MAE</dt><dd>{mae}명</dd></div><div><dt>RMSE</dt><dd>{rmse}명</dd></div><div><dt>학습 / 테스트</dt><dd>428일 / 108일</dd></div><div><dt>2025년 보조 평가 R²</dt><dd>{r2Year}</dd></div></dl>
      <div className="model-importance">
        <small>변수 중요도</small>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={importance} margin={{ bottom: 42 }}><CartesianGrid stroke="#e8edf2" vertical={false} /><XAxis dataKey="feature" angle={-25} textAnchor="end" interval={0} tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} width={34} /><Tooltip /><Bar dataKey="value" name="중요도" fill="#0c2948" radius={[4, 4, 0, 0]} /></BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

function AnalysisView({ target }: { target: string }) {
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/analysis?target=${encodeURIComponent(target)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        if (active) setAnalysis(data);
      })
      .catch((caughtError) => {
        if (active) setError(caughtError instanceof Error ? caughtError.message : "분석 자료를 불러오지 못했습니다.");
      });
    return () => { active = false; };
  }, [target]);

  return (
    <div className="view-content">
      <div className="section-intro"><div><span className="section-kicker">2022—2025 · {target}</span><h2>기상과 환자 수의 관계를 확인합니다.</h2></div></div>
      {error && <div className="data-error">{error}</div>}
      {!analysis && !error && <div className="data-loading">학습 자료를 불러오는 중입니다.</div>}
      {analysis && <>
        <div className="chart-grid">
          <ChartPanel title="기본 데이터">
            <div className="data-table-wrap">
              <table className="data-table">
                <thead><tr>{analysis.preview.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
                <tbody>{analysis.preview.rows.map((row, index) => (
                  <tr key={index}>{analysis.preview.columns.map((column) => <td key={column}>{row[column]}</td>)}</tr>
                ))}</tbody>
              </table>
            </div>
            <p className="analysis-caption">전체 데이터 수: {analysis.rowCount}일 · 수집 연도: 2022~2025년</p>
          </ChartPanel>
          <ChartPanel title="날짜별 환자 수">
            <ResponsiveContainer width="100%" height={270}>
              <LineChart data={analysis.timeSeries}><CartesianGrid stroke="#e8edf2" vertical={false} /><XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={42} /><YAxis tick={{ fontSize: 11 }} width={38} /><Tooltip /><Line type="monotone" dataKey="patients" name="환자 수" stroke="#1768ac" strokeWidth={2} dot={false} /></LineChart>
            </ResponsiveContainer>
          </ChartPanel>
        </div>
        <div className="chart-grid">
          <ChartPanel title="최고기온과 환자 수">
            <ResponsiveContainer width="100%" height={270}>
              <ScatterChart><CartesianGrid stroke="#e8edf2" /><XAxis type="number" dataKey="temperature" name="최고기온" unit="°C" tick={{ fontSize: 11 }} /><YAxis type="number" dataKey="patients" name="환자 수" tick={{ fontSize: 11 }} width={38} /><Tooltip cursor={{ strokeDasharray: "3 3" }} /><Scatter data={analysis.scatter} fill="#f06449" fillOpacity={0.58} /></ScatterChart>
            </ResponsiveContainer>
          </ChartPanel>
          <ChartPanel title="기상 변수 중요도">
            <ResponsiveContainer width="100%" height={270}>
              <BarChart data={analysis.importance} margin={{ bottom: 42 }}><CartesianGrid stroke="#e8edf2" vertical={false} /><XAxis dataKey="feature" angle={-25} textAnchor="end" interval={0} tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} width={38} /><Tooltip /><Bar dataKey="value" name="중요도" fill="#0c2948" radius={[5, 5, 0, 0]} /></BarChart>
            </ResponsiveContainer>
          </ChartPanel>
        </div>
        <div className="section-intro" style={{ marginTop: 8 }}><div><h2>분석 결과 해석</h2></div></div>
        <div className="insight-grid">
          <article className="insight-card">
            <h3><ThermometerSun size={16} /> 높은 기온에서 환자 수 증가</h3>
            <p>전국 평균 최고기온이 높은 구간에서 환자가 많이 발생한 날들이 관찰됩니다.</p>
            <p><strong>더운 날일수록 환자 발생 규모가 커지는 경향이 있습니다.</strong></p>
          </article>
          <article className="insight-card">
            <h3><BarChart3 size={16} /> 같은 기온에서도 발생 규모 차이</h3>
            <p>비슷한 최고기온에서도 날짜에 따라 환자 수가 크게 달라집니다.</p>
            <p><strong>최고기온만으로 하루 환자 수를 설명하기는 어렵습니다.</strong></p>
          </article>
        </div>
        <p className="analysis-caption">분석 범위: 전국 단위의 여름철 감시자료 · 특정 지역이나 개인의 위험을 직접 나타내지는 않습니다.</p>
        <section className="finding"><span>분석 메모</span><p>이러한 특성을 반영하기 위해 기온·습도·풍속 등 8개 기상 변수를 함께 사용하는 Random Forest 모델을 적용했습니다. 변수 중요도는 이 모델이 어떤 기상 정보를 예측에 주로 활용했는지 해석하는 데 사용했습니다.</p></section>
        <p className="analysis-caption">전국 평균을 이용한 분석이므로 특정 지역의 극단적인 더위나 개인의 온열질환 위험을 그대로 나타내지는 않습니다.</p>
      </>}
    </div>
  );
}

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="chart-panel"><h3>{title}</h3>{children}</section>;
}
