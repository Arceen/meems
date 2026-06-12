"use client";

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import Link from 'next/link';
import { saveGameResult } from '@/lib/firebase';

type GameState = 'setup' | 'playing' | 'result';
type Operation = '+' | '-' | '*';

export default function QuickMath() {
    const [gameState, setGameState] = useState<GameState>('setup');

    // Settings
    const [timeLimit, setTimeLimit] = useState(60);
    const [digitCount, setDigitCount] = useState(2);

    // Game Data
    const [currentProblem, setCurrentProblem] = useState({ a: 0, b: 0, op: '+', answer: 0 });
    const [userAnswer, setUserAnswer] = useState('');
    const [score, setScore] = useState({ correct: 0, total: 0 });
    const [timeLeft, setTimeLeft] = useState(0);
    const [flash, setFlash] = useState(false);

    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const gameStartTimeRef = useRef<number>(0);

    const generateProblem = () => {
        const min = Math.pow(10, digitCount - 1);
        const max = Math.pow(10, digitCount) - 1;

        let a = Math.floor(Math.random() * (max - min + 1)) + min;
        let b = Math.floor(Math.random() * (max - min + 1)) + min;

        // Choose operation: 70% addition, 30% subtraction
        // No division, limited multiplication only for small numbers
        let op: Operation = Math.random() < 0.7 ? '+' : '-';

        // For subtraction, ensure a >= b so result is non-negative
        if (op === '-' && b > a) {
            [a, b] = [b, a]; // Swap
        }

        let answer = 0;
        if (op === '+') {
            answer = a + b;
        } else if (op === '-') {
            answer = a - b;
        }

        setCurrentProblem({ a, b, op, answer });
    };

    const startGame = () => {
        setScore({ correct: 0, total: 0 });
        setTimeLeft(timeLimit);
        gameStartTimeRef.current = Date.now();
        setGameState('playing');
        generateProblem();
        setUserAnswer('');

        // Focus input
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const handleInput = (val: string) => {
        setUserAnswer(val);

        // Auto-check logic
        const numVal = parseInt(val);
        if (!isNaN(numVal) && numVal === currentProblem.answer) {
            handleCorrect();
        }
    };

    const handleVirtualKey = (key: string) => {
        if (key === 'DEL') {
            handleInput(userAnswer.slice(0, -1));
        } else {
            handleInput(userAnswer + key);
        }
    };

    const handleCorrect = () => {
        setScore(prev => ({
            correct: prev.correct + 1,
            total: prev.total + 1
        }));

        // Visual feedback
        setFlash(true);
        setTimeout(() => setFlash(false), 200);

        generateProblem();
        setUserAnswer('');
    };

    const endGame = async () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setGameState('result');

        const elapsed = gameStartTimeRef.current > 0
            ? Math.round((Date.now() - gameStartTimeRef.current) / 1000)
            : timeLimit;
        const percentage = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;

        await saveGameResult({
            type: 'quick-math',
            count: score.total,
            correct: score.correct,
            total: score.total,
            percentage,
            memorizeTime: 0,
            recallTime: elapsed,
            precision: percentage,
            completeness: 100,
        });
    };

    useEffect(() => {
        if (gameState === 'playing' && timeLeft > 0) {
            timerRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        endGame();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [gameState]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <>
            <Header />
            <main className="container" style={{ maxWidth: '800px' }}>
                <div style={{ marginBottom: '2rem' }}>
                    <Link href="/training" style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '0.5rem', display: 'inline-block' }}>
                        ← Back to Training
                    </Link>
                    <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Quick Math</h1>
                    <p style={{ opacity: 0.7 }}>Speed Arithmetic Challenge</p>
                </div>

                {gameState === 'setup' && (
                    <div className="glass card animate-fade-in">
                        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.2rem' }}>Configuration</h2>

                        <div style={{ marginBottom: '2rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Time Limit</label>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {[30, 60, 120, 300].map(t => (
                                    <button
                                        key={t}
                                        className={`btn ${timeLimit === t ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setTimeLimit(t)}
                                        style={{ flex: 1, minWidth: '80px' }}
                                    >
                                        {t >= 60 ? `${t / 60}m` : `${t}s`}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ marginBottom: '2rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Difficulty (Digits)</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {[1, 2, 3, 4].map(d => (
                                    <button
                                        key={d}
                                        className={`btn ${digitCount === d ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setDigitCount(d)}
                                        style={{ flex: 1 }}
                                    >
                                        {d} Digit{d > 1 ? 's' : ''}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={startGame}>
                            Start Game
                        </button>
                    </div>
                )}

                {gameState === 'playing' && (
                    <div className="animate-fade-in" style={{ textAlign: 'center', padding: '1rem 0' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: timeLeft < 10 ? 'var(--error)' : 'var(--foreground)' }}>
                            {formatTime(timeLeft)}
                        </div>

                        <div className="glass" style={{
                            padding: '2rem 1rem',
                            borderRadius: '1rem',
                            marginBottom: '1rem',
                            background: flash ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
                            transition: 'background 0.2s'
                        }}>
                            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', fontFamily: 'monospace', marginBottom: '1.5rem' }}>
                                {currentProblem.a} {currentProblem.op} {currentProblem.b}
                            </div>

                            <input
                                ref={inputRef}
                                type="number"
                                className="input-field"
                                value={userAnswer}
                                onChange={(e) => handleInput(e.target.value)}
                                style={{
                                    fontSize: '2rem',
                                    textAlign: 'center',
                                    width: '200px',
                                    padding: '0.5rem',
                                    background: 'rgba(0,0,0,0.3)',
                                    border: '2px solid var(--primary)',
                                    color: 'white'
                                }}
                            />
                        </div>

                        {/* Virtual Keypad */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '0.5rem',
                            maxWidth: '300px',
                            margin: '0 auto'
                        }}>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                                <button
                                    key={num}
                                    className="btn glass"
                                    style={{ fontSize: '1.5rem', padding: '1rem', color: 'white' }}
                                    onClick={() => handleVirtualKey(num.toString())}
                                >
                                    {num}
                                </button>
                            ))}
                            <div /> {/* Spacer */}
                            <button
                                className="btn glass"
                                style={{ fontSize: '1.5rem', padding: '1rem', color: 'white' }}
                                onClick={() => handleVirtualKey('0')}
                            >
                                0
                            </button>
                            <button
                                className="btn glass"
                                style={{ fontSize: '1.5rem', padding: '1rem', color: 'var(--error)' }}
                                onClick={() => handleVirtualKey('DEL')}
                            >
                                ⌫
                            </button>
                        </div>

                        <div style={{ marginTop: '1rem', opacity: 0.7 }}>
                            Solved: {score.correct}
                        </div>
                    </div>
                )}

                {gameState === 'result' && (
                    <div className="glass card animate-fade-in">
                        <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', textAlign: 'center' }}>Time's Up!</h2>

                        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                            <div style={{ fontSize: '4rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                                {score.correct}
                            </div>
                            <div style={{ opacity: 0.7 }}>Correct Answers</div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>Accuracy</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--success)' }}>
                                    {score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0}%
                                </div>
                            </div>
                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>Speed</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                                    {(score.total / (timeLimit / 60)).toFixed(1)} / min
                                </div>
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
