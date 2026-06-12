"use client";

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import Link from 'next/link';
import Image from 'next/image';
import { saveGameResult } from '@/lib/firebase';
import { FACE_BANK, INTERNATIONAL_NAMES } from '@/data/imageBank';

type GameState = 'setup' | 'memorize' | 'recall' | 'result';

interface FaceData {
    id: number;
    imagePath: string;
    firstName: string;
    lastName: string;
    origin: string;
}

export default function InternationalNames() {
    const [gameState, setGameState] = useState<GameState>('setup');
    const [faceCount, setFaceCount] = useState(20);
    const [timeLimit, setTimeLimit] = useState(300);
    const [faces, setFaces] = useState<FaceData[]>([]);
    const [recallInput, setRecallInput] = useState<{ [key: number]: { first: string, last: string } }>({});
    const [startTime, setStartTime] = useState<number>(0);
    const [endTime, setEndTime] = useState<number>(0);
    const [timeLeft, setTimeLeft] = useState(0);

    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const generateFaces = (count: number) => {
        const selectedFaces: FaceData[] = [];
        const usedIndices = new Set<number>();

        for (let i = 0; i < count; i++) {
            // Pick random face from bank
            let faceIdx = Math.floor(Math.random() * FACE_BANK.length);
            while (usedIndices.has(faceIdx)) {
                faceIdx = Math.floor(Math.random() * FACE_BANK.length);
            }
            usedIndices.add(faceIdx);

            // Pick random name
            const nameIdx = Math.floor(Math.random() * INTERNATIONAL_NAMES.length);
            const name = INTERNATIONAL_NAMES[nameIdx];

            selectedFaces.push({
                id: i,
                imagePath: FACE_BANK[faceIdx].url,
                firstName: name.first,
                lastName: name.last,
                origin: name.origin
            });
        }
        return selectedFaces;
    };

    const startGame = () => {
        const newFaces = generateFaces(faceCount);
        setFaces(newFaces);
        setTimeLeft(timeLimit);
        setGameState('memorize');
        setStartTime(Date.now());
        setRecallInput({});
    };

    const finishMemorization = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setEndTime(Date.now());
        const shuffled = [...faces].sort(() => Math.random() - 0.5);
        setFaces(shuffled);
        setGameState('recall');
    };

    const handleInputChange = (id: number, field: 'first' | 'last', value: string) => {
        setRecallInput(prev => ({
            ...prev,
            [id]: { ...prev[id], [field]: value }
        }));
    };

    const calculateScore = () => {
        let points = 0;
        faces.forEach(face => {
            const input = recallInput[face.id] || { first: '', last: '' };
            if (input.first.trim().toLowerCase() === face.firstName.toLowerCase()) points++;
            if (input.last.trim().toLowerCase() === face.lastName.toLowerCase()) points++;
        });
        return points;
    };

    const submitRecall = async () => {
        const correctCount = calculateScore();
        const memorizeTimeSeconds = Math.floor((endTime - startTime) / 1000);

        await saveGameResult({
            type: 'names-international',
            count: faceCount,
            correct: correctCount,
            total: faceCount * 2,
            percentage: Math.round((correctCount / (faceCount * 2)) * 100),
            memorizeTime: memorizeTimeSeconds,
            recallTime: 0,
            precision: Math.round((correctCount / (faceCount * 2)) * 100),
            completeness: 100,
        });

        setGameState('result');
    };

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
                    <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>International Names</h1>
                </div>

                {gameState === 'setup' && (
                    <div className="glass card animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
                        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.2rem' }}>Configuration</h2>
                        <div style={{ display: 'grid', gap: '1.5rem', marginBottom: '2rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Number of Faces</label>
                                <input type="number" className="input-field" value={faceCount} onChange={(e) => setFaceCount(parseInt(e.target.value) || 0)} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Time Limit (Seconds)</label>
                                <input type="number" className="input-field" value={timeLimit} onChange={(e) => setTimeLimit(parseInt(e.target.value) || 0)} />
                            </div>
                        </div>
                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={startGame}>Start Game</button>
                    </div>
                )}

                {gameState === 'memorize' && (
                    <div className="animate-fade-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', position: 'sticky', top: '70px', zIndex: 10, background: 'var(--background)', padding: '1rem 0', borderBottom: '1px solid var(--glass-border)' }}>
                            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: timeLeft < 60 ? 'var(--error)' : 'var(--foreground)' }}>
                                Time Left: {formatTime(timeLeft)}
                            </div>
                            <button className="btn btn-primary" onClick={finishMemorization}>Done Memorizing</button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1.5rem' }}>
                            {faces.map((face) => (
                                <div key={face.id} className="glass" style={{ padding: '0.5rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                                    <div style={{ position: 'relative', width: '100%', height: '180px', marginBottom: '0.5rem', borderRadius: '0.25rem', overflow: 'hidden' }}>
                                        <Image src={face.imagePath} alt="Face" fill style={{ objectFit: 'cover' }} unoptimized />
                                    </div>
                                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{face.firstName}</div>
                                    <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>{face.lastName}</div>
                                    <div style={{ fontSize: '0.7rem', opacity: 0.5, marginTop: '0.2rem' }}>{face.origin}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {gameState === 'recall' && (
                    <div className="animate-fade-in">
                        <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2>Recall Phase</h2>
                            <button className="btn btn-primary" onClick={submitRecall}>Submit Recall</button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem' }}>
                            {faces.map((face) => (
                                <div key={face.id} className="glass" style={{ padding: '1rem', borderRadius: '0.5rem' }}>
                                    <div style={{ position: 'relative', width: '100%', height: '180px', marginBottom: '1rem', borderRadius: '0.25rem', overflow: 'hidden' }}>
                                        <Image src={face.imagePath} alt="Face" fill style={{ objectFit: 'cover' }} unoptimized />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <input type="text" placeholder="First Name" className="input-field" style={{ padding: '0.5rem' }} value={recallInput[face.id]?.first || ''} onChange={(e) => handleInputChange(face.id, 'first', e.target.value)} />
                                        <input type="text" placeholder="Last Name" className="input-field" style={{ padding: '0.5rem' }} value={recallInput[face.id]?.last || ''} onChange={(e) => handleInputChange(face.id, 'last', e.target.value)} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {gameState === 'result' && (
                    <div className="glass card animate-fade-in">
                        <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', textAlign: 'center' }}>Results</h2>
                        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>
                                {calculateScore()} / {faces.length * 2}
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                            {faces.map((face) => {
                                const input = recallInput[face.id] || { first: '', last: '' };
                                const firstCorrect = input.first.trim().toLowerCase() === face.firstName.toLowerCase();
                                const lastCorrect = input.last.trim().toLowerCase() === face.lastName.toLowerCase();
                                return (
                                    <div key={face.id} className="glass" style={{ padding: '1rem', borderRadius: '0.5rem', border: (firstCorrect && lastCorrect) ? '1px solid var(--success)' : '1px solid var(--glass-border)' }}>
                                        <div style={{ position: 'relative', width: '100%', height: '100px', marginBottom: '0.5rem', borderRadius: '0.25rem', overflow: 'hidden' }}>
                                            <Image src={face.imagePath} alt="Face" fill style={{ objectFit: 'cover' }} unoptimized />
                                        </div>
                                        <div style={{ fontSize: '0.9rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ opacity: 0.6 }}>First:</span>
                                                <span style={{ color: firstCorrect ? 'var(--success)' : 'var(--error)' }}>{input.first || '-'} {(!firstCorrect) && `(${face.firstName})`}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ opacity: 0.6 }}>Last:</span>
                                                <span style={{ color: lastCorrect ? 'var(--success)' : 'var(--error)' }}>{input.last || '-'} {(!lastCorrect) && `(${face.lastName})`}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setGameState('setup')}>New Game</button>
                    </div>
                )}
            </main>
        </>
    );
}
