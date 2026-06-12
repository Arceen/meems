"use client";

import { useState, useMemo, useRef } from 'react';
import { useDrillEngine } from '@/hooks/useDrillEngine';
import DrillShell from '@/components/drill/DrillShell';
import CountdownTimer from '@/components/drill/CountdownTimer';
import ResultsCard from '@/components/drill/ResultsCard';
import StatBox from '@/components/drill/StatBox';
import ToggleGroup from '@/components/drill/ToggleGroup';
import { historicEvents, generateFictionalEvent, generateRandomYears, HistoricEvent } from '@/data/historic-dates';
import PresetManager from '@/components/drill/PresetManager';
import { shuffle } from '@/lib/drill-utils';

interface Config {
    count: number;
    memorizeSeconds: number;
    mode: 'real' | 'fictional' | 'mixed';
    category: 'all' | 'ancient' | 'medieval' | 'modern' | 'contemporary';
}

interface RecallItem {
    year: number;
    event: string;
    isFictional: boolean;
    userAnswer: string;
}

const DEFAULT_CONFIG: Config = {
    count: 10,
    memorizeSeconds: 180,
    mode: 'real',
    category: 'all',
};

function buildEventList(config: Config): { year: number; event: string; isFictional: boolean }[] {
    let pool = config.category === 'all'
        ? [...historicEvents]
        : historicEvents.filter(e => e.category === config.category);

    const shuffledReal = shuffle(pool);

    if (config.mode === 'real') {
        return shuffledReal.slice(0, config.count).map(e => ({ year: e.year, event: e.event, isFictional: false }));
    }

    if (config.mode === 'fictional') {
        const years = generateRandomYears(config.count);
        return years.map(y => ({ ...generateFictionalEvent(y), isFictional: true }));
    }

    // mixed: half real, half fictional
    const half = Math.ceil(config.count / 2);
    const realPart = shuffledReal.slice(0, half).map(e => ({ year: e.year, event: e.event, isFictional: false }));
    const fictPart = generateRandomYears(config.count - half).map(y => ({ ...generateFictionalEvent(y), isFictional: true }));
    return shuffle([...realPart, ...fictPart]);
}

