"use client";

import { formatTime } from '@/lib/drill-utils';

interface CountdownTimerProps {
    timeLeft: number;
    /** Seconds threshold under which the timer turns the error color. */
    warnUnder?: number;
    label?: string;
}

export default function CountdownTimer({ timeLeft, warnUnder = 60, label = 'Time Left' }: CountdownTimerProps) {
    return (
        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: timeLeft < warnUnder ? 'var(--error)' : 'var(--foreground)' }}>
            {label}: {formatTime(timeLeft)}
        </div>
    );
}
