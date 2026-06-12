"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import Header from '@/components/Header';
import Link from 'next/link';
import { saveGameResult } from '@/lib/firebase';

type GameState = 'setup' | 'playing' | 'result';

export default function NBack() {
    const [gameState, setGameState] = useState<GameState>('setup');

    // Settings
    const [nLevel, setNLevel] = useState(2);
    const [duration, setDuration] = useState(2500); // ms per turn (total cycle)
    const [totalTurns, setTotalTurns] = useState(20);
    const [mode, setMode] = useState<'position' | 'dual'>('dual'); // Default to Dual N-Back

    // Game Data
    const [positionSequence, setPositionSequence] = useState<number[]>([]); // 0-8
    const [audioSequence, setAudioSequence] = useState<string[]>([]); // Letters
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [isStimulusVisible, setIsStimulusVisible] = useState(false);

    // Scoring
    const [positionScore, setPositionScore] = useState({ correct: 0, wrong: 0, missed: 0 });
    const [audioScore, setAudioScore] = useState({ correct: 0, wrong: 0, missed: 0 });

    // User Actions for current turn
    const [actions, setActions] = useState({ position: false, audio: false });

    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef(0);

    // Audio letters
    const LETTERS = ['C', 'H', 'K', 'L', 'Q', 'R', 'S', 'T'];

    const generateSequences = (n: number, length: number) => {
        const posSeq: number[] = [];
        const audSeq: string[] = [];

        // Ensure we have some matches
        // Target match rate ~30%

        for (let i = 0; i < length; i++) {
            // Position
            let isPosMatch = false;
            if (i >= n) {
                // Force match if we are falling behind on match rate? 
                // Or just random chance. Let's do random chance but ensure at least 1 match if length > n
                isPosMatch = Math.random() < 0.3;
            }

            if (isPosMatch) {
                posSeq.push(posSeq[i - n]);
            } else {
                let val = Math.floor(Math.random() * 9);
                // Avoid accidental match
                if (i >= n && val === posSeq[i - n]) {
                    val = (val + 1) % 9;
                }
                posSeq.push(val);
            }

            // Audio
            let isAudMatch = false;
            if (i >= n) {
                isAudMatch = Math.random() < 0.3;
            }

            if (isAudMatch) {
                audSeq.push(audSeq[i - n]);
            } else {
                let val = LETTERS[Math.floor(Math.random() * LETTERS.length)];
                if (i >= n && val === audSeq[i - n]) {
                    // Pick another
                    const otherLetters = LETTERS.filter(l => l !== val);
                    val = otherLetters[Math.floor(Math.random() * otherLetters.length)];
                }
                audSeq.push(val);
            }
        }

        // Verify we have at least some matches, otherwise regenerate?
        // For short games this matters. For 20 turns, probability says we'll be fine.

        return { posSeq, audSeq };
    };

    const speakLetter = (letter: string) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel(); // Cancel any ongoing speech
            const u = new SpeechSynthesisUtterance(letter);
            u.rate = 1.5;
            window.speechSynthesis.speak(u);
        }
    };

    const startGame = () => {
        const { posSeq, audSeq } = generateSequences(nLevel, totalTurns);
        setPositionSequence(posSeq);
        setAudioSequence(audSeq);
        setCurrentIndex(0); // Start at index 0, useEffect will handle the loop
        setPositionScore({ correct: 0, wrong: 0, missed: 0 });
        setAudioScore({ correct: 0, wrong: 0, missed: 0 });
        setActions({ position: false, audio: false });
        setGameState('playing');
        startTimeRef.current = Date.now();
    };

    // This function is no longer used - using useEffect loop instead

    const scoreTurn = (index: number, posSeq: number[], audSeq: number[] | string[]) => {
        // We need to check actions state here. 
        // Since we are inside a closure created at start of turn, we can't see updated state?
        // Actually, we can't rely on state inside setTimeout closure.
        // We need to use Refs for actions to check them at the end of the turn.
    };

    // Ref approach for scoring
    const actionsRef = useRef({ position: false, audio: false });
    const currentIndexRef = useRef(-1);

    // Sync refs
    useEffect(() => { actionsRef.current = actions; }, [actions]);
    useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

    // Re-implement runTurn to use a separate effect for the loop to avoid closure hell?
    // Or just use the Refs inside the timeout.

    // Let's restart the logic with a clean useEffect loop driven by currentIndex

    useEffect(() => {
        if (gameState !== 'playing') return;
        if (currentIndex === -1) return; // Only skip if not started yet

        const posSeq = positionSequence;
        const audSeq = audioSequence;

        // 1. Show Stimulus
        setIsStimulusVisible(true);
        if (mode === 'dual') speakLetter(audSeq[currentIndex]);

        // 2. Hide Stimulus
        const hideTimer = setTimeout(() => {
            setIsStimulusVisible(false);
        }, 800); // 800ms visible

        // 3. End Turn & Score
        const endTimer = setTimeout(() => {
            // Score previous turn
            const idx = currentIndex;
            const isPosMatch = idx >= nLevel && posSeq[idx] === posSeq[idx - nLevel];
            const isAudMatch = mode === 'dual' && idx >= nLevel && audSeq[idx] === audSeq[idx - nLevel];

            const didPosAction = actionsRef.current.position;
            const didAudAction = actionsRef.current.audio;

            // Position Scoring
            if (isPosMatch) {
                if (didPosAction) setPositionScore(s => ({ ...s, correct: s.correct + 1 }));
                else setPositionScore(s => ({ ...s, missed: s.missed + 1 }));
            } else {
                if (didPosAction) setPositionScore(s => ({ ...s, wrong: s.wrong + 1 }));
            }

            // Audio Scoring
            if (mode === 'dual') {
                if (isAudMatch) {
                    if (didAudAction) setAudioScore(s => ({ ...s, correct: s.correct + 1 }));
                    else setAudioScore(s => ({ ...s, missed: s.missed + 1 }));
                } else {
                    if (didAudAction) setAudioScore(s => ({ ...s, wrong: s.wrong + 1 }));
                }
            }

            // Next turn
            if (idx + 1 < posSeq.length) {
                setCurrentIndex(idx + 1);
                setActions({ position: false, audio: false });
            } else {
                endGame();
            }

        }, duration);

        return () => {
            clearTimeout(hideTimer);
            clearTimeout(endTimer);
        };
    }, [currentIndex, gameState]); // Only depend on index changing to trigger next step


    const handleAction = useCallback((type: 'position' | 'audio') => {
        if (gameState !== 'playing') return;
        setActions(prev => ({ ...prev, [type]: true }));
    }, [gameState]);

    const endGame = async () => {
        setGameState('result');
        const timeTaken = (Date.now() - startTimeRef.current) / 1000;

        // Calculate stats
        // We need to know total possible matches to calculate percentage correctly
        let posMatches = 0;
        let audMatches = 0;
        for (let i = nLevel; i < positionSequence.length; i++) {
            if (positionSequence[i] === positionSequence[i - nLevel]) posMatches++;
            if (audioSequence[i] === audioSequence[i - nLevel]) audMatches++;
        }

        const posAcc = posMatches > 0 ? Math.round((positionScore.correct / posMatches) * 100) : 0;
        const audAcc = audMatches > 0 ? Math.round((audioScore.correct / audMatches) * 100) : 0;

        const totalMatches = mode === 'dual' ? posMatches + audMatches : posMatches;
        const totalCorrect = mode === 'dual' ? positionScore.correct + audioScore.correct : positionScore.correct;
        const totalPercentage = totalMatches > 0 ? Math.round((totalCorrect / totalMatches) * 100) : 0;

        await saveGameResult({
            type: 'n-back',
            count: nLevel,
            correct: totalCorrect,
            total: totalMatches,
            percentage: totalPercentage,
            memorizeTime: 0,
            recallTime: timeTaken,
            precision: totalPercentage,
            completeness: 100,
        });
    };

    // Keyboard
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
                handleAction('position');
            }
            if (e.code === 'KeyL' || e.code === 'ArrowRight') {
                handleAction('audio');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleAction]);

    return (
        <>
            <Header />
            <main className="container" style={{ maxWidth: '800px' }}>
                <div style={{ marginBottom: '2rem' }}>
                    <Link href="/training" style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '0.5rem', display: 'inline-block' }}>
                        ← Back to Training
                    </Link>
                    <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Dual N-Back</h1>
                    <p style={{ opacity: 0.7 }}>Position & Audio Memory</p>
                </div>

                {gameState === 'setup' && (
                    <div className="glass card animate-fade-in">
                        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.2rem' }}>Configuration</h2>

                        <div style={{ marginBottom: '2rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>N-Level (1-15)</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <input
                                    type="range"
                                    min="1"
                                    max="15"
                                    value={nLevel}
                                    onChange={(e) => setNLevel(parseInt(e.target.value))}
                                    style={{ flex: 1, accentColor: 'var(--primary)' }}
                                />
                                <span style={{ fontSize: '1.5rem', fontWeight: 'bold', width: '3rem', textAlign: 'center' }}>{nLevel}</span>
                            </div>
                        </div>

                        <div style={{ marginBottom: '2rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Mode</label>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button
                                    className={`btn ${mode === 'position' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setMode('position')}
                                    style={{ flex: 1 }}
                                >
                                    Position Only
                                </button>
                                <button
                                    className={`btn ${mode === 'dual' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setMode('dual')}
                                    style={{ flex: 1 }}
                                >
                                    Dual (Position + Audio)
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Speed (ms)</label>
                                <input
                                    type="number"
                                    className="input-field"
                                    value={duration}
                                    onChange={(e) => setDuration(parseInt(e.target.value))}
                                    step="100"
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Total Turns</label>
                                <input
                                    type="number"
                                    className="input-field"
                                    value={totalTurns}
                                    onChange={(e) => setTotalTurns(parseInt(e.target.value))}
                                />
                            </div>
                        </div>

                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={startGame}>
                            Start Game
                        </button>
                    </div>
                )}

                {gameState === 'playing' && (
                    <div className="animate-fade-in" style={{ textAlign: 'center' }}>
                        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', opacity: 0.7, fontSize: '0.9rem' }}>
                            <span>N = {nLevel}</span>
                            <span>Turn {currentIndex + 1} / {totalTurns}</span>
                        </div>

                        {/* 3x3 Grid */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '1rem',
                            maxWidth: '400px',
                            margin: '0 auto 2rem',
                            aspectRatio: '1/1'
                        }}>
                            {Array.from({ length: 9 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="glass"
                                    style={{
                                        borderRadius: '0.5rem',
                                        background: (isStimulusVisible && positionSequence[currentIndex] === i) ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                                        boxShadow: (isStimulusVisible && positionSequence[currentIndex] === i) ? '0 0 20px var(--primary)' : 'none',
                                        transition: 'background 0.1s, box-shadow 0.1s'
                                    }}
                                />
                            ))}
                        </div>

                        {/* Controls */}
                        <div style={{ display: 'grid', gridTemplateColumns: mode === 'dual' ? '1fr 1fr' : '1fr', gap: '1rem', maxWidth: '500px', margin: '0 auto' }}>
                            <button
                                className="btn"
                                style={{
                                    height: '3.5rem',
                                    fontSize: '0.9rem',
                                    background: actions.position ? 'var(--secondary)' : 'rgba(255,255,255,0.1)',
                                    border: '2px solid var(--primary)',
                                    color: 'white'
                                }}
                                onClick={() => handleAction('position')}
                            >
                                Position (A)
                            </button>

                            {mode === 'dual' && (
                                <button
                                    className="btn"
                                    style={{
                                        height: '3.5rem',
                                        fontSize: '0.9rem',
                                        background: actions.audio ? 'var(--secondary)' : 'rgba(255,255,255,0.1)',
                                        border: '2px solid var(--accent)',
                                        color: 'white'
                                    }}
                                    onClick={() => handleAction('audio')}
                                >
                                    Audio (L)
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {gameState === 'result' && (
                    <div className="glass card animate-fade-in">
                        <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', textAlign: 'center' }}>Session Complete</h2>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                            {/* Position Stats */}
                            <div>
                                <h3 style={{ borderBottom: '1px solid var(--primary)', paddingBottom: '0.5rem', marginBottom: '1rem', color: 'var(--primary)' }}>Position</h3>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <span>Correct:</span>
                                    <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>{positionScore.correct}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <span>Missed:</span>
                                    <span style={{ color: 'orange', fontWeight: 'bold' }}>{positionScore.missed}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Wrong:</span>
                                    <span style={{ color: 'var(--error)', fontWeight: 'bold' }}>{positionScore.wrong}</span>
                                </div>
                            </div>

                            {/* Audio Stats */}
                            {mode === 'dual' && (
                                <div>
                                    <h3 style={{ borderBottom: '1px solid var(--accent)', paddingBottom: '0.5rem', marginBottom: '1rem', color: 'var(--accent)' }}>Audio</h3>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <span>Correct:</span>
                                        <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>{audioScore.correct}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <span>Missed:</span>
                                        <span style={{ color: 'orange', fontWeight: 'bold' }}>{audioScore.missed}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Wrong:</span>
                                        <span style={{ color: 'var(--error)', fontWeight: 'bold' }}>{audioScore.wrong}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setGameState('setup')}>
                                Play Again
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
