import React, { useState, useRef, useCallback, useMemo } from 'react';
import { Check, ChevronRight } from 'lucide-react';

interface SlideToCompleteProps {
  onComplete: () => void;
  text?: string;
  completedText?: string;
  disabled?: boolean;
}

const SlideToComplete: React.FC<SlideToCompleteProps> = ({
  onComplete,
  text = 'スライドして完了',
  completedText = '完了！',
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);

  const THUMB_WIDTH = 56; // px
  const COMPLETION_THRESHOLD = 0.85; // 85%までスライドで完了

  const getMaxPosition = useCallback(() => {
    if (!containerRef.current) return 0;
    return containerRef.current.offsetWidth - THUMB_WIDTH;
  }, []);

  const progress = useMemo(() => {
    const maxPos = getMaxPosition();
    return maxPos > 0 ? position / maxPos : 0;
  }, [position, getMaxPosition]);

  // 進行度に応じた色を計算（青 → 緑のグラデーション）
  const progressColors = useMemo(() => {
    if (isCompleted) {
      return {
        bg: 'rgb(34, 197, 94)', // green-500
        fill: 'rgb(74, 222, 128)', // green-400
        thumb: 'rgb(34, 197, 94)',
        glow: 'rgba(34, 197, 94, 0.5)',
      };
    }
    
    // 青(59, 130, 246) → 緑(34, 197, 94)
    const r = Math.round(59 + (34 - 59) * progress);
    const g = Math.round(130 + (197 - 130) * progress);
    const b = Math.round(246 + (94 - 246) * progress);
    
    return {
      bg: `rgb(${r}, ${g}, ${b})`,
      fill: `rgba(${r}, ${g}, ${b}, 0.8)`,
      thumb: `rgb(${r}, ${g}, ${b})`,
      glow: `rgba(${r}, ${g}, ${b}, ${0.3 + progress * 0.4})`,
    };
  }, [progress, isCompleted]);

  const handleStart = useCallback((clientX: number) => {
    if (disabled || isCompleted) return;
    setIsDragging(true);
    startXRef.current = clientX - position;
  }, [disabled, isCompleted, position]);

  const handleMove = useCallback((clientX: number) => {
    if (!isDragging || disabled || isCompleted) return;

    const maxPos = getMaxPosition();
    const newPosition = Math.min(Math.max(0, clientX - startXRef.current), maxPos);
    setPosition(newPosition);
  }, [isDragging, disabled, isCompleted, getMaxPosition]);

  const handleEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    const maxPos = getMaxPosition();
    const completionPoint = maxPos * COMPLETION_THRESHOLD;

    if (position >= completionPoint) {
      // 完了！
      setPosition(maxPos);
      setIsCompleted(true);
      
      // 少し待ってからコールバック実行（エフェクト見せるため）
      setTimeout(() => {
        onComplete();
        // リセット（次のタスクのため）
        setTimeout(() => {
          setIsCompleted(false);
          setPosition(0);
        }, 300);
      }, 400);
    } else {
      // 戻す
      setPosition(0);
    }
  }, [isDragging, position, getMaxPosition, onComplete]);

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientX);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    handleMove(e.clientX);
  }, [handleMove]);

  const handleMouseUp = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    handleStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    handleMove(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    handleEnd();
  };

  // Global mouse events for dragging outside the element
  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={containerRef}
      className={`
        relative h-14 rounded-full overflow-hidden select-none
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-grab'}
        ${isDragging ? 'cursor-grabbing' : ''}
        transition-all duration-300
      `}
      style={{
        background: isCompleted 
          ? progressColors.bg 
          : `linear-gradient(90deg, ${progressColors.bg}40 0%, rgba(59, 130, 246, 0.2) 100%)`,
        boxShadow: isDragging || progress > 0 
          ? `0 0 20px ${progressColors.glow}, inset 0 1px 0 rgba(255,255,255,0.2)` 
          : 'inset 0 1px 0 rgba(255,255,255,0.1)',
        border: `1px solid ${progressColors.bg}80`,
      }}
    >
      {/* Progress fill with gradient */}
      <div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ 
          width: `${position + THUMB_WIDTH}px`,
          background: `linear-gradient(90deg, ${progressColors.fill}, ${progressColors.bg})`,
          transition: isDragging ? 'none' : 'width 0.3s ease-out',
        }}
      />

      {/* Shimmer effect when dragging */}
      {isDragging && (
        <div 
          className="absolute inset-0 pointer-events-none overflow-hidden rounded-full"
          style={{
            background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)`,
            animation: 'shimmer 1.5s infinite',
          }}
        />
      )}

      {/* Text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span
          className={`
            font-semibold text-lg tracking-wide
            transition-all duration-300
            ${progress > 0.3 ? 'opacity-0 scale-90' : 'opacity-100 scale-100'}
          `}
          style={{
            color: progress > 0 ? 'white' : 'rgba(255,255,255,0.9)',
            textShadow: '0 1px 2px rgba(0,0,0,0.2)',
          }}
        >
          {isCompleted ? completedText : text}
        </span>
      </div>

      {/* Animated arrow hints */}
      {!isCompleted && !isDragging && progress === 0 && (
        <div className="absolute inset-0 flex items-center justify-end pr-4 pointer-events-none">
          <div className="flex items-center opacity-60">
            <ChevronRight className="w-5 h-5 text-white -mr-2 animate-[bounce-right_1s_ease-in-out_infinite]" style={{ animationDelay: '0ms' }} />
            <ChevronRight className="w-5 h-5 text-white/70 -mr-2 animate-[bounce-right_1s_ease-in-out_infinite]" style={{ animationDelay: '100ms' }} />
            <ChevronRight className="w-5 h-5 text-white/40 animate-[bounce-right_1s_ease-in-out_infinite]" style={{ animationDelay: '200ms' }} />
          </div>
        </div>
      )}

      {/* Draggable thumb */}
      <div
        className={`
          absolute top-1 bottom-1 w-12 rounded-full
          flex items-center justify-center
          shadow-lg
          transition-all duration-150
          ${isDragging ? 'scale-110' : 'scale-100 hover:scale-105'}
        `}
        style={{ 
          left: `${position + 4}px`,
          transition: isDragging ? 'transform 0.1s ease' : 'left 0.3s ease-out, transform 0.15s ease',
          background: isCompleted ? 'white' : `linear-gradient(135deg, white 0%, #f0f0f0 100%)`,
          color: progressColors.thumb,
          boxShadow: `0 2px 8px rgba(0,0,0,0.2), 0 0 0 2px ${progressColors.bg}40`,
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {isCompleted ? (
          <Check className="w-6 h-6 animate-bounce" />
        ) : (
          <ChevronRight 
            className="w-6 h-6 transition-transform duration-150" 
            style={{ transform: isDragging ? 'translateX(2px)' : 'none' }}
          />
        )}
      </div>

      {/* CSS for custom animations */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes bounce-right {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
};

export default SlideToComplete;
