"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { saveGameResult } from '@/lib/firebase';

type GamePhase = 'config' | 'encoding' | 'recall' | 'results';

interface EncodingItem {
    number: string;
    visualColor: string;
    visualObject: string;
    visualPosition: number; // 0-8 for 3x3 grid
}

interface RecallAnswer {
    numberAnswer: string;
    colorAnswer: string;
    objectAnswer: string;
    positionAnswer: number;
}

const COLORS = ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange', 'Pink', 'Cyan'];
const OBJECTS = ['Star', 'Circle', 'Square', 'Triangle', 'Heart', 'Diamond', 'Pentagon', 'Hexagon'];
const COLOR_HEX: { [key: string]: string } = {
    'Red': '#ef4444',
    'Blue': '#3b82f6',
    'Green': '#22c55e',
    'Yellow': '#eab308',
    'Purple': '#a855f7',
    'Orange': '#f97316',
    'Pink': '#ec4899',
    'Cyan': '#06b6d4'
};

export default function FocusShifterPage() {
    const [phase, setPhase] = useState<GamePhase>('config');
    const [sequenceLength, setSequenceLength] = useState(10);
    const [itemDuration, setItemDuration] = useState(2.5);
    const [distractionMode, setDistractionMode] = useState(false);
    
    const [sequence, setSequence] = useState<EncodingItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<RecallAnswer[]>([]);
    const [currentRecallIndex, setCurrentRecallIndex] = useState(0);
    
    const [numberInput, setNumberInput] = useState('');
    const [colorInput, setColorInput] = useState('');
    const [objectInput, setObjectInput] = useState('');
    const [positionInput, setPositionInput] = useState(-1);
    
    const [startTime, setStartTime] = useState<number | null>(null);
    const [totalTime, setTotalTime] = useState(0);
    
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const generateSequence = () => {
        const newSequence: EncodingItem[] = [];
        for (let i = 0; i < sequenceLength; i++) {
            newSequence.push({
                number: String(Math.floor(Math.random() * 900) + 100), // 3-digit number
                visualColor: COLORS[Math.floor(Math.random() * COLORS.length)],
                visualObject: OBJECTS[Math.floor(Math.random() * OBJECTS.length)],
                visualPosition: Math.floor(Math.random() * 9)
            });
        }
        return newSequence;
    };

    const startGame = () => {
        const newSequence = generateSequence();
        setSequence(newSequence);
        setCurrentIndex(0);
        setAnswers([]);
        setPhase('encoding');
        setStartTime(Date.now());
        
        if (distractionMode && audioRef.current) {
            audioRef.current.play();
        }
    };

    useEffect(() => {
        if (phase === 'encoding' && currentIndex < sequence.length) {
            const timer = setTimeout(() => {
                setCurrentIndex(prev => prev + 1);
            }, itemDuration * 1000);
            return () => clearTimeout(timer);
        } else if (phase === 'encoding' && currentIndex >= sequence.length) {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
            setPhase('recall');
            setCurrentRecallIndex(0);
        }
    }, [phase, currentIndex, sequence.length, itemDuration]);

    const submitRecallAnswer = () => {
        const newAnswer: RecallAnswer = {
            numberAnswer: numberInput,
            colorAnswer: colorInput,
            objectAnswer: objectInput,
            positionAnswer: positionInput
        };
        
        setAnswers([...answers, newAnswer]);
        setNumberInput('');
        setColorInput('');
        setObjectInput('');
        setPositionInput(-1);
        
        if (currentRecallIndex + 1 >= sequence.length) {
            setTotalTime(Date.now() - (startTime || Date.now()));
            setPhase('results');
        } else {
            setCurrentRecallIndex(prev => prev + 1);
        }
    };

    const calculateResults = () => {
        let correctNumbers = 0;
        let correctColors = 0;
        let correctObjects = 0;
        let correctPositions = 0;

        answers.forEach((answer, idx) => {
            const item = sequence[idx];
            if (answer.numberAnswer === item.number) correctNumbers++;
            if (answer.colorAnswer.toLowerCase() === item.visualColor.toLowerCase()) correctColors++;
            if (answer.objectAnswer.toLowerCase() === item.visualObject.toLowerCase()) correctObjects++;
            if (answer.positionAnswer === item.visualPosition) correctPositions++;
        });

        const totalQuestions = sequence.length * 4;
        const totalCorrect = correctNumbers + correctColors + correctObjects + correctPositions;
        const accuracy = (totalCorrect / totalQuestions) * 100;

        return {
            correctNumbers,
            correctColors,
            correctObjects,
            correctPositions,
            totalCorrect,
            totalQuestions,
            accuracy
        };
    };

    const getGridPosition = (pos: number) => {
        const row = Math.floor(pos / 3);
        const col = pos % 3;
        return { row, col };
    };

    const currentItem = sequence[currentIndex];
    const results = phase === 'results' ? calculateResults() : null;

    // Persist a summary once per finished run
    const resultSavedRef = useRef(false);
    useEffect(() => {
        if (phase === 'config') {
            resultSavedRef.current = false;
            return;
        }
        if (phase !== 'results' || resultSavedRef.current || answers.length === 0 || sequence.length === 0) return;
        resultSavedRef.current = true;

        let totalCorrect = 0;
        answers.forEach((answer, idx) => {
            const item = sequence[idx];
            if (answer.numberAnswer === item.number) totalCorrect++;
            if (answer.colorAnswer.toLowerCase() === item.visualColor.toLowerCase()) totalCorrect++;
            if (answer.objectAnswer.toLowerCase() === item.visualObject.toLowerCase()) totalCorrect++;
            if (answer.positionAnswer === item.visualPosition) totalCorrect++;
        });
        const totalQuestions = sequence.length * 4;

        saveGameResult({
            type: 'focus-shifter',
            count: sequence.length,
            correct: totalCorrect,
            total: totalQuestions,
            percentage: Math.round((totalCorrect / totalQuestions) * 100),
            memorizeTime: Math.round(sequence.length * itemDuration),
            recallTime: Math.round(totalTime / 1000),
            precision: Math.round((totalCorrect / totalQuestions) * 100),
            completeness: 100,
        }).catch(err => console.error('Failed to save focus-shifter result:', err));
    }, [phase, answers, sequence, itemDuration, totalTime]);

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <h1 style={{ margin: 0 }}>🎯 Focus Shifter</h1>
                <Link href="/training" className="btn btn-secondary">← Back</Link>
            </div>

            {/* Audio for distraction mode */}
            {distractionMode && (
                <audio ref={audioRef} loop>
                    <source src="/audio/ambient-city.mp3" type="audio/mpeg" />
                </audio>
            )}

            {/* Main Content */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                {phase === 'config' && (
                    <div className="glass card" style={{ maxWidth: '500px', width: '100%', padding: '2rem' }}>
                        <h2 style={{ marginBottom: '1rem' }}>Configuration</h2>
                        <p style={{ fontSize: '0.9rem', opacity: 0.8, marginBottom: '1.5rem' }}>
                            Rapidly switch between processing numbers and visual-spatial information to improve concentration and cognitive flexibility.
                        </p>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Sequence Length</label>
                            <input
                                type="number"
                                min={5}
                                max={50}
                                value={sequenceLength}
                                onChange={(e) => setSequenceLength(parseInt(e.target.value) || 10)}
                                style={{ width: '100%' }}
                            />
                            <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '0.25rem' }}>
                                Challenge: 30 items at 90%+ accuracy
                            </div>
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Item Duration (seconds)</label>
                            <input
                                type="number"
                                min={1}
                                max={10}
                                step={0.5}
                                value={itemDuration}
                                onChange={(e) => setItemDuration(parseFloat(e.target.value) || 2.5)}
                                style={{ width: '100%' }}
                            />
                            <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '0.25rem' }}>
                                Challenge: 2.5 seconds per item
                            </div>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={distractionMode}
                                    onChange={(e) => setDistractionMode(e.target.checked)}
                                />
                                <span>Enable Distraction Mode (ambient sounds)</span>
                            </label>
                        </div>

                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={startGame}>
                            Start Game
                        </button>
                    </div>
                )}

                {phase === 'encoding' && currentItem && (
                    <div style={{ width: '100%', maxWidth: '900px' }}>
                        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                            <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>
                                Item {currentIndex + 1} of {sequence.length}
                            </div>
                            <div style={{ fontSize: '0.8rem', opacity: 0.5, marginTop: '0.25rem' }}>
                                Encode both the number and the visual object
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                            {/* Zone 1: Abstract Number */}
                            <div className="glass card" style={{ padding: '3rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '1rem' }}>ZONE 1: NUMBER</div>
                                <div style={{ fontSize: '4rem', fontWeight: 'bold', color: '#3b82f6' }}>
                                    {currentItem.number}
                                </div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '1rem' }}>
                                    Convert to PAO/Major image
                                </div>
                            </div>

                            {/* Zone 2: Visual/Spatial */}
                            <div className="glass card" style={{ padding: '3rem' }}>
                                <div style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '1rem', textAlign: 'center' }}>ZONE 2: VISUAL</div>
                                
                                {/* 3x3 Grid */}
                                <div style={{ 
                                    display: 'grid', 
                                    gridTemplateColumns: 'repeat(3, 1fr)', 
                                    gap: '0.5rem',
                                    marginBottom: '1rem'
                                }}>
                                    {[...Array(9)].map((_, idx) => {
                                        const isTarget = idx === currentItem.visualPosition;
                                        return (
                                            <div
                                                key={idx}
                                                style={{
                                                    aspectRatio: '1',
                                                    border: '2px solid rgba(255,255,255,0.2)',
                                                    borderRadius: '0.5rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    background: isTarget ? COLOR_HEX[currentItem.visualColor] : 'rgba(0,0,0,0.2)',
                                                    fontSize: '2rem'
                                                }}
                                            >
                                                {isTarget && getObjectEmoji(currentItem.visualObject)}
                                            </div>
                                        );
                                    })}
                                </div>

                                <div style={{ textAlign: 'center', fontSize: '0.9rem' }}>
                                    <div style={{ color: COLOR_HEX[currentItem.visualColor], fontWeight: 'bold' }}>
                                        {currentItem.visualColor} {currentItem.visualObject}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '0.5rem' }}>
                                        Position: Row {Math.floor(currentItem.visualPosition / 3) + 1}, Col {(currentItem.visualPosition % 3) + 1}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {phase === 'recall' && (
                    <div className="glass card" style={{ maxWidth: '600px', width: '100%', padding: '2rem' }}>
                        <h2 style={{ marginBottom: '1rem' }}>Recall Item {currentRecallIndex + 1}</h2>
                        
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>What was the 3-digit number?</label>
                            <input
                                type="text"
                                value={numberInput}
                                onChange={(e) => setNumberInput(e.target.value)}
                                placeholder="e.g., 416"
                                style={{ width: '100%' }}
                                maxLength={3}
                            />
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>What was the color?</label>
                            <select
                                value={colorInput}
                                onChange={(e) => setColorInput(e.target.value)}
                                style={{ width: '100%' }}
                            >
                                <option value="">Select color...</option>
                                {COLORS.map(color => (
                                    <option key={color} value={color}>{color}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>What was the object?</label>
                            <select
                                value={objectInput}
                                onChange={(e) => setObjectInput(e.target.value)}
                                style={{ width: '100%' }}
                            >
                                <option value="">Select object...</option>
                                {OBJECTS.map(obj => (
                                    <option key={obj} value={obj}>{obj}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>What was the position?</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                                {[...Array(9)].map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setPositionInput(idx)}
                                        className={positionInput === idx ? 'btn btn-primary' : 'btn btn-secondary'}
                                        style={{ aspectRatio: '1', fontSize: '0.8rem' }}
                                    >
                                        {idx + 1}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            className="btn btn-primary"
                            style={{ width: '100%' }}
                            onClick={submitRecallAnswer}
                            disabled={!numberInput || !colorInput || !objectInput || positionInput === -1}
                        >
                            {currentRecallIndex + 1 === sequence.length ? 'Finish' : 'Next'}
                        </button>
                    </div>
                )}

                {phase === 'results' && results && (
                    <div className="glass card" style={{ maxWidth: '700px', width: '100%', padding: '2rem' }}>
                        <h2 style={{ marginBottom: '1rem' }}>Results</h2>
                        
                        <div style={{ 
                            fontSize: '3rem', 
                            fontWeight: 'bold', 
                            textAlign: 'center', 
                            marginBottom: '2rem',
                            color: results.accuracy >= 90 ? '#22c55e' : results.accuracy >= 70 ? '#eab308' : '#ef4444'
                        }}>
                            {results.accuracy.toFixed(1)}%
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                            <div className="glass" style={{ padding: '1rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Numbers</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                                    {results.correctNumbers}/{sequence.length}
                                </div>
                            </div>
                            <div className="glass" style={{ padding: '1rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Colors</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                                    {results.correctColors}/{sequence.length}
                                </div>
                            </div>
                            <div className="glass" style={{ padding: '1rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Objects</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                                    {results.correctObjects}/{sequence.length}
                                </div>
                            </div>
                            <div className="glass" style={{ padding: '1rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Positions</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                                    {results.correctPositions}/{sequence.length}
                                </div>
                            </div>
                        </div>

                        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                            <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>
                                Time: {(totalTime / 1000).toFixed(1)}s
                            </div>
                            {results.accuracy >= 90 && (
                                <div style={{ color: '#22c55e', marginTop: '0.5rem', fontWeight: 'bold' }}>
                                    🎉 Challenge Complete! Excellent focus!
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setPhase('config')}>
                                New Game
                            </button>
                            <Link href="/training" className="btn btn-primary" style={{ flex: 1, textAlign: 'center' }}>
                                Back to Training
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function getObjectEmoji(object: string): string {
    const emojiMap: { [key: string]: string } = {
        'Star': '⭐',
        'Circle': '⚫',
        'Square': '⬛',
        'Triangle': '🔺',
        'Heart': '❤️',
        'Diamond': '💎',
        'Pentagon': '⬟',
        'Hexagon': '⬡'
    };
    return emojiMap[object] || '●';
}
