import React from 'react';
import { LiveLogsPanel } from './LiveLogsPanel';

export function ConsoleTab() {
    return (
        <div className="h-[600px] bg-white">
            <LiveLogsPanel />
        </div>
    );
}