import React, { useState, useRef } from 'react';
import { Check, Trash2 } from 'lucide-react';

interface TrashBinProps {
  onComplete: (taskId: number) => void;
  onDelete: (taskId: number) => void;
  onCrumple?: (taskId: number) => void;
}

const TrashBin: React.FC<TrashBinProps> = ({ onComplete, onDelete, onCrumple }) => {
  const [isDragOverComplete, setIsDragOverComplete] = useState(false);
  const [isDragOverDelete, setIsDragOverDelete] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const completeRef = useRef<HTMLDivElement>(null);
  const deleteRef = useRef<HTMLDivElement>(null);

  const handleDragOverComplete = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverComplete(true);
  };

  const handleDragOverDelete = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverDelete(true);
  };

  const handleDragLeaveComplete = (e: React.DragEvent) => {
    e.preventDefault();
    const completeElement = completeRef.current;
    const relatedTarget = e.relatedTarget as Node;
    
    if (completeElement && relatedTarget && completeElement.contains(relatedTarget)) {
      return;
    }
    
    setIsDragOverComplete(false);
  };

  const handleDragLeaveDelete = (e: React.DragEvent) => {
    e.preventDefault();
    const deleteElement = deleteRef.current;
    const relatedTarget = e.relatedTarget as Node;
    
    if (deleteElement && relatedTarget && deleteElement.contains(relatedTarget)) {
      return;
    }
    
    setIsDragOverDelete(false);
  };

  const handleDropComplete = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverComplete(false);
    
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      const parsedTaskId = parseInt(taskId);
      
      setIsAnimating(true);
      setTimeout(() => {
        onComplete(parsedTaskId);
        setIsAnimating(false);
      }, 300);
    }
  };

  const handleDropDelete = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverDelete(false);
    
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      const parsedTaskId = parseInt(taskId);
      
      if (onCrumple) {
        onCrumple(parsedTaskId);
      }
      
      setIsAnimating(true);
      setTimeout(() => {
        onDelete(parsedTaskId);
        setIsAnimating(false);
      }, 800);
    }
  };

  return (
    <div className="fixed bottom-8 right-8 z-50 flex flex-col space-y-4">
      {/* Complete Zone - Primary/Prominent */}
      <div
        ref={completeRef}
        className={`w-20 h-20 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 ${
          isDragOverComplete 
            ? 'bg-green-500 text-white scale-110 shadow-lg' 
            : 'bg-green-100 text-green-600 hover:bg-green-200'
        } ${isAnimating ? 'animate-bounce' : ''}`}
        onDragOver={handleDragOverComplete}
        onDragLeave={handleDragLeaveComplete}
        onDrop={handleDropComplete}
        title="タスクを完了する"
      >
        <div className="text-center">
          <Check className="w-8 h-8 mx-auto" />
          <div className="text-xs font-medium mt-1">完了</div>
        </div>
        
        {/* Complete drop zone indicator */}
        {isDragOverComplete && (
          <div className="absolute inset-0 bg-green-500/20 border-2 border-green-400 border-dashed rounded-full animate-pulse"></div>
        )}
      </div>

      {/* Delete Zone - Unified Size */}
      <div
        ref={deleteRef}
        className={`w-20 h-20 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 ${
          isDragOverDelete 
            ? 'bg-red-500 text-white scale-110 shadow-lg' 
            : 'bg-red-100 text-red-600 hover:bg-red-200'
        } ${isAnimating ? 'animate-bounce' : ''}`}
        onDragOver={handleDragOverDelete}
        onDragLeave={handleDragLeaveDelete}
        onDrop={handleDropDelete}
        title="タスクを削除する"
      >
        <div className="text-center">
          <Trash2 className="w-8 h-8 mx-auto" />
          <div className="text-xs font-medium mt-1">削除</div>
        </div>
        
        {/* Delete drop zone indicator */}
        {isDragOverDelete && (
          <div className="absolute inset-0 bg-red-500/20 border-2 border-red-400 border-dashed rounded-full animate-pulse"></div>
        )}
      </div>
      
      {/* Success animation particles */}
      {isAnimating && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="particle particle-1"></div>
          <div className="particle particle-2"></div>
          <div className="particle particle-3"></div>
          <div className="particle particle-4"></div>
        </div>
      )}
    </div>
  );
};

export default TrashBin;