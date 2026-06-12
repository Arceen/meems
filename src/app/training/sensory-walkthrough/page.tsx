"use client";

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import Link from 'next/link';
import { Palace, getImageVaultData, saveGameResult } from '@/lib/firebase';
import { SAMPLE_PALACES } from '@/data/sampleImageVault';

type GameState = 'loading' | 'setup' | 'question' | 'result';

interface SensoryPrompt {
    id: string;
    question: string;
    category: string;
}

interface QueueItem extends SensoryPrompt {
    location: string;
}

const MIN_REFLECTION_SECONDS = 15;

const QUESTION_BANK: SensoryPrompt[] = [
    { id: 'smell', question: 'What do you smell here?', category: 'Smell' },
    { id: 'sound', question: 'What is the dominant sound in this location?', category: 'Sound' },
    { id: 'texture', question: 'Describe the texture beneath your feet.', category: 'Touch' },
    { id: 'temperature', question: 'What temperature do you feel in the air?', category: 'Temperature' },
    { id: 'light', question: 'How is this space lit? Describe the light quality.', category: 'Vision' },
    { id: 'color', question: 'What color dominates this location?', category: 'Vision' },
    { id: 'motion', question: 'Is anything moving here? Describe it.', category: 'Motion' },
    { id: 'emotion', question: 'What emotion does this location evoke?', category: 'Emotion' },
    { id: 'taste', question: 'Is there any taste associated with this place?', category: 'Taste' },
];

const clonePalaces = (palaces: Palace[]) => palaces.map((palace) => ({ ...palace, locations: [...palace.locations] }));

