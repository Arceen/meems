"use client";

import { useState, useEffect, useMemo } from 'react';
import Header from '@/components/Header';
import Link from 'next/link';
import { saveGameResult } from '@/lib/firebase';
import { PHILOSOPHY_QUOTES, PhilosophicalQuote } from '@/data/philosophicalQuotes';

type Tab = 'learn' | 'challenge';
type ChallengeMode = 'quote-to-source' | 'speaker-to-quote';
type ChallengeState = 'idle' | 'running' | 'complete';

interface ChallengeResult {
    quote: PhilosophicalQuote;
    mode: ChallengeMode;
    speakerAnswer?: string;
    sourceAnswer?: string;
    quoteAnswer?: string;
    speakerCorrect?: boolean;
    sourceCorrect?: boolean;
    quoteCorrect?: boolean;
}

const LEARN_STORAGE_KEY = 'phil_attribution_learned';

const normalize = (value: string) =>
    value
        .trim()
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/\s+/g, ' ')
        .toLowerCase();

const shuffle = <T,>(items: T[]) => {
    const clone = [...items];
    for (let i = clone.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [clone[i], clone[j]] = [clone[j], clone[i]];
    }
    return clone;
};

export default function PhilosophicalAttribution() {
    const [activeTab, setActiveTab] = useState<Tab>('learn');
    const [searchTerm, setSearchTerm] = useState('');
    const [tagFilter, setTagFilter] = useState<string>('all');
    const [learnedIds, setLearnedIds] = useState<Set<string>>(new Set());

    const [challengeMode, setChallengeMode] = useState<ChallengeMode>('quote-to-source');
    const [questionCount, setQuestionCount] = useState(10);
    const [challengeState, setChallengeState] = useState<ChallengeState>('idle');
    const [challengeDeck, setChallengeDeck] = useState<PhilosophicalQuote[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [speakerInput, setSpeakerInput] = useState('');
    const [sourceInput, setSourceInput] = useState('');
    const [quoteInput, setQuoteInput] = useState('');
    const [results, setResults] = useState<ChallengeResult[]>([]);
    const [challengeStart, setChallengeStart] = useState<number | null>(null);

    // Hydrate learned ids
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const stored = window.localStorage.getItem(LEARN_STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored) as string[];
                setLearnedIds(new Set(parsed));
            } catch (error) {
                console.warn('Failed to parse stored learned quotes', error);
            }
        }
    }, []);

    // Persist learned ids
    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(LEARN_STORAGE_KEY, JSON.stringify(Array.from(learnedIds)));
    }, [learnedIds]);

    const tagOptions = useMemo(() => {
        const tags = new Set<string>();
        PHILOSOPHY_QUOTES.forEach((quote) => quote.tags.forEach((tag) => tags.add(tag)));
        return ['all', ...Array.from(tags).sort()];
    }, []);

    const filteredQuotes = useMemo(() => {
        return PHILOSOPHY_QUOTES.filter((quote) => {
            const matchesSearch =
                quote.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
                quote.speaker.toLowerCase().includes(searchTerm.toLowerCase()) ||
                quote.source.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesTag = tagFilter === 'all' || quote.tags.includes(tagFilter);
            return matchesSearch && matchesTag;
        });
    }, [searchTerm, tagFilter]);

    const learnedCount = learnedIds.size;
    const learnedQuotes = useMemo(
        () => PHILOSOPHY_QUOTES.filter((quote) => learnedIds.has(quote.id)),
        [learnedIds]
    );

    const readyForChallenge = learnedQuotes.length >= Math.min(questionCount, 3);

    const toggleLearned = (id: string) => {
        setLearnedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const markFilteredAsLearned = () => {
        setLearnedIds((prev) => {
            const next = new Set(prev);
            filteredQuotes.forEach((quote) => next.add(quote.id));
            return next;
        });
    };

    const clearLearned = () => {
        setLearnedIds(new Set());
    };

    const startChallenge = () => {
        if (!readyForChallenge) return;
        const deck = shuffle(learnedQuotes).slice(0, Math.min(questionCount, learnedQuotes.length));
        setChallengeDeck(deck);
        setChallengeState('running');
        setCurrentIndex(0);
        setSpeakerInput('');
        setSourceInput('');
        setQuoteInput('');
        setResults([]);
        setChallengeStart(Date.now());
    };

    const recordAnswer = () => {
        if (!challengeDeck[currentIndex]) return;
        const quote = challengeDeck[currentIndex];
        let entry: ChallengeResult;
        if (challengeMode === 'quote-to-source') {
            const speakerCorrect = normalize(speakerInput) === normalize(quote.speaker);
            const sourceCorrect = normalize(sourceInput) === normalize(quote.source);
            entry = {
                quote,
                mode: challengeMode,
                speakerAnswer: speakerInput,
                sourceAnswer: sourceInput,
                speakerCorrect,
                sourceCorrect
            };
        } else {
            const quoteCorrect = normalize(quoteInput) === normalize(quote.text);
            entry = {
                quote,
                mode: challengeMode,
                quoteAnswer: quoteInput,
                quoteCorrect
            };
        }
        const updatedResults = [...results, entry];
        setResults(updatedResults);

        setSpeakerInput('');
        setSourceInput('');
        setQuoteInput('');

        if (currentIndex >= challengeDeck.length - 1) {
            finishChallenge(updatedResults);
        } else {
            setCurrentIndex((prev) => prev + 1);
        }
    };

    const finishChallenge = async (finalResults?: ChallengeResult[]) => {
        setChallengeState('complete');
        const answerSheet = finalResults ?? results;
        if (challengeStart && challengeDeck.length > 0) {
            const duration = (Date.now() - challengeStart) / 1000;
            const totalQuestions = challengeDeck.length;
            let correct = 0;
            answerSheet.forEach((result) => {
                if (result.mode === 'quote-to-source') {
                    if (result.speakerCorrect) correct += 0.5;
                    if (result.sourceCorrect) correct += 0.5;
                } else if (result.quoteCorrect) {
                    correct += 1;
                }
            });
            const percentage = Math.round((correct / totalQuestions) * 100);
            try {
                await saveGameResult({
                    type: 'philosophical-attribution',
                    count: totalQuestions,
                    correct,
                    total: totalQuestions,
                    percentage,
                    memorizeTime: 0,
                    recallTime: duration,
                    precision: percentage,
                    completeness: 100,
                });
            } catch (error) {
                console.error('Failed to save Philosophical Attribution result:', error);
            }
        }
    };

    const resetChallenge = () => {
        setChallengeState('idle');
        setChallengeDeck([]);
        setResults([]);
        setCurrentIndex(0);
        setSpeakerInput('');
        setSourceInput('');
        setQuoteInput('');
        setChallengeStart(null);
    };

    const accuracySummary = useMemo(() => {
        if (!results.length) return { correct: 0, total: 0, accuracy: 0 };
        let correctUnits = 0;
        let totalUnits = 0;
        results.forEach((result) => {
            if (result.mode === 'quote-to-source') {
                totalUnits += 2;
                if (result.speakerCorrect) correctUnits += 1;
                if (result.sourceCorrect) correctUnits += 1;
            } else {
                totalUnits += 1;
                if (result.quoteCorrect) correctUnits += 1;
            }
        });
        return {
            correct: correctUnits,
            total: totalUnits,
            accuracy: totalUnits ? Math.round((correctUnits / totalUnits) * 100) : 0
        };
    }, [results]);

    return (
        <>
            <Header compact={challengeState === 'running'} />
            <main className="container" style={{ maxWidth: '1100px' }}>
                <div style={{ marginBottom: '2rem' }}>
                    <Link href="/training" style={{ fontSize: '0.9rem', opacity: 0.7 }}>
                        ← Back to Training
                    </Link>
                    <h1 style={{ fontSize: '2.3rem', fontWeight: 'bold', marginTop: '0.5rem' }}>
                        Philosophical Attribution Challenge
                    </h1>
                    <p style={{ color: '#94a3b8', maxWidth: '720px' }}>
                        Anchor verbatim quotes to speakers and sources, then flip the link in challenge mode. Learn first,
                        then attempt the 15-quote / 10-minute mastery test with ≥90% accuracy.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                    <button
                        className={`btn ${activeTab === 'learn' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setActiveTab('learn')}
                    >
                        Learn ({learnedCount}/{PHILOSOPHY_QUOTES.length})
                    </button>
                    <button
                        className={`btn ${activeTab === 'challenge' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setActiveTab('challenge')}
                    >
                        Challenge
                    </button>
                </div>

                {activeTab === 'learn' && (
                    <section className="glass card animate-fade-in" style={{ padding: '2rem', marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                            <input
                                className="input-field"
                                placeholder="Search quote, speaker, or source"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ flex: 1, minWidth: '220px' }}
                            />
                            <select
                                className="input-field"
                                value={tagFilter}
                                onChange={(e) => setTagFilter(e.target.value)}
                                style={{ minWidth: '180px' }}
                            >
                                {tagOptions.map((tag) => (
                                    <option key={tag} value={tag}>
                                        {tag === 'all' ? 'All categories' : tag}
                                    </option>
                                ))}
                            </select>
                            <button className="btn btn-secondary" onClick={markFilteredAsLearned}>
                                Mark filtered as learned
                            </button>
                            <button className="btn btn-secondary" onClick={clearLearned}>
                                Clear learned
                            </button>
                        </div>

                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                gap: '1rem'
                            }}
                        >
                            {filteredQuotes.map((quote) => {
                                const isLearned = learnedIds.has(quote.id);
                                return (
                                    <div
                                        key={quote.id}
                                        className="glass"
                                        style={{
                                            padding: '1.25rem',
                                            borderRadius: '1rem',
                                            border: isLearned ? '1px solid var(--success)' : '1px solid transparent',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '0.75rem'
                                        }}
                                    >
                                        <p style={{ fontSize: '1rem', lineHeight: 1.6, color: '#e2e8f0' }}>
                                            “{quote.text}”
                                        </p>
                                        <div>
                                            <strong>{quote.speaker}</strong>
                                            <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>{quote.source}</div>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                            {quote.tags.map((tag) => (
                                                <span
                                                    key={`${quote.id}-${tag}`}
                                                    style={{
                                                        fontSize: '0.75rem',
                                                        padding: '0.2rem 0.6rem',
                                                        borderRadius: '999px',
                                                        background: 'rgba(255,255,255,0.08)'
                                                    }}
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                        <button
                                            className={`btn ${isLearned ? 'btn-secondary' : 'btn-primary'}`}
                                            onClick={() => toggleLearned(quote.id)}
                                        >
                                            {isLearned ? 'Unmark' : 'Mark learned'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {activeTab === 'challenge' && (
                    <section className="glass card animate-fade-in" style={{ padding: '2rem', marginBottom: '2rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1' }}>Mode</label>
                                <select
                                    className="input-field"
                                    value={challengeMode}
                                    onChange={(e) => setChallengeMode(e.target.value as ChallengeMode)}
                                >
                                    <option value="quote-to-source">Quote → Speaker & Source</option>
                                    <option value="speaker-to-quote">Speaker → Quote (verbatim)</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1' }}>Question count</label>
                                <input
                                    type="number"
                                    className="input-field"
                                    min={5}
                                    max={30}
                                    value={questionCount}
                                    onChange={(e) => setQuestionCount(Math.max(5, Math.min(30, parseInt(e.target.value, 10) || 5)))}
                                />
                                <p style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '0.25rem' }}>
                                    Learned quotes available: {learnedQuotes.length}
                                </p>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1' }}>Status</label>
                                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: readyForChallenge ? 'var(--success)' : 'var(--error)' }}>
                                    {readyForChallenge ? 'Ready' : 'Add more learned quotes'}
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                            <button
                                className="btn btn-primary"
                                onClick={startChallenge}
                                disabled={!readyForChallenge}
                                style={{ flex: 1, minWidth: '200px' }}
                            >
                                {challengeState === 'running' ? 'Restart Challenge' : 'Start Challenge'}
                            </button>
                            {challengeState !== 'idle' && (
                                <button className="btn btn-secondary" onClick={resetChallenge} style={{ minWidth: '160px' }}>
                                    Reset
                                </button>
                            )}
                        </div>
                    </section>
                )}

                {challengeState === 'running' && challengeDeck[currentIndex] && (
                    <section className="glass card animate-fade-in" style={{ padding: '2rem', marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <div>
                                <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>Question</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                                    {currentIndex + 1} / {challengeDeck.length}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>Mode</div>
                                <div style={{ fontSize: '1rem', fontWeight: 'bold' }}>
                                    {challengeMode === 'quote-to-source' ? 'Quote → Attribution' : 'Speaker → Verbatim'}
                                </div>
                            </div>
                        </div>

                        <div className="glass" style={{ padding: '1.25rem', borderRadius: '1rem', marginBottom: '1.5rem' }}>
                            {challengeMode === 'quote-to-source' ? (
                                <p style={{ fontSize: '1.2rem', lineHeight: 1.7, color: '#e2e8f0' }}>“{challengeDeck[currentIndex].text}”</p>
                            ) : (
                                <div>
                                    <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>Speaker</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{challengeDeck[currentIndex].speaker}</div>
                                    <div style={{ fontSize: '0.95rem', opacity: 0.7 }}>{challengeDeck[currentIndex].source}</div>
                                </div>
                            )}
                        </div>

                        {challengeMode === 'quote-to-source' ? (
                            <div style={{ display: 'grid', gap: '1rem', marginBottom: '1rem' }}>
                                <input
                                    className="input-field"
                                    placeholder="Speaker name"
                                    value={speakerInput}
                                    onChange={(e) => setSpeakerInput(e.target.value)}
                                />
                                <input
                                    className="input-field"
                                    placeholder="Source (book, speech, film...)"
                                    value={sourceInput}
                                    onChange={(e) => setSourceInput(e.target.value)}
                                />
                            </div>
                        ) : (
                            <textarea
                                className="input-field"
                                rows={4}
                                placeholder="Type the quote verbatim"
                                value={quoteInput}
                                onChange={(e) => setQuoteInput(e.target.value)}
                                style={{ marginBottom: '1rem' }}
                            />
                        )}

                        <button className="btn btn-primary" onClick={recordAnswer} style={{ width: '100%' }}>
                            Submit answer
                        </button>
                    </section>
                )}

                {challengeState === 'complete' && (
                    <section className="glass card animate-fade-in" style={{ padding: '2rem', marginBottom: '2rem' }}>
                        <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Challenge Summary</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div className="glass" style={{ padding: '1rem', borderRadius: '0.75rem' }}>
                                <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>Accuracy</div>
                                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: accuracySummary.accuracy >= 90 ? 'var(--success)' : 'var(--accent)' }}>
                                    {accuracySummary.accuracy}%
                                </div>
                            </div>
                            <div className="glass" style={{ padding: '1rem', borderRadius: '0.75rem' }}>
                                <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>Correct Units</div>
                                <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                                    {accuracySummary.correct} / {accuracySummary.total}
                                </div>
                            </div>
                        </div>
                        <div style={{ maxHeight: '320px', overflowY: 'auto', marginBottom: '1.5rem' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                <thead style={{ position: 'sticky', top: 0, background: 'rgba(15,23,42,0.95)' }}>
                                    <tr>
                                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Prompt</th>
                                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Your answer</th>
                                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Correct</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.map((result, index) => (
                                        <tr key={`${result.quote.id}-${index}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '0.5rem' }}>
                                                {result.mode === 'quote-to-source'
                                                    ? `“${result.quote.text}”`
                                                    : `${result.quote.speaker} (${result.quote.source})`}
                                            </td>
                                            <td style={{ padding: '0.5rem' }}>
                                                {result.mode === 'quote-to-source' ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                        <span style={{ color: result.speakerCorrect ? 'var(--success)' : 'var(--error)' }}>
                                                            Speaker: {result.speakerAnswer || '—'}
                                                        </span>
                                                        <span style={{ color: result.sourceCorrect ? 'var(--success)' : 'var(--error)' }}>
                                                            Source: {result.sourceAnswer || '—'}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span style={{ color: result.quoteCorrect ? 'var(--success)' : 'var(--error)' }}>
                                                        {result.quoteAnswer || '—'}
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: '0.5rem' }}>
                                                {result.mode === 'quote-to-source' ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', opacity: 0.8 }}>
                                                        <span>Speaker: {result.quote.speaker}</span>
                                                        <span>Source: {result.quote.source}</span>
                                                    </div>
                                                ) : (
                                                    <span style={{ opacity: 0.8 }}>“{result.quote.text}”</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}
            </main>
        </>
    );
}

