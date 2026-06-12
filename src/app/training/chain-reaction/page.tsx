"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import wordList from '@/data/words.json';
import { saveGameResult } from '@/lib/firebase';

type GamePhase = 'config' | 'encoding' | 'drill' | 'results';
type ItemType = 'words' | 'digits';

interface SequenceItem {
    value: string;
    type: 'word' | 'digit';
    index: number;
}

interface EncodingResult {
    item: SequenceItem;
    encodingTime: number; // Time taken to encode this item
}

interface ChainResult {
    fromItem: SequenceItem;
    toItem: SequenceItem;
    userInput: string;
    isCorrect: boolean;
    chainLatency: number; // Time from cue display to correct answer
    attemptCount: number; // Number of attempts before getting it right
}

const DIGIT_POOL = Array.from({ length: 100 }, (_, i) => i.toString().padStart(2, '0'));

export default function ChainReactionLatencyPage() {
    // Config
    const [sequenceLength, setSequenceLength] = useState(20);
    const [itemType, setItemType] = useState<ItemType>('digits');
    const [timedEncoding, setTimedEncoding] = useState(true);
    const [encodingPace, setEncodingPace] = useState(3000);

    // State
    const [phase, setPhase] = useState<GamePhase>('config');
    const [sequence, setSequence] = useState<SequenceItem[]>([]);
    const [currentEncodingIndex, setCurrentEncodingIndex] = useState(0);
    const [encodingResults, setEncodingResults] = useState<EncodingResult[]>([]);
    
    // Drill state
    const [currentDrillIndex, setCurrentDrillIndex] = useState(0);
    const [userInput, setUserInput] = useState('');
    const [chainResults, setChainResults] = useState<ChainResult[]>([]);
    const [attemptCount, setAttemptCount] = useState(0);
    
    // Timing refs
    const encodingStartRef = useRef<number>(0);
    const drillCueStartRef = useRef<number>(0);
    const encodingTimerRef = useRef<NodeJS.Timeout | null>(null);
    const [currentEncodingElapsed, setCurrentEncodingElapsed] = useState(0);

    const generateSequence = (): SequenceItem[] => {
        const items: SequenceItem[] = [];
        let digitPool = [...DIGIT_POOL];
        
        for (let i = 0; i < sequenceLength; i++) {
            let value = '';
            
            if (itemType === 'digits') {
                if (digitPool.length === 0) digitPool = [...DIGIT_POOL];
                const idx = Math.floor(Math.random() * digitPool.length);
                value = digitPool[idx];
                digitPool.splice(idx, 1);
            } else {
                const idx = Math.floor(Math.random() * wordList.length);
                value = wordList[idx];
            }
            
            items.push({
                value,
                type: itemType === 'digits' ? 'digit' : 'word',
                index: i
            });
        }
        
        return items;
    };

    const startEncoding = () => {
        const newSequence = generateSequence();
        setSequence(newSequence);
        setCurrentEncodingIndex(0);
        setEncodingResults([]);
        setPhase('encoding');
        encodingStartRef.current = Date.now();
    };

    // Encoding phase timer
    useEffect(() => {
        if (phase === 'encoding' && timedEncoding && currentEncodingIndex < sequence.length) {
            encodingTimerRef.current = setTimeout(() => {
                handleEncodingNext();
            }, encodingPace);
            
            return () => {
                if (encodingTimerRef.current) {
                    clearTimeout(encodingTimerRef.current);
                }
            };
        }
    }, [phase, currentEncodingIndex, timedEncoding, encodingPace, sequence.length]);

    // Live timer for untimed encoding
    useEffect(() => {
        if (phase === 'encoding' && !timedEncoding && currentEncodingIndex < sequence.length) {
            const interval = setInterval(() => {
                setCurrentEncodingElapsed(Date.now() - encodingStartRef.current);
            }, 100);
            return () => clearInterval(interval);
        }
    }, [phase, timedEncoding, currentEncodingIndex, sequence.length]);

    const handleEncodingNext = () => {
        const encodingTime = Date.now() - encodingStartRef.current;
        
        setEncodingResults(prev => [
            ...prev,
            {
                item: sequence[currentEncodingIndex],
                encodingTime
            }
        ]);
        
        if (currentEncodingIndex + 1 >= sequence.length) {
            startDrill();
        } else {
            setCurrentEncodingIndex(prev => prev + 1);
            encodingStartRef.current = Date.now();
            setCurrentEncodingElapsed(0);
        }
    };

    const startDrill = () => {
        setPhase('drill');
        setCurrentDrillIndex(0);
        setChainResults([]);
        setUserInput('');
        setAttemptCount(0);
        drillCueStartRef.current = Date.now();
    };

    const handleDrillSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        
        if (!userInput.trim()) return;
        
        const targetItem = sequence[currentDrillIndex + 1];
        const inputClean = userInput.trim().toLowerCase();
        const targetClean = targetItem.value.toLowerCase();
        const isCorrect = inputClean === targetClean;
        
        setAttemptCount(prev => prev + 1);
        
        if (isCorrect) {
            const chainLatency = Date.now() - drillCueStartRef.current;
            
            setChainResults(prev => [
                ...prev,
                {
                    fromItem: sequence[currentDrillIndex],
                    toItem: targetItem,
                    userInput: userInput.trim(),
                    isCorrect: true,
                    chainLatency,
                    attemptCount
                }
            ]);
            
            if (currentDrillIndex + 2 >= sequence.length) {
                // Finished
                setPhase('results');
            } else {
                setCurrentDrillIndex(prev => prev + 1);
                setUserInput('');
                setAttemptCount(0);
                drillCueStartRef.current = Date.now();
            }
        } else {
            // Wrong answer, let them try again
            setUserInput('');
        }
    };

    const calculateStats = () => {
        if (chainResults.length === 0) return null;
        
        const totalLatency = chainResults.reduce((sum, r) => sum + r.chainLatency, 0);
        const avgLatency = totalLatency / chainResults.length;
        
        const correctFirstTry = chainResults.filter(r => r.attemptCount === 0).length;
        const accuracy = (correctFirstTry / chainResults.length) * 100;
        
        const sortedByLatency = [...chainResults].sort((a, b) => b.chainLatency - a.chainLatency);
        const slowestTransitions = sortedByLatency.slice(0, 5);
        const fastestTransitions = [...chainResults].sort((a, b) => a.chainLatency - b.chainLatency).slice(0, 5);
        
        // Encoding stats
        const avgEncodingTime = encodingResults.reduce((sum, r) => sum + r.encodingTime, 0) / encodingResults.length;
        const slowestEncoded = [...encodingResults].sort((a, b) => b.encodingTime - a.encodingTime).slice(0, 5);
        
        return {
            avgLatency,
            accuracy,
            correctFirstTry,
            totalTransitions: chainResults.length,
            slowestTransitions,
            fastestTransitions,
            avgEncodingTime,
            slowestEncoded
        };
    };

    const stats = phase === 'results' ? calculateStats() : null;

    // Persist a summary once per finished run
    const resultSavedRef = useRef(false);
    useEffect(() => {
        if (phase === 'config') {
            resultSavedRef.current = false;
            return;
        }
        if (phase !== 'results' || resultSavedRef.current || chainResults.length === 0) return;
        resultSavedRef.current = true;

        const correctFirstTry = chainResults.filter(r => r.attemptCount === 0).length;
        const totalEncodingMs = encodingResults.reduce((sum, r) => sum + r.encodingTime, 0);
        const totalChainMs = chainResults.reduce((sum, r) => sum + r.chainLatency, 0);

        saveGameResult({
            type: 'chain-reaction',
            count: sequence.length,
            correct: correctFirstTry,
            total: chainResults.length,
            percentage: Math.round((correctFirstTry / chainResults.length) * 100),
            memorizeTime: Math.round(totalEncodingMs / 1000),
            recallTime: Math.round(totalChainMs / 1000),
            precision: Math.round((correctFirstTry / chainResults.length) * 100),
            completeness: Math.round((chainResults.length / sequence.length) * 100),
        }).catch(err => console.error('Failed to save chain-reaction result:', err));
    }, [phase, chainResults, encodingResults, sequence.length]);

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <h1 style={{ margin: 0 }}>⛓️ Chain Reaction Latency</h1>
                <Link href="/training" className="btn btn-secondary">← Back</Link>
            </div>

            {/* Main Content */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                {phase === 'config' && (
                    <div className="glass card" style={{ maxWidth: '600px', width: '100%', padding: '2rem' }}>
                        <h2 style={{ marginBottom: '1rem' }}>Configuration</h2>
                        <p style={{ fontSize: '0.9rem', opacity: 0.8, marginBottom: '1.5rem' }}>
                            Measure your system fluidity by testing how quickly you can transition between consecutive mnemonic images in a chain.
                        </p>

                        <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Sequence Length</label>
                                <input
                                    type="number"
                                    min={5}
                                    max={50}
                                    value={sequenceLength}
                                    onChange={(e) => setSequenceLength(parseInt(e.target.value) || 20)}
                                    style={{ width: '100%' }}
                                />
                                <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '0.25rem' }}>
                                    Challenge: 40 items, &lt;1.0s avg latency, 95%+ accuracy
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Item Type</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        className={`btn ${itemType === 'digits' ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setItemType('digits')}
                                        style={{ flex: 1 }}
                                    >
                                        2-Digit Numbers
                                    </button>
                                    <button
                                        className={`btn ${itemType === 'words' ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setItemType('words')}
                                        style={{ flex: 1 }}
                                    >
                                        Words
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Encoding Mode</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        className={`btn ${timedEncoding ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setTimedEncoding(true)}
                                        style={{ flex: 1 }}
                                    >
                                        Timed
                                    </button>
                                    <button
                                        className={`btn ${!timedEncoding ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setTimedEncoding(false)}
                                        style={{ flex: 1 }}
                                    >
                                        Untimed
                                    </button>
                                </div>
                            </div>

                            {timedEncoding && (
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Encoding Pace (seconds)</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={10}
                                        step={0.5}
                                        value={encodingPace / 1000}
                                        onChange={(e) => setEncodingPace((parseFloat(e.target.value) || 3) * 1000)}
                                        style={{ width: '100%' }}
                                    />
                                </div>
                            )}
                        </div>

                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={startEncoding}>
                            Start Encoding
                        </button>
                    </div>
                )}

                {phase === 'encoding' && sequence[currentEncodingIndex] && (
                    <div className="glass card" style={{ maxWidth: '700px', width: '100%', padding: '3rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '1rem' }}>
                            Encoding {currentEncodingIndex + 1} of {sequence.length}
                        </div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.5, marginBottom: '2rem' }}>
                            Create a vivid mnemonic image and link it to the previous one
                        </div>

                        <div style={{
                            fontSize: sequence[currentEncodingIndex].type === 'digit' ? '5rem' : '3rem',
                            fontWeight: 'bold',
                            marginBottom: '3rem',
                            minHeight: '120px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontFamily: sequence[currentEncodingIndex].type === 'digit' ? 'monospace' : 'inherit'
                        }}>
                            {sequence[currentEncodingIndex].value}
                        </div>

                        <button
                            className="btn btn-primary"
                            style={{ minWidth: '200px', fontSize: '1.2rem', padding: '1rem 2rem' }}
                            onClick={handleEncodingNext}
                        >
                            {timedEncoding ? 'Next' : 'Ready'}
                        </button>

                        {!timedEncoding && (
                            <div style={{ marginTop: '1rem', fontSize: '0.85rem', opacity: 0.6 }}>
                                Time: {(currentEncodingElapsed / 1000).toFixed(2)}s
                            </div>
                        )}
                    </div>
                )}

                {phase === 'drill' && (
                    <div className="glass card" style={{ maxWidth: '700px', width: '100%', padding: '3rem' }}>
                        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                            <div style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '0.5rem' }}>
                                Transition {currentDrillIndex + 1} of {sequence.length - 1}
                            </div>
                            <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>
                                Type the next item in the chain
                            </div>
                        </div>

                        <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.9rem', opacity: 0.6, marginBottom: '1rem' }}>Current Cue:</div>
                            <div style={{
                                fontSize: sequence[currentDrillIndex].type === 'digit' ? '4rem' : '2.5rem',
                                fontWeight: 'bold',
                                color: '#3b82f6',
                                fontFamily: sequence[currentDrillIndex].type === 'digit' ? 'monospace' : 'inherit'
                            }}>
                                {sequence[currentDrillIndex].value}
                            </div>
                        </div>

                        <form onSubmit={handleDrillSubmit} style={{ maxWidth: '400px', margin: '0 auto' }}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', textAlign: 'center' }}>
                                    What comes next?
                                </label>
                                <input
                                    autoFocus
                                    type="text"
                                    value={userInput}
                                    onChange={(e) => setUserInput(e.target.value)}
                                    placeholder="Type the next item..."
                                    style={{ width: '100%', textAlign: 'center', fontSize: '1.5rem', padding: '1rem' }}
                                />
                            </div>
                            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                                Submit
                            </button>
                            {attemptCount > 0 && (
                                <div style={{ marginTop: '1rem', color: '#ef4444', textAlign: 'center' }}>
                                    Incorrect. Try again! (Attempt {attemptCount + 1})
                                </div>
                            )}
                        </form>
                    </div>
                )}

                {phase === 'results' && stats && (
                    <div className="glass card" style={{ maxWidth: '900px', width: '100%', padding: '2rem' }}>
                        <h2 style={{ marginBottom: '2rem', textAlign: 'center' }}>Chain Reaction Results</h2>

                        {/* Key Metrics */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                            <div className="glass" style={{ padding: '1.5rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Avg Chain Latency</div>
                                <div style={{
                                    fontSize: '2.5rem',
                                    fontWeight: 'bold',
                                    color: stats.avgLatency < 1000 ? '#22c55e' : stats.avgLatency < 2000 ? '#eab308' : '#ef4444'
                                }}>
                                    {(stats.avgLatency / 1000).toFixed(2)}s
                                </div>
                            </div>
                            <div className="glass" style={{ padding: '1.5rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>First-Try Accuracy</div>
                                <div style={{
                                    fontSize: '2.5rem',
                                    fontWeight: 'bold',
                                    color: stats.accuracy >= 95 ? '#22c55e' : stats.accuracy >= 80 ? '#eab308' : '#ef4444'
                                }}>
                                    {stats.accuracy.toFixed(1)}%
                                </div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>
                                    {stats.correctFirstTry}/{stats.totalTransitions}
                                </div>
                            </div>
                            <div className="glass" style={{ padding: '1.5rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Avg Encoding Time</div>
                                <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>
                                    {(stats.avgEncodingTime / 1000).toFixed(2)}s
                                </div>
                            </div>
                        </div>

                        {stats.avgLatency < 1000 && stats.accuracy >= 95 && (
                            <div style={{
                                background: 'rgba(34, 197, 94, 0.1)',
                                border: '2px solid #22c55e',
                                borderRadius: '0.5rem',
                                padding: '1rem',
                                textAlign: 'center',
                                marginBottom: '2rem',
                                color: '#22c55e',
                                fontWeight: 'bold'
                            }}>
                                🎉 Challenge Complete! Excellent system fluidity!
                            </div>
                        )}

                        {/* Detailed Analysis */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                            <div>
                                <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#ef4444' }}>Slowest Transitions</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {stats.slowestTransitions.map((result, i) => (
                                        <div key={i} className="glass" style={{ padding: '0.75rem', fontSize: '0.85rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                                <span><strong>{result.fromItem.value}</strong> → <strong>{result.toItem.value}</strong></span>
                                                <span style={{ fontFamily: 'monospace', color: '#ef4444' }}>
                                                    {(result.chainLatency / 1000).toFixed(2)}s
                                                </span>
                                            </div>
                                            {result.attemptCount > 0 && (
                                                <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                                                    {result.attemptCount + 1} attempts
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#22c55e' }}>Fastest Transitions</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {stats.fastestTransitions.map((result, i) => (
                                        <div key={i} className="glass" style={{ padding: '0.75rem', fontSize: '0.85rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span><strong>{result.fromItem.value}</strong> → <strong>{result.toItem.value}</strong></span>
                                                <span style={{ fontFamily: 'monospace', color: '#22c55e' }}>
                                                    {(result.chainLatency / 1000).toFixed(2)}s
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Encoding Analysis */}
                        <div style={{ marginBottom: '2rem' }}>
                            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Slowest Encoded Items</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {stats.slowestEncoded.map((result, i) => (
                                    <div key={i} className="glass" style={{ padding: '0.75rem', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' }}>
                                        <span>#{result.item.index + 1}: <strong>{result.item.value}</strong></span>
                                        <span style={{ fontFamily: 'monospace' }}>
                                            {(result.encodingTime / 1000).toFixed(2)}s
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setPhase('config')}>
                                New Session
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
