'use client';

import { useState, useMemo } from 'react';

interface ChatbotCharacterProps {
  clickCount: number;
  onCharacterClick: () => void;
  isHiding: boolean;
}

export function ChatbotCharacter({
  clickCount,
  onCharacterClick,
  isHiding,
}: ChatbotCharacterProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  const getDialogue = () => {
    if (clickCount === 0) return '안녕! 맛집 궁금한 거 있어?';
    if (clickCount === 1) return '뭐 도와드릴까요? 😊';
    if (clickCount === 2) return '헤이, 뭘 자꾸 누르는 거야?';
    if (clickCount === 3) return '진짜 필요한 거만 물어봐...';
    if (clickCount === 4) return '아! 이제 진짜 화났어!';
    if (clickCount >= 5) return '꺼져! 난 여기 있고 싶지 않아! 도망 갈래!';
    return '';
  };

  const handleClick = () => {
    setIsAnimating(true);
    onCharacterClick();
    setTimeout(() => setIsAnimating(false), 300);
  };

  const shouldRun = clickCount > 5;
  const animationStyle = shouldRun
    ? { animation: 'runAway 0.5s ease-in forwards' }
    : isAnimating
      ? { animation: 'wiggle 0.3s ease-in-out' }
      : {};

  return (
    <div className="relative flex items-center justify-center">
      <style>{`
        @keyframes wiggle {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          25% { transform: translateX(-5px) rotate(-2deg); }
          75% { transform: translateX(5px) rotate(2deg); }
        }
        @keyframes runAway {
          0% { transform: translateX(0) scaleX(1); opacity: 1; }
          100% { transform: translateX(100px) scaleX(-1); opacity: 0; }
        }
        @keyframes blink {
          0%, 100% { cy: 35; }
          50% { cy: 32; }
        }
      `}</style>

      <svg
        width="80"
        height="80"
        viewBox="0 0 80 80"
        className="drop-shadow-lg cursor-pointer transition-transform hover:scale-105"
        onClick={handleClick}
        style={animationStyle}
      >
        {/* 밥그릇 바디 */}
        <ellipse cx="40" cy="45" rx="28" ry="25" fill="#F5DEB3" stroke="#D4AF37" strokeWidth="2" />
        <path
          d="M 12 45 Q 12 60 40 65 Q 68 60 68 45"
          fill="#E8D5B7"
          stroke="#D4AF37"
          strokeWidth="2"
        />

        {/* 눈 */}
        <circle cx="32" cy="35" r="3" fill="#333" />
        <circle cx="48" cy="35" r="3" fill="#333" />

        {/* 눈빛 */}
        <circle cx="33" cy="34" r="1.5" fill="#fff" />
        <circle cx="49" cy="34" r="1.5" fill="#fff" />

        {/* 입 */}
        <path d="M 35 45 Q 40 48 45 45" stroke="#333" strokeWidth="1.5" fill="none" strokeLinecap="round" />

        {/* 뺨 */}
        <circle cx="20" cy="42" r="4" fill="#FFB6C1" opacity="0.6" />
        <circle cx="60" cy="42" r="4" fill="#FFB6C1" opacity="0.6" />

        {/* 숟가락 */}
        <line x1="50" y1="50" x2="60" y2="65" stroke="#C0C0C0" strokeWidth="2" />
        <ellipse cx="62" cy="67" rx="5" ry="3" fill="#C0C0C0" transform="rotate(30 62 67)" />

        {/* 밥 (쌀알 모양) */}
        <circle cx="38" cy="52" r="1.5" fill="#FFE4B5" opacity="0.8" />
        <circle cx="42" cy="51" r="1.5" fill="#FFE4B5" opacity="0.8" />
        <circle cx="40" cy="54" r="1.5" fill="#FFE4B5" opacity="0.8" />
      </svg>

      {/* 말풍선 */}
      {!isHiding && (
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-white rounded-lg shadow-md px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-700 pointer-events-none">
          {getDialogue()}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-white" />
        </div>
      )}
    </div>
  );
}
