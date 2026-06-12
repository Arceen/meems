"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import {
    getImageVaultData, getCardStats, saveCardAttempt, saveGameResult,
    getSrsState, saveSrsState, SrsStateDoc, SrsItemState,
    MajorEntry, CardStats,
} from '@/lib/firebase';
import {
    computeDueQueue, applyReview, gradeFromResponse, seedFromTier,
    mergeReviews, SrsState,
} from '@/lib/srs';
import { getCardPerformanceColor } from '@/lib/firebase';
import { normalize } from '@/lib/drill-utils';
import Loader from '@/components/Loader';

interface ReviewQuestion {
    itemKey: string;          // bare '00'–'99' for major; 'cardpao:KH' for card PAO
    prompt: string;
    answer: string;
    hint?: string;
    direction: 'num-to-word' | 'word-to-num';
    itemState: SrsItemState;
}

function getItemTier(stats: CardStats | undefined): string {
    if (!stats || stats.totalAttempts === 0) return 'none';
    const color = getCardPerformanceColor(stats);
    if (color.includes('229, 228, 226')) return 'platinum';
    if (color.includes('251, 191, 36') || color.includes('245, 158, 11')) return 'gold';
    if (color.includes('203, 213, 225') || color.includes('148, 163, 184')) return 'silver';
    return 'bronze';
}

function buildQuestions(
    majorSystem: MajorEntry[],
    srsState: SrsState,
    cardStatsMap: Map<string, CardStats>,
): ReviewQuestion[] {
    // Seed SRS state from card stats for items not yet in state
    const seededState = { ...srsState };
    for (const entry of majorSystem) {
        const key = entry.number;
        if (!seededState.items[key]) {
            const stats = cardStatsMap.get(key);
            const tier = getItemTier(stats);
            seededState.items[key] = seedFromTier(key, tier);
        }
    }

    const allKeys = majorSystem
        .filter(e => e.persons?.length || e.actions?.length || e.objects?.length || e.images?.length)
        .map(e => e.number);

    const due = computeDueQueue({ items: seededState.items, lastUpdated: 0 }, allKeys, 40);

    const result: ReviewQuestion[] = [];
    for (const item of due) {
        const entry = majorSystem.find(e => e.number === item.itemKey);
        if (!entry) continue;
        const word = entry.objects?.[0] || entry.persons?.[0] || entry.actions?.[0] || entry.images?.[0] || '';
        if (!word) continue;

        const direction: 'num-to-word' | 'word-to-num' = item.reps % 2 === 0 ? 'num-to-word' : 'word-to-num';
        if (direction === 'num-to-word') {
            result.push({ itemKey: item.itemKey, prompt: `What is the mnemonic for ${entry.number}?`, answer: word, hint: `Starts with "${word[0]}"`, direction, itemState: item });
        } else {
            result.push({ itemKey: item.itemKey, prompt: `"${word}" belongs to which number?`, answer: entry.number, direction, itemState: item });
        }
    }
    return result;
}

