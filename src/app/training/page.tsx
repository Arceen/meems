"use client";

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Link from 'next/link';
import { bootstrapDigitPaoSystem, bootstrapCardPaoSystem, bootstrapMajorSystem } from '@/lib/firebase';
import { digitPaoList } from '@/data/digit-pao';
import { cardPaoList } from '@/data/card-pao';
import { majorSystemList } from '@/data/major-system';
import { doc, getDoc, setDoc, getFirestore } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

const USER_ID = 'default_user'; // In production, use authenticated user ID

type DifficultyLevel = 'foundational' | 'beginner' | 'intermediate' | 'expert';

interface Game {
    id: string;
    title: string;
    description: string;
    difficulty: DifficultyLevel;
    href: string;
    color: string;
    date: string;
}

const games: Game[] = [
    {
        id: 'digits',
        title: 'Digit Memorization',
        description: 'Memorize sequences of random digits.',
        difficulty: 'foundational',
        href: '/digits',
        color: 'from-blue-600 to-indigo-600',
        date: '2023-11-01'
    },
    {
        id: 'words',
        title: 'Word Memorization',
        description: 'Memorize random words in order.',
        difficulty: 'foundational',
        href: '/words',
        color: 'from-emerald-600 to-teal-600',
        date: '2023-11-02'
    },
    {
        id: 'image-vault',
        title: 'The Image Vault',
        description: 'Manage and drill your mnemonic systems (Major, PAO, Palaces).',
        difficulty: 'foundational',
        href: '/training/image-vault',
        color: 'from-rose-500 to-pink-500',
        date: '2023-10-10'
    },
    {
        id: 'instant-visualization',
        title: 'Instant Visualization Test',
        description: 'Explosive image creation speed drill for digits and words.',
        difficulty: 'foundational',
        href: '/training/instant-visualization',
        color: 'from-teal-500 to-cyan-500',
        date: '2023-10-11'
    },
    {
        id: 'sensory-walkthrough',
        title: 'The Sensory Walkthrough',
        description: 'Force deeper palace immersion with guided sensory prompts.',
        difficulty: 'foundational',
        href: '/training/sensory-walkthrough',
        color: 'from-emerald-500 to-green-500',
        date: '2023-10-12'
    },
    {
        id: 'system-checker',
        title: 'System Component Checker',
        description: 'Rapid-fire integrity test for Major and PAO mappings.',
        difficulty: 'foundational',
        href: '/training/system-component-checker',
        color: 'from-slate-500 to-slate-700',
        date: '2023-10-13'
    },
    {
        id: 'philosophical-attribution',
        title: 'Philosophical Attribution',
        description: 'Memorize quotes verbatim and nail the speaker + source on demand.',
        difficulty: 'foundational',
        href: '/training/philosophical-attribution',
        color: 'from-lime-500 to-emerald-500',
        date: '2023-10-18'
    },
    {
        id: 'number-wall',
        title: 'The Number Wall',
        description: 'Test capacity and speed in encoding long sequences of abstract digits.',
        difficulty: 'beginner',
        href: '/training/number-wall',
        color: 'from-blue-500 to-cyan-500',
        date: '2023-10-01'
    },
    {
        id: 'word-palace',
        title: 'Word-Palace Builder',
        description: 'Practice the Phonetic Link or Visual Conversion technique for words.',
        difficulty: 'beginner',
        href: '/training/word-palace',
        color: 'from-indigo-500 to-violet-500',
        date: '2023-10-09'
    },
    {
        id: 'n-back',
        title: 'N-Back Challenge',
        description: 'Classic working memory training. Match current position with N steps back.',
        difficulty: 'beginner',
        href: '/training/n-back',
        color: 'from-violet-500 to-purple-500',
        date: '2023-10-16'
    },
    {
        id: 'quick-math',
        title: 'Quick Math',
        description: 'High-speed arithmetic drills to improve mental calculation speed.',
        difficulty: 'beginner',
        href: '/training/quick-math',
        color: 'from-yellow-500 to-orange-500',
        date: '2023-10-17'
    },
    {
        id: 'visualization-latency',
        title: 'Visualization Latency',
        description: 'Measure and improve your image creation speed with precision timing.',
        difficulty: 'beginner',
        href: '/training/visualization-latency',
        color: 'from-red-500 to-pink-500',
        date: '2023-10-21'
    },
    {
        id: 'chain-reaction',
        title: 'Chain Reaction Latency',
        description: 'Measure transition speed between consecutive mnemonic images in a chain.',
        difficulty: 'beginner',
        href: '/training/chain-reaction',
        color: 'from-cyan-500 to-blue-500',
        date: '2023-10-23'
    },
    {
        id: 'card-blitz',
        title: 'Card Conversion Blitz',
        description: 'Train instant, reflexive conversion of playing cards into mnemonic images.',
        difficulty: 'intermediate',
        href: '/training/card-blitz',
        color: 'from-red-500 to-orange-500',
        date: '2023-10-02'
    },
    {
        id: 'card-sequence',
        title: 'Card Sequence Memory',
        description: 'Memorize sequences of playing cards with speed and accuracy.',
        difficulty: 'intermediate',
        href: '/training/card-sequence',
        color: 'from-amber-500 to-yellow-500',
        date: '2023-10-22'
    },
    {
        id: 'names-gauntlet',
        title: 'The Names Gauntlet',
        description: 'Practice associating arbitrary names with distinct facial features.',
        difficulty: 'intermediate',
        href: '/training/names-gauntlet',
        color: 'from-green-500 to-emerald-500',
        date: '2023-10-03'
    },
    {
        id: 'names-international',
        title: 'International Names',
        description: 'Memorize names and faces from diverse international backgrounds.',
        difficulty: 'intermediate',
        href: '/training/names-international',
        color: 'from-green-600 to-teal-600',
        date: '2023-10-14'
    },
    {
        id: 'binary-surge',
        title: 'Binary Code Surge',
        description: 'High-intensity conversion of non-decimal data (0s and 1s).',
        difficulty: 'intermediate',
        href: '/training/binary-surge',
        color: 'from-purple-500 to-pink-500',
        date: '2023-10-04'
    },
    {
        id: 'image-sequence',
        title: 'Image Sequence',
        description: 'Rapid-fire visual memory test with high-speed image presentation.',
        difficulty: 'intermediate',
        href: '/training/image-sequence',
        color: 'from-pink-500 to-rose-500',
        date: '2023-10-15'
    },
    {
        id: 'focus-shifter',
        title: 'Focus Shifter',
        description: 'Rapidly switch between processing numbers and visual-spatial information.',
        difficulty: 'intermediate',
        href: '/training/focus-shifter',
        color: 'from-fuchsia-500 to-purple-500',
        date: '2023-10-19'
    },
    {
        id: 'urban-locus-tracer',
        title: 'Urban Locus Tracer',
        description: 'Build and test your memory palace using real-world map locations.',
        difficulty: 'intermediate',
        href: '/training/urban-locus-tracer',
        color: 'from-blue-500 to-indigo-500',
        date: '2023-10-20'
    },
    {
        id: 'spoken-numbers',
        title: 'Spoken Number Terror',
        description: 'Ultimate test of concentration with sequentially presented auditory digits.',
        difficulty: 'expert',
        href: '/training/spoken-numbers',
        color: 'from-yellow-500 to-amber-500',
        date: '2023-10-05'
    },
    {
        id: 'decathlon',
        title: 'Decathlon Simulation',
        description: 'Test mental stamina with a sequential simulation of multiple disciplines.',
        difficulty: 'expert',
        href: '/training/decathlon',
        color: 'from-slate-500 to-gray-500',
        date: '2023-10-06'
    },
    {
        id: 'abstract-matrix',
        title: 'The Abstract Matrix',
        description: 'Visual-spatial overload: Link abstract patterns to coordinates and numbers.',
        difficulty: 'expert',
        href: '/training/abstract-matrix',
        color: 'from-cyan-500 to-teal-500',
        date: '2023-10-07'
    },
    {
        id: 'multilingual-list',
        title: 'The Multilingual List',
        description: 'Phonetic bridge training with foreign language vocabulary.',
        difficulty: 'expert',
        href: '/training/multilingual-list',
        color: 'from-orange-500 to-red-500',
        date: '2023-10-08'
    },
    {
        id: 'srs-review',
        title: 'SRS Review',
        description: 'Spaced repetition queue. Reviews due major system cards with adaptive intervals.',
        difficulty: 'foundational',
        href: '/training/review',
        color: 'from-emerald-500 to-green-400',
        date: '2026-06-12'
    },
    {
        id: 'historic-dates',
        title: 'Historic Dates',
        description: 'Memorize years for real or fictional historical events. WMC-format drill.',
        difficulty: 'intermediate',
        href: '/training/historic-dates',
        color: 'from-purple-500 to-violet-500',
        date: '2026-06-12'
    },
    {
        id: 'spoken-words',
        title: 'Spoken Words',
        description: 'Memorize words read aloud at a timed pace. One per line in recall.',
        difficulty: 'beginner',
        href: '/training/spoken-words',
        color: 'from-amber-500 to-yellow-400',
        date: '2026-06-12'
    }
];

