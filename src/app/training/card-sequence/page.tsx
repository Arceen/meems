"use client";

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import Link from 'next/link';
import { saveGameResult } from '@/lib/firebase';

type GameState = 'setup' | 'memorize' | 'recall' | 'result';
type RecallOrder = 'forward' | 'reverse';

const SUITS = ['♠', '♥', '♣', '♦'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

interface Card {
    id: string;
    suit: string;
    rank: string;
}

const generateDeck = () => {
    const deck: Card[] = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push({ suit, rank, id: `${rank}${suit}` });
        }
    }
    return deck;
};

const shuffleDeck = (deck: Card[]) => {
    const newDeck = [...deck];
    for (let i = newDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
    }
    return newDeck;
};

export default function CardSequence() {
    const [gameState, setGameState] = useState<GameState>('setup');
    const [cardCount, setCardCount] = useState(52);
    const [recallOrder, setRecallOrder] = useState<RecallOrder>('forward');

    const [sequence, setSequence] = useState<Card[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userSequence, setUserSequence] = useState<Card[]>([]);
    const [availableCards, setAvailableCards] = useState<Card[]>([]); // The pool to pick from

    const [startTime, setStartTime] = useState(0);
    const [memorizeTime, setMemorizeTime] = useState(0);
    const [recallTime, setRecallTime] = useState(0);

    // Setup
    const startGame = () => {
        const fullDeck = generateDeck();
        const shuffled = shuffleDeck(fullDeck);
        const selected = shuffled.slice(0, cardCount);

        setSequence(selected);
        setAvailableCards(fullDeck); // Pool is always full 52 cards? Or just the subset? 
        // "initially all cards are showed" implies full deck usually, but for a "sequence" drill of specific cards, 
        // maybe just the ones involved? 
        // If I choose 5 cards, finding them in 52 is a search task + memory. 
        // If I choose 52, it's just ordering.
        // I'll stick to full 52 deck as the pool to make it a proper "Card Memory" drill.

        setCurrentIndex(0);
        setGameState('memorize');
        setStartTime(Date.now());
    };

    // Memorization
    const nextCard = () => {
        if (currentIndex < sequence.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            startRecall();
        }
    };

    const startRecall = () => {
        setMemorizeTime(Date.now() - startTime);
        setGameState('recall');
        setStartTime(Date.now());
        setUserSequence([]);
        // Available cards are already set to full deck.
        // We might want to sort them for easier finding?
        // Usually recall decks are sorted.
        setAvailableCards(generateDeck());
    };

    // Recall
    const selectCard = (card: Card) => {
        // Add to user sequence
        const newUserSequence = [...userSequence, card];
        setUserSequence(newUserSequence);

        // Remove from available (make unavailable)
        // We can just filter it out or mark it. 
        // "after selection each become unavailable"
        setAvailableCards(prev => prev.map(c => c.id === card.id ? { ...c, unavailable: true } : c) as any);

        // Check if done
        if (newUserSequence.length === sequence.length) {
            finishGame(newUserSequence);
        }
    };

    const finishGame = async (finalUserSequence: Card[]) => {
        const endTime = Date.now();
        setRecallTime(endTime - startTime);
        setGameState('result');

        // Calculate Score
        let correct = 0;
        const targetSequence = recallOrder === 'reverse' ? [...sequence].reverse() : sequence;

        finalUserSequence.forEach((card, idx) => {
            if (card.id === targetSequence[idx].id) {
                correct++;
            }
        });

        // Save result
        try {
            await saveGameResult({
                type: 'card-sequence',
                count: cardCount,
                correct,
                total: cardCount,
                percentage: (correct / cardCount) * 100,
                memorizeTime: memorizeTime / 1000,
                recallTime: (endTime - startTime) / 1000,
                precision: Math.round((correct / cardCount) * 100),
                completeness: 100,
            });
        } catch (e) {
            console.error(e);
        }
    };

    // Keyboard for memorization
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (gameState === 'memorize' && (e.code === 'Space' || e.code === 'ArrowRight')) {
                nextCard();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [gameState, currentIndex, sequence]);

    const getCardColor = (suit: string) => {
        return (suit === '♥' || suit === '♦') ? '#ef4444' : '#0f172a';
    };

    return (
        <>
            <Header />
            <main className="container" style={{ maxWidth: '1000px', paddingBottom: '4rem' }}>

                {/* Header / Nav */}
                <div style={{ marginBottom: '2rem' }}>
                    <Link href="/training" style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '0.5rem', display: 'inline-block' }}>
                        ← Back to Training
                    </Link>
                    <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Sequence Recall</h1>
                </div>

                {gameState === 'setup' && (
                    <div className="glass card animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
                        <div style={{ marginBottom: '2rem' }}>
                            <label style={{ display: 'block', marginBottom: '1rem', fontSize: '1rem' }}>
                                Number of Cards: <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{cardCount}</span>
                            </label>
                            <input
                                type="range"
                                min="1"
                                max="52"
                                value={cardCount}
                                onChange={(e) => setCardCount(parseInt(e.target.value))}
                                style={{ width: '100%', accentColor: 'var(--primary)' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', opacity: 0.5, marginTop: '0.5rem' }}>
                                <span>1</span>
                                <span>52</span>
                            </div>
                        </div>

                        <div style={{ marginBottom: '2rem' }}>
                            <label style={{ display: 'block', marginBottom: '1rem', fontSize: '1rem' }}>Recall Order</label>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button
                                    className={`btn ${recallOrder === 'forward' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setRecallOrder('forward')}
                                    style={{ flex: 1 }}
                                >
                                    Forward (1 → End)
                                </button>
                                <button
                                    className={`btn ${recallOrder === 'reverse' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setRecallOrder('reverse')}
                                    style={{ flex: 1 }}
                                >
                                    Reverse (End → 1)
                                </button>
                            </div>
                        </div>

                        <button className="btn btn-primary" style={{ width: '100%', padding: '1rem' }} onClick={startGame}>
                            Start Memorization
                        </button>
                    </div>
                )}

                {gameState === 'memorize' && (
                    <div className="animate-fade-in" style={{ textAlign: 'center', height: '60vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                        <div style={{ marginBottom: '1rem', opacity: 0.7 }}>
                            Card {currentIndex + 1} / {cardCount}
                        </div>

                        <div
                            className="glass"
                            onClick={nextCard}
                            style={{
                                width: '280px',
                                height: '400px',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                fontSize: '6rem',
                                borderRadius: '1.5rem',
                                background: 'white',
                                color: getCardColor(sequence[currentIndex].suit),
                                boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                                cursor: 'pointer',
                                position: 'relative',
                                userSelect: 'none'
                            }}
                        >
                            <div style={{ position: 'absolute', top: '1.5rem', left: '1.5rem', fontSize: '2rem', lineHeight: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <span>{sequence[currentIndex].rank}</span>
                                <span>{sequence[currentIndex].suit}</span>
                            </div>

                            <div>{sequence[currentIndex].suit}</div>

                            <div style={{ position: 'absolute', bottom: '1.5rem', right: '1.5rem', fontSize: '2rem', lineHeight: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', transform: 'rotate(180deg)' }}>
                                <span>{sequence[currentIndex].rank}</span>
                                <span>{sequence[currentIndex].suit}</span>
                            </div>
                        </div>

                        <div style={{ marginTop: '2rem', opacity: 0.5 }}>
                            Tap card or press Space to continue
                        </div>
                    </div>
                )}

                {gameState === 'recall' && (
                    <div className="animate-fade-in">
                        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
                                Recall {recallOrder === 'forward' ? 'Forward' : 'Reverse'}
                            </h2>
                            <p style={{ opacity: 0.7 }}>
                                Select the cards in the correct order ({userSequence.length} / {cardCount})
                            </p>
                        </div>

                        {/* Selection Pool */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(50px, 1fr))',
                            gap: '0.5rem',
                            maxWidth: '900px',
                            margin: '0 auto'
                        }}>
                            {availableCards.map((card: any) => (
                                <button
                                    key={card.id}
                                    disabled={card.unavailable}
                                    onClick={() => selectCard(card)}
                                    style={{
                                        aspectRatio: '2/3',
                                        background: card.unavailable ? 'rgba(255,255,255,0.05)' : 'white',
                                        color: getCardColor(card.suit),
                                        border: 'none',
                                        borderRadius: '0.25rem',
                                        fontSize: '1.2rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: card.unavailable ? 'default' : 'pointer',
                                        opacity: card.unavailable ? 0.2 : 1,
                                        transition: 'transform 0.1s',
                                        boxShadow: card.unavailable ? 'none' : '0 2px 5px rgba(0,0,0,0.2)'
                                    }}
                                    onMouseEnter={(e) => !card.unavailable && (e.currentTarget.style.transform = 'scale(1.1)')}
                                    onMouseLeave={(e) => !card.unavailable && (e.currentTarget.style.transform = 'scale(1)')}
                                >
                                    <span style={{ fontWeight: 'bold' }}>{card.rank}</span>
                                    <span>{card.suit}</span>
                                </button>
                            ))}
                        </div>

                        {/* Current Sequence Preview (Optional, maybe just last picked?) */}
                        <div style={{
                            marginTop: '2rem',
                            display: 'flex',
                            gap: '0.5rem',
                            overflowX: 'auto',
                            padding: '1rem',
                            background: 'rgba(0,0,0,0.2)',
                            borderRadius: '0.5rem',
                            minHeight: '80px'
                        }}>
                            {userSequence.map((card, idx) => (
                                <div key={idx} style={{
                                    minWidth: '40px',
                                    height: '60px',
                                    background: 'white',
                                    color: getCardColor(card.suit),
                                    borderRadius: '0.25rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.9rem'
                                }}>
                                    {card.rank}{card.suit}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {gameState === 'result' && (
                    <div className="glass card animate-fade-in" style={{ textAlign: 'center' }}>
                        <h2 style={{ fontSize: '2rem', marginBottom: '2rem' }}>Results</h2>

                        {(() => {
                            const targetSequence = recallOrder === 'reverse' ? [...sequence].reverse() : sequence;
                            const correctCount = userSequence.filter((c, i) => c.id === targetSequence[i].id).length;
                            const percentage = Math.round((correctCount / cardCount) * 100);

                            return (
                                <>
                                    <div style={{ fontSize: '4rem', fontWeight: 'bold', color: percentage === 100 ? 'var(--success)' : 'var(--primary)', marginBottom: '1rem' }}>
                                        {percentage}%
                                    </div>
                                    <p style={{ fontSize: '1.2rem', marginBottom: '2rem' }}>
                                        You recalled {correctCount} out of {cardCount} cards correctly.
                                    </p>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                                        <div>Position</div>
                                        <div>Correct Card</div>
                                        <div>Your Pick</div>
                                    </div>

                                    <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '2rem' }}>
                                        {targetSequence.map((target, idx) => {
                                            const userCard = userSequence[idx];
                                            const isCorrect = userCard?.id === target.id;

                                            return (
                                                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <div style={{ opacity: 0.5 }}>{idx + 1}</div>
                                                    <div style={{ color: getCardColor(target.suit) }}>{target.rank}{target.suit}</div>
                                                    <div style={{ color: isCorrect ? 'var(--primary)' : 'var(--error)', fontWeight: isCorrect ? 'bold' : 'normal' }}>
                                                        {userCard ? `${userCard.rank}${userCard.suit}` : '-'}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <button className="btn btn-primary" onClick={() => setGameState('setup')}>
                                        Try Again
                                    </button>
                                </>
                            );
                        })()}
                    </div>
                )}

            </main>
        </>
    );
}