export default function ReviewDrill() {
    const [phase, setPhase] = useState<'loading' | 'empty' | 'session' | 'result'>('loading');
    const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answer, setAnswer] = useState('');
    const [showAnswer, setShowAnswer] = useState(false);
    const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
    const [reviewedItems, setReviewedItems] = useState<SrsItemState[]>([]);
    const [sessionStats, setSessionStats] = useState({ correct: 0, wrong: 0 });
    const [saving, setSaving] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const questionStartRef = useRef(0);
    const srsStateRef = useRef<SrsStateDoc>({ items: {}, lastUpdated: 0 });

    useEffect(() => {
        async function init() {
            const [vaultData, cardStatsMap, srsDoc] = await Promise.all([
                getImageVaultData(),
                getCardStats(),
                getSrsState(),
            ]);

            srsStateRef.current = srsDoc;

            const majorSystem = vaultData?.majorSystem ?? [];
            if (majorSystem.length === 0) { setPhase('empty'); return; }

            const srsState: SrsState = { items: srsDoc.items, lastUpdated: srsDoc.lastUpdated };
            const qs = buildQuestions(majorSystem, srsState, cardStatsMap);

            if (qs.length === 0) { setPhase('empty'); return; }

            setQuestions(qs);
            questionStartRef.current = Date.now();
            setPhase('session');
            setTimeout(() => inputRef.current?.focus(), 100);
        }
        init();
    }, []);

    const submitAnswer = useCallback(async (skipped = false) => {
        const q = questions[currentIndex];
        if (!q || feedback !== null) return;

        const elapsed = Date.now() - questionStartRef.current;
        const given = skipped ? '' : answer.trim();
        const correct = !skipped && normalize(given) === normalize(q.answer);
        const grade = gradeFromResponse(correct, elapsed);
        const updatedItem = applyReview(q.itemState, grade);

        setFeedback(correct ? 'correct' : 'wrong');
        setShowAnswer(true);
        setSessionStats(prev => ({ correct: prev.correct + (correct ? 1 : 0), wrong: prev.wrong + (correct ? 0 : 1) }));
        setReviewedItems(prev => [...prev, updatedItem]);

        // Save card attempt for tier tracking
        saveCardAttempt({
            cardNumber: q.itemKey,
            isCorrect: correct,
            responseTime: elapsed,
            timestamp: Date.now(),
            questionType: q.direction === 'num-to-word' ? 'digits' : 'words',
            system: 'major',
        }).catch(() => {});
    }, [questions, currentIndex, answer, feedback]);

    const advance = useCallback(() => {
        const next = currentIndex + 1;
        setAnswer('');
        setFeedback(null);
        setShowAnswer(false);
        questionStartRef.current = Date.now();

        if (next >= questions.length) {
            // End of session — persist SRS state and game result
            const finalState = mergeReviews(
                { items: srsStateRef.current.items, lastUpdated: srsStateRef.current.lastUpdated },
                reviewedItems
            );
            setSaving(true);
            Promise.all([
                saveSrsState(finalState),
                saveGameResult({
                    type: 'srs-review',
                    count: questions.length,
                    correct: sessionStats.correct,
                    total: questions.length,
                    percentage: Math.round((sessionStats.correct / questions.length) * 100),
                    memorizeTime: 0,
                    recallTime: Math.round((Date.now() - (questionStartRef.current - 1)) / 1000),
                    precision: Math.round((sessionStats.correct / questions.length) * 100),
                    completeness: 100,
                }),
            ]).finally(() => setSaving(false));
            setPhase('result');
            return;
        }

        setCurrentIndex(next);
        setTimeout(() => inputRef.current?.focus(), 50);
    }, [currentIndex, questions.length, reviewedItems, sessionStats]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            if (!showAnswer) { submitAnswer(); }
            else { advance(); }
            e.preventDefault();
        }
    };

    const q = questions[currentIndex];
    const progress = questions.length > 0 ? ((currentIndex) / questions.length) * 100 : 0;

    return (
        <>
            <Header />
            <main className="container" style={{ maxWidth: '560px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h1 style={{ fontSize: '1.4rem', margin: 0 }}>SRS Review</h1>
                    <Link href="/training" className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>← Hub</Link>
                </div>

                {phase === 'loading' && <Loader />}

                {phase === 'empty' && (
                    <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center' }}>
                        <p style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Nothing due for review.</p>
                        <p style={{ opacity: 0.6, marginBottom: '1.5rem' }}>
                            Fill in your Major System cards in Image Vault and train with System Checker — items will appear here as they come due.
                        </p>
                        <Link href="/training/image-vault" className="btn btn-primary">Open Image Vault</Link>
                    </div>
                )}

                {phase === 'session' && q && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {/* Progress bar */}
                        <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${progress}%`, background: 'var(--primary)', transition: 'width 0.3s' }} />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', opacity: 0.6 }}>
                            <span>{currentIndex + 1} / {questions.length}</span>
                            <span style={{ color: 'var(--success)' }}>{sessionStats.correct} correct</span>
                        </div>

                        {/* SRS metadata chips */}
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{ background: 'rgba(255,255,255,0.06)', padding: '0.2rem 0.5rem', borderRadius: '0.3rem', fontSize: '0.75rem' }}>
                                {q.itemKey}
                            </span>
                            <span style={{ background: 'rgba(255,255,255,0.06)', padding: '0.2rem 0.5rem', borderRadius: '0.3rem', fontSize: '0.75rem', opacity: 0.6 }}>
                                interval: {q.itemState.intervalDays}d • ease: {q.itemState.ease.toFixed(1)} • reps: {q.itemState.reps}
                            </span>
                        </div>

                        {/* Question card */}
                        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
                            <p style={{ fontSize: '1.3rem', lineHeight: 1.5 }}>{q.prompt}</p>
                        </div>

                        {/* Answer input */}
                        {!showAnswer ? (
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <input
                                    ref={inputRef}
                                    className="input-field"
                                    value={answer}
                                    onChange={e => setAnswer(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Your answer…"
                                    style={{ flex: 1 }}
                                    autoComplete="off"
                                />
                                <button className="btn btn-primary" onClick={() => submitAnswer()}>
                                    Check
                                </button>
                                <button className="btn btn-secondary" onClick={() => submitAnswer(true)}
                                    title="Skip (counts as wrong)">
                                    Skip
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div style={{
                                    padding: '1rem 1.25rem', borderRadius: '0.5rem',
                                    background: feedback === 'correct' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)',
                                    borderLeft: `4px solid ${feedback === 'correct' ? 'var(--success)' : 'var(--error)'}`,
                                }}>
                                    <div style={{ fontWeight: 700, fontSize: '1.1rem', color: feedback === 'correct' ? 'var(--success)' : 'var(--error)' }}>
                                        {feedback === 'correct' ? 'Correct!' : `Wrong — answer: ${q.answer}`}
                                    </div>
                                    {feedback === 'wrong' && answer && (
                                        <div style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: '0.25rem' }}>You wrote: "{answer}"</div>
                                    )}
                                </div>
                                <button className="btn btn-primary" onClick={advance} onKeyDown={e => e.key === 'Enter' && advance()}>
                                    Next →
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {phase === 'result' && (
                    <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
                        <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Session Complete</h2>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                            {[
                                { label: 'Reviewed', value: questions.length },
                                { label: 'Correct', value: sessionStats.correct, color: 'var(--success)' },
                                { label: 'Wrong', value: sessionStats.wrong, color: sessionStats.wrong > 0 ? 'var(--error)' : undefined },
                            ].map(s => (
                                <div key={s.label} className="glass-panel" style={{ padding: '1rem' }}>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.3rem' }}>{s.label}</div>
                                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                                </div>
                            ))}
                        </div>

                        {saving && <p style={{ opacity: 0.6, marginBottom: '1rem', fontSize: '0.9rem' }}>Saving state…</p>}

                        <p style={{ opacity: 0.65, marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                            SRS intervals updated. Next due items will reflect today's performance.
                        </p>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <Link href="/training" className="btn btn-secondary" style={{ flex: 1 }}>← Hub</Link>
                            <button className="btn btn-primary" style={{ flex: 1 }}
                                onClick={() => { setPhase('loading'); window.location.reload(); }}>
                                New Session
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </>
    );
}
