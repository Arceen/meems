"use client";

import { useState, useEffect, useRef } from 'react';
import { useDrillEngine } from '@/hooks/useDrillEngine';
import DrillShell from '@/components/drill/DrillShell';
import ResultsCard from '@/components/drill/ResultsCard';
import StatBox from '@/components/drill/StatBox';
import PresetManager from '@/components/drill/PresetManager';
import { generateDigits } from '@/lib/drill-utils';

interface Config {
    digitCount: number;
    pace: number;
    groupSize: 1 | 2;
}

const DEFAULT_CONFIG: Config = { digitCount: 50, pace: 1.0, groupSize: 2 };

export default function SpokenNumbers() {
    const engine = useDrillEngine<Config>({ gameType: 'spoken-numbers', defaultConfig: DEFAULT_CONFIG });
    const { phase, config, setConfig } = engine;

    const [digits, setDigits] = useState('');
    const [userInput, setUserInput] = useState('');
    const [currentIndex, setCurrentIndex] = useState(0);

    const synthRef = useRef<SpeechSynthesis | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') synthRef.current = window.speechSynthesis;
        return () => stopSpeaking();
    }, []);

    const stopSpeaking = () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        synthRef.current?.cancel();
    };

    const startDrill = (overrideConfig?: Partial<Config>) => {
        const cfg = { ...config, ...overrideConfig };
        const newDigits = generateDigits(cfg.digitCount);
        setDigits(newDigits);
        setUserInput('');
        setCurrentIndex(0);
        engine.start({ config: overrideConfig });

        // Build groups and speak them at the configured pace
        const chunks: string[] = [];
        for (let i = 0; i < newDigits.length; i += cfg.groupSize) {
            chunks.push(newDigits.slice(i, i + cfg.groupSize));
        }

        let i = 0;
        setTimeout(() => {
            intervalRef.current = setInterval(() => {
                if (i >= chunks.length) {
                    stopSpeaking();
                    engine.finishMemorize();
                    return;
                }
                setCurrentIndex(i);
                const utterance = new SpeechSynthesisUtterance(chunks[i].split('').join(' '));
                utterance.rate = 1.2;
                synthRef.current?.speak(utterance);
                i++;
            }, cfg.pace * 1000);
        }, 1000);
    };

    const submitRecall = async () => {
        const cleanInput = userInput.replace(/\s/g, '');
        let correct = 0;
        for (let i = 0; i < digits.length; i++) {
            if (i < cleanInput.length && cleanInput[i] === digits[i]) correct++;
        }
        await engine.finishRecall({
            count: config.digitCount,
            correct,
            total: digits.length,
            percentage: Math.round((correct / digits.length) * 100),
            precision: Math.round((correct / digits.length) * 100),
            completeness: 100,
        });
    };

    const correctCount = () => {
        const cleanInput = userInput.replace(/\s/g, '');
        let c = 0;
        for (let i = 0; i < digits.length; i++) {
            if (i < cleanInput.length && cleanInput[i] === digits[i]) c++;
        }
        return c;
    };

    const totalGroups = Math.ceil(config.digitCount / config.groupSize);

    return (
        <DrillShell title="Spoken Number Terror">
            {/* ── SETUP ─────────────────────────────────────────────── */}
            {phase === 'setup' && (
                <div style={{ maxWidth: '520px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.8, fontSize: '0.9rem' }}>Total Digits</label>
                            <input type="number" className="input-field"
                                value={config.digitCount} min={10} max={500}
                                onChange={e => setConfig(c => ({ ...c, digitCount: parseInt(e.target.value) || 50 }))}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.8, fontSize: '0.9rem' }}>
                                Pace: {config.pace}s per group
                            </label>
                            <input type="range" min={0.5} max={3} step={0.1}
                                value={config.pace}
                                onChange={e => setConfig(c => ({ ...c, pace: parseFloat(e.target.value) }))}
                                style={{ width: '100%' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', opacity: 0.5 }}>
                                <span>0.5s (fast)</span><span>3s (slow)</span>
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.8, fontSize: '0.9rem' }}>Grouping</label>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                {([1, 2] as const).map(g => (
                                    <button key={g}
                                        className={`btn ${config.groupSize === g ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setConfig(c => ({ ...c, groupSize: g }))}
                                        style={{ flex: 1 }}>
                                        {g} Digit{g > 1 ? 's' : ''}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <PresetManager
                        gameType="spoken-numbers"
                        currentConfig={config}
                        onLoad={cfg => {
                            setConfig(c => ({ ...c, ...cfg }));
                            startDrill(cfg as Partial<Config>);
                        }}
                    />

                    <button className="btn btn-primary" style={{ padding: '0.85rem', fontSize: '1.1rem' }}
                        onClick={() => startDrill()}>
                        Start ({config.digitCount} digits at {config.pace}s / group)
                    </button>
                </div>
            )}

            {/* ── MEMORIZE (AUDIO) ──────────────────────────────────── */}
            {phase === 'memorize' && (
                <div style={{ maxWidth: '480px', margin: '0 auto', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${((currentIndex + 1) / totalGroups) * 100}%`, background: 'var(--primary)', transition: 'width 0.3s' }} />
                    </div>

                    <p style={{ opacity: 0.6, fontSize: '0.9rem' }}>Group {currentIndex + 1} / {totalGroups}</p>

                    <div className="glass-panel" style={{
                        width: '150px', height: '150px', margin: '0 auto', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'var(--primary)', boxShadow: '0 0 50px rgba(99,102,241,0.4)',
                    }}>
                        <span style={{ fontSize: '3rem' }}>🔊</span>
                    </div>

                    <p style={{ fontSize: '1.1rem', opacity: 0.7 }}>Listen carefully…</p>

                    <button className="btn btn-secondary"
                        onClick={() => { stopSpeaking(); engine.reset(); }}>
                        Cancel
                    </button>
                </div>
            )}

            {/* ── RECALL ────────────────────────────────────────────── */}
            {phase === 'recall' && (
                <div style={{ maxWidth: '520px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <h2 style={{ fontSize: '1.1rem', marginBottom: '0' }}>Enter the digits you heard</h2>
                    <textarea
                        className="input-field"
                        style={{ minHeight: '220px', fontFamily: 'monospace', fontSize: '1.2rem', letterSpacing: '1px' }}
                        value={userInput}
                        onChange={e => setUserInput(e.target.value)}
                        placeholder="Enter digits…"
                        autoFocus
                    />
                    <button className="btn btn-primary" style={{ padding: '0.85rem' }} onClick={submitRecall}
                        disabled={engine.saving}>
                        {engine.saving ? 'Saving…' : 'Submit Recall'}
                    </button>
                </div>
            )}

            {/* ── RESULT ────────────────────────────────────────────── */}
            {phase === 'result' && (
                <div style={{ maxWidth: '520px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <StatBox label="Score" value={`${correctCount()} / ${digits.length}`} valueColor="var(--success)" />
                        <StatBox label="Pace" value={`${config.pace}s / ${config.groupSize}`} />
                    </div>

                    <div>
                        <p style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '0.5rem' }}>Comparison</p>
                        <div style={{ fontFamily: 'monospace', fontSize: '1rem', background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '0.5rem', wordBreak: 'break-all' }}>
                            <div style={{ marginBottom: '0.75rem' }}>
                                <span style={{ opacity: 0.5, fontSize: '0.8rem' }}>Actual: </span>
                                <span>{digits}</span>
                            </div>
                            <div>
                                <span style={{ opacity: 0.5, fontSize: '0.8rem' }}>You:    </span>
                                {userInput.replace(/\s/g, '').split('').map((char, i) => (
                                    <span key={i} style={{ color: i < digits.length && char === digits[i] ? 'var(--success)' : 'var(--error)' }}>{char}</span>
                                ))}
                            </div>
                        </div>
                    </div>

                    <ResultsCard onNewGame={engine.reset}>{null}</ResultsCard>
                </div>
            )}
        </DrillShell>
    );
}
