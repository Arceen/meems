"use client";

import { useState } from 'react';
import { useDrillEngine } from '@/hooks/useDrillEngine';
import DrillShell from '@/components/drill/DrillShell';
import CountdownTimer from '@/components/drill/CountdownTimer';
import ResultsCard from '@/components/drill/ResultsCard';
import StatBox from '@/components/drill/StatBox';
import PresetManager from '@/components/drill/PresetManager';

interface Config {
    digitCount: number;
    timeLimit: number;
    groupSize: 3 | 6;
}

const DEFAULT_CONFIG: Config = { digitCount: 120, timeLimit: 300, groupSize: 3 };

function generateBinary(count: number) {
    let r = '';
    for (let i = 0; i < count; i++) r += Math.random() > 0.5 ? '1' : '0';
    return r;
}

function formatBinary(data: string, group: number) {
    const chunks = [];
    for (let i = 0; i < data.length; i += group) chunks.push(data.slice(i, i + group));
    return chunks;
}

export default function BinarySurge() {
    const engine = useDrillEngine<Config>({ gameType: 'binary-surge', defaultConfig: DEFAULT_CONFIG });
    const { phase, config, setConfig } = engine;

    const [binaryData, setBinaryData] = useState('');
    const [userInput, setUserInput] = useState('');

    const startDrill = (overrideConfig?: Partial<Config>) => {
        const cfg = { ...config, ...overrideConfig };
        const data = generateBinary(cfg.digitCount);
        setBinaryData(data);
        setUserInput('');
        engine.start({ config: overrideConfig, memorizeSeconds: cfg.timeLimit });
    };

    const calculateScore = () => {
        const clean = userInput.replace(/[^01]/g, '');
        let c = 0;
        for (let i = 0; i < binaryData.length; i++) {
            if (i < clean.length && clean[i] === binaryData[i]) c++;
        }
        return c;
    };

    const submitRecall = async () => {
        const correct = calculateScore();
        await engine.finishRecall({
            count: config.digitCount,
            correct,
            total: binaryData.length,
            percentage: Math.round((correct / binaryData.length) * 100),
            precision: Math.round((correct / binaryData.length) * 100),
            completeness: 100,
        });
    };

    return (
        <DrillShell title="Binary Code Surge">
            {/* ── SETUP ─────────────────────────────────────────────── */}
            {phase === 'setup' && (
                <div style={{ maxWidth: '520px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.8, fontSize: '0.9rem' }}>Total Digits</label>
                            <input type="number" className="input-field"
                                value={config.digitCount} min={30} max={1000}
                                onChange={e => setConfig(c => ({ ...c, digitCount: parseInt(e.target.value) || 120 }))}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.8, fontSize: '0.9rem' }}>
                                Time Limit: {Math.floor(config.timeLimit / 60)}m {config.timeLimit % 60}s
                            </label>
                            <input type="range" min={60} max={1200} step={30}
                                value={config.timeLimit}
                                onChange={e => setConfig(c => ({ ...c, timeLimit: +e.target.value }))}
                                style={{ width: '100%' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', opacity: 0.5 }}>
                                <span>1m</span><span>20m</span>
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.8, fontSize: '0.9rem' }}>Grouping</label>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                {([3, 6] as const).map(g => (
                                    <button key={g}
                                        className={`btn ${config.groupSize === g ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setConfig(c => ({ ...c, groupSize: g }))}
                                        style={{ flex: 1 }}>
                                        {g} Digits
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <PresetManager
                        gameType="binary-surge"
                        currentConfig={config}
                        onLoad={cfg => {
                            setConfig(c => ({ ...c, ...cfg }));
                            startDrill(cfg as Partial<Config>);
                        }}
                    />

                    <button className="btn btn-primary" style={{ padding: '0.85rem', fontSize: '1.1rem' }}
                        onClick={() => startDrill()}>
                        Start ({config.digitCount} digits, {Math.floor(config.timeLimit / 60)}m {config.timeLimit % 60}s)
                    </button>
                </div>
            )}

            {/* ── MEMORIZE ──────────────────────────────────────────── */}
            {phase === 'memorize' && (
                <div style={{ maxWidth: '700px', margin: '0 auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <CountdownTimer timeLeft={engine.timeLeft} />
                        <button className="btn btn-primary" onClick={engine.finishMemorize}>
                            Done Memorizing
                        </button>
                    </div>

                    <div className="glass-panel" style={{
                        minHeight: '300px', fontFamily: 'monospace', fontSize: '1.5rem',
                        lineHeight: '1.8', letterSpacing: '1px', wordBreak: 'break-all',
                        padding: '1.25rem',
                    }}>
                        {formatBinary(binaryData, config.groupSize).map((chunk, idx) => (
                            <span key={idx} style={{ marginRight: '1rem', display: 'inline-block', color: idx % 2 === 0 ? '#fff' : '#cbd5e1' }}>
                                {chunk}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* ── RECALL ────────────────────────────────────────────── */}
            {phase === 'recall' && (
                <div style={{ maxWidth: '520px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Enter the binary sequence</h2>
                    <textarea
                        className="input-field"
                        style={{ minHeight: '260px', fontFamily: 'monospace', fontSize: '1.2rem', letterSpacing: '1px' }}
                        value={userInput}
                        onChange={e => setUserInput(e.target.value.replace(/[^01\s]/g, ''))}
                        placeholder="010 110…"
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
                        <StatBox label="Score" value={`${calculateScore()} / ${binaryData.length}`} valueColor="var(--success)" />
                        <StatBox label="Memorize Time" value={`${engine.memorizeElapsed}s`} />
                    </div>

                    <div>
                        <p style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '0.5rem' }}>Comparison</p>
                        <div style={{ fontFamily: 'monospace', fontSize: '1rem', background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '0.5rem', wordBreak: 'break-all' }}>
                            {binaryData.split('').map((char, i) => {
                                const userChar = userInput.replace(/[^01]/g, '')[i];
                                const color = !userChar ? 'inherit' : userChar === char ? 'var(--success)' : 'var(--error)';
                                return <span key={i} style={{ color }}>{char}</span>;
                            })}
                        </div>
                    </div>

                    <ResultsCard onNewGame={engine.reset}>{null}</ResultsCard>
                </div>
            )}
        </DrillShell>
    );
}
