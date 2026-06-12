"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import Header from '@/components/Header';
import Link from 'next/link';
import { saveGameResult } from '@/lib/firebase';
import wordList from '@/data/words.json';

type GamePhase = 'setup' | 'drill' | 'recall' | 'result';
type ItemType = 'mixed' | 'digits' | 'words';

const DIGIT_POOL = Array.from({ length: 100 }, (_, i) => i.toString().padStart(2, '0'));
const PACE_OPTIONS = [500, 1000, 1500, 2000, 3000, 5000];

interface DrillItem {
    value: string;
    type: 'digit' | 'word';
    originalIndex: number;
}

interface ItemResult {
    item: DrillItem;
    latency: number; // ms, or PACE if lapsed
    isLapse: boolean;
    recallInput: string;
    isRecallCorrect: boolean;
}

interface SessionStats {
    totalDuration: number;
    avgLatencyCorrect: number;
    avgLatencyIncorrect: number;
    slowestEncoded: ItemResult[];
    fastestMissed: ItemResult[];
    totalItems: number;
    recallAccuracy: number;
    recallCorrectCount: number;
}

const getRandomItems = (count: number, type: ItemType): DrillItem[] => {
    const items: DrillItem[] = [];
    let digitPool = [...DIGIT_POOL];
    
    for (let i = 0; i < count; i++) {
        let selectedType: 'digit' | 'word';
        
        if (type === 'mixed') {
            selectedType = Math.random() < 0.5 ? 'digit' : 'word';
        } else {
            selectedType = type === 'digits' ? 'digit' : 'word';
        }

        let value = '';
        if (selectedType === 'digit') {
            if (digitPool.length === 0) digitPool = [...DIGIT_POOL];
            const idx = Math.floor(Math.random() * digitPool.length);
            value = digitPool[idx];
            digitPool.splice(idx, 1);
        } else {
            const idx = Math.floor(Math.random() * wordList.length);
            value = wordList[idx];
        }

        items.push({ value, type: selectedType, originalIndex: i });
    }
    return items;
};

