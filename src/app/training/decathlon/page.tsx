"use client";

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import Link from 'next/link';
import { saveGameResult } from '@/lib/firebase';

type GameState = 'setup' | 'running' | 'result';
type DisciplineType = 'numbers' | 'names' | 'cards' | 'binary';

interface Discipline {
    type: DisciplineType;
    name: string;
    duration: number; // in seconds
    data?: any;
}

export default function Decathlon() {
    const [gameState, setGameState] = useState<GameState>('setup');
    const [currentDisciplineIndex, setCurrentDisciplineIndex] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);
    const [startTime, setStartTime] = useState(0);
    const [endTime, setEndTime] = useState(0);

    const [disciplines, setDisciplines] = useState<Discipline[]>([
        { type: 'numbers', name: 'Random Numbers', duration: 600 }, // 10 min
        { type: 'names', name: 'Names & Faces', duration: 900 }, // 15 min
        { type: 'cards', name: 'Playing Cards', duration: 600 }, // 10 min
        { type: 'binary', name: 'Binary Digits', duration: 900 }, // 15 min
    ]);

    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const startDecathlon = () => {
        // Generate data for all disciplines
        const newDisciplines = disciplines.map(d => ({
            ...d,
            data: generateDisciplineData(d.type)
        }));

        setDisciplines(newDisciplines);
        setCurrentDisciplineIndex(0);
        setTimeLeft(newDisciplines[0].duration);
        setStartTime(Date.now());
        setGameState('running');
    };

    const generateDisciplineData = (type: DisciplineType) => {
        switch (type) {
            case 'numbers':
                return generateDigits(300);
            case 'binary':
                return generateBinary(300);
            case 'cards':
                return 'Card deck visualization';
            case 'names':
                return 'Names & faces visualization';
            default:
                return '';
        }
    };

    const generateDigits = (count: number) => {
        let result = "";
        for (let i = 0; i < count; i++) {
            result += Math.floor(Math.random() * 10).toString();
        }
        return result;
    };

    const generateBinary = (count: number) => {
        let result = "";
        for (let i = 0; i < count; i++) {
            result += Math.random() > 0.5 ? "1" : "0";
        }
        return result;
    };

    const nextDiscipline = () => {
        if (currentDisciplineIndex < disciplines.length - 1) {
            const nextIdx = currentDisciplineIndex + 1;
            setCurrentDisciplineIndex(nextIdx);
            setTimeLeft(disciplines[nextIdx].duration);
        } else {
            finishDecathlon();
        }
    };

    const finishDecathlon = async () => {
        const end = Date.now();
        setEndTime(end);
        setGameState('result');

        if (timerRef.current) clearInterval(timerRef.current);

        // Save result
        const totalTime = Math.floor((end - startTime) / 1000);
        await saveGameResult({
            type: 'decathlon',
            count: disciplines.length,
            correct: disciplines.length,
            total: disciplines.length,
            percentage: 100,
            memorizeTime: totalTime,
            recallTime: 0,
            precision: 100,
            completeness: 100,
        });
    };

    // Timer Logic
    useEffect(() => {
        if (gameState === 'running' && timeLeft > 0) {
            timerRef.current = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        nextDiscipline();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [gameState, currentDisciplineIndex]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatDigits = (data: string, groupSize: number) => {
        const chunks = [];
        for (let i = 0; i < data.length; i += groupSize) {
            chunks.push(data.slice(i, i + groupSize));
        }
        return chunks;
    };

    const currentDiscipline = disciplines[currentDisciplineIndex];

    return (
        <>
            <Header />
            <main className="container" style={{ maxWidth: '1000px' }}>

                <div style={{ marginBottom: '2rem' }}>
                    <Link href="/training" style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '0.5rem', display: 'inline-block' }}>
                        ← Back to Training
                    </Link>
                    <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Decathlon Simulation</h1>
                </div>

                {gameState === 'setup' && (
                    <div className="glass card animate-fade-in">
                        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.2rem' }}>90-Minute Mock Competition</h2>

                        <div style={{ marginBottom: '2rem' }}>
                            <p style={{ opacity: 0.8, marginBottom: '1rem' }}>
                                This simulation runs multiple disciplines back-to-back with zero gap between memorization phases.
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {disciplines.map((d, idx) => (
                                    <div key={idx} className="glass-panel" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 'bold' }}>{idx + 1}. {d.name}</div>
                                            <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{formatTime(d.duration)} memorization</div>
                                        </div>
                                        <div style={{ fontSize: '1.2rem', opacity: 0.5 }}>
                                            {d.type === 'numbers' && '🔢'}
                                            {d.type === 'names' && '👤'}
                                            {d.type === 'cards' && '🃏'}
                                            {d.type === 'binary' && '💾'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{ background: 'rgba(255, 193, 7, 0.1)', border: '1px solid rgba(255, 193, 7, 0.3)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '2rem' }}>
                            <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#ffc107' }}>⚠️ Important</div>
                            <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>
                                This is a continuous endurance test. Once started, you cannot pause. Recall will be done at the end of all disciplines.
                            </div>
                        </div>

                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={startDecathlon}>
                            Start Decathlon
                        </button>
                    </div>
                )}

                {gameState === 'running' && currentDiscipline && (
                    <div className="animate-fade-in">
                        {/* Progress Bar */}
                        <div style={{ marginBottom: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <span style={{ fontSize: '0.9rem', opacity: 0.7 }}>
                                    Discipline {currentDisciplineIndex + 1} of {disciplines.length}
                                </span>
                                <span style={{ fontSize: '0.9rem', opacity: 0.7 }}>
                                    {Math.round((currentDisciplineIndex / disciplines.length) * 100)}% Complete
                                </span>
                            </div>
                            <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%',
                                    width: `${(currentDisciplineIndex / disciplines.length) * 100}%`,
                                    background: 'linear-gradient(to right, var(--primary), var(--accent))',
                                    transition: 'width 0.3s'
                                }}></div>
                            </div>
                        </div>

                        {/* Timer */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', padding: '1.5rem', background: 'rgba(0,0,0,0.3)', borderRadius: '1rem' }}>
                            <div>
                                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                                    {currentDiscipline.name}
                                </h2>
                                <div style={{ fontSize: '0.9rem', opacity: 0.6 }}>Memorize the data below</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: timeLeft < 60 ? 'var(--error)' : 'var(--success)' }}>
                                    {formatTime(timeLeft)}
                                </div>
                                <button className="btn btn-secondary" style={{ marginTop: '0.5rem' }} onClick={nextDiscipline}>
                                    Next →
                                </button>
                            </div>
                        </div>

                        {/* Data Display */}
                        <div className="glass card" style={{ minHeight: '400px' }}>
                            {(currentDiscipline.type === 'numbers' || currentDiscipline.type === 'binary') && (
                                <div style={{
                                    fontFamily: 'monospace',
                                    fontSize: '1.3rem',
                                    lineHeight: '1.8',
                                    letterSpacing: '1px',
                                    wordBreak: 'break-all'
                                }}>
                                    {formatDigits(currentDiscipline.data, currentDiscipline.type === 'binary' ? 3 : 5).map((chunk, idx) => (
                                        <span key={idx} style={{ marginRight: '1rem', display: 'inline-block' }}>
                                            {chunk}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {currentDiscipline.type === 'cards' && (
                                <div style={{ textAlign: 'center', padding: '4rem' }}>
                                    <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>🃏</div>
                                    <div style={{ fontSize: '1.2rem', opacity: 0.7 }}>
                                        Visualize a shuffled deck of 52 playing cards
                                    </div>
                                    <div style={{ fontSize: '0.9rem', opacity: 0.5, marginTop: '1rem' }}>
                                        (Full card visualization coming soon)
                                    </div>
                                </div>
                            )}

                            {currentDiscipline.type === 'names' && (
                                <div style={{ textAlign: 'center', padding: '4rem' }}>
                                    <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>👥</div>
                                    <div style={{ fontSize: '1.2rem', opacity: 0.7 }}>
                                        Memorize 30 names and faces
                                    </div>
                                    <div style={{ fontSize: '0.9rem', opacity: 0.5, marginTop: '1rem' }}>
                                        (Full names visualization coming soon)
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {gameState === 'result' && (
                    <div className="glass card animate-fade-in">
                        <h2 style={{ fontSize: '2rem', marginBottom: '2rem', textAlign: 'center' }}>
                            🏆 Decathlon Complete!
                        </h2>

                        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                            <div style={{ fontSize: '4rem', fontWeight: 'bold', lineHeight: '1', marginBottom: '0.5rem' }}>
                                {formatTime(Math.floor((endTime - startTime) / 1000))}
                            </div>
                            <div style={{ fontSize: '1.2rem', opacity: 0.7 }}>Total Time</div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                            {disciplines.map((d, idx) => (
                                <div key={idx} className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
                                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                                        {d.type === 'numbers' && '🔢'}
                                        {d.type === 'names' && '👤'}
                                        {d.type === 'cards' && '🃏'}
                                        {d.type === 'binary' && '💾'}
                                    </div>
                                    <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>{d.name}</div>
                                    <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>✓ Completed</div>
                                </div>
                            ))}
                        </div>

                        <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--success)', padding: '1.5rem', borderRadius: '0.5rem', marginBottom: '2rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                                Congratulations on completing the full simulation!
                            </div>
                            <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                                In a real competition, you would now have a recall period for all disciplines.
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setGameState('setup')}>
                                Try Again
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
