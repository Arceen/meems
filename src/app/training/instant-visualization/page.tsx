"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import Header from '@/components/Header';
import Link from 'next/link';
import { saveGameResult } from '@/lib/firebase';
import wordList from '@/data/words.json';

type GameState = 'setup' | 'running' | 'result';
type ItemType = 'digits' | 'words';

const DIGIT_POOL = Array.from({ length: 100 }, (_, i) => i.toString().padStart(2, '0'));
const PACE_OPTIONS = [500, 750, 1000, 1500, 2000];

interface SessionStats {
    totalDuration: number;
    avgLatency: number;
    bestLatency: number;
    formed: number;
    lapses: number;
}

const getRandomWords = (count: number) => {
    const words: string[] = [];
    for (let i = 0; i < count; i++) {
        const randomIndex = Math.floor(Math.random() * wordList.length);
        words.push(wordList[randomIndex]);
    }
    return words;
};

const getRandomDigits = (count: number) => {
    const digits: string[] = [];
    let pool = [...DIGIT_POOL];
    for (let i = 0; i < count; i++) {
        if (pool.length === 0) {
            pool = [...DIGIT_POOL];
        }
        const idx = Math.floor(Math.random() * pool.length);
        digits.push(pool[idx]);
        pool.splice(idx, 1);
    }
    return digits;
};

