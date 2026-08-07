'use client';

import { useRef, useEffect, useState } from 'react';
import { useChatbotStore } from '@/lib/stores/chatbot';
import { sendChatbotMessage } from '@/app/chatbot/actions';
import { MessageCircle, X, Send, RefreshCw } from 'lucide-react';

interface ChatbotPanelProps {
  characterX: number;
  characterY: number;
}

// **굵게** 표시만 인라인으로 처리 (그 외 마크다운 기호는 그대로 노출하지 않고 텍스트로만 취급)
function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*.+?\*\*)/g).filter((part) => part.length > 0);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

// 줄바꿈 단위로 문단을 나눠서 렌더링 (빈 줄은 여백, #헤더/구분선은 별도 스타일로 처리)
function FormattedMessage({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        const trimmed = line.trim();

        if (trimmed === '') {
          return <div key={i} className="h-1" />;
        }

        if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
          return <hr key={i} className="my-1.5 border-gray-200" />;
        }

        const headerMatch = trimmed.match(/^#{1,6}\s+(.*)$/);
        if (headerMatch) {
          return (
            <p key={i} className="font-bold leading-relaxed">
              {renderInlineMarkdown(headerMatch[1])}
            </p>
          );
        }

        return (
          <p key={i} className="leading-relaxed">
            {renderInlineMarkdown(line)}
          </p>
        );
      })}
    </div>
  );
}

export function ChatbotPanel({ characterX, characterY }: ChatbotPanelProps) {
  const {
    isOpen,
    messages,
    isLoading,
    characterClickCount,
    setIsOpen,
    addMessage,
    clearMessages,
    setIsLoading,
  } = useChatbotStore();

  const [input, setInput] = useState('');
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDraggingPanel, setIsDraggingPanel] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user' as const,
      content: input,
      timestamp: Date.now(),
    };

    addMessage(userMessage);
    setInput('');
    setIsLoading(true);

    try {
      // characterClickCount를 context로 포함시켜서 전송
      const contextMessage = characterClickCount > 0
        ? `[사용자가 캐릭터를 ${characterClickCount}번 클릭했습니다]`
        : '';

      const response = await sendChatbotMessage(messages, input, characterClickCount);
      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant' as const,
        content: response,
        timestamp: Date.now(),
      };
      addMessage(assistantMessage);
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant' as const,
        content: '죄송해요, 지금 답변을 드릴 수 없어요. 다시 시도해주세요.',
        timestamp: Date.now(),
      };
      addMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // 헤더 드래그로 채팅창 이동 (Pointer Events + capture로 마우스/터치 함께 처리)
  const draggingPanelRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });

  const handleHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // 버튼 클릭은 드래그로 취급하지 않음
    if ((e.target as HTMLElement).closest('button')) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    draggingPanelRef.current = true;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    setIsDraggingPanel(true);
  };

  const handleHeaderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingPanelRef.current) return;
    const deltaX = e.clientX - lastPointerRef.current.x;
    const deltaY = e.clientY - lastPointerRef.current.y;
    setDragOffset((prev) => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
  };

  const endHeaderDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingPanelRef.current) return;
    draggingPanelRef.current = false;
    setIsDraggingPanel(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  if (!isOpen) return null;

  // 캐릭터 위치를 기반으로 패널 위치 계산
  const isCharacterOnRight = characterX > 50;
  const panelWidth = 384; // w-96 = 24rem = 384px

  // 패널이 화면을 넘치지 않도록 위치 조정
  const panelLeft = isCharacterOnRight ? 'auto' : undefined;
  const panelRight = isCharacterOnRight ? '20px' : 'auto';

  return (
    <div
      ref={panelRef}
      className="fixed bg-white rounded-lg shadow-2xl flex flex-col z-40 border border-gray-200"
      style={{
        width: `${panelWidth}px`,
        height: 'min(560px, 75vh)',
        bottom: '120px',
        left: panelLeft || 'auto',
        right: panelRight,
        transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`,
        pointerEvents: 'auto',
      }}
    >
      {/* Header */}
      <div
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={endHeaderDrag}
        onPointerCancel={endHeaderDrag}
        className={`flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0 select-none ${
          isDraggingPanel ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{ userSelect: 'none', touchAction: 'none' }}
      >
        <div className="flex items-center gap-2">
          <MessageCircle size={20} className="text-blue-600" />
          <span className="font-semibold text-gray-800">맛집 도우미</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearMessages}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
            title="채팅 초기화"
          >
            <RefreshCw size={16} className="text-gray-600" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
          >
            <X size={16} className="text-gray-600" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">맛집에 대해 궁금한 점을 물어봐주세요!</p>
            <p className="text-xs mt-2">식당 추천, 메뉴 조언, 앱 사용법 등</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] px-3 py-2 rounded-lg text-sm break-words ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <FormattedMessage content={msg.content} />
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-lg rounded-bl-none px-3 py-2">
              <div className="flex gap-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-200 flex-shrink-0 bg-white">
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
            placeholder="질문을 입력하세요..."
            disabled={isLoading}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-gray-100"
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !input.trim()}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
