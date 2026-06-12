"use client";

import { useState, useRef, useCallback, useEffect } from 'react';

interface UsePacedSequenceOptions<T> {
    items: T[];
    intervalMs: number;
    startDelayMs?: number;
    /** Called for each item as it is presented (own any speech/audio here). */
    onItem: (item: T, index: number) => void;
    /** Called after the last item's interval elapses. */
    onDone: () => void;
}

/**
 * Auto-advancing timed presentation: fires onItem for each item at a fixed pace,
 * then onDone. Used for spoken/flashed sequences. Cleans up timers on unmount.
 */
export function usePacedSequence<T>({ items, intervalMs, startDelayMs = 0, onItem, onDone }: UsePacedSequenceOptions<T>) {
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [running, setRunning] = useState(false);

    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const delayRef = useRef<NodeJS.Timeout | null>(null);

    // Latest callbacks/items without restarting a running sequence.
    const itemsRef = useRef(items);
    itemsRef.current = items;
    const onItemRef = useRef(onItem);
    onItemRef.current = onItem;
    const onDoneRef = useRef(onDone);
    onDoneRef.current = onDone;

    const cancel = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (delayRef.current) clearTimeout(delayRef.current);
        timerRef.current = null;
        delayRef.current = null;
        setRunning(false);
        setCurrentIndex(-1);
    }, []);

    useEffect(() => cancel, [cancel]);

    const start = useCallback(() => {
        cancel();
        if (itemsRef.current.length === 0) return;
        setRunning(true);

        let index = 0;
        const tick = () => {
            if (index >= itemsRef.current.length) {
                if (timerRef.current) clearInterval(timerRef.current);
                timerRef.current = null;
                setRunning(false);
                setCurrentIndex(-1);
                onDoneRef.current();
                return;
            }
            setCurrentIndex(index);
            onItemRef.current(itemsRef.current[index], index);
            index++;
        };

        delayRef.current = setTimeout(() => {
            tick(); // present first item immediately after the delay
            timerRef.current = setInterval(tick, intervalMs);
        }, startDelayMs);
    }, [cancel, intervalMs, startDelayMs]);

    return { currentIndex, running, start, cancel };
}