export default function SensoryWalkthrough() {
    const [gameState, setGameState] = useState<GameState>('loading');
    const [palaces, setPalaces] = useState<Palace[]>([]);
    const [selectedPalaceId, setSelectedPalaceId] = useState<string>('');
    const [questionsPerLocation, setQuestionsPerLocation] = useState(5);
    const [questionQueue, setQuestionQueue] = useState<QueueItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [response, setResponse] = useState('');
    const [countdown, setCountdown] = useState(MIN_REFLECTION_SECONDS);
    const [answers, setAnswers] = useState<Array<QueueItem & { response: string; duration: number }>>([]);
    const [sessionStart, setSessionStart] = useState<number | null>(null);
    const [canAdvance, setCanAdvance] = useState(false);

    const countdownRef = useRef<NodeJS.Timeout | null>(null);
    const questionStartRef = useRef<number>(0);

    useEffect(() => {
        const loadPalaces = async () => {
            const data = await getImageVaultData();
            if (data && data.palaces && data.palaces.length > 0) {
                setPalaces(clonePalaces(data.palaces));
                setSelectedPalaceId(data.palaces[0].id);
            } else {
                const fallback = clonePalaces(SAMPLE_PALACES);
                setPalaces(fallback);
                setSelectedPalaceId(fallback[0]?.id || '');
            }
            setGameState('setup');
        };

        loadPalaces();
    }, []);

    useEffect(() => {
        if (gameState !== 'question') return;
        setCountdown(MIN_REFLECTION_SECONDS);
        setCanAdvance(false);
        questionStartRef.current = Date.now();
        if (countdownRef.current) clearInterval(countdownRef.current);

        countdownRef.current = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    if (countdownRef.current) clearInterval(countdownRef.current);
                    setCanAdvance(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (countdownRef.current) clearInterval(countdownRef.current);
        };
    }, [gameState, currentIndex]);

    const buildQueue = (palace: Palace) => {
        const queue: QueueItem[] = [];
        palace.locations.forEach((location) => {
            const shuffled = [...QUESTION_BANK].sort(() => Math.random() - 0.5);
            shuffled.slice(0, questionsPerLocation).forEach((prompt) => {
                queue.push({ ...prompt, location });
            });
        });
        return queue;
    };

    const startWalkthrough = () => {
        const palace = palaces.find((p) => p.id === selectedPalaceId);
        if (!palace || palace.locations.length === 0) return;
        const queue = buildQueue(palace);
        setQuestionQueue(queue);
        setCurrentIndex(0);
        setResponse('');
        setAnswers([]);
        setSessionStart(Date.now());
        setGameState('question');
    };

    const recordAnswer = (skip = false) => {
        if (questionQueue.length === 0) return;

        const item = questionQueue[currentIndex];
        const duration = (Date.now() - questionStartRef.current) / 1000;
        setAnswers((prev) => [...prev, { ...item, response: skip ? '' : response.trim(), duration }]);
        setResponse('');
        setCanAdvance(false);
        setCountdown(MIN_REFLECTION_SECONDS);

        if (currentIndex >= questionQueue.length - 1) {
            finishSession([...answers, { ...item, response: skip ? '' : response.trim(), duration }]);
        } else {
            setCurrentIndex((prev) => prev + 1);
        }
    };

    const finishSession = async (finalAnswers = answers) => {
        if (countdownRef.current) clearInterval(countdownRef.current);
        setGameState('result');
        setQuestionQueue(questionQueue);
        const total = questionQueue.length;
        const answered = finalAnswers.filter((a) => a.response.length > 0).length;
        const duration = sessionStart ? (Date.now() - sessionStart) / 1000 : 0;

        if (total > 0) {
            try {
                await saveGameResult({
                    type: 'sensory-walkthrough',
                    count: total,
                    correct: answered,
                    total,
                    percentage: Math.round((answered / total) * 100),
                    memorizeTime: duration,
                    recallTime: 0,
                    precision: Math.round((answered / total) * 100),
                    completeness: 100,
                });
            } catch (error) {
                console.error('Failed to save Sensory Walkthrough result:', error);
            }
        }
    };

    const reset = () => {
        if (countdownRef.current) clearInterval(countdownRef.current);
        setResponse('');
        setAnswers([]);
        setQuestionQueue([]);
        setGameState('setup');
    };

    if (gameState === 'loading') {
        return (
            <>
                <Header />
                <main className="container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
                    Loading palaces...
                </main>
            </>
        );
    }

    if (palaces.length === 0) {
        return (
            <>
                <Header />
                <main className="container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
                    <div className="glass card" style={{ padding: '2rem' }}>
                        <p>You need at least one Memory Palace to run this drill.</p>
                        <Link href="/training/image-vault" className="btn btn-primary" style={{ marginTop: '1rem' }}>
                            Build Palaces
                        </Link>
                    </div>
                </main>
            </>
        );
    }

    const currentItem = questionQueue[currentIndex];

    return (
        <>
            <Header />
            <main className="container" style={{ maxWidth: '950px' }}>
                <div style={{ marginBottom: '2rem' }}>
                    <Link href="/training" style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '0.5rem', display: 'inline-block' }}>
                        ← Back to Training
                    </Link>
                    <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Sensory Walkthrough</h1>
                    <p style={{ color: '#94a3b8', maxWidth: '600px' }}>
                        Deepen your palaces with forced sensory detail. No skips: spend at least 15 seconds immersing yourself before advancing.
                    </p>
                </div>

                {gameState === 'setup' && (
                    <div className="glass card animate-fade-in" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1' }}>Choose a Memory Palace</label>
                            <select
                                className="input-field"
                                value={selectedPalaceId}
                                onChange={(e) => setSelectedPalaceId(e.target.value)}
                            >
                                {palaces.map((palace) => (
                                    <option key={palace.id} value={palace.id}>
                                        {palace.name} ({palace.locations.length} locations)
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1' }}>Questions per Location</label>
                            <input
                                type="number"
                                min={3}
                                max={5}
                                className="input-field"
                                value={questionsPerLocation}
                                onChange={(e) => setQuestionsPerLocation(Math.max(3, Math.min(5, parseInt(e.target.value, 10) || 5)))}
                            />
                        </div>

                        <div style={{ background: 'rgba(15,23,42,0.6)', padding: '1rem', borderRadius: '0.75rem' }}>
                            <h3 style={{ margin: 0, color: '#cbd5e1' }}>Challenge Goal</h3>
                            <p style={{ margin: '0.5rem 0 0', color: '#94a3b8' }}>
                                Work through 30 locations with 5 questions each, no skips, and capture every sensory detail.
                            </p>
                        </div>

                        <button className="btn btn-primary" onClick={startWalkthrough} style={{ alignSelf: 'center', minWidth: '240px' }}>
                            Begin Walkthrough
                        </button>
                    </div>
                )}

                {gameState === 'question' && currentItem && (
                    <div className="glass card animate-fade-in" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                            <div>
                                <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>Location</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{currentItem.location}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>Question</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                                    {currentIndex + 1} / {questionQueue.length}
                                </div>
                            </div>
                        </div>

                        <div style={{ padding: '1.5rem', borderRadius: '1rem', background: 'rgba(255,255,255,0.05)', fontSize: '1.2rem', lineHeight: 1.6 }}>
                            {currentItem.question}
                        </div>

                        <div className="glass" style={{ padding: '1rem', borderRadius: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                            <div>
                                <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>Reflection Timer</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: countdown > 0 ? '#fbbf24' : 'var(--success)' }}>
                                    {countdown > 0 ? `${countdown}s` : 'Unlocked'}
                                </div>
                            </div>
                            <div style={{ fontSize: '0.9rem', color: '#94a3b8' }}>
                                Minimum {MIN_REFLECTION_SECONDS}s before advancing.
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1' }}>Answer / imagery notes</label>
                            <textarea
                                className="input-field"
                                rows={4}
                                value={response}
                                onChange={(e) => setResponse(e.target.value)}
                                placeholder="Describe smells, textures, sounds, emotions..."
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            <button
                                className="btn btn-primary"
                                style={{ flex: 1, minWidth: '180px' }}
                                disabled={!canAdvance}
                                onClick={() => recordAnswer(false)}
                            >
                                Lock In Detail
                            </button>
                            <button
                                className="btn btn-secondary"
                                style={{ flex: 1, minWidth: '180px' }}
                                disabled={!canAdvance}
                                onClick={() => recordAnswer(true)}
                            >
                                I Need to Skip
                            </button>
                        </div>
                    </div>
                )}

                {gameState === 'result' && (
                    <div className="glass card animate-fade-in" style={{ padding: '2rem' }}>
                        <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Immersion Report</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div className="glass" style={{ padding: '1rem', borderRadius: '0.75rem' }}>
                                <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Prompts Completed</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: answers.filter((a) => a.response).length === questionQueue.length ? 'var(--success)' : 'var(--accent)' }}>
                                    {answers.filter((a) => a.response).length} / {questionQueue.length}
                                </div>
                            </div>
                            <div className="glass" style={{ padding: '1rem', borderRadius: '0.75rem' }}>
                                <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Avg Reflection Time</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>
                                    {answers.length
                                        ? (answers.reduce((sum, entry) => sum + entry.duration, 0) / answers.length).toFixed(1)
                                        : '0.0'}{' '}
                                    s
                                </div>
                            </div>
                            <div className="glass" style={{ padding: '1rem', borderRadius: '0.75rem' }}>
                                <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Skipped Questions</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: answers.filter((a) => !a.response).length ? 'var(--error)' : 'var(--foreground)' }}>
                                    {answers.filter((a) => !a.response).length}
                                </div>
                            </div>
                        </div>

                        <div style={{ maxHeight: '320px', overflowY: 'auto', marginBottom: '1.5rem' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                <thead style={{ position: 'sticky', top: 0, background: 'rgba(15,23,42,0.95)' }}>
                                    <tr>
                                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Location</th>
                                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Prompt</th>
                                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Response</th>
                                        <th style={{ textAlign: 'center', padding: '0.5rem' }}>Time (s)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {answers.map((entry, idx) => (
                                        <tr key={`${entry.location}-${idx}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '0.5rem', fontWeight: 600 }}>{entry.location}</td>
                                            <td style={{ padding: '0.5rem', opacity: 0.8 }}>{entry.question}</td>
                                            <td style={{ padding: '0.5rem', color: entry.response ? '#e2e8f0' : '#64748b' }}>
                                                {entry.response || 'Skipped'}
                                            </td>
                                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                                {entry.duration.toFixed(1)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={reset}>
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