type TabType = 'all' | 'favorites' | 'foundational' | 'beginner' | 'intermediate' | 'expert';

export default function TrainingHub() {
    const [favorites, setFavorites] = useState<string[]>([]);
    const [mounted, setMounted] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('all');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setMounted(true);
        loadFavorites();
        bootstrapSystems();
    }, []);

    const loadFavorites = async () => {
        try {
            const docRef = doc(db, 'training_favorites', USER_ID);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const data = docSnap.data();
                setFavorites(data.favorites || []);
            }
        } catch (error) {
            console.error('Error loading favorites:', error);
            // Fallback to localStorage
            const savedFavorites = localStorage.getItem('training_favorites');
            if (savedFavorites) {
                setFavorites(JSON.parse(savedFavorites));
            }
        } finally {
            setLoading(false);
        }
    };

    const saveFavorites = async (newFavorites: string[]) => {
        try {
            const docRef = doc(db, 'training_favorites', USER_ID);
            await setDoc(docRef, {
                favorites: newFavorites,
                lastUpdated: Date.now()
            });
            // Also save to localStorage as backup
            localStorage.setItem('training_favorites', JSON.stringify(newFavorites));
        } catch (error) {
            console.error('Error saving favorites:', error);
            // Fallback to localStorage only
            localStorage.setItem('training_favorites', JSON.stringify(newFavorites));
        }
    };

    const bootstrapSystems = async () => {
        const initDigitPao = async () => {
            const paoEntries = digitPaoList.map(p => ({
                id: p.number,
                ...p
            }));
            await bootstrapDigitPaoSystem(paoEntries);
        };
        
        const initCardPao = async () => {
            const paoEntries = cardPaoList.map(p => ({
                id: p.card,
                ...p
            }));
            await bootstrapCardPaoSystem(paoEntries);
        };

        const initMajorSystem = async () => {
            const majorEntries = majorSystemList.map(m => ({
                id: m.number,
                number: m.number,
                images: [m.word],
                persons: [],
                actions: [],
                objects: []
            }));
            await bootstrapMajorSystem(majorEntries);
        };

        initDigitPao();
        initCardPao();
        initMajorSystem();
    };

    const toggleFavorite = async (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        
        const newFavorites = favorites.includes(id) 
            ? favorites.filter(fav => fav !== id)
            : [...favorites, id];
        
        setFavorites(newFavorites);
        await saveFavorites(newFavorites);
    };

    const getFilteredGames = () => {
        let filtered = games;

        if (activeTab === 'favorites') {
            filtered = games.filter(game => favorites.includes(game.id));
        } else if (activeTab !== 'all') {
            filtered = games.filter(game => game.difficulty === activeTab);
        }

        return filtered.sort((a, b) => {
            const aFav = favorites.includes(a.id);
            const bFav = favorites.includes(b.id);
            
            if (aFav && !bFav) return -1;
            if (!aFav && bFav) return 1;
            
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
    };

    const tabs: { id: TabType; label: string }[] = [
        { id: 'all', label: 'All' },
        { id: 'favorites', label: 'Favorites' },
        { id: 'foundational', label: 'Foundational' },
        { id: 'beginner', label: 'Beginner' },
        { id: 'intermediate', label: 'Intermediate' },
        { id: 'expert', label: 'Expert' }
    ];

    const getDifficultyLabel = (difficulty: DifficultyLevel): string => {
        return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
    };

    if (!mounted || loading) return null;

    const filteredGames = getFilteredGames();

    return (
        <>
            <Header />
            <main className="container" style={{ maxWidth: '1200px' }}>
                <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1rem', background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Memory Athlete Training
                    </h1>
                    <p style={{ color: '#94a3b8', maxWidth: '600px', margin: '0 auto' }}>
                        Master the core disciplines of competitive memory sports with progressive difficulty levels.
                    </p>
                </div>

                {/* Tabs */}
                <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    marginBottom: '2rem',
                    overflowX: 'auto',
                    padding: '0.5rem',
                    borderRadius: '12px',
                    background: 'rgba(15, 23, 42, 0.6)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                padding: '0.75rem 1.5rem',
                                borderRadius: '8px',
                                border: 'none',
                                background: activeTab === tab.id 
                                    ? 'linear-gradient(135deg, var(--primary), var(--accent))' 
                                    : 'transparent',
                                color: activeTab === tab.id ? '#fff' : '#94a3b8',
                                fontWeight: activeTab === tab.id ? '600' : '500',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                whiteSpace: 'nowrap',
                                fontSize: '0.95rem'
                            }}
                            onMouseEnter={(e) => {
                                if (activeTab !== tab.id) {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                    e.currentTarget.style.color = '#fff';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (activeTab !== tab.id) {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = '#94a3b8';
                                }
                            }}
                        >
                            {tab.label}
                            {tab.id === 'favorites' && favorites.length > 0 && (
                                <span style={{
                                    marginLeft: '0.5rem',
                                    padding: '0.125rem 0.5rem',
                                    borderRadius: '12px',
                                    background: activeTab === tab.id ? 'rgba(255,255,255,0.2)' : 'rgba(251, 191, 36, 0.2)',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold'
                                }}>
                                    {favorites.length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Games Grid */}
                {filteredGames.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '4rem 2rem',
                        color: '#94a3b8'
                    }}>
                        <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" strokeWidth="2" style={{ margin: '0 auto 1rem', opacity: 0.3 }}>
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                        <p style={{ fontSize: '1.1rem' }}>No favorites yet. Click the star icon on any exercise to add it to your favorites!</p>
                    </div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                        gap: '1.5rem',
                        paddingBottom: '2rem'
                    }}>
                        {filteredGames.map((game) => (
                            <Link href={game.href} key={game.id} style={{ display: 'block', position: 'relative' }}>
                                <div className="glass card" style={{
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    transition: 'transform 0.2s, box-shadow 0.2s',
                                    cursor: 'pointer',
                                    position: 'relative'
                                }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-5px)';
                                        e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.3)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                >
                                    <button
                                        onClick={(e) => toggleFavorite(e, game.id)}
                                        style={{
                                            position: 'absolute',
                                            top: '1rem',
                                            right: '1rem',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: favorites.includes(game.id) ? '#fbbf24' : 'rgba(255,255,255,0.2)',
                                            transition: 'color 0.2s',
                                            zIndex: 10,
                                            padding: '0.25rem'
                                        }}
                                        aria-label={favorites.includes(game.id) ? "Remove from favorites" : "Add to favorites"}
                                    >
                                        <svg viewBox="0 0 24 24" width="24" height="24" fill={favorites.includes(game.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                        </svg>
                                    </button>

                                    <div style={{
                                        fontSize: '0.75rem',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        marginBottom: '0.5rem',
                                        color: 'var(--primary)',
                                        fontWeight: 'bold'
                                    }}>
                                        {getDifficultyLabel(game.difficulty)}
                                    </div>
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.75rem', paddingRight: '2rem' }}>
                                        {game.title}
                                    </h3>
                                    <p style={{ fontSize: '0.9rem', color: '#cbd5e1', lineHeight: '1.5', flex: 1 }}>
                                        {game.description}
                                    </p>
                                    <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', color: 'var(--accent)', fontSize: '0.9rem', fontWeight: '600' }}>
                                        Start Training <span style={{ marginLeft: '0.5rem' }}>→</span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </main>
        </>
    );
}
