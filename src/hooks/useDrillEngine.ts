"use client";

import { useState, useRef, useEffect, useCallback, Dispatch, SetStateAction } from 'react';
import { saveGameResult, GameResult, startTrainingSession, endTrainingSession } from '@/lib/firebase';

export type DrillPhase = 'setup' | 'memorize' | 'recall' | 'result';

export interface DrillScore {
    count: number;
    correct: number;
    total: number;
    percentage: number;
    /** Canonical: correct/attempted * 100. Replaces legacy accuracy field for new drills. */
    precision?: number;
    /** Canonical: attempted/total * 100. Replaces legacy recallPercentage for new drills. */
    completeness?: number;
    /** @deprecated use precision */
    accuracy?: number;
    /** @deprecated use completeness */
    recallPercentage?: number;
    recallTime?: number;
}

interface UseDrillEngineOptions<TConfig> {
    gameType: GameResult['type'];
    defaultConfig: TConfig;
}

export interface DrillEngine<TConfig> {
    phase: DrillPhase;
    config: TConfig;
    setConfig: Dispatch<SetStateAction<TConfig>>;
    /** Move to the memorize phase. Pass memorizeSeconds to run a countdown that auto-finishes. */
    start: (opts?: { config?: Partial<TConfig>; memorizeSeconds?: number }) => void;
    /** Move to the recall phase, stamping the memorize duration. */
    finishMemorize: () => void;
    /** Move to the result phase and persist the score via saveGameResult. */
    finishRecall: (score: DrillScore) => Promise<void>;
    reset: () => void;
    /** Seconds remaining in a timed memorize phase (0 when untimed). */
    timeLeft: number;
    /** Seconds spent in the memorize phase (final once recall starts). */
    memorizeElapsed: number;
    /** Returns ms since the previous mark (or phase start) — for per-item response timing. */
    markItem: () => number;
    saving: boolean;
}

export function useDrillEngine<TConfig>({ gameType, defaultConfig }: UseDrillEngineOptions<TConfig>): DrillEngine<TConfig> {
    const [phase, setPhase] = useState<DrillPhase>('setup');
    const [config, setConfig] = useState<TConfig>(defaultConfig);
    const [timeLeft, setTimeLeft] = useState(0);
    const [saving, setSaving] = useState(false);

    const memorizeStartRef = useRef(0);
    const memorizeEndRef = useRef(0);
    const lastMarkRef = useRef(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const phaseRef = useRef<DrillPhase>('setup');
    phaseRef.current = phase;
    const sessionIdRef = useRef<string>('');

    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    useEffect(() => clearTimer, [clearTimer]);

    const finishMemorize = useCallback(() => {
        if (phaseRef.current !== 'memorize') return;
        clearTimer();
        memorizeEndRef.current = Date.now();
        lastMarkRef.current = Date.now();
        setPhase('recall');
    }, [clearTimer]);

    // Keep a stable reference so the countdown interval always calls the latest version.
    const finishMemorizeRef = useRef(finishMemorize);
    finishMemorizeRef.current = finishMemorize;

    const start = useCallback((opts?: { config?: Partial<TConfig>; memorizeSeconds?: number }) => {
        if (opts?.config) setConfig(prev => ({ ...prev, ...opts.config }));
        clearTimer();
        memorizeStartRef.current = Date.now();
        memorizeEndRef.current = 0;
        lastMarkRef.current = Date.now();
        setSaving(false);
        // Start session tracking (fire-and-forget)
        startTrainingSession(gameType).then(id => { sessionIdRef.current = id; }).catch(() => {});

        const seconds = opts?.memorizeSeconds ?? 0;
        setTimeLeft(seconds);
        setPhase('memorize');

        if (seconds > 0) {
            timerRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        finishMemorizeRef.current();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
    }, [clearTimer]);

    const finishRecall = useCallback(async (score: DrillScore) => {
        const memorizeEnd = memorizeEndRef.current || Date.now();
        const memorizeStart = memorizeStartRef.current || memorizeEnd;
        const memorizeTime = Math.max(0, Math.floor((memorizeEnd - memorizeStart) / 1000));

        setSaving(true);
        setPhase('result');

        try {
            await saveGameResult({
                type: gameType,
                count: score.count,
                correct: score.correct,
                total: score.total,
                percentage: score.percentage,
                ...(score.precision !== undefined ? { precision: score.precision } : {}),
                ...(score.completeness !== undefined ? { completeness: score.completeness } : {}),
                ...(score.accuracy !== undefined ? { accuracy: score.accuracy } : {}),
                ...(score.recallPercentage !== undefined ? { recallPercentage: score.recallPercentage } : {}),
                memorizeTime,
                recallTime: score.recallTime ?? 0,
            });
            // End session tracking
            if (sessionIdRef.current) {
                endTrainingSession(sessionIdRef.current, undefined, true).catch(() => {});
                sessionIdRef.current = '';
            }
        } catch (error) {
            console.error(`Failed to save ${gameType} result:`, error);
        } finally {
            setSaving(false);
        }
    }, [gameType]);

    const reset = useCallback(() => {
        clearTimer();
        // End session as abandoned if still active
        if (sessionIdRef.current) {
            endTrainingSession(sessionIdRef.current, undefined, false).catch(() => {});
            sessionIdRef.current = '';
        }
        memorizeStartRef.current = 0;
        memorizeEndRef.current = 0;
        setTimeLeft(0);
        setSaving(false);
        setPhase('setup');
    }, [clearTimer]);

    const markItem = useCallback(() => {
        const now = Date.now();
        const elapsed = lastMarkRef.current ? now - lastMarkRef.current : 0;
        lastMarkRef.current = now;
        return elapsed;
    }, []);

    const memorizeElapsed = memorizeStartRef.current
        ? Math.floor(((memorizeEndRef.current || Date.now()) - memorizeStartRef.current) / 1000)
        : 0;

    return { phase, config, setConfig, start, finishMemorize, finishRecall, reset, timeLeft, memorizeElapsed, markItem, saving };
}