export default function HistoricDates() {
    const engine = useDrillEngine<Config>({ gameType: 'historic-dates', defaultConfig: DEFAULT_CONFIG });

    // Memorize phase state
    const [events, setEvents] = useState<{ year: number; event: string; isFictional: boolean }[]>([]);
    const [memIndex, setMemIndex] = useState(0);

    // Recall phase state
    const [recall, setRecall] = useState<RecallItem[]>([]);

    // Result state
    const [resultStats, setResultStats] = useState({ correct: 0, total: 0, offBy: 0 });

    const startDrill = () => {
        const list = buildEventList(engine.config);
        setEvents(list);
        setMemIndex(0);
        // Recall inputs: events shuffled by event text, user must supply year
        const recallItems: RecallItem[] = shuffle(list.map(e => ({
            year: e.year,
            event: e.event,
            isFictional: e.isFictional,
            userAnswer: '',
        })));
        setRecall(recallItems);
        engine.start({ memorizeSeconds: engine.config.memorizeSeconds });
    };

    const submitRecall = async () => {
        let correct = 0;
        let offBy = 0;
        const updated = recall.map(item => {
            const parsed = parseInt(item.userAnswer.trim());
            if (!isNaN(parsed)) {
                const diff = Math.abs(parsed - item.year);
                if (diff === 0) correct++;
                offBy += diff;
            }
            return item;
        });
        setRecall(updated);

        const stats = { correct, total: recall.length, offBy: Math.round(offBy / recall.length) };
        setResultStats(stats);

        await engine.finishRecall({
            count: recall.length,
            correct,
            total: recall.length,
            percentage: Math.round((correct / recall.length) * 100),
            precision: Math.round((correct / recall.length) * 100),
            completeness: 100,
        });
    };

    const updateAnswer = (idx: number, val: string) => {
        setRecall(prev => prev.map((r, i) => i === idx ? { ...r, userAnswer: val } : r));
    };

    return (
        <DrillShell title="Historic Dates">
            {/* ── SETUP ─────────────────────────────────────────────── */}
            {engine.phase === 'setup' && (
                <div style={{ maxWidth: '520px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {/* Event count */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.8, fontSize: '0.9rem' }}>
                                Events: {engine.config.count}
                            </label>
                            <input type="range" min={5} max={30} step={5}
                                value={engine.config.count}
                                onChange={e => engine.setConfig(c => ({ ...c, count: +e.target.value }))}
                                style={{ width: '100%' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', opacity: 0.5 }}>
                                <span>5</span><span>30</span>
                            </div>
                        </div>

                        {/* Memorize time */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.8, fontSize: '0.9rem' }}>
                                Memorize time: {engine.config.memorizeSeconds}s
                            </label>
                            <input type="range" min={60} max={600} step={30}
                                value={engine.config.memorizeSeconds}
                                onChange={e => engine.setConfig(c => ({ ...c, memorizeSeconds: +e.target.value }))}
                                style={{ width: '100%' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', opacity: 0.5 }}>
                                <span>60s</span><span>600s</span>
                            </div>
                        </div>

                        {/* Mode */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.8, fontSize: '0.9rem' }}>Mode</label>
                            <ToggleGroup
                                options={[
                                    { value: 'real', label: 'Real events' },
                                    { value: 'fictional', label: 'Fictional' },
                                    { value: 'mixed', label: 'Mixed' },
                                ]}
                                value={engine.config.mode}
                                onChange={v => engine.setConfig(c => ({ ...c, mode: v as Config['mode'] }))}
                            />
                        </div>

                        {/* Category (real/mixed only) */}
                        {engine.config.mode !== 'fictional' && (
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.8, fontSize: '0.9rem' }}>Category</label>
                                <ToggleGroup
                                    options={[
                                        { value: 'all', label: 'All' },
                                        { value: 'ancient', label: 'Ancient' },
                                        { value: 'medieval', label: 'Medieval' },
                                        { value: 'modern', label: 'Modern' },
                                        { value: 'contemporary', label: 'Contemporary' },
                                    ]}
                                    value={engine.config.category}
                                    onChange={v => engine.setConfig(c => ({ ...c, category: v as Config['category'] }))}
                                />
                            </div>
                        )}
                    </div>

                    <PresetManager
                        gameType="historic-dates"
                        currentConfig={engine.config}
                        onLoad={cfg => engine.setConfig(c => ({ ...c, ...cfg }))}
                    />

                    <button className="btn btn-primary" style={{ padding: '0.85rem', fontSize: '1.1rem' }}
                        onClick={startDrill}>
                        Start ({engine.config.count} events, {engine.config.memorizeSeconds}s)
                    </button>
                </div>
            )}

            {/* ── MEMORIZE ──────────────────────────────────────────── */}
            {engine.phase === 'memorize' && (
                <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <CountdownTimer timeLeft={engine.timeLeft} warnUnder={30} />
                        <div style={{ opacity: 0.6, fontSize: '0.9rem' }}>{events.length} events</div>
                        <button className="btn btn-secondary" onClick={engine.finishMemorize}>
                            Done memorizing
                        </button>
                    </div>

                    {/* Scrollable event list */}
                    <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '65vh', overflowY: 'auto' }}>
                        {events.map((e, i) => (
                            <div key={i} style={{
                                display: 'flex', alignItems: 'baseline', gap: '1rem',
                                padding: '0.6rem 0.75rem', borderRadius: '0.5rem',
                                background: 'rgba(255,255,255,0.04)',
                                borderLeft: `3px solid ${e.isFictional ? 'var(--accent)' : 'var(--primary)'}`,
                            }}>
                                <span style={{ fontWeight: 800, fontSize: '1.1rem', color: e.isFictional ? 'var(--accent)' : 'var(--primary)', minWidth: '4.5rem', fontVariantNumeric: 'tabular-nums' }}>
                                    {e.year < 0 ? `${Math.abs(e.year)} BCE` : e.year}
                                </span>
                                <span style={{ opacity: 0.9, lineHeight: 1.4 }}>{e.event}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── RECALL ────────────────────────────────────────────── */}
            {engine.phase === 'recall' && (
                <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ opacity: 0.7, textAlign: 'center' }}>
                        Enter the year for each event. BCE years as negative (e.g. −490).
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {recall.map((item, i) => (
                            <div key={i} style={{
                                display: 'flex', alignItems: 'center', gap: '1rem',
                                padding: '0.65rem 0.85rem', borderRadius: '0.5rem',
                                background: 'rgba(255,255,255,0.04)',
                            }}>
                                <input
                                    type="number"
                                    value={item.userAnswer}
                                    onChange={e => updateAnswer(i, e.target.value)}
                                    placeholder="year"
                                    className="input-field"
                                    style={{ width: '90px', textAlign: 'center', padding: '0.4rem', flexShrink: 0 }}
                                />
                                <span style={{ opacity: 0.85, lineHeight: 1.4, fontSize: '0.9rem' }}>{item.event}</span>
                            </div>
                        ))}
                    </div>

                    <button className="btn btn-primary" style={{ padding: '0.85rem', fontSize: '1rem' }}
                        onClick={submitRecall} disabled={engine.saving}>
                        {engine.saving ? 'Saving…' : 'Submit Answers'}
                    </button>
                </div>
            )}

            {/* ── RESULT ────────────────────────────────────────────── */}
            {engine.phase === 'result' && (
                <ResultsCard onNewGame={engine.reset}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                        <StatBox label="Correct" value={`${resultStats.correct}/${resultStats.total}`} />
                        <StatBox label="Precision" value={`${Math.round((resultStats.correct / Math.max(resultStats.total, 1)) * 100)}%`} />
                        <StatBox label="Avg off by" value={`${resultStats.offBy}y`} />
                    </div>

                    <div style={{ maxHeight: '45vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {recall.map((item, i) => {
                            const parsed = parseInt(item.userAnswer);
                            const diff = isNaN(parsed) ? null : Math.abs(parsed - item.year);
                            const correct = diff === 0;
                            return (
                                <div key={i} style={{
                                    display: 'flex', gap: '0.75rem', alignItems: 'baseline',
                                    padding: '0.5rem 0.75rem', borderRadius: '0.4rem',
                                    background: correct ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)',
                                    borderLeft: `3px solid ${correct ? 'var(--success)' : 'var(--error)'}`,
                                }}>
                                    <span style={{ fontWeight: 700, minWidth: '4.5rem', color: correct ? 'var(--success)' : 'var(--error)', fontVariantNumeric: 'tabular-nums' }}>
                                        {item.year < 0 ? `${Math.abs(item.year)} BCE` : item.year}
                                    </span>
                                    <span style={{ opacity: 0.8, fontSize: '0.85rem', flex: 1 }}>{item.event}</span>
                                    {!correct && item.userAnswer && (
                                        <span style={{ opacity: 0.5, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                                            you: {item.userAnswer} ({diff !== null ? `±${diff}y` : '?'})
                                        </span>
                                    )}
                                    {!item.userAnswer && (
                                        <span style={{ opacity: 0.4, fontSize: '0.78rem' }}>skipped</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </ResultsCard>
            )}
        </DrillShell>
    );
}
