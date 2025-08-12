import React, { useEffect, useState } from 'react';
import { Task } from '../types';

interface CrumpleOverlayProps {
  task: Task | null;
  isActive: boolean;
  onComplete: () => void;
}

const CrumpleOverlay: React.FC<CrumpleOverlayProps> = ({ task, isActive, onComplete }) => {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isActive && task) {
      setIsAnimating(true);
      
      // Complete animation after 800ms
      const timer = setTimeout(() => {
        setIsAnimating(false);
        onComplete();
      }, 800);

      return () => clearTimeout(timer);
    }
  }, [isActive, task, onComplete]);

  if (!isActive || !task) {
    return null;
  }

  return (
    <div className="fixed bottom-8 right-8 z-50 pointer-events-none">
      {/* Position over the trash bin */}
      <div className="relative w-80 h-80 flex items-center justify-center">
        {/* Animated task representation */}
        <div 
          className={`absolute w-48 max-w-xs transition-all duration-800 ${
            isAnimating ? 'animate-completion-crumple' : ''
          }`}
          style={{
            background: 'linear-gradient(145deg, #c5e1a5 0%, #aed581 50%, #9ccc65 100%)',
            borderRadius: '3px',
            padding: '12px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            border: '1px solid rgba(0, 0, 0, 0.1)',
          }}
        >
          <div className="text-sm font-semibold text-gray-800 mb-2 truncate">
            {task.title}
          </div>
          <div className="text-xs text-gray-600 mb-2">
            {task.category}
          </div>
          {task.imageUrl && (
            <div className="w-full h-16 bg-gray-100 rounded overflow-hidden">
              <img 
                src={task.imageUrl} 
                alt="Task illustration"
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>

        {/* Success sparkles */}
        {isAnimating && (
          <>
            <div className="absolute top-4 left-4 w-2 h-2 bg-green-400 rounded-full animate-ping"></div>
            <div className="absolute top-8 right-8 w-1 h-1 bg-yellow-400 rounded-full animate-ping animation-delay-200"></div>
            <div className="absolute bottom-12 left-8 w-1.5 h-1.5 bg-blue-400 rounded-full animate-ping animation-delay-400"></div>
            <div className="absolute bottom-4 right-4 w-2 h-2 bg-green-500 rounded-full animate-ping animation-delay-600"></div>
            
            {/* Completion checkmark */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center animate-bounce-in animation-delay-400">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CrumpleOverlay;