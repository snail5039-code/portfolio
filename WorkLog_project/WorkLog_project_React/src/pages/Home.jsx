import React, { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import LandingHome from "../components/home/LandingHome";
import WorkDashboard from "../components/home/WorkDashboard";

function Home() {
  const { isLoginedId, authLoaded } = useContext(AuthContext);

  if (!authLoaded) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#fdfcf9] text-[#d95635]">
        <div className="text-center">
          <span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-[#f0d8cf] border-t-[#d95635]" />
          <p className="mt-3 text-xs text-[#8c837c]">업무 기록을 불러오는 중입니다.</p>
        </div>
      </div>
    );
  }

  return isLoginedId > 0 ? <WorkDashboard userId={isLoginedId} /> : <LandingHome />;
}

export default Home;
