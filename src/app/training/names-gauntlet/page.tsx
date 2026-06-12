"use client";

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import Link from 'next/link';
import Image from 'next/image';
import { saveGameResult } from '@/lib/firebase';

type GameState = 'setup' | 'memorize' | 'recall' | 'result';

interface FaceData {
    id: number;
    imagePath: string;
    firstName: string;
    lastName: string;
}

const FIRST_NAMES = ["James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda", "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy", "Daniel", "Lisa", "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra", "Donald", "Ashley", "Steven", "Kimberly", "Paul", "Emily", "Andrew", "Donna", "Joshua", "Michelle"];
const LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores"];

export default function NamesGauntlet() {
    const [gameState, setGameState] = useState<GameState>('setup');

    // Settings
    const [faceCount, setFaceCount] = useState(20);
    const [timeLimit, setTimeLimit] = useState(300); // 5 minutes

    // Game Data
    const [faces, setFaces] = useState<FaceData[]>([]);
    const [recallInput, setRecallInput] = useState<{ [key: number]: { first: string, last: string } }>({});
    const [startTime, setStartTime] = useState<number>(0);
    const [endTime, setEndTime] = useState<number>(0);
    const [timeLeft, setTimeLeft] = useState(0);

    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const generateFaces = (count: number) => {
        const newFaces: FaceData[] = [];
        const usedIndices = new Set<number>();

        for (let i = 0; i < count; i++) {
            // Pick random image index (1-50)
            let imgIdx = Math.floor(Math.random() * 50) + 1;
            // Ensure unique images if possible, though with 50 images and high count it might overlap.
            // Let's try to be unique if count <= 50
            if (count <= 50) {
                while (usedIndices.has(imgIdx)) {
                    imgIdx = Math.floor(Math.random() * 50) + 1;
                }
                usedIndices.add(imgIdx);
            }

            const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
            const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];

            newFaces.push({
                id: i,
                imagePath: `/faces/face_${imgIdx}.jpg`,
                firstName: first,
                lastName: last
            });
        }
        return newFaces;
    };

    const startWeek3Challenge = () => {
        setFaceCount(40);
        setTimeLimit(300); // 5 minutes
        startGame(40, 300);
    };

    const startGame = (count = faceCount, time = timeLimit) => {
        const newFaces = generateFaces(count);
        setFaces(newFaces);
        setTimeLeft(time);
        setGameState('memorize');
        setStartTime(Date.now());
        setRecallInput({});
    };

    const finishMemorization = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setEndTime(Date.now());

        // Shuffle faces for recall
        const shuffled = [...faces].sort(() => Math.random() - 0.5);
        setFaces(shuffled);

        setGameState('recall');
    };

    const handleInputChange = (id: number, field: 'first' | 'last', value: string) => {
        setRecallInput(prev => ({
            ...prev,
            [id]: {
                ...prev[id],
                [field]: value
            }
        }));
    };

    const submitRecall = async () => {
        const correctCount = calculateScore();
        const memorizeTimeSeconds = Math.floor((endTime - startTime) / 1000);

        await saveGameResult({
            type: 'names-gauntlet',
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
        faces.forEach(face => {
            const input = recallInput[face.id] || { first: '', last: '' };
            if (input.first.trim().toLowerCase() === face.firstName.toLowerCase()) points++;
            if (input.last.trim().toLowerCase() === face.lastName.toLowerCase()) points++;
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
            <main className="container" style={{ maxWidth: '1000px' }}>

                <div style={{ marginBottom: '2rem' }}>
                    <Link href="/training" style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '0.5rem', display: 'inline-block' }}>
                        ← Back to Training
                    </Link>
                    <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>The Names Gauntlet</h1>
                </div>

                {gameState === 'setup' && (
                    <div className="glass card animate-fade-in">
                        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.2rem' }}>Configuration</h2>

                        <div style={{ display: 'grid', gap: '1.5rem', marginBottom: '2rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Number of Faces</label>
                                <input
                                    type="number"
                                    className="input-field"
                                    value={faceCount}
                                    onChange={(e) => setFaceCount(parseInt(e.target.value) || 0)}
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

                        <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
                            <button className="btn btn-primary" onClick={() => startGame()}>
                                Start Custom Game
                            </button>

                            <div style={{ borderTop: '1px solid var(--glass-border)', margin: '1rem 0' }}></div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 'bold' }}>Week 3 Challenge</h3>
                                    <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>40 Faces • 5 Minutes</p>
                                </div>
                                <button className="btn btn-secondary" onClick={startWeek3Challenge} style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
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

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1.5rem' }}>
                            {faces.map((face) => (
                                <div key={face.id} className="glass" style={{ padding: '0.5rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                                    <div style={{ position: 'relative', width: '100%', height: '150px', marginBottom: '0.5rem', borderRadius: '0.25rem', overflow: 'hidden' }}>
                                        <Image
                                            src={face.imagePath}
                                            alt="Face"
                                            fill
                                            style={{ objectFit: 'cover' }}
                                        />
                                    </div>
                                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{face.firstName}</div>
                                    <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>{face.lastName}</div>
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
                                <p style={{ opacity: 0.7 }}>Who are these people?</p>
                            </div>
                            <button className="btn btn-primary" onClick={submitRecall}>
                                Submit Recall
                            </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem' }}>
                            {faces.map((face) => (
                                <div key={face.id} className="glass" style={{ padding: '1rem', borderRadius: '0.5rem' }}>
                                    <div style={{ position: 'relative', width: '100%', height: '150px', marginBottom: '1rem', borderRadius: '0.25rem', overflow: 'hidden' }}>
                                        <Image
                                            src={face.imagePath}
                                            alt="Face"
                                            fill
                                            style={{ objectFit: 'cover' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <input
                                            type="text"
                                            placeholder="First Name"
                                            className="input-field"
                                            style={{ padding: '0.5rem' }}
                                            value={recallInput[face.id]?.first || ''}
                                            onChange={(e) => handleInputChange(face.id, 'first', e.target.value)}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Last Name"
                                            className="input-field"
                                            style={{ padding: '0.5rem' }}
                                            value={recallInput[face.id]?.last || ''}
                                            onChange={(e) => handleInputChange(face.id, 'last', e.target.value)}
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

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>Score</div>
                                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>
                                    {calculateScore()} / {faces.length * 2}
                                </div>
                                <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>1 point per correct name part</div>
                            </div>

                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>Memorization Time</div>
                                <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                                    {formatTime(Math.floor((endTime - startTime) / 1000))}
                                </div>
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
                                            <Image
                                                src={face.imagePath}
                                                alt="Face"
                                                fill
                                                style={{ objectFit: 'cover' }}
                                            />
                                        </div>
                                        <div style={{ fontSize: '0.9rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                                <span style={{ opacity: 0.6 }}>First:</span>
                                                <span style={{ color: firstCorrect ? 'var(--success)' : 'var(--error)' }}>
                                                    {input.first || '-'} {(!firstCorrect) && `(${face.firstName})`}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ opacity: 0.6 }}>Last:</span>
                                                <span style={{ color: lastCorrect ? 'var(--success)' : 'var(--error)' }}>
                                                    {input.last || '-'} {(!lastCorrect) && `(${face.lastName})`}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
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