export default function VisualizationLatencyDrill() {
    // Settings
    const [itemCount, setItemCount] = useState(50);
    const [pace, setPace] = useState(2000);
    const [itemType, setItemType] = useState<ItemType>('mixed');
    const [timedMode, setTimedMode] = useState(true);

    // State
    const [phase, setPhase] = useState<GamePhase>('setup');
    const [items, setItems] = useState<DrillItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [results, setResults] = useState<ItemResult[]>([]);
    
    // Recall State
    const [recallOrder, setRecallOrder] = useState<number[]>([]); // Indices into 'items'
    const [recallInput, setRecallInput] = useState('');
    const [recallIndex, setRecallIndex] = useState(0); // Index into 'recallOrder'

    // Refs
    const itemStartRef = useRef<number>(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const sessionStartRef = useRef<number>(0);
    const drillEndRef = useRef<number>(0);
    
    // Live timer for untimed mode
    const [currentElapsed, setCurrentElapsed] = useState(0);

    const stopTimer = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    // --- Drill Phase ---

    const startDrill = () => {
        const newItems = getRandomItems(itemCount, itemType);
        setItems(newItems);
        setResults([]);
        setCurrentIndex(0);
        setPhase('drill');
        sessionStartRef.current = Date.now();
        
        // Start first item immediately
        // We use a small timeout to allow render to settle if needed, but usually direct is fine.
        // For consistent timing, we'll set the start time in the effect.
    };

    const nextDrillItem = useCallback(() => {
        stopTimer();
        if (currentIndex >= items.length) {
            // Drill finished, go to recall
            drillEndRef.current = Date.now();
            startRecallPhase();
            return;
        }

        itemStartRef.current = Date.now();
        if (timedMode) {
            timerRef.current = setTimeout(() => {
                handleLapse();
            }, pace);
        }
    }, [currentIndex, items.length, pace, timedMode]);

    useEffect(() => {
        if (phase === 'drill') {
            nextDrillItem();
        }
        return stopTimer;
    }, [phase, currentIndex]); // Dependency on currentIndex triggers next item
    
    // Update live timer in untimed mode
    useEffect(() => {
        if (phase === 'drill' && !timedMode) {
            const interval = setInterval(() => {
                setCurrentElapsed(Date.now() - itemStartRef.current);
            }, 100);
            return () => clearInterval(interval);
        }
    }, [phase, timedMode, currentIndex]);

    const handleImageReady = () => {
        if (phase !== 'drill') return;
        const latency = Date.now() - itemStartRef.current;
        recordResult(latency, false);
    };

    const handleLapse = () => {
        if (phase !== 'drill') return;
        recordResult(pace, true);
    };

    const recordResult = (latency: number, isLapse: boolean) => {
        stopTimer();
        setResults(prev => [
            ...prev,
            {
                item: items[currentIndex],
                latency,
                isLapse,
                recallInput: '',
                isRecallCorrect: false
            }
        ]);
        setCurrentIndex(prev => prev + 1);
    };

    // --- Recall Phase ---

    const startRecallPhase = () => {
        // Generate random order of indices
        const indices = Array.from({ length: items.length }, (_, i) => i);
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        setRecallOrder(indices);
        setRecallIndex(0);
        setRecallInput('');
        setPhase('recall');
    };

    const submitRecall = (e?: React.FormEvent) => {
        e?.preventDefault();
        
        const currentItemIndex = recallOrder[recallIndex];
        const currentItem = items[currentItemIndex];
        
        // Normalize strings for comparison (case insensitive, trim)
        const inputClean = recallInput.trim().toLowerCase();
        const targetClean = currentItem.value.toLowerCase();
        const isCorrect = inputClean === targetClean;

        // Update results
        // We need to find the result entry corresponding to this item.
        // Since results are stored in order of drill (0 to N-1), result index == item index.
        const updatedResults = [...results];
        updatedResults[currentItemIndex] = {
            ...updatedResults[currentItemIndex],
            recallInput: recallInput,
            isRecallCorrect: isCorrect
        };
        setResults(updatedResults);

        if (recallIndex + 1 >= recallOrder.length) {
            finishGame(updatedResults);
        } else {
            setRecallIndex(prev => prev + 1);
            setRecallInput('');
        }
    };

    // --- Results Phase ---

    const finishGame = async (finalResults: ItemResult[]) => {
        setResults(finalResults);
        setPhase('result');

        // Calculate Stats
        const correctItems = finalResults.filter(r => r.isRecallCorrect);
        const incorrectItems = finalResults.filter(r => !r.isRecallCorrect);

        const avgLatencyCorrect = correctItems.length 
            ? correctItems.reduce((sum, r) => sum + r.latency, 0) / correctItems.length 
            : 0;
        
        const avgLatencyIncorrect = incorrectItems.length
            ? incorrectItems.reduce((sum, r) => sum + r.latency, 0) / incorrectItems.length
            : 0;

        // Sort by latency for "Slowest Encoded"
        const sortedByLatencyDesc = [...finalResults].sort((a, b) => b.latency - a.latency);
        const slowestEncoded = sortedByLatencyDesc.slice(0, 5);

        // "Fastest Encoded but Missed" -> Filter incorrect, sort by latency asc
        const fastestMissed = incorrectItems
            .sort((a, b) => a.latency - b.latency)
            .slice(0, 5);

        const totalTime = (Date.now() - sessionStartRef.current) / 1000;
        const recallAccuracy = Math.round((correctItems.length / finalResults.length) * 100);

        // Save to Firebase
        try {
            await saveGameResult({
                type: 'visualization-latency',
                count: finalResults.length,
                correct: correctItems.length,
                total: finalResults.length,
                percentage: recallAccuracy,
                memorizeTime: (drillEndRef.current - sessionStartRef.current) / 1000,
                recallTime: (Date.now() - drillEndRef.current) / 1000,
                precision: recallAccuracy,
                completeness: 100,
            });
        } catch (error) {
            console.error('Failed to save result:', error);
        }
    };

    const getStats = (): SessionStats | null => {
        if (phase !== 'result' || results.length === 0) return null;

        const correctItems = results.filter(r => r.isRecallCorrect);
        const incorrectItems = results.filter(r => !r.isRecallCorrect);

        const avgLatencyCorrect = correctItems.length 
            ? correctItems.reduce((sum, r) => sum + r.latency, 0) / correctItems.length 
            : 0;
        
        const avgLatencyIncorrect = incorrectItems.length
            ? incorrectItems.reduce((sum, r) => sum + r.latency, 0) / incorrectItems.length
            : 0;

        const sortedByLatencyDesc = [...results].sort((a, b) => b.latency - a.latency);
        const slowestEncoded = sortedByLatencyDesc.slice(0, 5);

        const fastestMissed = incorrectItems
            .sort((a, b) => a.latency - b.latency)
            .slice(0, 5);

        return {
            totalDuration: (Date.now() - sessionStartRef.current) / 1000, // Approx
            avgLatencyCorrect,
            avgLatencyIncorrect,
            slowestEncoded,
            fastestMissed,
            totalItems: results.length,
            recallAccuracy: Math.round((correctItems.length / results.length) * 100),
            recallCorrectCount: correctItems.length
        };
    };

    // --- Render ---

    return (
        <>
            <Header />
            <main className="container" style={{ maxWidth: '900px' }}>
                <div style={{ marginBottom: '2rem' }}>
                    <Link href="/training" style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '0.5rem', display: 'inline-block' }}>
                        ← Back to Training
                    </Link>
                    <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Visualization Latency Drill</h1>
                    <p style={{ color: '#94a3b8', maxWidth: '600px' }}>
                        Measure your image encoding speed and its impact on recall.
                    </p>
                </div>

                {phase === 'setup' && (
                    <div className="glass card animate-fade-in" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#cbd5e1' }}>Stimulus Type</label>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {(['mixed', 'digits', 'words'] as ItemType[]).map(t => (
                                        <button
                                            key={t}
                                            className={`btn ${itemType === t ? 'btn-primary' : 'btn-secondary'}`}
                                            onClick={() => setItemType(t)}
                                            style={{ flex: 1, textTransform: 'capitalize' }}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#cbd5e1' }}>Items per Session</label>
                                <input
                                    type="number"
                                    className="input-field"
                                    value={itemCount}
                                    min={5}
                                    max={100}
                                    onChange={(e) => setItemCount(Math.max(5, Math.min(100, parseInt(e.target.value, 10) || 5)))}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#cbd5e1' }}>Mode</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        className={`btn ${timedMode ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setTimedMode(true)}
                                        style={{ flex: 1 }}
                                    >
                                        Timed
                                    </button>
                                    <button
                                        className={`btn ${!timedMode ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setTimedMode(false)}
                                        style={{ flex: 1 }}
                                    >
                                        Untimed
                                    </button>
                                </div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '0.25rem' }}>
                                    {timedMode ? 'Auto-advance after max time' : 'Manual advance (time still tracked)'}
                                </div>
                            </div>

                            {timedMode && (
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#cbd5e1' }}>Max Display Time</label>
                                    <select
                                        className="input-field"
                                        value={pace}
                                        onChange={(e) => setPace(parseInt(e.target.value, 10))}
                                    >
                                        {PACE_OPTIONS.map((option) => (
                                            <option key={option} value={option}>
                                                {(option / 1000).toFixed(1)}s
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        <button className="btn btn-primary" onClick={startDrill} style={{ alignSelf: 'center', minWidth: '240px' }}>
                            Start Drill
                        </button>
                    </div>
                )}

                {phase === 'drill' && items[currentIndex] && (
                    <div className="glass card animate-fade-in" style={{ padding: '2rem', textAlign: 'center' }}>
                        <div style={{ marginBottom: '1rem', fontSize: '0.9rem', opacity: 0.7 }}>
                            Item {currentIndex + 1} / {items.length}
                        </div>
                        <div
                            style={{
                                fontSize: items[currentIndex].type === 'digit' ? '5rem' : '3rem',
                                fontWeight: 'bold',
                                letterSpacing: items[currentIndex].type === 'digit' ? '0.2em' : 'normal',
                                fontFamily: items[currentIndex].type === 'digit' ? 'monospace' : 'inherit',
                                marginBottom: '2rem',
                                minHeight: '120px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            {items[currentIndex].value}
                        </div>
                        <button 
                            className="btn btn-primary" 
                            style={{ minWidth: '200px', fontSize: '1.2rem', padding: '1rem 2rem' }} 
                            onClick={handleImageReady}
                        >
                            {timedMode ? 'Image Ready' : 'Next'}
                        </button>
                        {!timedMode && (
                            <div style={{ marginTop: '1rem', fontSize: '0.85rem', opacity: 0.6 }}>
                                Time: {(currentElapsed / 1000).toFixed(2)}s
                            </div>
                        )}
                    </div>
                )}

                {phase === 'recall' && (
                    <div className="glass card animate-fade-in" style={{ padding: '2rem', textAlign: 'center' }}>
                         <div style={{ marginBottom: '1rem', fontSize: '0.9rem', opacity: 0.7 }}>
                            Recall {recallIndex + 1} / {items.length}
                        </div>
                        <div style={{ fontSize: '1.5rem', marginBottom: '2rem' }}>
                            What was Item <strong>#{recallOrder[recallIndex] + 1}</strong>?
                        </div>
                        <form onSubmit={submitRecall} style={{ maxWidth: '400px', margin: '0 auto' }}>
                            <input
                                autoFocus
                                type="text"
                                className="input-field"
                                value={recallInput}
                                onChange={(e) => setRecallInput(e.target.value)}
                                placeholder="Type word or number..."
                                style={{ textAlign: 'center', fontSize: '1.5rem', marginBottom: '1rem' }}
                            />
                            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                                Submit
                            </button>
                        </form>
                    </div>
                )}

                {phase === 'result' && (
                    <div className="glass card animate-fade-in" style={{ padding: '2rem' }}>
                        <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Diagnostic Report</h2>
                        
                        {(() => {
                            const stats = getStats();
                            if (!stats) return null;
                            return (
                                <>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                                        <div className="glass" style={{ padding: '1rem', borderRadius: '0.75rem' }}>
                                            <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Recall Accuracy</div>
                                            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: stats.recallAccuracy >= 90 ? 'var(--success)' : 'var(--foreground)' }}>
                                                {stats.recallAccuracy}%
                                            </div>
                                            <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>{stats.recallCorrectCount}/{stats.totalItems}</div>
                                        </div>
                                        <div className="glass" style={{ padding: '1rem', borderRadius: '0.75rem' }}>
                                            <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Avg Latency (Correct)</div>
                                            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--success)' }}>
                                                {stats.avgLatencyCorrect.toFixed(0)} ms
                                            </div>
                                        </div>
                                        <div className="glass" style={{ padding: '1rem', borderRadius: '0.75rem' }}>
                                            <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Avg Latency (Failed)</div>
                                            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--error)' }}>
                                                {stats.avgLatencyIncorrect.toFixed(0)} ms
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                                        <div>
                                            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--accent)' }}>Slowest Encoded Items</h3>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                {stats.slowestEncoded.map((res, i) => (
                                                    <div key={i} className="glass" style={{ padding: '0.5rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '0.5rem' }}>
                                                        <span>#{res.item.originalIndex + 1} <strong>{res.item.value}</strong></span>
                                                        <span style={{ fontFamily: 'monospace' }}>{res.latency}ms {res.isLapse ? '(Lapse)' : ''}</span>
                                                    </div>
                                                ))}
                                                {stats.slowestEncoded.length === 0 && <div style={{ opacity: 0.5 }}>No data</div>}
                                            </div>
                                        </div>
                                        <div>
                                            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--warning)' }}>Fastest Missed (False Confidence)</h3>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                {stats.fastestMissed.map((res, i) => (
                                                    <div key={i} className="glass" style={{ padding: '0.5rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '0.5rem' }}>
                                                        <span>#{res.item.originalIndex + 1} <strong>{res.item.value}</strong></span>
                                                        <span style={{ fontFamily: 'monospace' }}>{res.latency}ms</span>
                                                    </div>
                                                ))}
                                                {stats.fastestMissed.length === 0 && <div style={{ opacity: 0.5 }}>No missed items</div>}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setPhase('setup')}>
                                            Run Again
                                        </button>
                                        <Link href="/training" className="btn btn-primary" style={{ flex: 1 }}>
                                            Back to Hub
                                        </Link>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                )}
            </main>
        </>
    );
}
