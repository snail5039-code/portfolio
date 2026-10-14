import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ChatbotStore {
  isOpen: boolean;
  messages: ChatMessage[];
  isLoading: boolean;
  characterClickCount: number;
  characterY: number; // 0-100 (상대값)
  characterX: number; // 0-100 (상대값)
  isHiding: boolean;

  // Actions
  setIsOpen: (isOpen: boolean) => void;
  addMessage: (message: ChatMessage) => void;
  clearMessages: () => void;
  setIsLoading: (isLoading: boolean) => void;
  incrementClickCount: () => void;
  resetClickCount: () => void;
  setCharacterY: (y: number) => void;
  setCharacterX: (x: number) => void;
  setIsHiding: (isHiding: boolean) => void;
  resetAllState: () => void;
}

const initialState = {
  isOpen: false,
  messages: [],
  isLoading: false,
  characterClickCount: 0,
  characterY: 50,
  characterX: 95,
  isHiding: false,
};

export const useChatbotStore = create<ChatbotStore>()(
  persist(
    (set) => ({
      ...initialState,

      setIsOpen: (isOpen) => set({ isOpen }),

      addMessage: (message) =>
        set((state) => ({
          messages: [...state.messages, message],
        })),

      clearMessages: () => set({ messages: [] }),

      setIsLoading: (isLoading) => set({ isLoading }),

      incrementClickCount: () =>
        set((state) => ({
          characterClickCount: state.characterClickCount + 1,
          isHiding: state.characterClickCount >= 5,
        })),

      resetClickCount: () => set({ characterClickCount: 0, isHiding: false }),

      setCharacterY: (y) => set({ characterY: Math.max(0, Math.min(100, y)) }),

      setCharacterX: (x) => set({ characterX: Math.max(0, Math.min(100, x)) }),

      setIsHiding: (isHiding) => set({ isHiding }),

      resetAllState: () => set(initialState),
    }),
    {
      name: 'chatbot-storage',
      partialize: (state) => ({
        messages: state.messages,
      }),
    },
  ),
);