export default function InstantVisualizationTest() {
    const [gameState, setGameState] = useState<GameState>('setup');
    const [itemType, setItemType] = useState<ItemType>('digits');
    const [pace, setPace] = useState(1000);
    const [itemCount, setItemCount] = useState(30);
    const [sequence, setSequence] = useState<string[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [lapses, setLapses] = useState(0);
    const [formedCount, setFormedCount] = useState(0);
    const [stats, setStats] = useState<SessionStats | null>(null);

    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const itemStartRef = useRef<number>(0);
    const clickedRef = useRef(false);
    const latenciesRef = useRef<number[]>([]);
    const finishedRef = useRef(false);
    const sessionStartRef = useRef<number>(0);

    const stopTimer = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    const finalizeSession = useCallback(async () => {
        if (finishedRef.current) return;
        finishedRef.current = true;
        stopTimer();

        const totalDuration = (Date.now() - sessionStartRef.current) / 1000;
        const formed = latenciesRef.current.length;
        const total = sequence.length;
        const averageLatency = formed
            ? latenciesRef.current.reduce((sum, val) => sum + val, 0) / formed
            : 0;
        const bestLatency = formed ? Math.min(...latenciesRef.current) : 0;

        const lapseCount = total - formed;
        const summary: SessionStats = {
            totalDuration,
            avgLatency: averageLatency,
            bestLatency,
            formed,
            lapses: lapseCount,
        };
        setStats(summary);
        setGameState('result');

        if (total > 0) {
            try {
                await saveGameResult({
                    type: 'instant-visualization',
                    count: total,
                    correct: formed,
                    total,
                    percentage: Math.round((formed / total) * 100),
                    memorizeTime: totalDuration,
                    recallTime: 0,
                    precision: Math.round((formed / total) * 100),
                    completeness: 100,
                });
            } catch (error) {
                console.error('Failed to save Instant Visualization score:', error);
            }
        }
    }, [sequence.length]);

    useEffect(() => {
        if (gameState === 'running' && sequence.length > 0 && currentIndex >= sequence.length) {
            finalizeSession();
        }
    }, [currentIndex, gameState, sequence.length, finalizeSession]);

    useEffect(() => {
        if (gameState !== 'running' || sequence.length === 0 || currentIndex >= sequence.length) {
            return;
        }

        clickedRef.current = false;
        itemStartRef.current = Date.now();
        stopTimer();

        timerRef.current = setTimeout(() => {
            if (!clickedRef.current) {
                setLapses((prev) => prev + 1);
            }
            setCurrentIndex((prev) => prev + 1);
        }, pace);

        return stopTimer;
    }, [gameState, currentIndex, sequence, pace]);

    useEffect(() => stopTimer, []);

    const startSession = () => {
        const items = itemType === 'digits' ? getRandomDigits(itemCount) : getRandomWords(itemCount);
        setSequence(items);
        setCurrentIndex(0);
        setLapses(0);
        setFormedCount(0);
        setStats(null);
        latenciesRef.current = [];
        sessionStartRef.current = Date.now();
        finishedRef.current = false;
        setGameState('running');
    };

    const registerVisualization = () => {
        if (gameState !== 'running' || clickedRef.current) return;
        const latency = Date.now() - itemStartRef.current;
        clickedRef.current = true;
        latenciesRef.current.push(latency);
        setFormedCount((prev) => prev + 1);
    };

    const resetSession = () => {
        stopTimer();
        setGameState('setup');
        setSequence([]);
        setCurrentIndex(0);
        setLapses(0);
        setFormedCount(0);
        setStats(null);
    };

    const progressPercent = sequence.length ? ((currentIndex / sequence.length) * 100).toFixed(0) : '0';

    return (
        <>
            <Header />
            <main className="container" style={{ maxWidth: '900px' }}>
                <div style={{ marginBottom: '2rem' }}>
                    <Link href="/training" style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '0.5rem', display: 'inline-block' }}>
                        ← Back to Training
                    </Link>
                    <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Instant Visualization Test</h1>
                    <p style={{ color: '#94a3b8', maxWidth: '600px' }}>
                        Drill explosive image creation. The item stream advances automatically—register your mental “click” before the next flash.
                    </p>
                </div>

                {gameState === 'setup' && (
                    <div className="glass card animate-fade-in" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#cbd5e1' }}>Stimulus Type</label>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <button
                                        className={`btn ${itemType === 'digits' ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setItemType('digits')}
                                        style={{ flex: 1, minWidth: '120px' }}
                                    >
                                        Two-Digit Numbers
                                    </button>
                                    <button
                                        className={`btn ${itemType === 'words' ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setItemType('words')}
                                        style={{ flex: 1, minWidth: '120px' }}
                                    >
                                        Random Words
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#cbd5e1' }}>Items per Session</label>
                                <input
                                    type="number"
                                    className="input-field"
                                    value={itemCount}
                                    min={10}
                                    max={200}
                                    onChange={(e) => setItemCount(Math.max(10, Math.min(200, parseInt(e.target.value, 10) || 10)))}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#cbd5e1' }}>Display Pace (ms)</label>
                                <select
                                    className="input-field"
                                    value={pace}
                                    onChange={(e) => setPace(parseInt(e.target.value, 10))}
                                >
                                    {PACE_OPTIONS.map((option) => (
                                        <option key={option} value={option}>
                                            {(option / 1000).toFixed(1)}s per item
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'rgba(15,23,42,0.6)', borderRadius: '0.75rem', padding: '1rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1rem', color: '#cbd5e1' }}>Week 4 Challenge</h3>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8' }}>
                                Complete 100 numbers at 1.0s pace with zero lapses. Press “Image Formed” before each flash flips.
                            </p>
                        </div>

                        <button className="btn btn-primary" onClick={startSession} style={{ alignSelf: 'center', minWidth: '240px' }}>
                            Start Drill
                        </button>
                    </div>
                )}

                {gameState === 'running' && (
                    <div className="glass card animate-fade-in" style={{ padding: '2rem', textAlign: 'center' }}>
                        <div style={{ marginBottom: '1rem', fontSize: '0.9rem', opacity: 0.7 }}>
                            Item {Math.min(currentIndex + 1, sequence.length)} / {sequence.length} · {progressPercent}% complete
                        </div>
                        <div
                            style={{
                                fontSize: itemType === 'digits' ? '5rem' : '3rem',
                                fontWeight: 'bold',
                                letterSpacing: itemType === 'digits' ? '0.2em' : 'normal',
                                fontFamily: itemType === 'digits' ? 'monospace' : 'inherit',
                                marginBottom: '2rem'
                            }}
                        >
                            {sequence[currentIndex] || '—'}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                            <button className="btn btn-primary" style={{ minWidth: '200px' }} onClick={registerVisualization}>
                                Image Formed
                            </button>
                        </div>
                        <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                            <div className="glass" style={{ padding: '1rem', borderRadius: '0.75rem' }}>
                                <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Images Formed</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{formedCount}</div>
                            </div>
                            <div className="glass" style={{ padding: '1rem', borderRadius: '0.75rem' }}>
                                <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Lapses</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: lapses > 0 ? 'var(--error)' : 'var(--foreground)' }}>{lapses}</div>
                            </div>
                            <div className="glass" style={{ padding: '1rem', borderRadius: '0.75rem' }}>
                                <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Pace</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{(pace / 1000).toFixed(1)}s</div>
                            </div>
                        </div>
                    </div>
                )}

                {gameState === 'result' && stats && (
                    <div className="glass card animate-fade-in" style={{ padding: '2rem' }}>
                        <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Visualization Report</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                            <div className="glass" style={{ padding: '1rem', borderRadius: '0.75rem' }}>
                                <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Completion</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: stats.lapses === 0 ? 'var(--success)' : 'var(--accent)' }}>
                                    {stats.formed} / {sequence.length}
                                </div>
                            </div>
                            <div className="glass" style={{ padding: '1rem', borderRadius: '0.75rem' }}>
                                <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Average Latency</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>
                                    {stats.avgLatency.toFixed(0)} ms
                                </div>
                            </div>
                            <div className="glass" style={{ padding: '1rem', borderRadius: '0.75rem' }}>
                                <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Best Reaction</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>
                                    {stats.bestLatency.toFixed(0)} ms
                                </div>
                            </div>
                            <div className="glass" style={{ padding: '1rem', borderRadius: '0.75rem' }}>
                                <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Total Drill Time</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>
                                    {stats.totalDuration.toFixed(1)} s
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={resetSession}>
                                Run Again
                            </button>
                            <Link href="/training" className="btn btn-primary" style={{ flex: 1 }}>
                                Back to Hub
                            </Link>
                        </div>
                    </div>
                )}
            </main>
        </>
    );
}

