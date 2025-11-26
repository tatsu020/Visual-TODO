import React from 'react';
import { Task } from '../types';
import { MapPin, Clock, Edit2, Trash2 } from 'lucide-react';
import { useHoverImage } from '../contexts/HoverImageContext';

interface SmallTaskCardProps {
    task: Task;
    onSelect: (task: Task) => void;
    onEdit: (task: Task) => void;
    onDelete: (task: Task) => void;
}

const SmallTaskCard: React.FC<SmallTaskCardProps> = ({ task, onSelect, onEdit, onDelete }) => {
    const { showHoverImage, hideHoverImage } = useHoverImage();

    const getPriorityIndicator = (priority?: string) => {
        switch (priority) {
            case 'high': return { color: 'bg-red-500', ring: 'ring-red-200' };
            case 'medium': return { color: 'bg-orange-400', ring: 'ring-orange-200' };
            case 'low': return { color: 'bg-blue-400', ring: 'ring-blue-200' };
            default: return { color: 'bg-gray-300', ring: 'ring-gray-100' };
        }
    };

    const priority = getPriorityIndicator(task.priority);

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        e.dataTransfer.setData('application/json', JSON.stringify({ taskId: task.id }));
        e.dataTransfer.effectAllowed = 'move';
        // ドラッグ中のビジュアルエフェクト
        e.currentTarget.style.opacity = '0.5';
    };

    const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
        e.currentTarget.style.opacity = '1';
    };

    return (
        <div
            className="group relative flex items-start p-3 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-md transition-all cursor-grab active:cursor-grabbing"
            onDoubleClick={() => onSelect(task)}
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            {/* Priority indicator - top left corner dot */}
            <div className={`absolute -top-1 -left-1 w-3 h-3 ${priority.color} rounded-full ring-2 ${priority.ring}`} />

            {/* Image Thumbnail */}
            <div
                className="w-20 h-20 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden shadow-sm"
                onMouseEnter={(e) => {
                    if (task.imageUrl) {
                        showHoverImage(task.imageUrl, task.title, e.currentTarget.getBoundingClientRect());
                    }
                }}
                onMouseLeave={hideHoverImage}
            >
                {task.imageUrl ? (
                    <img src={task.imageUrl} alt={task.title} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <span className="text-2xl">🖼️</span>
                    </div>
                )}
            </div>

            {/* Content - Right side */}
            <div className="flex-1 min-w-0 ml-3 flex flex-col justify-center h-20">
                {/* Row 1: Title */}
                <h3 className="text-base font-medium text-gray-900 truncate leading-tight">
                    {task.title}
                </h3>

                {/* Row 2: Time & Location */}
                <div className="flex items-center gap-3 mt-1.5 text-sm text-gray-500">
                    {/* Time */}
                    <div className="flex items-center">
                        <Clock className="w-3.5 h-3.5 mr-1 text-gray-400" />
                        <span>
                            {(task.scheduledTime || task.scheduledTimeEnd) ? (
                                <>
                                    {task.scheduledTime || ''}
                                    {task.scheduledTime && task.scheduledTimeEnd ? ' - ' : ''}
                                    {task.scheduledTimeEnd || ''}
                                </>
                            ) : (
                                <span className="text-gray-300">--:--</span>
                            )}
                        </span>
                    </div>

                    {/* Location */}
                    <div className="flex items-center truncate">
                        <MapPin className="w-3.5 h-3.5 mr-1 text-gray-400 flex-shrink-0" />
                        <span className="truncate">
                            {task.location || <span className="text-gray-300">--</span>}
                        </span>
                    </div>
                </div>
            </div>

            {/* Action buttons - show on hover */}
            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                <button
                    className="p-1.5 text-gray-300 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                    onClick={(e) => {
                        e.stopPropagation();
                        onEdit(task);
                    }}
                    title="編集"
                >
                    <Edit2 className="w-4 h-4" />
                </button>
                <button
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(task);
                    }}
                    title="削除"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default SmallTaskCard;
