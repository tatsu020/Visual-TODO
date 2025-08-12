import React, { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';

interface HoverImageState {
  isVisible: boolean;
  imageUrl: string | null;
  taskTitle: string | null;
  cardRect: DOMRect | null;
}

interface HoverImageContextType {
  hoverImageState: HoverImageState;
  showHoverImage: (imageUrl: string, taskTitle: string, cardRect: DOMRect) => void;
  hideHoverImage: () => void;
}

const HoverImageContext = createContext<HoverImageContextType | undefined>(undefined);

export const useHoverImage = () => {
  const context = useContext(HoverImageContext);
  if (!context) {
    throw new Error('useHoverImage must be used within a HoverImageProvider');
  }
  return context;
};

interface HoverImageProviderProps {
  children: ReactNode;
}

export const HoverImageProvider: React.FC<HoverImageProviderProps> = ({ children }) => {
  const [hoverImageState, setHoverImageState] = useState<HoverImageState>({
    isVisible: false,
    imageUrl: null,
    taskTitle: null,
    cardRect: null
  });
  
  // 遅延hide用のグローバルタイマー（カード間移動時の競合を防ぐ）
  const hideTimeoutIdRef = useRef<number | null>(null);
  const HIDE_DELAY_MS = 25;

  const showHoverImage = (imageUrl: string, taskTitle: string, cardRect: DOMRect) => {
    // 既存のhideタイマーを必ずクリア（前カードからの遅延hideを無効化）
    if (hideTimeoutIdRef.current !== null) {
      clearTimeout(hideTimeoutIdRef.current);
      hideTimeoutIdRef.current = null;
    }

    setHoverImageState({
      isVisible: true,
      imageUrl,
      taskTitle,
      cardRect
    });
  };

  const hideHoverImage = () => {
    // 以前のタイマーをクリアしてから遅延hideを設定
    if (hideTimeoutIdRef.current !== null) {
      clearTimeout(hideTimeoutIdRef.current);
      hideTimeoutIdRef.current = null;
    }

    hideTimeoutIdRef.current = window.setTimeout(() => {
      setHoverImageState({
        isVisible: false,
        imageUrl: null,
        taskTitle: null,
        cardRect: null
      });
      hideTimeoutIdRef.current = null;
    }, HIDE_DELAY_MS);
  };

  // アンマウント時にタイマーをクリア
  useEffect(() => {
    return () => {
      if (hideTimeoutIdRef.current !== null) {
        clearTimeout(hideTimeoutIdRef.current);
        hideTimeoutIdRef.current = null;
      }
    };
  }, []);

  return (
    <HoverImageContext.Provider value={{
      hoverImageState,
      showHoverImage,
      hideHoverImage
    }}>
      {children}
    </HoverImageContext.Provider>
  );
};