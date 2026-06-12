"use client";

import { useState } from 'react';
import PresetManager from '@/components/drill/PresetManager';
import { useDrillEngine } from '@/hooks/useDrillEngine';
import DrillShell from '@/components/drill/DrillShell';
import CountdownTimer from '@/components/drill/CountdownTimer';
import ResultsCard from '@/components/drill/ResultsCard';
import StatBox from '@/components/drill/StatBox';
import ToggleGroup from '@/components/drill/ToggleGroup';
import { generateDigits, formatTime, clamp } from '@/lib/drill-utils';

interface NumberWallConfig {
    digitCount: number;
    timeLimit: number; // seconds
    groupSize: 5 | 10;
}

export default function NumberWall() {
    const engine = useDrillEngine<NumberWallConfig>({
        gameType: 'number-wall',
        defaultConfig: { digitCount: 100, timeLimit: 300, groupSize: 5 }
    });
    const { phase, config, setConfig } = engine;

    const [digits, setDigits] = useState<string>("");
    const [userInput, setUserInput] = useState<string>("");

    const startGame = (count = config.digitCount, time = config.timeLimit) => {
        const sanitizedCount = clamp(count, 5, 1000);
        const sanitizedTime = clamp(time, 30, 3600);

        setDigits(generateDigits(sanitizedCount));
        setUserInput("");
        engine.start({
            config: { digitCount: sanitizedCount, timeLimit: sanitizedTime },
            memorizeSeconds: sanitizedTime
        });
    };

    // Score is the number of correct digits before the first error.
    const calculateScore = () => {
        const cleanInput = userInput.replace(/\s/g, '');
        let correctCount = 0;
        for (let i = 0; i < digits.length; i++) {
            if (i < cleanInput.length && cleanInput[i] === digits[i]) {
                correctCount++;
            } else {
                break;
            }
        }
        return correctCount;
    };

    const submitRecall = async () => {
        if (!digits.length || engine.saving) {
            console.warn('Tried to submit recall without generated digits.');
            if (!digits.length) engine.reset();
            return;
        }

        const correctCount = calculateScore();
        const cleanInput = userInput.replace(/\s/g, '');
        const attemptedCount = cleanInput.length;

        // Accuracy: Correct / Attempted; Recall %: Attempted / Total Target
        const accuracy = attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0;
        const recallPercentage = digits.length ? Math.round((attemptedCount / digits.length) * 100) : 0;

        await engine.finishRecall({
            count: config.digitCount,
            correct: correctCount,
            total: digits.length,
            percentage: accuracy,
            precision: accuracy,
            completeness: recallPercentage,
            accuracy,
            recallPercentage,
        });
    };

    // Formatting for display
    const formatDigitGroups = (allDigits: string, group: number) => {
        const chunks = [];
        for (let i = 0; i < allDigits.length; i += group) {
            chunks.push(allDigits.slice(i, i + group));
        }
        return chunks;
    };

    const cleanInputLength = userInput.replace(/\s/g, '').length;

    return (
        <DrillShell title="The Number Wall">
            {/* SETUP SCREEN */}
            {phase === 'setup' && (
                <div className="glass card animate-fade-in">
                    <h2 style={{ marginBottom: '1.5rem', fontSize: '1.2rem' }}>Configuration</h2>

                    <div style={{ display: 'grid', gap: '1.5rem', marginBottom: '2rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Digit Count</label>
                            <input
                                type="number"
                                className="input-field"
                                value={config.digitCount}
                                min={5}
                                max={1000}
                                onChange={(e) => {
                                    const nextValue = parseInt(e.target.value, 10);
                                    setConfig(prev => ({ ...prev, digitCount: Number.isNaN(nextValue) ? 0 : nextValue }));
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Time Limit (Seconds)</label>
                            <input
                                type="number"
                                className="input-field"
                                value={config.timeLimit}
                                min={30}
                                max={3600}
                                onChange={(e) => {
                                    const nextValue = parseInt(e.target.value, 10);
                                    setConfig(prev => ({ ...prev, timeLimit: Number.isNaN(nextValue) ? 0 : nextValue }));
                                }}
                            />
                            <div style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '0.25rem' }}>
                                {Math.floor(config.timeLimit / 60)} minutes {config.timeLimit % 60} seconds
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Group Size</label>
                            <ToggleGroup
                                options={[{ value: 5, label: '5 Digits' }, { value: 10, label: '10 Digits' }]}
                                value={config.groupSize}
                                onChange={(groupSize) => setConfig(prev => ({ ...prev, groupSize: groupSize as 5 | 10 }))}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
                        <button className="btn btn-primary" onClick={() => startGame()}>
                            Start Custom Game
                        </button>

                        <PresetManager
                            gameType="number-wall"
                            currentConfig={config}
                            onLoad={cfg => {
                                setConfig(prev => ({ ...prev, ...cfg }));
                                const c = cfg as Partial<NumberWallConfig>;
                                startGame(c.digitCount ?? config.digitCount, c.timeLimit ?? config.timeLimit);
                            }}
                        />
                    </div>
                </div>
            )}

            {/* MEMORIZE SCREEN */}
            {phase === 'memorize' && (
                <div className="animate-fade-in">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <CountdownTimer timeLeft={engine.timeLeft} />
                        <button className="btn btn-primary" onClick={engine.finishMemorize}>
                            Done Memorizing
                        </button>
                    </div>

                    <div className="glass card" style={{ minHeight: '300px', fontSize: '1.5rem', lineHeight: '2', letterSpacing: '2px', fontFamily: 'monospace' }}>
                        {formatDigitGroups(digits, config.groupSize).map((chunk, idx) => (
                            <span key={idx} style={{ marginRight: '1.5rem', display: 'inline-block' }}>
                                {chunk}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* RECALL SCREEN */}
            {phase === 'recall' && (
                <div className="animate-fade-in">
                    <div style={{ marginBottom: '1.5rem' }}>
                        <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Recall Phase</h2>
                        <p style={{ opacity: 0.7 }}>Type the digits you remember.</p>
                    </div>

                    <textarea
                        className="input-field"
                        style={{ minHeight: '300px', fontFamily: 'monospace', fontSize: '1.2rem', letterSpacing: '1px' }}
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        placeholder="Enter digits here..."
                        autoFocus
                    />

                    <div style={{ marginTop: '1.5rem' }}>
                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={submitRecall}>
                            Submit Recall
                        </button>
                    </div>
                </div>
            )}

            {/* RESULT SCREEN */}
            {phase === 'result' && (
                <ResultsCard saving={engine.saving} onNewGame={engine.reset}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                        <StatBox
                            label="Accuracy"
                            value={`${cleanInputLength > 0 ? Math.round((calculateScore() / cleanInputLength) * 100) : 0}%`}
                            sublabel={`${calculateScore()} / ${cleanInputLength} Correct`}
                            valueColor="var(--success)"
                        />
                        <StatBox
                            label="Recall %"
                            value={`${digits.length > 0 ? Math.round((cleanInputLength / digits.length) * 100) : 0}%`}
                            sublabel={`${cleanInputLength} / ${digits.length} Attempted`}
                        />
                        <StatBox
                            label="Memorization Time"
                            value={formatTime(engine.memorizeElapsed)}
                            span={2}
                        />
                    </div>

                    <div style={{ marginBottom: '2rem' }}>
                        <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Comparison</h3>
                        <div style={{ fontFamily: 'monospace', fontSize: '1rem', background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '0.5rem', overflowX: 'auto' }}>
                            <div style={{ marginBottom: '1rem' }}>
                                <div style={{ fontSize: '0.8rem', opacity: 0.5, marginBottom: '0.25rem' }}>Original:</div>
                                <div style={{ letterSpacing: '1px', wordBreak: 'break-all' }}>{digits}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.8rem', opacity: 0.5, marginBottom: '0.25rem' }}>Your Recall:</div>
                                <div style={{ letterSpacing: '1px', wordBreak: 'break-all' }}>
                                    {userInput.split('').map((char, i) => {
                                        let color = 'inherit';
                                        if (i >= digits.length) color = 'var(--error)';
                                        else if (char === digits[i]) color = 'var(--success)';
                                        else color = 'var(--error)';

                                        return <span key={i} style={{ color }}>{char}</span>;
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </ResultsCard>
            )}
        </DrillShell>
    );
}
