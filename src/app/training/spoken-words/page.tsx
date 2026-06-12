"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { useDrillEngine } from '@/hooks/useDrillEngine';
import { usePacedSequence } from '@/hooks/usePacedSequence';
import DrillShell from '@/components/drill/DrillShell';
import ResultsCard from '@/components/drill/ResultsCard';
import StatBox from '@/components/drill/StatBox';
import ToggleGroup from '@/components/drill/ToggleGroup';
import { normalize, shuffle } from '@/lib/drill-utils';
import PresetManager from '@/components/drill/PresetManager';
import wordList from '@/data/words.json';

interface Config {
    count: number;
    paceSec: number;
    rate: number; // speech rate
}

const DEFAULT_CONFIG: Config = {
    count: 20,
    paceSec: 2.5,
    rate: 1.0,
};

function pickWords(count: number): string[] {
    return shuffle([...wordList]).slice(0, count);
}

function scoreRecall(words: string[], userText: string): { correct: number; results: { word: string; given: string; ok: boolean }[] } {
    const lines = userText.split('\n').map(l => l.trim()).filter(Boolean);
    const results = words.map((word, i) => {
        const given = lines[i] ?? '';
        const ok = normalize(given) === normalize(word);
        return { word, given, ok };
    });
    return { correct: results.filter(r => r.ok).length, results };
}

