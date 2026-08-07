// src/pages/Home.jsx
import React, { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import LogoutButton from "./Logout";
import { AuthContext } from "../context/AuthContext";
import MainHeader from "../components/MainHeader";
import supportImg from "../assets/surport.png";
import mainImg from "../assets/mainImg.png";
import mainImg2 from "../assets/mainImg2.png";
import under1 from "../assets/under1.png";
import under2 from "../assets/under2.png";
import under3 from "../assets/under3.png";
import under4 from "../assets/under4.png";
import under5 from "../assets/under5.png";
import under6 from "../assets/under6.png";

import AOS from "aos";
import "aos/dist/aos.css";

function Home() {
  const { isLoginedId } = useContext(AuthContext);
  const isLoggedIn = isLoginedId !== 0;

  useEffect(() => {
    AOS.init({
      duration: 800,
      once: true,
      easing: "ease-out-cubic",
    });
  }, []);

  // ── 슬라이드 데이터 ───────────────────────────────────
  const slides = [
    {
      title: "업무를 효율적으로, WorkLog와 함께",
      subtitle:
        "하루의 업무를 간단히 정리하고, 자동으로 요약된 인수인계 문서를 만들어 보세요.",
      image:
        "https://images.unsplash.com/photo-1517048676732-d65bc937f952?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3",
    },
    {
      title: "인수인계, 더 간단하게",
      subtitle:
        "업무일지를 기반으로 템플릿에 맞는 인수인계 문서를 한 번에 생성할 수 있어요.",
      image:
        "https://images.unsplash.com/photo-1542640244-7e672d6cef4e?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3",
    },
    {
      title: "팀원과 기록을 공유하세요",
      subtitle: "누가 어떤 업무를 했는지, 한 번에 조회하고 공유해 보세요.",
      image:
        "https://images.unsplash.com/photo-1527689368864-3a821dbccc34?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3",
    },
  ];

  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const totalSlides = slides.length;

  const goToSlide = (targetIndex) => {
    if (targetIndex === currentSlide) return;
    setIsFading(true);
    setTimeout(() => {
      setCurrentSlide(targetIndex);
      setIsFading(false);
    }, 200);
  };

  const handlePrev = () => {
    const nextIndex = (currentSlide - 1 + totalSlides) % totalSlides;
    goToSlide(nextIndex);
  };

  const handleNext = () => {
    const nextIndex = (currentSlide + 1) % totalSlides;
    goToSlide(nextIndex);
  };

  const current = slides[currentSlide];

  const workLogCards = [
    {
      id: 1,
      title: "최근 작성한 일일업무일지",
      image: under1, // 로컬 이미지
      linkText: "업무일지 보러가기",
      linkTo: "/list?boardId=4",
    },
    {
      id: 2,
      title: "주간 업무 기록",
      image: under2,
      linkText: "주간 기록 보기",
      linkTo: "/list?boardId=5",
    },
    {
      id: 3,
      title: "인수인계 문서 리스트",
      image: under3,
      linkText: "인수인계 보러가기",
      linkTo: "/handoverList",
    },
    {
      id: 4,
      title: "템플릿 등록",
      image: under4,
      linkText: "템플릿 관리",
      linkTo: "/list?boardId=7", // 나중에 라우트 만들면 됨
    },
    {
      id: 5,
      title: "AI 요약 히스토리",
      image: under5,
      linkText: "요약 히스토리",
      linkTo: "/mypage",
    },
    {
      id: 6,
      title: "전체 글",
      image: under6,
      linkText: "전체 글 보기",
      linkTo: "/list",
    },
  ];
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <MainHeader />

      <main className="container mx-auto px-4 pt-10 pb-20 space-y-24">
        {/* 1. 메인 슬라이드 배너 */}
        <section
          className={`relative w-full h-[420px] rounded-2xl overflow-hidden shadow-xl bg-gray-900
            transition-opacity duration-500 ease-out
            ${isFading ? "opacity-0" : "opacity-100"}`}
        >
          <img
            className="w-full h-full object-cover opacity-80"
            src={current.image}
            alt="Work Log Background"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-gray-200/60 to-transparent flex flex-col items-center justify-center gap-4">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 text-center drop-shadow-md">
              {current.title}
            </h1>
            <p className="text-base md:text-lg text-gray-700 text-center max-w-xl">
              {current.subtitle}
            </p>
          </div>

          {/* 슬라이드 컨트롤 (< ● ○ ○ >) */}
          <div className="absolute bottom-6 right-8 flex items-center gap-3 text-gray-800 text-xs">
            <button
              onClick={handlePrev}
              className="w-6 h-6 flex items-center justify-center rounded-full border border-gray-400 bg-white/80 hover:bg-white shadow-sm"
            >
              ‹
            </button>

            <div className="flex items-center gap-1.5">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => goToSlide(idx)}
                  className={`w-2.5 h-2.5 rounded-full border transition
                    ${
                      idx === currentSlide
                        ? "bg-gray-800 border-gray-800"
                        : "bg-white/70 border-gray-400/70"
                    }`}
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              className="w-6 h-6 flex items-center justify-center rounded-full border border-gray-400 bg-white/80 hover:bg-white shadow-sm"
            >
              ›
            </button>
          </div>
        </section>

        {/* 2. 소개 / 고객센터 두 카드 */}
        <section
          className="grid grid-cols-1 md:grid-cols-2 gap-8"
          data-aos="fade-up"
        >
          {/* WorkLog 소개 카드 */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden flex flex-col md:flex-row">
            <div className="md:w-2/5 h-32 md:h-auto">
              <img
                src="https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?q=80&w=1200&auto=format&fit=crop&ixlib=rb-4.0.3"
                alt="소개 이미지"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 p-6 flex flex-col justify-between h-80">
              <div>
                <h2 className="text-xl font-semibold mb-2">WorkLog 소개</h2>
                <p className="text-sm text-gray-600">
                  WorkLog가 어떤 서비스인지, 실제 사용 화면과 함께 간단하게
                  소개합니다.
                </p>
              </div>
              <Link
                to="/about"
                className="mt-4 inline-flex items-center text-sm text-teal-700 font-semibold hover:underline self-end"
              >
                소개 페이지로 이동 →
              </Link>
            </div>
          </div>

          {/* 고객센터 카드 */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden flex flex-col md:flex-row">
            <div className="md:w-2/5 h-32 md:h-auto">
              <img
                src={supportImg}
                alt="고객센터 이미지"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 p-6 flex flex-col justify-between">
              <div>
                <h2 className="text-xl font-semibold mb-2">고객 센터</h2>
                <p className="text-sm text-gray-600">
                  사용 중 궁금한 점이나 오류가 있다면 언제든지 문의해 주세요.
                  답변 기록도 한 곳에서 관리할 수 있어요.
                </p>
              </div>
              <Link
                to="/customerCenter"
                className="mt-4 inline-flex items-center text-sm text-teal-700 font-semibold hover:underline self-end"
              >
                문의하러 가기 →
              </Link>
            </div>
          </div>
        </section>

        {/* 3. 겹쳐진 사진 섹션 (글목록 대신) */}
        <section className="relative z-0 h-[1000px] md:h-[950px] overflow-hidden rounded-3xl">
          {/* ✅ 배경: 연한 그라데이션 */}
          <div className="absolute inset-0 z-0 bg-gradient-to-b from-white via-gray-50 to-white" />

          {/* ✅ 배경: 블러 블롭 (추천) */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            <div className="absolute -top-28 -left-28 w-[560px] h-[560px] bg-teal-300/25 rounded-full blur-3xl" />
            <div className="absolute top-24 -right-28 w-[560px] h-[560px] bg-indigo-300/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-28 left-1/3 w-[560px] h-[560px] bg-rose-300/15 rounded-full blur-3xl" />
          </div>

          {/* 위 사진 (먼저 등장) */}
          <div
            className="absolute z-10 left-4 md:left-24 top-0 w-[75%] md:w-[50%] h-[480px] md:h-[560px] rounded-2xl overflow-hidden shadow-xl border border-gray-200 bg-white"
            data-aos="fade-right"
            data-aos-offset="200"
          >
            <img
              src={mainImg}
              alt="사용하는 사진 넣기"
              className="w-full h-full object-cover"
            />
          </div>
 
          {/* 아래쪽 겹치는 사진 (스크롤 좀 더 내리면 등장) */}
          <div
            className="absolute z-10 right-4 md:right-24 bottom-0 w-[85%] md:w-[60%] h-[450px] md:h-[490px] rounded-2xl overflow-hidden shadow-2xl border border-gray-200 bg-white"
            data-aos="fade-left"
            data-aos-delay="250"
            data-aos-offset="230"
          >
            <img
              src={mainImg2}
              alt="사용하는 사진 넣기"
              className="w-full h-full object-cover"
            />
          </div>
        </section>

        {/* 4. LIST 섹션 (사진 카드 6개) */}
        <section className="space-y-8">
          <div
            className="inline-block px-6 py-2 rounded-full font-semibold text-4xl"
            data-aos="fade-up"
          >
            WorkLogList
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {workLogCards.map((card, idx) => (
              <div
                key={card.id}
                className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden flex flex-col"
                data-aos="fade-up"
                data-aos-delay={50 * idx}
              >
                {/* 이미지 영역 */}
                <div className="h-40">
                  <img
                    src={card.image}
                    alt={card.title}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* 텍스트 + 링크 영역 */}
                <div className="p-4 flex justify-between items-center">
                  <span className="text-sm text-gray-700">{card.title}</span>

                  <Link
                    to={card.linkTo}
                    className="text-xs border border-gray-400 rounded-full px-3 py-1 hover:bg-gray-100"
                  >
                    {card.linkText}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 5. 하단 시작하기 CTA */}
        <section className="mt-12" data-aos="fade-up" data-aos-delay="100">
          <div className="flex justify-center">
            <div
              className="max-w-3xl text-center text-sm md:text-base text-gray-700
                 px-6 py-3 border border-gray-200 rounded-full bg-white
                 hover:bg-gray-100 hover:border-gray-300
                 transition-colors duration-200"
            >
              <span className="text-3xl">
                지금 바로 WorkLog를 시작해 보세요.{" "}
              </span>
              <Link
                to="/write"
                className="font-semibold underline underline-offset-2"
              >
                시작하기
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="text-center p-6 mt-8 border-t border-gray-200 text-gray-500 bg-white">
        &copy; 2025 WorkLog. All rights reserved.
      </footer>
    </div>
  );
}

export default Home;
