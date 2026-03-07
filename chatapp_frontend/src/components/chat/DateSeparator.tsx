// src/components/chat/DateSeparator.tsx
// Extracted from MessageList.tsx - date header/separator between message groups

import React from 'react';

interface DateSeparatorProps {
    dateString: string;
}

function formatDateHeader(dateString: string): string {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
        return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    } else {
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    }
}

export const DateSeparator: React.FC<DateSeparatorProps> = ({ dateString }) => {
    return (
        <div className="flex justify-center my-6">
            <div className="bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300 px-3 py-1 rounded-full text-xs font-medium">
                {formatDateHeader(dateString)}
            </div>
        </div>
    );
};

interface TimeSeparatorProps {
    timestamp: string;
}

export const TimeSeparator: React.FC<TimeSeparatorProps> = ({ timestamp }) => {
    return (
        <div className="flex justify-center my-4">
            <div className="bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300 px-3 py-1 rounded-full text-xs font-medium">
                {new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </div>
        </div>
    );
};
