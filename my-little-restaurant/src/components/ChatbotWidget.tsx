'use client';

import { useEffect, useState, useRef } from 'react';
import { useChatbotStore } from '@/lib/stores/chatbot';
import { ChatbotCharacter } from './ChatbotCharacter';
import { ChatbotPanel } from './ChatbotPanel';

export function ChatbotWidget() {
  const [mounted, setMounted] = useState(false);
  const {
    isOpen,
    setIsOpen,
    characterClickCount,
    incrementClickCount,
    resetClickCount,
    characterY,
    characterX,
    setCharacterY,
    setCharacterX,
    isHiding,
    setIsHiding,
  } = useChatbotStore();

  const [isDragging, setIsDragging] = useState(false);
  const characterRef = useRef<HTMLDivElement>(null);
  // 실제로 드래그(이동)가 발생했는지 ref로 동기 추적 — 클릭 핸들러가 참조하는
  // React state는 리렌더링을 거쳐야 갱신되므로, 빠른 클릭 시 pointerup이 먼저
  // 발생해도 state가 아직 반영되지 않아 클릭이 무시되는 경쟁 상태를 피하기 위함
  const wasDraggedRef = useRef(false);

  // Hydration 문제 해결
  useEffect(() => {
    setMounted(true);
  }, []);

  // 캐릭터 클릭: 채팅창 열기/닫기 토글 + 클릭할 때마다 대사 단계 진행
  const handleCharacterClick = () => {
    if (wasDraggedRef.current) {
      // 드래그 후 발생하는 클릭은 무시
      wasDraggedRef.current = false;
      return;
    }

    // 채팅창은 클릭할 때마다 열림/닫힘 토글
    setIsOpen(!isOpen);

    // 클릭 카운트는 열림/닫힘과 무관하게 항상 증가 (대사 단계 진행)
    incrementClickCount();

    // 5번 이상 누르면 2초 뒤 숨김 상태 해제
    if (characterClickCount >= 5) {
      setTimeout(() => {
        setIsHiding(false);
        resetClickCount();
      }, 2000);
    }
  };

  // Pointer Events로 마우스/터치를 함께 처리 (마우스 전용 mousedown/mousemove로는
  // 모바일 터치 드래그가 전혀 동작하지 않아서 교체함).
  // setPointerCapture는 쓰지 않는다 — 캡처를 걸면 이후 이 엘리먼트에서 발생해야 할
  // 네이티브 click 합성이 억제되는 경우가 있어(실제 크로미움에서 재현됨) 캐릭터를
  // 눌러도 채팅창이 열리지 않는 문제가 있었다. 대신 document에 리스너를 바로
  // 등록해 포인터가 엘리먼트 밖으로 나가도 계속 추적한다.
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isOpen) return; // 채팅창이 열려있으면 드래그 불가

    wasDraggedRef.current = false;
    const startX = e.clientX;
    const startY = e.clientY;
    let lastX = startX;
    let lastY = startY;
    let currentX = characterX;
    let currentY = characterY;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const movedX = Math.abs(moveEvent.clientX - startX);
      const movedY = Math.abs(moveEvent.clientY - startY);

      // 실제 클릭/탭에도 몇 px 정도의 미세한 흔들림은 항상 섞이므로, 임계값이
      // 너무 작으면(예전 3px) 정상적인 클릭까지 드래그로 오인해 채팅이 안 열리는
      // 문제가 있었다. 여유 있게 12px로 잡는다.
      if (!wasDraggedRef.current && (movedX > 12 || movedY > 12)) {
        wasDraggedRef.current = true;
        setIsDragging(true);
      }

      if (!wasDraggedRef.current) return;

      const deltaX = moveEvent.clientX - lastX;
      const deltaY = moveEvent.clientY - lastY;

      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;

      currentX = Math.max(0, Math.min(100, currentX + (deltaX / windowWidth) * 100));
      currentY = Math.max(0, Math.min(100, currentY + (deltaY / windowHeight) * 100));

      setCharacterX(currentX);
      setCharacterY(currentY);

      lastX = moveEvent.clientX;
      lastY = moveEvent.clientY;
    };

    const handlePointerUp = () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointercancel', handlePointerUp);
      setIsDragging(false);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointercancel', handlePointerUp);
  };

  if (!mounted) return null;

  return (
    <>
      {/* 캐릭터 */}
      <div
        ref={characterRef}
        className={`fixed z-50 transition-all select-none ${isDragging ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${
          isHiding ? 'opacity-0 pointer-events-none' : ''
        }`}
        style={{
          left: `${characterX}%`,
          top: `${characterY}%`,
          transform: 'translate(-50%, -50%)',
          userSelect: 'none',
          touchAction: 'none',
        }}
        onPointerDown={handlePointerDown}
      >
        <ChatbotCharacter
          clickCount={characterClickCount}
          onCharacterClick={handleCharacterClick}
          isHiding={isHiding}
        />
      </div>

      {/* 채팅 패널 */}
      {isOpen && <ChatbotPanel characterX={characterX} characterY={characterY} />}
    </>
  );
}