export default function SpokenWords() {
    const engine = useDrillEngine<Config>({ gameType: 'spoken-words', defaultConfig: DEFAULT_CONFIG });

    const [words, setWords] = useState<string[]>([]);
    const [currentWord, setCurrentWord] = useState('');
    const [userInput, setUserInput] = useState('');
    const [scoreResults, setScoreResults] = useState<{ word: string; given: string; ok: boolean }[]>([]);
    const [finalScore, setFinalScore] = useState({ correct: 0, total: 0 });

    const synthRef = useRef<SpeechSynthesis | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            synthRef.current = window.speechSynthesis;
        }
        return () => { synthRef.current?.cancel(); };
    }, []);

    const speakWord = useCallback((word: string, rate: number) => {
        if (!synthRef.current) return;
        synthRef.current.cancel();
        const utt = new SpeechSynthesisUtterance(word);
        utt.rate = rate;
        synthRef.current.speak(utt);
    }, []);

    const onItemPresented = useCallback((word: string) => {
        setCurrentWord(word);
        speakWord(word, engine.config.rate);
    }, [engine.config.rate, speakWord]);

    const onSequenceDone = useCallback(() => {
        setCurrentWord('');
        synthRef.current?.cancel();
        engine.finishMemorize();
        setTimeout(() => textareaRef.current?.focus(), 100);
    }, [engine]);

    const { currentIndex, running, start: startSequence, cancel } = usePacedSequence({
        items: words,
        intervalMs: engine.config.paceSec * 1000,
        startDelayMs: 1000,
        onItem: onItemPresented,
        onDone: onSequenceDone,
    });

    const startDrill = () => {
        const picked = pickWords(engine.config.count);
        setWords(picked);
        setUserInput('');
        setScoreResults([]);
        engine.start();
        // Sequence starts via useEffect once words are set and phase is memorize
    };

    // Start the audio sequence once we're in memorize phase and words are ready
    useEffect(() => {
        if (engine.phase === 'memorize' && words.length > 0) {
            startSequence();
        }
        if (engine.phase !== 'memorize') {
            cancel();
            synthRef.current?.cancel();
        }
    }, [engine.phase, words]); // eslint-disable-line react-hooks/exhaustive-deps

    const submitRecall = async () => {
        const { correct, results } = scoreRecall(words, userInput);
        const attempted = userInput.split('\n').filter(l => l.trim()).length;
        const total = words.length;
        setScoreResults(results);
        setFinalScore({ correct, total });

        await engine.finishRecall({
            count: total,
            correct,
            total,
            percentage: Math.round((correct / total) * 100),
            precision: attempted > 0 ? Math.round((correct / attempted) * 100) : 0,
            completeness: Math.round((attempted / total) * 100),
        });
    };

    const progressPct = words.length > 0 ? Math.round(((currentIndex + 1) / words.length) * 100) : 0;

    return (
        <DrillShell title="Spoken Words">
            {/* ── SETUP ─────────────────────────────────────────────── */}
            {engine.phase === 'setup' && (
                <div style={{ maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {/* Word count */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.8, fontSize: '0.9rem' }}>
                                Words: {engine.config.count}
                            </label>
                            <input type="range" min={5} max={50} step={5}
                                value={engine.config.count}
                                onChange={e => engine.setConfig(c => ({ ...c, count: +e.target.value }))}
                                style={{ width: '100%' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', opacity: 0.5 }}>
                                <span>5</span><span>50</span>
                            </div>
                        </div>

                        {/* Pace */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.8, fontSize: '0.9rem' }}>
                                Pace: {engine.config.paceSec}s per word
                            </label>
                            <ToggleGroup
                                options={[
                                    { value: '4', label: '4s (slow)' },
                                    { value: '2.5', label: '2.5s' },
                                    { value: '1.5', label: '1.5s' },
                                    { value: '1', label: '1s (fast)' },
                                ]}
                                value={String(engine.config.paceSec)}
                                onChange={v => engine.setConfig(c => ({ ...c, paceSec: +v }))}
                            />
                        </div>

                        {/* Speech rate */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.8, fontSize: '0.9rem' }}>
                                Speech rate: {engine.config.rate}×
                            </label>
                            <input type="range" min={0.5} max={1.5} step={0.1}
                                value={engine.config.rate}
                                onChange={e => engine.setConfig(c => ({ ...c, rate: +e.target.value }))}
                                style={{ width: '100%' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', opacity: 0.5 }}>
                                <span>0.5× (slow)</span><span>1.5× (fast)</span>
                            </div>
                        </div>
                    </div>

                    <PresetManager
                        gameType="spoken-words"
                        currentConfig={engine.config}
                        onLoad={cfg => engine.setConfig(c => ({ ...c, ...cfg }))}
                    />

                    <button className="btn btn-primary" style={{ padding: '0.85rem', fontSize: '1.1rem' }}
                        onClick={startDrill}>
                        Start ({engine.config.count} words at {engine.config.paceSec}s each)
                    </button>
                </div>
            )}

            {/* ── MEMORIZE (AUDIO PLAYBACK) ──────────────────────────── */}
            {engine.phase === 'memorize' && (
                <div style={{ maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem', alignItems: 'center', textAlign: 'center' }}>
                    {/* Progress bar */}
                    <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${progressPct}%`, background: 'var(--primary)', transition: 'width 0.3s ease', borderRadius: '3px' }} />
                    </div>

                    <div style={{ fontSize: '0.9rem', opacity: 0.6 }}>
                        {running ? `${currentIndex + 1} / ${words.length}` : 'Starting…'}
                    </div>

                    {/* Current word display */}
                    <div className="glass-panel" style={{ padding: '2.5rem 3rem', minHeight: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                        <span style={{ fontSize: '2.5rem', fontWeight: 700, letterSpacing: '0.02em', color: 'var(--primary)' }}>
                            {currentWord || (running ? '…' : '')}
                        </span>
                    </div>

                    <button className="btn btn-secondary" onClick={() => {
                        cancel();
                        synthRef.current?.cancel();
                        engine.finishMemorize();
                    }}>
                        Skip to recall
                    </button>
                </div>
            )}

            {/* ── RECALL ────────────────────────────────────────────── */}
            {engine.phase === 'recall' && (
                <div style={{ maxWidth: '520px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <p style={{ opacity: 0.7, textAlign: 'center' }}>
                        Type the words in order, one per line ({words.length} words).
                    </p>
                    <textarea
                        ref={textareaRef}
                        value={userInput}
                        onChange={e => setUserInput(e.target.value)}
                        className="input-field"
                        placeholder={`word 1\nword 2\nword 3\n…`}
                        style={{ height: `${Math.min(words.length, 20) * 1.8 + 2}rem`, resize: 'vertical', fontFamily: 'monospace', fontSize: '0.95rem', lineHeight: 1.7 }}
                    />
                    <button className="btn btn-primary" style={{ padding: '0.85rem' }}
                        onClick={submitRecall} disabled={engine.saving}>
                        {engine.saving ? 'Saving…' : `Submit (${userInput.split('\n').filter(l => l.trim()).length}/${words.length})`}
                    </button>
                </div>
            )}

            {/* ── RESULT ────────────────────────────────────────────── */}
            {engine.phase === 'result' && (
                <ResultsCard onNewGame={engine.reset}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                        <StatBox label="Correct" value={`${finalScore.correct}/${finalScore.total}`} />
                        <StatBox label="Precision" value={`${Math.round((finalScore.correct / Math.max(finalScore.total, 1)) * 100)}%`} />
                        <StatBox label="Words" value={finalScore.total} />
                    </div>

                    <div style={{ maxHeight: '45vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {scoreResults.map((r, i) => (
                            <div key={i} style={{
                                display: 'flex', gap: '0.75rem', alignItems: 'center',
                                padding: '0.4rem 0.75rem', borderRadius: '0.35rem',
                                background: r.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)',
                                borderLeft: `3px solid ${r.ok ? 'var(--success)' : 'var(--error)'}`,
                            }}>
                                <span style={{ opacity: 0.5, fontSize: '0.75rem', minWidth: '1.5rem' }}>{i + 1}.</span>
                                <span style={{ fontWeight: 600, color: r.ok ? 'var(--success)' : 'inherit' }}>{r.word}</span>
                                {!r.ok && r.given && (
                                    <span style={{ opacity: 0.5, fontSize: '0.8rem' }}>→ you wrote: "{r.given}"</span>
                                )}
                                {!r.ok && !r.given && (
                                    <span style={{ opacity: 0.4, fontSize: '0.8rem' }}>skipped</span>
                                )}
                            </div>
                        ))}
                    </div>
                </ResultsCard>
            )}
        </DrillShell>
    );
}
