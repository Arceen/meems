"use client";

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import wordList from '@/data/words.json';
import { saveGameResult } from '@/lib/firebase';

type GameState = 'config' | 'memorize' | 'recall' | 'result';

export default function WordMemorization() {
    const [gameState, setGameState] = useState<GameState>('config');
    const [wordCount, setWordCount] = useState<number | ''>(10);
    const [recallMode, setRecallMode] = useState<'ordered' | 'unordered'>('ordered');
    const [generatedWords, setGeneratedWords] = useState<string[]>([]);
    const [userInputs, setUserInputs] = useState<string[]>([]);
    const [recallOrder, setRecallOrder] = useState<number[]>([]);

    const [memorizeStartTime, setMemorizeStartTime] = useState(0);
    const [memorizeDuration, setMemorizeDuration] = useState(0);
    const [recallStartTime, setRecallStartTime] = useState(0);
    const [recallDuration, setRecallDuration] = useState(0);

    const [timeLimitMinutes, setTimeLimitMinutes] = useState<number | ''>(1);
    const [timeLimitSeconds, setTimeLimitSeconds] = useState<number | ''>(0);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);

    const inputRef = useRef<HTMLTextAreaElement>(null);

    const startMemorization = () => {
        const count = typeof wordCount === 'number' ? wordCount : 10;
        const finalCount = Math.max(5, Math.min(100, count));
        setWordCount(finalCount);

        const shuffled = [...wordList].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, finalCount);
        setGeneratedWords(selected);

        const mins = typeof timeLimitMinutes === 'number' ? timeLimitMinutes : 0;
        const secs = typeof timeLimitSeconds === 'number' ? timeLimitSeconds : 0;
        setTimeLeft(mins * 60 + secs);

        setGameState('memorize');
        setMemorizeStartTime(Date.now());
    };

    // Timer logic for memorization phase
    useEffect(() => {
        if (gameState === 'memorize' && timeLeft !== null) {
            if (timeLeft <= 0) {
                startRecall();
                return;
            }
            const timer = setTimeout(() => {
                setTimeLeft(timeLeft - 1);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [gameState, timeLeft]);

    const startRecall = () => {
        const now = Date.now();
        setMemorizeDuration(now - memorizeStartTime);
        setGameState('recall');
        setRecallStartTime(now);
        
        let order = Array.from({ length: generatedWords.length }, (_, i) => i);
        if (recallMode === 'unordered') {
            order = order.sort(() => Math.random() - 0.5);
        }
        setRecallOrder(order);
        setUserInputs(Array(generatedWords.length).fill(''));
        
        // setTimeout(() => inputRef.current?.focus(), 100);
    };

    const calculateScore = () => {
        let correct = 0;
        const total = generatedWords.length;
        let attemptedCount = 0;
        const comparison = [];

        for (let i = 0; i < total; i++) {
            const target = generatedWords[i];
            const input = userInputs[i] || '';
            const isCorrect = input.trim().toLowerCase() === target.toLowerCase();
            if (isCorrect) correct++;
            if (input.trim() !== '') attemptedCount++;
            comparison.push({ target, input, isCorrect });
        }

        // Accuracy: Correct / Attempted
        const accuracy = attemptedCount > 0 ? (correct / attemptedCount) * 100 : 0;

        // Recall Percentage: Attempted / Total
        const recallPercentage = total > 0 ? (attemptedCount / total) * 100 : 0;

        return { correct, total, attemptedCount, percentage: accuracy, accuracy, recallPercentage, comparison };
    };

    const finishGame = async () => {
        const now = Date.now();
        const duration = now - recallStartTime;
        setRecallDuration(duration);
        setGameState('result');

        const { correct, total, accuracy, recallPercentage } = calculateScore();
        try {
            await saveGameResult({
                type: 'word',
                count: total,
                correct,
                total,
                percentage: accuracy,
                accuracy,
                recallPercentage,
                memorizeTime: memorizeDuration,
                recallTime: duration
            });
        } catch (error) {
            console.error('Failed to save game result:', error);
        }
    };

    const resetGame = () => {
        setGameState('config');
        setGeneratedWords([]);
        setUserInputs([]);
        setMemorizeDuration(0);
        setRecallDuration(0);
    };

    const formatTime = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
    };



    return (
        <>
            <Header />
            <main className="container" style={{ alignItems: 'center' }}>
                <div className="glass-panel" style={{ width: '100%', maxWidth: '800px', padding: '2rem' }}>
                    <h1 style={{ fontSize: '2rem', marginBottom: '1.5rem', textAlign: 'center', background: 'linear-gradient(to right, var(--primary), var(--accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Word Memorization
                    </h1>

                    {gameState === 'config' && (
                        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
                            <div style={{ width: '100%', maxWidth: '500px' }}>
                                <label style={{ display: 'block', marginBottom: '1rem', color: '#cbd5e1', textAlign: 'center' }}>
                                    Number of Words (5 - 100)
                                </label>

                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', marginBottom: '1.5rem' }}>
                                    {[5, 10, 15, 20, 30, 50, 80, 100].map(num => (
                                        <button
                                            key={num}
                                            onClick={() => setWordCount(num)}
                                            className="btn"
                                            style={{
                                                padding: '0.5rem 1rem',
                                                fontSize: '0.9rem',
                                                background: wordCount === num ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                                                color: wordCount === num ? 'white' : 'var(--foreground)'
                                            }}
                                        >
                                            {num}
                                        </button>
                                    ))}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginBottom: '1rem' }}>
                                    <span style={{ fontSize: '0.9rem', opacity: 0.7 }}>Custom:</span>
                                    <input
                                        type="number"
                                        min="5"
                                        max="100"
                                        value={wordCount}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '') setWordCount('');
                                            else setWordCount(parseInt(val));
                                        }}
                                        className="input-field"
                                        style={{ textAlign: 'center', fontSize: '1.2rem', width: '120px' }}
                                    />
                                </div>

                                <div style={{ marginBottom: '1.5rem', width: '100%' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', textAlign: 'center' }}>Memorization Time Limits</label>
                                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <input
                                                type="number"
                                                min="0"
                                                value={timeLimitMinutes}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setTimeLimitMinutes(val === '' ? '' : parseInt(val));
                                                }}
                                                className="input-field"
                                                style={{ width: '80px', textAlign: 'center' }}
                                            />
                                            <span style={{ fontSize: '0.9rem', opacity: 0.7 }}>min</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <input
                                                type="number"
                                                min="0"
                                                max="59"
                                                value={timeLimitSeconds}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setTimeLimitSeconds(val === '' ? '' : parseInt(val));
                                                }}
                                                className="input-field"
                                                style={{ width: '80px', textAlign: 'center' }}
                                            />
                                            <span style={{ fontSize: '0.9rem', opacity: 0.7 }}>sec</span>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', textAlign: 'center' }}>Recall Mode</label>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            className={`btn ${recallMode === 'ordered' ? 'btn-primary' : 'btn-secondary'}`}
                                            onClick={() => setRecallMode('ordered')}
                                            style={{ flex: 1 }}
                                        >
                                            Ordered
                                        </button>
                                        <button
                                            className={`btn ${recallMode === 'unordered' ? 'btn-primary' : 'btn-secondary'}`}
                                            onClick={() => setRecallMode('unordered')}
                                            style={{ flex: 1 }}
                                        >
                                            Unordered
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <button onClick={startMemorization} className="btn btn-primary" style={{ width: '100%', maxWidth: '400px' }}>
                                Start Memorization
                            </button>
                        </div>
                    )}

                    {gameState === 'memorize' && (
                        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                            {timeLeft !== null && (
                                <div style={{
                                    fontSize: '2rem',
                                    fontWeight: 'bold',
                                    color: timeLeft <= 10 ? 'var(--error)' : 'var(--primary)',
                                    marginBottom: '1rem',
                                    fontFamily: 'monospace'
                                }}>
                                    {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                                </div>
                            )}
                            <p style={{ marginBottom: '1rem', color: '#cbd5e1' }}>Memorize these words{recallMode === 'ordered' ? ' in order' : ''}:</p>
                            <div className="glass" style={{
                                padding: '1.5rem',
                                borderRadius: '1rem',
                                marginBottom: '2rem',
                                fontSize: '1.2rem',
                                lineHeight: '1.8',
                                width: '100%',
                                maxHeight: '400px',
                                overflowY: 'auto',
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '0.5rem',
                                justifyContent: 'center'
                            }}>
                                {generatedWords.map((word, idx) => (
                                    <span key={idx} style={{ background: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.6rem', borderRadius: '0.4rem' }}>
                                        {word}
                                    </span>
                                ))}
                            </div>
                            <button onClick={startRecall} className="btn btn-primary" style={{ width: '100%', maxWidth: '400px' }}>
                                I'm Ready (Stop Timer)
                            </button>
                        </div>
                    )}

                    {gameState === 'recall' && (
                        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                            <p style={{ marginBottom: '1rem', color: '#cbd5e1' }}>Fill in the words for each position:</p>
                            
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                                gap: '1rem',
                                fontSize: '1.1rem',
                                width: '100%',
                                marginBottom: '2rem'
                            }}>
                                {recallOrder.map((originalIdx) => (
                                    <div key={originalIdx} style={{ display: 'flex', flexDirection: 'column' }}>
                                        <label style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.25rem' }}>
                                            Word {originalIdx + 1}
                                        </label>
                                        <input
                                            type="text"
                                            className="input-field"
                                            style={{ width: '100%', padding: '0.5rem', fontFamily: 'inherit' }}
                                            value={userInputs[originalIdx]}
                                            onChange={(e) => {
                                                const newInputs = [...userInputs];
                                                newInputs[originalIdx] = e.target.value;
                                                setUserInputs(newInputs);
                                            }}
                                            autoFocus={recallOrder[0] === originalIdx}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    const currentIdx = recallOrder.indexOf(originalIdx);
                                                    if (currentIdx < recallOrder.length - 1) {
                                                        const nextInput = document.getElementById(`recall-input-${recallOrder[currentIdx + 1]}`);
                                                        if (nextInput) nextInput.focus();
                                                    } else {
                                                        finishGame();
                                                    }
                                                }
                                            }}
                                            id={`recall-input-${originalIdx}`}
                                        />
                                    </div>
                                ))}
                            </div>
                            
                            <button onClick={finishGame} className="btn btn-primary" style={{ width: '100%', maxWidth: '400px' }}>
                                Finish & Check
                            </button>
                        </div>
                    )}

                    {gameState === 'result' && (
                        <div className="animate-fade-in" style={{ width: '100%' }}>
                            {(() => {
                                const { correct, total, attemptedCount, accuracy, recallPercentage, comparison } = calculateScore();
                                return (
                                    <>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                                            <div className="glass" style={{ padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>Accuracy</div>
                                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: accuracy === 100 ? 'var(--success)' : 'var(--primary)' }}>
                                                    {accuracy.toFixed(1)}%
                                                </div>
                                                <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{correct} / {attemptedCount} Correct</div>
                                            </div>
                                            <div className="glass" style={{ padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>Recall %</div>
                                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent)' }}>
                                                    {recallPercentage.toFixed(1)}%
                                                </div>
                                                <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{attemptedCount} / {total} Attempted</div>
                                            </div>
                                            <div className="glass" style={{ padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>Memorize Time</div>
                                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{formatTime(memorizeDuration)}</div>
                                            </div>
                                            <div className="glass" style={{ padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>Recall Time</div>
                                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{formatTime(recallDuration)}</div>
                                            </div>
                                        </div>

                                        <h3 style={{ marginBottom: '1rem', color: '#cbd5e1' }}>Detailed Results:</h3>
                                        <div className="glass" style={{
                                            padding: '1.5rem',
                                            borderRadius: '1rem',
                                            marginBottom: '2rem',
                                            fontSize: '1.1rem',
                                            lineHeight: '1.8',
                                            maxHeight: '400px',
                                            overflowY: 'auto'
                                        }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                                                <div>Your Input</div>
                                                <div>Correct Word</div>
                                            </div>
                                            {comparison.map((item, idx) => (
                                                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.5rem', color: item.isCorrect ? 'var(--success)' : 'var(--error)' }}>
                                                    <div>{item.input || <span style={{ opacity: 0.3 }}>(empty)</span>}</div>
                                                    <div style={{ color: 'var(--foreground)', opacity: item.isCorrect ? 0.5 : 1 }}>{item.target}</div>
                                                </div>
                                            ))}
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                                            <button onClick={resetGame} className="btn btn-primary" style={{ width: '100%', maxWidth: '400px' }}>
                                                Try Again
                                            </button>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    )}
                </div>
            </main>
        </>
    );
}
