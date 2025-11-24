import React from 'react';
import { Task } from '../types';
import { AlertCircle, Edit2 } from 'lucide-react';
import { useHoverImage } from '../contexts/HoverImageContext';

interface SmallTaskCardProps {
    task: Task;
    onSelect: (task: Task) => void;
    onEdit: (task: Task) => void;
}

const SmallTaskCard: React.FC<SmallTaskCardProps> = ({ task, onSelect, onEdit }) => {
    const { showHoverImage, hideHoverImage } = useHoverImage();

    const getPriorityColor = (priority?: string) => {
        switch (priority) {
            case 'high': return 'text-red-600 bg-red-50';
            case 'medium': return 'text-orange-500 bg-orange-50';
            case 'low': return 'text-blue-500 bg-blue-50';
            default: return 'text-gray-400 bg-gray-50';
        }
    };

    const getPriorityLabel = (priority?: string) => {
        if (!priority) return 'Normal';
        return priority.charAt(0).toUpperCase() + priority.slice(1);
    };

    return (
        <div
            className="group flex items-center py-4 px-2 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
            onDoubleClick={() => onSelect(task)}
        >
            {/* 1. Image (Thumbnail) */}
            <div
                className="w-16 h-16 flex-shrink-0 bg-gray-200 rounded-lg overflow-hidden mr-6 shadow-sm"
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
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                        No Img
                    </div>
                )}
            </div>

            {/* 2. Title */}
            <div className="flex-1 min-w-0 pr-4">
                <h3 className="text-xl font-normal text-gray-900 truncate">
                    {task.title}
                </h3>
            </div>

            {/* 3. Time */}
            <div className="w-40 text-center text-gray-500 text-lg font-light">
                {(task.scheduledTime || task.scheduledTimeEnd) ? (
                    <span>
                        {task.scheduledTime || ''}
                        {task.scheduledTime && task.scheduledTimeEnd ? ' - ' : ''}
                        {task.scheduledTimeEnd || ''}
                    </span>
                ) : (
                    <span className="text-gray-300">--:--</span>
                )}
            </div>

            {/* 4. Location (Where) */}
            <div className="w-40 text-center text-gray-600 text-base">
                {task.location ? (
                    <span className="truncate">{task.location}</span>
                ) : (
                    <span className="text-gray-300">--</span>
                )}
            </div>

            {/* 5. Priority */}
            <div className="w-32 flex justify-center">
                {task.priority && (
                    <div className={`flex items-center text-base font-medium ${task.priority === 'high' ? 'text-red-600' :
                        task.priority === 'medium' ? 'text-yellow-500' :
                            'text-gray-500'
                        }`}>
                        <AlertCircle className="w-5 h-5 mr-2 fill-current" />
                        {getPriorityLabel(task.priority)}
                    </div>
                )}
            </div>

            {/* 5. Actions */}
            <div className="w-24 flex items-center justify-end space-x-3 pl-4">
                <button
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    onClick={(e) => {
                        e.stopPropagation();
                        onEdit(task);
                    }}
                >
                    <Edit2 className="w-6 h-6" />
                </button>
            </div>
        </div>
    );
};

export default SmallTaskCard;
