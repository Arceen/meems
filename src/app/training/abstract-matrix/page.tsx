"use client";

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import Link from 'next/link';
import { saveGameResult } from '@/lib/firebase';

type GameState = 'setup' | 'memorize' | 'recall' | 'result';

interface MatrixCell {
    coordinate: string; // e.g., "A1", "B5"
    number: string; // 00-99
    imageUrl: string;
    row: number;
    col: number;
}

export default function AbstractMatrix() {
    const [gameState, setGameState] = useState<GameState>('setup');

    // Settings
    const [gridSize, setGridSize] = useState<5 | 10>(5);
    const [cellCount, setCellCount] = useState(25);
    const [timeLimit, setTimeLimit] = useState(300); // 5 minutes

    // Game Data
    const [cells, setCells] = useState<MatrixCell[]>([]);
    const [recallIndex, setRecallIndex] = useState(0);
    const [recallInput, setRecallInput] = useState<{ [key: number]: { coordinate: string; number: string } }>({});
    const [startTime, setStartTime] = useState<number>(0);
    const [endTime, setEndTime] = useState<number>(0);
    const [timeLeft, setTimeLeft] = useState(0);

    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const generateGrid = (size: 5 | 10, count: number) => {
        const newCells: MatrixCell[] = [];
        const letters = 'ABCDEFGHIJ'.slice(0, size);

        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                if (newCells.length >= count) break;

                const coordinate = `${letters[col]}${row + 1}`;
                const number = String(Math.floor(Math.random() * 100)).padStart(2, '0');
                const seed = row * size + col + Date.now();
                // Using picsum with grayscale and blur for abstract effect
                const imageUrl = `https://picsum.photos/seed/${seed}/200/200?grayscale&blur=2`;

                newCells.push({ coordinate, number, imageUrl, row, col });
            }
            if (newCells.length >= count) break;
        }

        return newCells;
    };

    const startWeek7Challenge = () => {
        setGridSize(10);
        setCellCount(50);
        setTimeLimit(300); // 5 minutes
        startGame(10, 50, 300);
    };

    const startGame = (size: 5 | 10 = gridSize, count = cellCount, time = timeLimit) => {
        const newCells = generateGrid(size, count);
        setCells(newCells);
        setTimeLeft(time);
        setGameState('memorize');
        setStartTime(Date.now());
        setRecallInput({});
        setRecallIndex(0);
    };

    const finishMemorization = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setEndTime(Date.now());

        // Shuffle cells for recall
        const shuffled = [...cells].sort(() => Math.random() - 0.5);
        setCells(shuffled);

        setGameState('recall');
    };

    const handleInputChange = (idx: number, field: 'coordinate' | 'number', value: string) => {
        setRecallInput(prev => ({
            ...prev,
            [idx]: {
                ...prev[idx],
                [field]: value.toUpperCase()
            }
        }));
    };

    const submitRecall = async () => {
        const correctCount = calculateScore();
        const memorizeTimeSeconds = Math.floor((endTime - startTime) / 1000);

        await saveGameResult({
            type: 'abstract-matrix',
            count: cellCount,
            correct: correctCount,
            total: cellCount * 2,
            percentage: Math.round((correctCount / (cellCount * 2)) * 100),
            memorizeTime: memorizeTimeSeconds,
            recallTime: 0,
            precision: Math.round((correctCount / (cellCount * 2)) * 100),
            completeness: 100,
        });

        setGameState('result');
    };

    // Timer Logic
    useEffect(() => {
        if (gameState === 'memorize' && timeLeft > 0) {
            timerRef.current = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        finishMemorization();
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

    const calculateScore = () => {
        let points = 0;
        cells.forEach((cell, idx) => {
            const input = recallInput[idx] || { coordinate: '', number: '' };
            if (input.coordinate.trim().toUpperCase() === cell.coordinate) points++;
            if (input.number.trim() === cell.number) points++;
        });
        return points;
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <>
            <Header />
            <main className="container" style={{ maxWidth: '1200px' }}>

                <div style={{ marginBottom: '2rem' }}>
                    <Link href="/training" style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '0.5rem', display: 'inline-block' }}>
                        ← Back to Training
                    </Link>
                    <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>The Abstract Matrix</h1>
                    <p style={{ opacity: 0.7, marginTop: '0.5rem' }}>Visual-Spatial Overload Challenge</p>
                </div>

                {gameState === 'setup' && (
                    <div className="glass card animate-fade-in">
                        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.2rem' }}>Configuration</h2>

                        <div style={{ display: 'grid', gap: '1.5rem', marginBottom: '2rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Grid Size</label>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <button
                                        className={`btn ${gridSize === 5 ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => { setGridSize(5); setCellCount(25); }}
                                        style={{ flex: 1 }}
                                    >
                                        5×5 (25 cells)
                                    </button>
                                    <button
                                        className={`btn ${gridSize === 10 ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => { setGridSize(10); setCellCount(100); }}
                                        style={{ flex: 1 }}
                                    >
                                        10×10 (100 cells)
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Cell Count</label>
                                <input
                                    type="number"
                                    className="input-field"
                                    value={cellCount}
                                    onChange={(e) => setCellCount(Math.min(parseInt(e.target.value) || 0, gridSize * gridSize))}
                                    max={gridSize * gridSize}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Time Limit (Seconds)</label>
                                <input
                                    type="number"
                                    className="input-field"
                                    value={timeLimit}
                                    onChange={(e) => setTimeLimit(parseInt(e.target.value) || 0)}
                                />
                            </div>
                        </div>

                        <div style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid var(--accent)', padding: '1.5rem', borderRadius: '0.5rem', marginBottom: '2rem' }}>
                            <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--accent)' }}>How to Play</h3>
                            <ul style={{ fontSize: '0.9rem', opacity: 0.9, lineHeight: '1.6', paddingLeft: '1.5rem' }}>
                                <li>Each cell shows an abstract pattern, coordinate (A1, B5), and 2-digit number</li>
                                <li>Link the pattern to its coordinate and number using your Major System</li>
                                <li>During recall, you'll see only the pattern - type the coordinate and number</li>
                                <li>Coordinate encoding: A=0, B=1, C=2... / 1=1, 2=2, 3=3... (e.g., C5 = 25)</li>
                            </ul>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
                            <button className="btn btn-primary" onClick={() => startGame()}>
                                Start Custom Game
                            </button>

                            <div style={{ borderTop: '1px solid var(--glass-border)', margin: '1rem 0' }}></div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 'bold' }}>Week 7 Challenge</h3>
                                    <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>50 Matrices • 5 Minutes • {"<"}5 Errors</p>
                                </div>
                                <button className="btn btn-secondary" onClick={startWeek7Challenge} style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
                                    Start Challenge
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {gameState === 'memorize' && (
                    <div className="animate-fade-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', position: 'sticky', top: '1rem', zIndex: 10, background: 'var(--background)', padding: '1rem 0', borderBottom: '1px solid var(--glass-border)' }}>
                            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: timeLeft < 60 ? 'var(--error)' : 'var(--foreground)' }}>
                                Time Left: {formatTime(timeLeft)}
                            </div>
                            <button className="btn btn-primary" onClick={finishMemorization}>
                                Done Memorizing
                            </button>
                        </div>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
                            gap: '0.5rem',
                            maxWidth: '100%',
                            overflowX: 'auto'
                        }}>
                            {cells.map((cell, idx) => (
                                <div key={idx} className="glass" style={{
                                    padding: 0,
                                    borderRadius: '0.5rem',
                                    textAlign: 'center',
                                    minWidth: gridSize === 10 ? '80px' : '100px',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    aspectRatio: '1/1'
                                }}>
                                    <img
                                        src={cell.imageUrl}
                                        alt="Abstract Pattern"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                    <div style={{
                                        position: 'absolute',
                                        bottom: 0,
                                        left: 0,
                                        right: 0,
                                        background: 'rgba(0, 0, 0, 0.4)',
                                        backdropFilter: 'blur(8px)',
                                        WebkitBackdropFilter: 'blur(8px)',
                                        padding: '0.25rem',
                                        display: 'flex',
                                        justifyContent: 'center',
                                        gap: '0.5rem',
                                        alignItems: 'center',
                                        borderTop: '1px solid rgba(255,255,255,0.1)'
                                    }}>
                                        <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'white' }}>
                                            {cell.coordinate}
                                        </span>
                                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>|</span>
                                        <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'white' }}>
                                            {cell.number}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {gameState === 'recall' && (
                    <div className="animate-fade-in">
                        <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Recall Phase</h2>
                                <p style={{ opacity: 0.7 }}>What coordinate and number match each pattern?</p>
                            </div>
                            <button className="btn btn-primary" onClick={submitRecall}>
                                Submit Recall
                            </button>
                        </div>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                            gap: '1rem'
                        }}>
                            {cells.map((cell, idx) => (
                                <div key={idx} className="glass" style={{ padding: '1rem', borderRadius: '0.5rem' }}>
                                    <div style={{ position: 'relative', width: '100%', height: '100px', marginBottom: '1rem', borderRadius: '0.25rem', overflow: 'hidden' }}>
                                        <img
                                            src={cell.imageUrl}
                                            alt="Abstract Pattern"
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <input
                                            type="text"
                                            placeholder="Coordinate (e.g., A1)"
                                            className="input-field"
                                            style={{ padding: '0.5rem', textAlign: 'center', textTransform: 'uppercase' }}
                                            value={recallInput[idx]?.coordinate || ''}
                                            onChange={(e) => handleInputChange(idx, 'coordinate', e.target.value)}
                                            maxLength={3}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Number (00-99)"
                                            className="input-field"
                                            style={{ padding: '0.5rem', textAlign: 'center' }}
                                            value={recallInput[idx]?.number || ''}
                                            onChange={(e) => handleInputChange(idx, 'number', e.target.value.replace(/\D/g, '').slice(0, 2))}
                                            maxLength={2}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                            <button className="btn btn-primary" style={{ width: '100%', maxWidth: '300px' }} onClick={submitRecall}>
                                Submit Recall
                            </button>
                        </div>
                    </div>
                )}

                {gameState === 'result' && (
                    <div className="glass card animate-fade-in">
                        <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', textAlign: 'center' }}>Results</h2>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>Score</div>
                                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>
                                    {calculateScore()} / {cells.length * 2}
                                </div>
                                <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>2 points per cell</div>
                            </div>

                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>Errors</div>
                                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: (cells.length * 2 - calculateScore()) <= 5 ? 'var(--success)' : 'var(--error)' }}>
                                    {cells.length * 2 - calculateScore()}
                                </div>
                                <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>Target: {"<"}5</div>
                            </div>

                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>Time</div>
                                <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                                    {formatTime(Math.floor((endTime - startTime) / 1000))}
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setGameState('setup')}>
                                New Game
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
