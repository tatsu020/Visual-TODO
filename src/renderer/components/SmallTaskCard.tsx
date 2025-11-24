import React from 'react';
import { Task } from '../types';
import { MapPin, Clock, AlertCircle } from 'lucide-react';

interface SmallTaskCardProps {
    task: Task;
    onSelect: (task: Task) => void;
}

const SmallTaskCard: React.FC<SmallTaskCardProps> = ({ task, onSelect }) => {
    const getPriorityIcon = (priority?: string) => {
        switch (priority) {
            case 'high': return <AlertCircle className="w-4 h-4 text-red-500" />;
            case 'medium': return <AlertCircle className="w-4 h-4 text-orange-400" />;
            case 'low': return <AlertCircle className="w-4 h-4 text-gray-300" />;
            default: return null;
        }
    };

    return (
        <div
            className="flex items-center p-2 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-gray-100"
            onDoubleClick={() => onSelect(task)}
        >
            {/* Thumbnail */}
            <div className="w-16 h-16 flex-shrink-0 bg-gray-100 rounded-md overflow-hidden mr-4">
                {task.imageUrl ? (
                    <img src={task.imageUrl} alt={task.title} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
                        No Img
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                    <h3 className="text-base font-semibold text-gray-900 truncate pr-2">
                        {task.title}
                    </h3>
                    {getPriorityIcon(task.priority)}
                </div>

                <div className="flex items-center text-xs text-gray-500 space-x-3">
                    {(task.scheduledTime || task.scheduledTimeEnd) && (
                        <div className="flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            <span>
                                {task.scheduledTime ? new Date(task.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                        </div>
                    )}

                    {task.location && (
                        <div className="flex items-center truncate">
                            <MapPin className="w-3 h-3 mr-1" />
                            <span className="truncate max-w-[100px]">{task.location}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SmallTaskCard;
