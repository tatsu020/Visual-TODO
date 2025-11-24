import React from 'react';
import { Task } from '../types';
import { Check, MapPin, Clock } from 'lucide-react';

interface NowCardProps {
    task: Task | null;
    onComplete: (taskId: number) => void;
}

const NowCard: React.FC<NowCardProps> = ({ task, onComplete }) => {
    if (!task) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 text-gray-400">
                <p className="text-lg font-medium">No Task Selected</p>
                <p className="text-sm">Double-click a task from the list below to start.</p>
            </div>
        );
    }

    return (
        <div className="relative h-full w-full bg-white rounded-xl shadow-lg overflow-hidden flex flex-col md:flex-row">
            {/* Image Area (Large) */}
            <div className="w-full md:w-1/2 h-64 md:h-full relative bg-gray-100">
                {task.imageUrl ? (
                    <img
                        src={task.imageUrl}
                        alt={task.title}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <span className="text-4xl">🖼️</span>
                    </div>
                )}
                <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm backdrop-blur-sm">
                    NOW
                </div>
            </div>

            {/* Info Area */}
            <div className="flex-1 p-6 flex flex-col justify-between">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">
                        {task.title}
                    </h2>

                    <div className="space-y-3 text-gray-600">
                        {task.location && (
                            <div className="flex items-center text-lg">
                                <MapPin className="w-5 h-5 mr-2 text-blue-500" />
                                <span>{task.location}</span>
                            </div>
                        )}

                        {(task.scheduledTime || task.scheduledTimeEnd) && (
                            <div className="flex items-center text-lg">
                                <Clock className="w-5 h-5 mr-2 text-green-500" />
                                <span>
                                    {task.scheduledTime ? new Date(task.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                    {task.scheduledTimeEnd ? ` - ${new Date(task.scheduledTimeEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                                </span>
                            </div>
                        )}

                        {task.description && (
                            <p className="mt-4 text-gray-500 text-base leading-relaxed">
                                {task.description}
                            </p>
                        )}
                    </div>
                </div>

                <div className="mt-8">
                    <button
                        onClick={() => task.id && onComplete(task.id)}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center"
                    >
                        <Check className="w-6 h-6 mr-2" />
                        Complete Task
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NowCard;
