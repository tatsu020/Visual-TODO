import React from 'react';
import { Task } from '../types';
import { MapPin, Clock } from 'lucide-react';
import { useHoverImage } from '../contexts/HoverImageContext';
import SlideToComplete from './SlideToComplete';

interface NowCardProps {
    task: Task | null;
    onComplete: (taskId: number) => void;
    onTaskDrop?: (taskId: number) => void;
}

const NowCard: React.FC<NowCardProps> = ({ task, onComplete, onTaskDrop }) => {
    const { showHoverImage, hideHoverImage } = useHoverImage();
    const [isDragOver, setIsDragOver] = React.useState(false);

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        // ドロップゾーンの外に出たかをチェック
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
            setIsDragOver(false);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(false);
        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            if (data.taskId && onTaskDrop) {
                onTaskDrop(data.taskId);
            }
        } catch (err) {
            console.error('Failed to parse drop data:', err);
        }
    };

    if (!task) {
        return (
            <div
                className={`h-full flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all duration-200 ${
                    isDragOver
                        ? 'bg-blue-50 border-blue-400 scale-[1.02] shadow-lg'
                        : 'bg-gray-50 border-gray-200'
                }`}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <div className={`transition-all duration-200 ${isDragOver ? 'scale-110' : ''}`}>
                    {isDragOver ? (
                        <>
                            <div className="text-4xl mb-2 animate-bounce">📥</div>
                            <p className="text-lg font-medium text-blue-600">ここにドロップ！</p>
                        </>
                    ) : (
                        <>
                            <p className="text-lg font-medium text-gray-400">No Task Selected</p>
                            <p className="text-sm text-gray-400">タスクをドラッグするか、ダブルクリックで設定</p>
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div
            className={`relative w-full h-full rounded-2xl overflow-hidden shadow-xl group bg-gray-900 transition-all duration-200 ${
                isDragOver ? 'ring-4 ring-blue-400 ring-opacity-75 scale-[1.01]' : ''
            }`}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Drag overlay indicator */}
            {isDragOver && (
                <div className="absolute inset-0 bg-blue-500/20 z-30 flex items-center justify-center pointer-events-none">
                    <div className="bg-white/90 px-6 py-3 rounded-xl shadow-lg">
                        <p className="text-blue-600 font-bold text-lg">タスクを切り替え</p>
                    </div>
                </div>
            )}
            
            {/* Background Image */}
            <div
                className="absolute inset-0"
                onMouseEnter={(e) => {
                    if (task.imageUrl) {
                        showHoverImage(task.imageUrl, task.title, e.currentTarget.getBoundingClientRect());
                    }
                }}
                onMouseLeave={hideHoverImage}
            >
                {task.imageUrl ? (
                    <img
                        src={task.imageUrl}
                        alt={task.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                        <span className="text-6xl opacity-50">🖼️</span>
                    </div>
                )}
                {/* Gradient Overlay (Scrim) - Darker at bottom for text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
            </div>

            {/* Content Overlay */}
            <div className="absolute inset-0 p-8 flex flex-col justify-end">
                {/* NOW Badge */}
                <div className="absolute top-6 left-6">
                    <div className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-full font-bold text-sm shadow-lg">
                        <span className="w-2 h-2 bg-white rounded-full" />
                        NOW
                    </div>
                </div>

                {/* Task Info */}
                <div className="text-white mb-6">
                    <h2 className="text-4xl font-bold mb-4 leading-tight text-shadow-sm tracking-tight">
                        {task.title}
                    </h2>

                    <div className="flex flex-wrap gap-6">
                        {/* Location */}
                        <div className="flex items-center text-lg text-gray-100 font-medium">
                            <MapPin className="w-5 h-5 mr-2.5 opacity-90" />
                            <span>{task.location || 'No Location'}</span>
                        </div>

                        {/* Time */}
                        <div className="flex items-center text-lg text-gray-100 font-medium">
                            <Clock className="w-5 h-5 mr-2.5 opacity-90" />
                            <span>
                                {task.scheduledTime || ''}
                                {task.scheduledTime && task.scheduledTimeEnd ? ' - ' : ''}
                                {task.scheduledTimeEnd || ''}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Slide to Complete */}
                <div className="w-full max-w-md">
                    <SlideToComplete
                        onComplete={() => task.id && onComplete(task.id)}
                        text="スライドして完了"
                        completedText="完了！🎉"
                    />
                </div>
            </div>
        </div>
    );
};

export default NowCard;
