import React from 'react';
import { Task } from '../types';
import { MapPin, Clock } from 'lucide-react';
import { useHoverImage } from '../contexts/HoverImageContext';

interface NowCardProps {
    task: Task | null;
    onComplete: (taskId: number) => void;
}

const NowCard: React.FC<NowCardProps> = ({ task, onComplete }) => {
    const { showHoverImage, hideHoverImage } = useHoverImage();

    if (!task) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 text-gray-400">
                <p className="text-lg font-medium">No Task Selected</p>
                <p className="text-sm">Double-click a task from the list below to start.</p>
            </div>
        );
    }

    return (
        <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-xl group bg-gray-900">
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
                <div className="flex items-end justify-between w-full">
                    {/* Left Side: Task Info */}
                    <div className="flex-1 min-w-0 mr-6 text-white">
                        <h2 className="text-4xl font-bold mb-4 leading-tight text-shadow-sm tracking-tight">
                            {task.title}
                        </h2>

                        <div className="flex flex-col space-y-2">
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

                    {/* Right Side: Action Button */}
                    <button
                        onClick={() => task.id && onComplete(task.id)}
                        className="flex-shrink-0 px-10 py-3.5 bg-blue-500 hover:bg-blue-600 text-white rounded-full font-medium text-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 active:translate-y-0 backdrop-blur-sm bg-opacity-90 border border-white/10"
                    >
                        Complete
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NowCard;
