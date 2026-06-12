"use client";

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import Link from 'next/link';
import { saveGameResult } from '@/lib/firebase';

type GameState = 'setup' | 'memorize' | 'recall' | 'result';

const CONCRETE_WORDS = ["Apple", "Chair", "Mountain", "Ocean", "Tree", "Book", "Car", "House", "Dog", "Cat", "Sun", "Moon", "Star", "River", "Bridge", "Phone", "Computer", "Flower", "Bird", "Fish", "Cloud", "Rain", "Snow", "Fire", "Water", "Stone", "Glass", "Metal", "Wood", "Paper"];
const ABSTRACT_WORDS = ["Freedom", "Justice", "Love", "Hope", "Faith", "Truth", "Beauty", "Wisdom", "Courage", "Peace", "Honor", "Pride", "Fear", "Joy", "Sadness", "Anger", "Trust", "Doubt", "Dream", "Memory", "Time", "Space", "Energy", "Power", "Knowledge", "Belief", "Reason", "Logic", "Chaos", "Order"];

export default function WordPalace() {
    const [gameState, setGameState] = useState<GameState>('setup');

    // Settings
    const [wordCount, setWordCount] = useState(40);
    const [timeLimit, setTimeLimit] = useState(300); // 5 minutes
    const [abstractPercentage, setAbstractPercentage] = useState(50); // % of abstract words

    const [recallMode, setRecallMode] = useState<'ordered' | 'unordered'>('ordered');

    // Game Data
    const [words, setWords] = useState<string[]>([]);
    const [userInputs, setUserInputs] = useState<string[]>([]);
    const [recallOrder, setRecallOrder] = useState<number[]>([]);
    const [startTime, setStartTime] = useState<number>(0);
    const [endTime, setEndTime] = useState<number>(0);
    const [timeLeft, setTimeLeft] = useState(0);

    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const generateWords = (count: number, abstractPct: number) => {
        const newWords: string[] = [];
        const abstractCount = Math.floor(count * abstractPct / 100);
        const concreteCount = count - abstractCount;

        // Pick abstract words
        const shuffledAbstract = [...ABSTRACT_WORDS].sort(() => Math.random() - 0.5);
        for (let i = 0; i < abstractCount && i < shuffledAbstract.length; i++) {
            newWords.push(shuffledAbstract[i]);
        }

        // Pick concrete words
        const shuffledConcrete = [...CONCRETE_WORDS].sort(() => Math.random() - 0.5);
        for (let i = 0; i < concreteCount && i < shuffledConcrete.length; i++) {
            newWords.push(shuffledConcrete[i]);
        }

        // Shuffle final list
        return newWords.sort(() => Math.random() - 0.5);
    };

    const startGame = (count = wordCount, time = timeLimit, abstractPct = abstractPercentage) => {
        const newWords = generateWords(count, abstractPct);
        setWords(newWords);
        setTimeLeft(time);
        
        let order = Array.from({ length: count }, (_, i) => i);
        if (recallMode === 'unordered') {
            order = order.sort(() => Math.random() - 0.5);
        }
        setRecallOrder(order);
        setUserInputs(Array(count).fill(""));

        setGameState('memorize');
        setStartTime(Date.now());
    };

    const finishMemorization = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setEndTime(Date.now());
        setGameState('recall');
    };

    const submitRecall = async () => {
        const correctCount = calculateScore();
        const memorizeTimeSeconds = Math.floor((endTime - startTime) / 1000);

        await saveGameResult({
            type: 'word-palace',
            count: wordCount,
            correct: correctCount,
            total: words.length,
            percentage: Math.round((correctCount / words.length) * 100),
            memorizeTime: memorizeTimeSeconds,
            recallTime: 0,
            precision: Math.round((correctCount / words.length) * 100),
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
        let correctCount = 0;
        words.forEach((word, idx) => {
            if (userInputs[idx] && userInputs[idx].trim().toLowerCase() === word.toLowerCase()) {
                correctCount++;
            }
        });
        return correctCount;
    };

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
                    <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Word-Palace Builder</h1>
                </div>

                {gameState === 'setup' && (
                    <div className="glass card animate-fade-in">
                        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.2rem' }}>Configuration</h2>

                        <div style={{ display: 'grid', gap: '1.5rem', marginBottom: '2rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Word Count</label>
                                <input
                                    type="number"
                                    className="input-field"
                                    value={wordCount}
                                    onChange={(e) => setWordCount(parseInt(e.target.value) || 0)}
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

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Abstract Words (%)</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={abstractPercentage}
                                    onChange={(e) => setAbstractPercentage(parseInt(e.target.value))}
                                    style={{ width: '100%' }}
                                />
                                <div style={{ textAlign: 'center', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                                    {abstractPercentage}% Abstract / {100 - abstractPercentage}% Concrete
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Recall Mode</label>
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

                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => startGame()}>
                            Start Game
                        </button>
                    </div>
                )}

                {gameState === 'memorize' && (
                    <div className="animate-fade-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: timeLeft < 60 ? 'var(--error)' : 'var(--foreground)' }}>
                                Time Left: {formatTime(timeLeft)}
                            </div>
                            <button className="btn btn-primary" onClick={finishMemorization}>
                                Done Memorizing
                            </button>
                        </div>

                        <div className="glass card" style={{ minHeight: '300px' }}>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                                gap: '1rem',
                                fontSize: '1.1rem'
                            }}>
                                {words.map((word, idx) => {
                                    const isAbstract = ABSTRACT_WORDS.includes(word);
                                    return (
                                        <div
                                            key={idx}
                                            style={{
                                                padding: '0.75rem',
                                                background: isAbstract ? 'rgba(139, 92, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                                                borderRadius: '0.5rem',
                                                textAlign: 'center',
                                                border: `1px solid ${isAbstract ? 'var(--accent)' : 'var(--success)'}`
                                            }}
                                        >
                                            <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.25rem' }}>
                                                {idx + 1}
                                            </div>
                                            {word}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {gameState === 'recall' && (
                    <div className="animate-fade-in">
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Recall Phase</h2>
                            <p style={{ opacity: 0.7 }}>Fill in the words for each position.</p>
                        </div>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                            gap: '1rem',
                            fontSize: '1.1rem'
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
                                                    submitRecall();
                                                }
                                            }
                                        }}
                                        id={`recall-input-${originalIdx}`}
                                    />
                                </div>
                            ))}
                        </div>

                        <div style={{ marginTop: '2rem' }}>
                            <button className="btn btn-primary" style={{ width: '100%' }} onClick={submitRecall}>
                                Submit Recall
                            </button>
                        </div>
                    </div>
                )}

                {gameState === 'result' && (
                    <div className="glass card animate-fade-in">
                        <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', textAlign: 'center' }}>Results</h2>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>Score</div>
                                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>
                                    {calculateScore()} / {words.length}
                                </div>
                                <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>Correct in sequence</div>
                            </div>

                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>Memorization Time</div>
                                <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                                    {formatTime(Math.floor((endTime - startTime) / 1000))}
                                </div>
                            </div>
                        </div>

                        <div style={{ marginBottom: '2rem' }}>
                            <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Comparison</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <div style={{ fontSize: '0.9rem', opacity: 0.6, marginBottom: '0.5rem' }}>Expected:</div>
                                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '0.5rem', minHeight: '200px' }}>
                                        {words.map((word, idx) => (
                                            <div key={idx} style={{ marginBottom: '0.25rem' }}>
                                                {idx + 1}. {word}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.9rem', opacity: 0.6, marginBottom: '0.5rem' }}>Your Recall:</div>
                                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '0.5rem', minHeight: '200px' }}>
                                        {words.map((word, idx) => {
                                            const userWord = userInputs[idx] || '';
                                            const isCorrect = userWord.trim().toLowerCase() === word.toLowerCase();
                                            return (
                                                <div key={idx} style={{ marginBottom: '0.25rem', color: isCorrect ? 'var(--success)' : 'var(--error)' }}>
                                                    {idx + 1}. {userWord || '(Empty)'}
                                                </div>
                                            );
                                        })}
                                    </div>
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
