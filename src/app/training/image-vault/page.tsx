
"use client";

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Header from '@/components/Header';
import Link from 'next/link';
import {
    getImageVaultData,
    saveImageVaultData,
    CardStats,
    CardAttempt,
    saveCardAttempt,
    getCardStats,
    getCardPerformanceColor,
    getCardHistory,
    getGlobalDailyStats,
    getCardDailyStats,
    type DailyGlobalStats,
    savePalaceAttempt,
    getPalaceStats,
    type PalaceAttempt,
    type PalaceStats,
    type PalaceItemStat,
    MajorEntry,
    PaoEntry,
    DigitPaoEntry,
    Palace,
    startTrainingSession,
    endTrainingSession,
    getTimeStats,
    type TimeStats,
    getSessionHistory,
    type TrainingSession,
    bootstrapDigitPaoSystem,
    saveGameResult,
    migrateMajorImagesToPao,
} from '@/lib/firebase';
import { majorSystemList } from '@/data/major-system';
import { cardPaoList } from '@/data/card-pao';
import { digitPaoList } from '@/data/digit-pao';
import wordList from '@/data/words.json';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Scatter, ScatterChart, ZAxis, ComposedChart } from 'recharts';
import { SAMPLE_MAJOR_SYSTEM, SAMPLE_PAO_SYSTEM, SAMPLE_PALACES } from '@/data/sampleImageVault';

type SystemType = 'analytics' | 'major' | 'card-pao' | 'digit-pao' | 'palace';
type TimeFilter = '1h' | '2h' | '12h' | '1d' | '1w' | '1m' | '1y' | 'all';

const STORAGE_KEY = 'image_vault_data';

export default function ImageVault() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const [activeTab, setActiveTab] = useState<SystemType>('analytics');
    const [userId, setUserId] = useState('default_user');
    const [drillStartTime, setDrillStartTime] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
    const [cardPerformanceStats, setCardPerformanceStats] = useState<Map<string, CardStats>>(new Map());
    const [sessionHistory, setSessionHistory] = useState<TrainingSession[]>([]);

    // Major System
    const [majorSystem, setMajorSystem] = useState<MajorEntry[]>([]);
    const [editingMajor, setEditingMajor] = useState<string | null>(null);

    // New PAO-style inputs
    const [newMajorPerson, setNewMajorPerson] = useState('');
    const [newMajorAction, setNewMajorAction] = useState('');
    const [newMajorObject, setNewMajorObject] = useState('');

    // Migration state
    const [migrating, setMigrating] = useState(false);
    const [migrateResult, setMigrateResult] = useState<{ migrated: number; skipped: number } | null>(null);

    // Analytics State
    const [majorViewMode, setMajorViewMode] = useState<'cards' | 'analytics'>('cards');
    const [selectedCardForStats, setSelectedCardForStats] = useState<string>('');
    const [cardHistory, setCardHistory] = useState<CardAttempt[]>([]);

    // Palace Drill State
    const [palaceDrillMode, setPalaceDrillMode] = useState<'config' | 'memorize' | 'recall' | 'result' | null>(null);
    const [selectedPalaceForDrill, setSelectedPalaceForDrill] = useState<Palace | null>(null);
    const [drillTurns, setDrillTurns] = useState(1);
    const [drillIsTimed, setDrillIsTimed] = useState(false);
    const [drillTimeLimit, setDrillTimeLimit] = useState(60); // seconds
    const [drillWords, setDrillWords] = useState<string[]>([]);
    const [currentDrillIndex, setCurrentDrillIndex] = useState(0);
    const [memorizeStartTime, setMemorizeStartTime] = useState(0);
    const [recallStartTime, setRecallStartTime] = useState(0);
    const [itemStartTime, setItemStartTime] = useState(0);
    const [drillItemStats, setDrillItemStats] = useState<PalaceItemStat[]>([]);
    const [currentRecallInput, setCurrentRecallInput] = useState('');
    const [lastRecallFeedback, setLastRecallFeedback] = useState<'correct' | 'incorrect' | null>(null);
    const [lastRecallCorrectWord, setLastRecallCorrectWord] = useState('');
    const [palaceStats, setPalaceStats] = useState<PalaceStats | null>(null);

    // Card PAO System
    const [cardPaoSystem, setCardPaoSystem] = useState<PaoEntry[]>([]);
    const [newCardPaoCard, setNewCardPaoCard] = useState('');
    const [newCardPaoPerson, setNewCardPaoPerson] = useState('');
    const [newCardPaoAction, setNewCardPaoAction] = useState('');
    const [newCardPaoObject, setNewCardPaoObject] = useState('');

    // Digit PAO System
    const [digitPaoSystem, setDigitPaoSystem] = useState<DigitPaoEntry[]>([]);
    const [newDigitPaoNumber, setNewDigitPaoNumber] = useState('');
    const [newDigitPaoPerson, setNewDigitPaoPerson] = useState('');
    const [newDigitPaoAction, setNewDigitPaoAction] = useState('');
    const [newDigitPaoObject, setNewDigitPaoObject] = useState('');

    // Memory Palaces
    const [palaces, setPalaces] = useState<Palace[]>([]);
    const [editingPalace, setEditingPalace] = useState<string | null>(null);
    const [activeLocationInput, setActiveLocationInput] = useState<string | null>(null);
    const [editingLocation, setEditingLocation] = useState<{ palaceId: string, index: number } | null>(null);
    const [newPalaceName, setNewPalaceName] = useState('');
    const [newLocationMap, setNewLocationMap] = useState<Map<string, string>>(new Map());

    // Drag and Drop State
    const [draggedItem, setDraggedItem] = useState<{ palaceId: string, index: number } | null>(null);
    const [dragOverItem, setDragOverItem] = useState<{ palaceId: string, index: number } | null>(null);

    // Quiz State
    const [quizMode, setQuizMode] = useState<'config' | 'active' | 'result' | null>(null);
    const [quizConfig, setQuizConfig] = useState({
        turns: 1,
        type: 'mixed' as 'digits' | 'words' | 'mixed',
        mode: 'untimed' as 'timed' | 'untimed',
        cardDifficulty: 'all' as 'all' | 'platinum' | 'gold' | 'silver' | 'bronze'
    });
    const [quizQueue, setQuizQueue] = useState<MajorEntry[]>([]);
    const [currentQuizCard, setCurrentQuizCard] = useState<MajorEntry | null>(null);
    const [quizQuestionType, setQuizQuestionType] = useState<'digits' | 'words'>('digits');
    const [quizPromptWord, setQuizPromptWord] = useState('');
    const [quizInput, setQuizInput] = useState('');
    const [quizStats, setQuizStats] = useState({ correct: 0, wrong: 0, startTime: 0, endTime: 0 });
    const [quizFeedback, setQuizFeedback] = useState<{ status: 'correct' | 'wrong' | null, message: string }>({ status: null, message: '' });
    const [flippedCards, setFlippedCards] = useState<Set<string>>(new Set());
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [timeStats, setTimeStats] = useState<TimeStats | null>(null);
    const [cardStats, setCardStats] = useState<Map<string, { attempts: number, attemptTimes: number[], masteredTime: number }>>(new Map());
    const [currentCardStartTime, setCurrentCardStartTime] = useState(0);
    const [wordsVisible, setWordsVisible] = useState(true); // Toggle for showing/hiding words on cards
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        if (activeTab === 'analytics') {
            const loadTimeStats = async () => {
                const stats = await getTimeStats(userId, timeFilter);
                setTimeStats(stats);
            };
            loadTimeStats();
        }
    }, [activeTab, timeFilter, userId]);

    // Helper to format duration
    const formatDuration = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    };


    // Load from Firestore on mount
    useEffect(() => {
        const loadData = async () => {
            // Bootstrap digit PAO system if needed
            const digitEntries = digitPaoList.map(p => ({ id: p.number, ...p }));
            await bootstrapDigitPaoSystem(digitEntries);

            const data = await getImageVaultData();
            if (data) {
                setMajorSystem(data.majorSystem || []);
                setCardPaoSystem(data.paoSystem || []);
                setDigitPaoSystem(data.digitPaoSystem || []);
                setPalaces(data.palaces || []);
            } else {
                // Initialize with sample data if no cloud data exists (or handle empty state)
                // For now, we'll just leave them empty or rely on the bootstrap logic from TrainingHub
                // But if we want to be safe:
                setMajorSystem([...SAMPLE_MAJOR_SYSTEM]);
                // We don't load sample PAO here to avoid overwriting the bootstrapped data potentially
            }
        };

        loadData();
    }, []);

    const [globalStats, setGlobalStats] = useState<DailyGlobalStats[]>([]);
    const [cardDailyStats, setCardDailyStats] = useState<DailyGlobalStats[]>([]);

    // Load stats when mode changes or time filter changes
    useEffect(() => {
        const loadSessionHistory = async () => {
            const sessions = await getSessionHistory(userId, timeFilter);
            setSessionHistory(sessions);
        };

        const loadStats = async () => {
            if (majorViewMode === 'cards') {
                const stats = await getCardStats(userId, timeFilter);
                setCardPerformanceStats(stats);
            } else if (majorViewMode === 'analytics') {
                // Load global stats
                const gStats = await getGlobalDailyStats(userId, timeFilter);
                setGlobalStats(gStats);
                // Load session history
                await loadSessionHistory();
            }
        };
        loadStats();
    }, [timeFilter, quizMode, majorViewMode]);

    // Load card history when selected
    useEffect(() => {
        if (majorViewMode === 'analytics') {
            if (selectedCardForStats) {
                const loadHistory = async () => {
                    const history = await getCardHistory(selectedCardForStats, 'default_user', timeFilter);
                    setCardHistory(history);

                    // Also load daily stats for this card
                    const dailyStats = await getCardDailyStats(selectedCardForStats, userId, timeFilter);
                    setCardDailyStats(dailyStats);
                };
                loadHistory();
            } else if (majorSystem.length > 0) {
                // Default to first card if none selected
                setSelectedCardForStats(majorSystem[0].number);
            }
        }
    }, [majorViewMode, selectedCardForStats, timeFilter, majorSystem]);

    // Save to Firestore whenever data changes (Debounced)
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            saveImageVaultData({
                majorSystem,
                paoSystem: cardPaoSystem,
                digitPaoSystem,
                palaces
            });
        }, 1000); // 1 second debounce for cloud save

        return () => clearTimeout(timeoutId);
    }, [majorSystem, cardPaoSystem, digitPaoSystem, palaces]);

    // ===== PALACE DRILL FUNCTIONS =====

    const startPalaceDrillConfig = (palace: Palace) => {
        setSelectedPalaceForDrill(palace);
        setPalaceDrillMode('config');
        setDrillTurns(1);
        setDrillIsTimed(false);
        setDrillTimeLimit(60);
    };

    const startMemorizePhase = () => {
        if (!selectedPalaceForDrill) return;

        // Generate words
        const totalWords = selectedPalaceForDrill.locations.length * drillTurns;
        const words: string[] = [];
        for (let i = 0; i < totalWords; i++) {
            const randomIndex = Math.floor(Math.random() * wordList.length);
            words.push(wordList[randomIndex]);
        }

        setDrillWords(words);
        setCurrentDrillIndex(0);
        setPalaceDrillMode('memorize');
        setMemorizeStartTime(Date.now());
        setDrillStartTime(Date.now());

        // Start tracking session
        startTrainingSession('palace-drill', userId, {
            palaceId: selectedPalaceForDrill.id,
            turns: drillTurns,
            timed: drillIsTimed
        }).then(id => setCurrentSessionId(id));
    };

    const nextMemorizeItem = () => {
        if (currentDrillIndex < drillWords.length - 1) {
            setCurrentDrillIndex(prev => prev + 1);
        } else {
            startRecallPhase();
        }
    };

    const prevMemorizeItem = () => {
        if (currentDrillIndex > 0) {
            setCurrentDrillIndex(prev => prev - 1);
        }
    };

    const startRecallPhase = () => {
        setPalaceDrillMode('recall');
        setRecallStartTime(Date.now());
        setCurrentDrillIndex(0);
        setItemStartTime(Date.now());
        setDrillItemStats([]);
        setCurrentRecallInput('');
        setLastRecallFeedback(null);
    };

    const submitRecallItem = () => {
        if (!selectedPalaceForDrill) return;

        const correctWord = drillWords[currentDrillIndex];
        const isCorrect = currentRecallInput.toLowerCase().trim() === correctWord.toLowerCase().trim();
        const recallTime = Date.now() - itemStartTime;

        const locationIndex = currentDrillIndex % selectedPalaceForDrill.locations.length;

        const stat: PalaceItemStat = {
            locationIndex,
            word: correctWord,
            isCorrect,
            recallTime
        };

        setDrillItemStats(prev => [...prev, stat]);
        setLastRecallFeedback(isCorrect ? 'correct' : 'incorrect');
        setLastRecallCorrectWord(correctWord);

        // Auto-advance after delay
        setTimeout(() => {
            setLastRecallFeedback(null);
            setCurrentRecallInput('');
            if (currentDrillIndex < drillWords.length - 1) {
                setCurrentDrillIndex(prev => prev + 1);
                setItemStartTime(Date.now());
            } else {
                finishPalaceDrill([...drillItemStats, stat]);
            }
        }, 1500);
    };

    const finishPalaceDrill = async (finalStats: PalaceItemStat[]) => {
        if (!selectedPalaceForDrill) return;

        const endTime = Date.now();
        const memorizeTime = recallStartTime - memorizeStartTime;
        const recallTime = endTime - recallStartTime;
        const correctCount = finalStats.filter(s => s.isCorrect).length;

        // End tracking session with stats
        endCurrentSession(true, {
            correct: correctCount,
            wrong: finalStats.length - correctCount,
            total: finalStats.length
        });

        const attempt: PalaceAttempt = {
            palaceId: selectedPalaceForDrill.id,
            timestamp: endTime,
            totalWords: drillWords.length,
            correctCount,
            memorizeTime,
            recallTime,
            turns: drillTurns,
            isTimed: drillIsTimed,
            itemStats: finalStats
        };

        await savePalaceAttempt(attempt, userId);
        const stats = await getPalaceStats(selectedPalaceForDrill.id, userId);
        setPalaceStats(stats);
        setPalaceDrillMode('result');
    };

    // Major System Functions - PAO Style
    const addMajorPerson = (number: string, person: string) => {
        if (!person.trim()) return;

        const existing = majorSystem.find(e => e.number === number);
        if (existing) {
            setMajorSystem(majorSystem.map(e =>
                e.number === number
                    ? { ...e, persons: [...(e.persons || []), person.trim()] }
                    : e
            ));
        } else {
            const newEntry: MajorEntry = {
                id: Date.now().toString(),
                number,
                persons: [person.trim()],
                actions: [],
                objects: []
            };
            setMajorSystem([...majorSystem, newEntry].sort((a, b) => parseInt(a.number) - parseInt(b.number)));
        }
    };

    const addMajorAction = (number: string, action: string) => {
        if (!action.trim()) return;

        const existing = majorSystem.find(e => e.number === number);
        if (existing) {
            setMajorSystem(majorSystem.map(e =>
                e.number === number
                    ? { ...e, actions: [...(e.actions || []), action.trim()] }
                    : e
            ));
        } else {
            const newEntry: MajorEntry = {
                id: Date.now().toString(),
                number,
                persons: [],
                actions: [action.trim()],
                objects: []
            };
            setMajorSystem([...majorSystem, newEntry].sort((a, b) => parseInt(a.number) - parseInt(b.number)));
        }
    };

    const addMajorObject = (number: string, object: string) => {
        if (!object.trim()) return;

        const existing = majorSystem.find(e => e.number === number);
        if (existing) {
            setMajorSystem(majorSystem.map(e =>
                e.number === number
                    ? { ...e, objects: [...(e.objects || []), object.trim()] }
                    : e
            ));
        } else {
            const newEntry: MajorEntry = {
                id: Date.now().toString(),
                number,
                persons: [],
                actions: [],
                objects: [object.trim()]
            };
            setMajorSystem([...majorSystem, newEntry].sort((a, b) => parseInt(a.number) - parseInt(b.number)));
        }
    };

    const deleteMajorPerson = (number: string, person: string) => {
        setMajorSystem(majorSystem.map(e => {
            if (e.number === number) {
                const newPersons = (e.persons || []).filter(p => p !== person);
                // Keep entry even if persons is empty (might have actions/objects)
                return { ...e, persons: newPersons };
            }
            return e;
        }));
    };

    const deleteMajorAction = (number: string, action: string) => {
        setMajorSystem(majorSystem.map(e => {
            if (e.number === number) {
                const newActions = (e.actions || []).filter(a => a !== action);
                return { ...e, actions: newActions };
            }
            return e;
        }));
    };

    const deleteMajorObject = (number: string, object: string) => {
        setMajorSystem(majorSystem.map(e => {
            if (e.number === number) {
                const newObjects = (e.objects || []).filter(o => o !== object);
                return { ...e, objects: newObjects };
            }
            return e;
        }));
    };

    const deleteMajorEntry = (id: string) => {
        setMajorSystem(majorSystem.filter(e => e.id !== id));
    };

    // Card PAO System Functions
    const addCardPaoEntry = () => {
        if (!newCardPaoCard || !newCardPaoPerson) return;

        const newEntry: PaoEntry = {
            id: Date.now().toString(),
            card: newCardPaoCard.toUpperCase(),
            person: newCardPaoPerson,
            action: newCardPaoAction,
            object: newCardPaoObject
        };

        setCardPaoSystem([...cardPaoSystem, newEntry].sort((a, b) => a.card.localeCompare(b.card)));

        setNewCardPaoCard('');
        setNewCardPaoPerson('');
        setNewCardPaoAction('');
        setNewCardPaoObject('');
    };

    const updateCardPaoEntry = (id: string, field: keyof PaoEntry, value: string) => {
        setCardPaoSystem(cardPaoSystem.map(e =>
            e.id === id ? { ...e, [field]: value } : e
        ));
    };

    const deleteCardPaoEntry = (id: string) => {
        setCardPaoSystem(cardPaoSystem.filter(e => e.id !== id));
    };

    // Digit PAO System Functions
    const addDigitPaoEntry = () => {
        if (!newDigitPaoNumber || !newDigitPaoPerson) return;

        const newEntry: DigitPaoEntry = {
            id: Date.now().toString(),
            number: newDigitPaoNumber,
            person: newDigitPaoPerson,
            action: newDigitPaoAction,
            object: newDigitPaoObject
        };

        setDigitPaoSystem([...digitPaoSystem, newEntry].sort((a, b) => parseInt(a.number) - parseInt(b.number)));

        setNewDigitPaoNumber('');
        setNewDigitPaoPerson('');
        setNewDigitPaoAction('');
        setNewDigitPaoObject('');
    };

    const updateDigitPaoEntry = (id: string, field: keyof DigitPaoEntry, value: string) => {
        setDigitPaoSystem(digitPaoSystem.map(e =>
            e.id === id ? { ...e, [field]: value } : e
        ));
    };

    const deleteDigitPaoEntry = (id: string) => {
        setDigitPaoSystem(digitPaoSystem.filter(e => e.id !== id));
    };

    // Palace Functions
    const addPalace = () => {
        if (!newPalaceName) return;

        const newPalace: Palace = {
            id: Date.now().toString(),
            name: newPalaceName,
            locations: []
        };

        setPalaces([...palaces, newPalace]);
        setNewPalaceName('');
        setEditingPalace(newPalace.id);
    };

    const addLocation = (palaceId: string) => {
        const locationText = newLocationMap.get(palaceId) || '';
        if (!locationText.trim()) return;

        setPalaces(palaces.map(p =>
            p.id === palaceId
                ? { ...p, locations: [...p.locations, locationText.trim()] }
                : p
        ));

        // Clear this palace's input
        setNewLocationMap(prev => {
            const next = new Map(prev);
            next.delete(palaceId);
            return next;
        });
    };

    const deleteLocation = (palaceId: string, location: string) => {
        setPalaces(palaces.map(p =>
            p.id === palaceId
                ? { ...p, locations: p.locations.filter(l => l !== location) }
                : p
        ));
    };

    const updateLocation = (palaceId: string, index: number, newName: string) => {
        setPalaces(palaces.map(p => {
            if (p.id === palaceId) {
                const newLocations = [...p.locations];
                newLocations[index] = newName;
                return { ...p, locations: newLocations };
            }
            return p;
        }));
    };

    const moveLocation = (palaceId: string, index: number, direction: 'up' | 'down') => {
        setPalaces(palaces.map(p => {
            if (p.id === palaceId) {
                const newLocations = [...p.locations];
                const newIndex = direction === 'up' ? index - 1 : index + 1;

                if (newIndex >= 0 && newIndex < newLocations.length) {
                    [newLocations[index], newLocations[newIndex]] = [newLocations[newIndex], newLocations[index]];
                }

                return { ...p, locations: newLocations };
            }
            return p;
        }));
    };

    const exitPalaceDrill = () => {
        endCurrentSession(false);
        setPalaceDrillMode(null);
    };

    const deletePalace = async (id: string) => {
        setPalaces(palaces.filter(p => p.id !== id));
        if (editingPalace === id) setEditingPalace(null);
    };

    const updatePalaceName = (id: string, name: string) => {
        setPalaces(palaces.map(p => p.id === id ? { ...p, name } : p));
    };

    // Drag and Drop Handlers
    const handleDragStart = (palaceId: string, index: number) => {
        setDraggedItem({ palaceId, index });
    };

    const handleDragEnter = (palaceId: string, index: number) => {
        setDragOverItem({ palaceId, index });
    };

    const handleDragEnd = () => {
        if (draggedItem && dragOverItem && draggedItem.palaceId === dragOverItem.palaceId) {
            const palace = palaces.find(p => p.id === draggedItem.palaceId);
            if (palace) {
                const newLocations = [...palace.locations];
                const draggedLocation = newLocations[draggedItem.index];
                newLocations.splice(draggedItem.index, 1);
                newLocations.splice(dragOverItem.index, 0, draggedLocation);

                setPalaces(palaces.map(p =>
                    p.id === draggedItem.palaceId ? { ...p, locations: newLocations } : p
                ));
            }
        }
        setDraggedItem(null);
        setDragOverItem(null);
    };

    // Search/Filter Functions
    // Helper to get card difficulty category
    const getCardDifficulty = (cardNumber: string): 'diamond' | 'gold' | 'silver' | 'bronze' | 'unknown' => {
        const stats = cardPerformanceStats.get(cardNumber);
        if (!stats || stats.totalAttempts === 0) return 'unknown';

        const avgTimeInSeconds = stats.averageTime / 1000;

        // Diamond: 0 mistakes AND average time < 2 seconds
        if (stats.mistakes === 0 && avgTimeInSeconds < 2) return 'diamond';

        const score = stats.performanceScore;
        if (score >= 75) return 'gold';
        if (score >= 50) return 'silver';
        return 'bronze';
    };

    const [selectedDifficultyFilters, setSelectedDifficultyFilters] = useState<Set<string>>(new Set(['unknown', 'diamond', 'gold', 'silver', 'bronze']));

    const toggleDifficultyFilter = (difficulty: string) => {
        // Single-select behavior: only one filter active at a time
        // 'all' shows everything (unknown + diamond + gold + silver + bronze)
        if (difficulty === 'all') {
            setSelectedDifficultyFilters(new Set(['unknown', 'diamond', 'gold', 'silver', 'bronze']));
        } else {
            setSelectedDifficultyFilters(new Set([difficulty]));
        }
    };

    // Search/Filter Functions
    const filteredMajor = majorSystem.filter(e => {
        const matchesSearch = e.number.includes(searchQuery) ||
            e.images?.some(img => img.toLowerCase().includes(searchQuery.toLowerCase()));

        if (!matchesSearch) return false;

        const difficulty = getCardDifficulty(e.number);
        return selectedDifficultyFilters.has(difficulty);
    });

    const filteredCardPao = cardPaoSystem.filter(e =>
        e.card.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.person.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.object.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredDigitPao = digitPaoSystem.filter(e =>
        e.number.includes(searchQuery) ||
        e.person.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.object.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredPalaces = palaces.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.locations.some(l => l.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    // Quiz Functions
    const toggleCardFlip = (id: string) => {
        const newFlipped = new Set(flippedCards);
        if (newFlipped.has(id)) newFlipped.delete(id);
        else newFlipped.add(id);
        setFlippedCards(newFlipped);
    };



    const endCurrentSession = (completed: boolean, customStats?: any) => {
        if (currentSessionId) {
            const statsToSave = customStats || quizStats;
            endTrainingSession(currentSessionId, userId, completed, { stats: statsToSave });
            setCurrentSessionId(null);
        }
    };

    // Persist a quiz summary once per finished run so it shows up in analytics
    const quizResultSavedRef = useRef(false);
    useEffect(() => {
        if (quizMode !== 'result') {
            quizResultSavedRef.current = false;
            return;
        }
        const totalAttempts = quizStats.correct + quizStats.wrong;
        if (quizResultSavedRef.current || totalAttempts === 0) return;
        quizResultSavedRef.current = true;

        saveGameResult({
            type: 'image-vault-quiz',
            count: totalAttempts,
            correct: quizStats.correct,
            total: totalAttempts,
            percentage: Math.round((quizStats.correct / totalAttempts) * 100),
            memorizeTime: 0,
            recallTime: quizStats.endTime > quizStats.startTime
                ? Math.round((quizStats.endTime - quizStats.startTime) / 1000)
                : 0,
            precision: Math.round((quizStats.correct / totalAttempts) * 100),
            completeness: 100,
        }).catch(err => console.error('Failed to save image vault quiz result:', err));
    }, [quizMode, quizStats]);

    const startQuiz = () => {
        let pool = [...majorSystem];

        // Filter by card difficulty if specified
        if (quizConfig.cardDifficulty !== 'all') {
            pool = pool.filter(card => {
                const difficulty = getCardDifficulty(card.number);
                // Include 'unknown' cards in all categories to ensure we have enough cards
                return difficulty === quizConfig.cardDifficulty || difficulty === 'unknown';
            });
        }

        if (pool.length === 0) {
            alert('No cards found for the selected difficulty level. Try practicing more cards first!');
            return;
        }

        // Apply turns multiplier
        let finalPool: MajorEntry[] = [];
        for (let i = 0; i < quizConfig.turns; i++) {
            finalPool = [...finalPool, ...pool];
        }

        // Shuffle the final pool
        pool = finalPool.sort(() => 0.5 - Math.random());

        setQuizQueue(pool);
        setQuizStats({ correct: 0, wrong: 0, startTime: Date.now(), endTime: 0 });
        setCardStats(new Map());
        setQuizMode('active');

        // Start tracking session
        startTrainingSession('major-drill', userId, { config: quizConfig })
            .then(id => setCurrentSessionId(id));

        nextQuizCard(pool);
    };

    const nextQuizCard = (queue: MajorEntry[]) => {
        if (queue.length === 0) {
            setQuizStats(prev => ({ ...prev, endTime: Date.now() }));
            setQuizMode('result');

            // End tracking session
            endCurrentSession(true);
            return;
        }

        const nextCard = queue[0];
        setCurrentQuizCard(nextCard);
        setQuizInput('');
        setQuizFeedback({ status: null, message: '' });
        setCurrentCardStartTime(Date.now());

        // Initialize card stats if first time seeing this card
        const cardKey = nextCard.number;
        if (!cardStats.has(cardKey)) {
            setCardStats(prev => new Map(prev).set(cardKey, {
                attempts: 0,
                attemptTimes: [],
                masteredTime: 0
            }));
        }

        let qType = quizConfig.type;
        if (qType === 'mixed') {
            qType = Math.random() > 0.5 ? 'digits' : 'words';
        }
        setQuizQuestionType(qType as 'digits' | 'words');

        // If showing words (asking for digits), pick a random word from any category
        if (qType === 'words') {
            const allWords = [
                ...(nextCard.persons || []),
                ...(nextCard.actions || []),
                ...(nextCard.objects || []),
                ...(nextCard.images || [])
            ];
            const randomWord = allWords.length > 0
                ? allWords[Math.floor(Math.random() * allWords.length)]
                : '???';
            setQuizPromptWord(randomWord);
        } else {
            setQuizPromptWord('');
        }
    };

    const handleQuizSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentQuizCard || quizFeedback.status) return;

        const answer = quizInput.trim().toLowerCase();
        if (!answer) return; // Don't submit if input is empty

        let isCorrect = false;
        const targetNumber = currentQuizCard.number;

        // Collect all valid words for this card
        const allValidWords = [
            ...(currentQuizCard.persons || []),
            ...(currentQuizCard.actions || []),
            ...(currentQuizCard.objects || []),
            ...(currentQuizCard.images || [])
        ].map(w => w.toLowerCase());

        // For display in feedback
        const targetWord = allValidWords.length > 0 ? allValidWords[0] : '???';
        // Or better: show a few examples
        const displayWords = [
            ...(currentQuizCard.persons || []),
            ...(currentQuizCard.actions || []),
            ...(currentQuizCard.objects || [])
        ].slice(0, 3).join(' / ') || (currentQuizCard.images?.[0] || '???');

        if (quizQuestionType === 'digits') {
            // Showed Digits, expect Word
            if (allValidWords.includes(answer)) isCorrect = true;
        } else {
            // Showed Word, expect Digits
            if (answer === targetNumber) isCorrect = true;
        }

        // Calculate response time
        const responseTime = Date.now() - currentCardStartTime;

        // Save attempt to Firestore
        const attempt: CardAttempt = {
            cardNumber: currentQuizCard.number,
            isCorrect,
            responseTime,
            timestamp: Date.now(),
            questionType: quizQuestionType
        };
        await saveCardAttempt(attempt);

        // Update card stats
        const cardKey = currentQuizCard.number;
        const stats = cardStats.get(cardKey);
        if (stats) {
            setCardStats(prev => {
                const updatedStats = {
                    ...stats,
                    attempts: stats.attempts + 1,
                    attemptTimes: [...stats.attemptTimes, responseTime]
                };
                return new Map(prev).set(cardKey, updatedStats);
            });
        }

        if (isCorrect) {
            setQuizFeedback({ status: 'correct', message: 'Correct!' });
            setQuizStats(prev => ({ ...prev, correct: prev.correct + 1 }));

            // Mark as mastered (only if first time getting it right)
            if (stats && stats.masteredTime === 0) {
                setCardStats(prev => {
                    const currentStats = prev.get(cardKey);
                    if (currentStats && currentStats.masteredTime === 0) {
                        return new Map(prev).set(cardKey, {
                            ...currentStats,
                            masteredTime: Date.now()
                        });
                    }
                    return prev;
                });
            }

            setTimeout(() => {
                const newQueue = quizQueue.slice(1);
                setQuizQueue(newQueue);
                nextQuizCard(newQueue);
                setTimeout(() => inputRef.current?.focus(), 100);
            }, 300);
        } else {
            setQuizFeedback({
                status: 'wrong',
                message: `Wrong! It was ${quizQuestionType === 'digits' ? displayWords : targetNumber}`
            });
            setQuizStats(prev => ({ ...prev, wrong: prev.wrong + 1 }));

            setTimeout(() => {
                const newQueue = [...quizQueue.slice(1), currentQuizCard];
                setQuizQueue(newQueue);
                nextQuizCard(newQueue);
                setTimeout(() => inputRef.current?.focus(), 100);
            }, 1000);
        }
    };

    return (
        <>
            <Header />
            <main className="container" style={{ maxWidth: '1200px' }}>

                <div style={{ marginBottom: '2rem' }}>
                    <Link href="/training" style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '0.5rem', display: 'inline-block' }}>
                        ← Back to Training
                    </Link>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                            <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>The Image Vault</h1>
                            <p style={{ opacity: 0.7, marginTop: '0.5rem' }}>Manage and organize your mnemonic systems</p>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '0.85rem', opacity: 0.7 }}>
                            <div style={{ color: 'var(--success)', marginBottom: '0.5rem' }}>
                                <span style={{ marginRight: '0.5rem' }}>☁️</span>
                                Cloud Storage Active
                            </div>
                            <button
                                onClick={async () => {
                                    if (confirm('This will overwrite your current data with the default sets. Are you sure?')) {
                                        const { digitPaoList } = await import('@/data/digit-pao');
                                        const { cardPaoList } = await import('@/data/card-pao');
                                        const { majorSystemList } = await import('@/data/major-system');

                                        const digitEntries = digitPaoList.map(p => ({ id: p.number, ...p }));
                                        const cardEntries = cardPaoList.map(p => ({ id: p.card, ...p }));

                                        const majorEntries = majorSystemList.map(m => ({
                                            id: m.number,
                                            number: m.number,
                                            images: [m.word],
                                            persons: [],
                                            actions: [],
                                            objects: []
                                        }));

                                        await saveImageVaultData({
                                            digitPaoSystem: digitEntries,
                                            paoSystem: cardEntries,
                                            majorSystem: majorEntries,
                                            palaces: [] // Keep palaces empty but initialized
                                        });

                                        // Reload
                                        const data = await getImageVaultData();
                                        if (data) {
                                            setDigitPaoSystem(data.digitPaoSystem || []);
                                            setCardPaoSystem(data.paoSystem || []);
                                            setMajorSystem(data.majorSystem || []);
                                            setPalaces(data.palaces || []);
                                        }
                                        alert('Data reset to defaults!');
                                    }
                                }}
                                style={{
                                    background: 'none',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '0.25rem',
                                    color: 'var(--foreground)',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem'
                                }}
                            >
                                ↺ Reset Defaults
                            </button>
                        </div>
                    </div>
                </div>

                {/* Search Bar */}
                <div style={{ marginBottom: '2rem' }}>
                    <input
                        type="text"
                        className="input-field"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ width: '100%', maxWidth: '400px' }}
                    />
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--glass-border)', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => { setActiveTab('analytics'); setSearchQuery(''); }}
                        style={{
                            padding: '1rem 1.5rem',
                            background: 'none',
                            border: 'none',
                            color: activeTab === 'analytics' ? 'var(--primary)' : 'var(--foreground)',
                            borderBottom: activeTab === 'analytics' ? '2px solid var(--primary)' : 'none',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            fontWeight: activeTab === 'analytics' ? 'bold' : 'normal'
                        }}
                    >
                        Analytics
                    </button>
                    <button
                        onClick={() => { setActiveTab('major'); setSearchQuery(''); }}
                        style={{
                            padding: '1rem 1.5rem',
                            background: 'none',
                            border: 'none',
                            color: activeTab === 'major' ? 'var(--primary)' : 'var(--foreground)',
                            borderBottom: activeTab === 'major' ? '2px solid var(--primary)' : 'none',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            fontWeight: activeTab === 'major' ? 'bold' : 'normal'
                        }}
                    >
                        Major System ({majorSystem.length})
                    </button>
                    <button
                        onClick={() => { setActiveTab('card-pao'); setSearchQuery(''); }}
                        style={{
                            padding: '1rem 1.5rem',
                            background: 'none',
                            border: 'none',
                            color: activeTab === 'card-pao' ? 'var(--primary)' : 'var(--foreground)',
                            borderBottom: activeTab === 'card-pao' ? '2px solid var(--primary)' : 'none',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            fontWeight: activeTab === 'card-pao' ? 'bold' : 'normal'
                        }}
                    >
                        Card PAO ({cardPaoSystem.length})
                    </button>
                    <button
                        onClick={() => { setActiveTab('digit-pao'); setSearchQuery(''); }}
                        style={{
                            padding: '1rem 1.5rem',
                            background: 'none',
                            border: 'none',
                            color: activeTab === 'digit-pao' ? 'var(--primary)' : 'var(--foreground)',
                            borderBottom: activeTab === 'digit-pao' ? '2px solid var(--primary)' : 'none',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            fontWeight: activeTab === 'digit-pao' ? 'bold' : 'normal'
                        }}
                    >
                        Digit PAO ({digitPaoSystem.length})
                    </button>
                    <button
                        onClick={() => { setActiveTab('palace'); setSearchQuery(''); }}
                        style={{
                            padding: '1rem 1.5rem',
                            background: 'none',
                            border: 'none',
                            color: activeTab === 'palace' ? 'var(--primary)' : 'var(--foreground)',
                            borderBottom: activeTab === 'palace' ? '2px solid var(--primary)' : 'none',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            fontWeight: activeTab === 'palace' ? 'bold' : 'normal'
                        }}
                    >
                        Memory Palaces ({palaces.length})
                    </button>
                </div>

                {/* Analytics Dashboard */}
                {activeTab === 'analytics' && (
                    <div className="animate-fade-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <h2 style={{ fontSize: '1.5rem' }}>Training Analytics</h2>

                            {/* Time Filter */}
                            <select
                                value={timeFilter}
                                onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
                                className="input-field"
                                style={{ padding: '0.5rem', fontSize: '0.9rem', width: 'auto' }}
                            >
                                <option value="1h">1 hr</option>
                                <option value="2h">2 hrs</option>
                                <option value="12h">12 hrs</option>
                                <option value="1d">Today</option>
                                <option value="1w">This Week</option>
                                <option value="1m">This Month</option>
                                <option value="1y">This Year</option>
                                <option value="all">All Time</option>
                            </select>
                        </div>

                        {timeStats ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                                {/* Total Time Card */}
                                <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '0.5rem' }}>Total Training Time</div>
                                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                                        {formatDuration(timeStats.totalTime)}
                                    </div>
                                </div>

                                {/* Sessions Card */}
                                <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '0.5rem' }}>Total Sessions</div>
                                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--accent)' }}>
                                        {timeStats.sessionCount}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '0.5rem' }}>
                                        {timeStats.completedSessions} Completed | {timeStats.incompleteSessions} Incomplete
                                    </div>
                                </div>

                                {/* Breakdown by Exercise */}
                                <div className="glass-panel" style={{ padding: '1.5rem', gridColumn: '1 / -1' }}>
                                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                                        Time by Exercise
                                    </h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                                        {Object.entries(timeStats.byExercise).map(([type, stats]) => (
                                            <div key={type} style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '0.5rem' }}>
                                                <div style={{ textTransform: 'capitalize', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                                                    {type.replace('-', ' ')}
                                                </div>
                                                <div style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>
                                                    {formatDuration(stats.totalTime)}
                                                </div>
                                                <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                                                    {stats.sessionCount} sessions
                                                </div>
                                            </div>
                                        ))}
                                        {Object.keys(timeStats.byExercise).length === 0 && (
                                            <div style={{ opacity: 0.5, fontStyle: 'italic' }}>No training data found for this period.</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>
                                Loading analytics...
                            </div>
                        )}
                    </div>
                )}

                {/* Major System Tab */}
                {activeTab === 'major' && (
                    <div className="animate-fade-in">
                        {/* Quiz Mode Overlay */}
                        {quizMode === 'config' && (
                            <div className="glass-panel" style={{ marginBottom: '2rem', padding: '2rem', textAlign: 'center' }}>
                                <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Major System Drill</h2>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', maxWidth: '1000px', margin: '0 auto 2rem' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1' }}>Turns (Multiplier)</label>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {[1, 2, 3, 4, 5].map(n => (
                                                <button
                                                    key={n}
                                                    onClick={() => setQuizConfig(c => ({ ...c, turns: n }))}
                                                    className={`btn ${quizConfig.turns === n ? 'btn-primary' : ''}`}
                                                    style={{ padding: '0.5rem', opacity: quizConfig.turns === n ? 1 : 0.6 }}
                                                >
                                                    {n}x
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1' }}>Drill Type</label>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            <button
                                                onClick={() => setQuizConfig(c => ({ ...c, type: 'digits' }))}
                                                className={`btn ${quizConfig.type === 'digits' ? 'btn-primary' : ''}`}
                                                style={{ padding: '0.5rem', opacity: quizConfig.type === 'digits' ? 1 : 0.6 }}
                                            >
                                                Digits
                                            </button>
                                            <button
                                                onClick={() => setQuizConfig(c => ({ ...c, type: 'words' }))}
                                                className={`btn ${quizConfig.type === 'words' ? 'btn-primary' : ''}`}
                                                style={{ padding: '0.5rem', opacity: quizConfig.type === 'words' ? 1 : 0.6 }}
                                            >
                                                Words
                                            </button>
                                            <button
                                                onClick={() => setQuizConfig(c => ({ ...c, type: 'mixed' }))}
                                                className={`btn ${quizConfig.type === 'mixed' ? 'btn-primary' : ''}`}
                                                style={{ padding: '0.5rem', opacity: quizConfig.type === 'mixed' ? 1 : 0.6 }}
                                            >
                                                Both
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1' }}>Difficulty (Time Period)</label>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            <select
                                                value={timeFilter}
                                                onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
                                                className="input-field"
                                                style={{ padding: '0.5rem', fontSize: '0.85rem', marginBottom: '0.5rem' }}
                                            >
                                                <option value="1h">1 hr</option>
                                                <option value="2h">2 hrs</option>
                                                <option value="12h">12 hrs</option>
                                                <option value="1d">Today</option>
                                                <option value="1w">This Week</option>
                                                <option value="1m">This Month</option>
                                                <option value="1y">This Year</option>
                                                <option value="all">All Time</option>
                                            </select>
                                            <button
                                                onClick={() => setQuizConfig(c => ({ ...c, cardDifficulty: 'all' }))}
                                                className={`btn ${quizConfig.cardDifficulty === 'all' ? 'btn-primary' : ''}`}
                                                style={{ padding: '0.5rem', opacity: quizConfig.cardDifficulty === 'all' ? 1 : 0.6 }}
                                            >
                                                All
                                            </button>
                                            <button
                                                onClick={() => setQuizConfig(c => ({ ...c, cardDifficulty: 'platinum' }))}
                                                className={`btn ${quizConfig.cardDifficulty === 'platinum' ? 'btn-primary' : ''}`}
                                                style={{
                                                    padding: '0.5rem',
                                                    opacity: quizConfig.cardDifficulty === 'platinum' ? 1 : 0.6,
                                                    background: quizConfig.cardDifficulty === 'platinum' ? 'linear-gradient(135deg, rgba(229, 228, 226, 0.5) 0%, rgba(156, 163, 175, 0.5) 50%, rgba(229, 228, 226, 0.5) 100%)' : undefined,
                                                    boxShadow: quizConfig.cardDifficulty === 'platinum' ? '0 0 20px rgba(229, 228, 226, 0.6), 0 0 40px rgba(156, 163, 175, 0.3)' : undefined
                                                }}
                                            >
                                                💎 Platinum
                                            </button>
                                            <button
                                                onClick={() => setQuizConfig(c => ({ ...c, cardDifficulty: 'gold' }))}
                                                className={`btn ${quizConfig.cardDifficulty === 'gold' ? 'btn-primary' : ''}`}
                                                style={{
                                                    padding: '0.5rem',
                                                    opacity: quizConfig.cardDifficulty === 'gold' ? 1 : 0.6,
                                                    background: quizConfig.cardDifficulty === 'gold' ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.45) 0%, rgba(245, 158, 11, 0.45) 100%)' : undefined,
                                                    boxShadow: quizConfig.cardDifficulty === 'gold' ? '0 0 15px rgba(251, 191, 36, 0.5)' : undefined
                                                }}
                                            >
                                                🥇 Gold
                                            </button>
                                            <button
                                                onClick={() => setQuizConfig(c => ({ ...c, cardDifficulty: 'silver' }))}
                                                className={`btn ${quizConfig.cardDifficulty === 'silver' ? 'btn-primary' : ''}`}
                                                style={{
                                                    padding: '0.5rem',
                                                    opacity: quizConfig.cardDifficulty === 'silver' ? 1 : 0.6,
                                                    background: quizConfig.cardDifficulty === 'silver' ? 'linear-gradient(135deg, rgba(203, 213, 225, 0.4) 0%, rgba(148, 163, 184, 0.4) 100%)' : undefined,
                                                    boxShadow: quizConfig.cardDifficulty === 'silver' ? '0 0 12px rgba(203, 213, 225, 0.4)' : undefined
                                                }}
                                            >
                                                🥈 Silver
                                            </button>
                                            <button
                                                onClick={() => setQuizConfig(c => ({ ...c, cardDifficulty: 'bronze' }))}
                                                className={`btn ${quizConfig.cardDifficulty === 'bronze' ? 'btn-primary' : ''}`}
                                                style={{
                                                    padding: '0.5rem',
                                                    opacity: quizConfig.cardDifficulty === 'bronze' ? 1 : 0.6,
                                                    background: quizConfig.cardDifficulty === 'bronze' ? 'linear-gradient(135deg, rgba(205, 127, 50, 0.35) 0%, rgba(180, 83, 9, 0.35) 100%)' : undefined,
                                                    boxShadow: quizConfig.cardDifficulty === 'bronze' ? '0 0 10px rgba(205, 127, 50, 0.3)' : undefined
                                                }}
                                            >
                                                🥉 Bronze
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1' }}>Mode</label>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            <button
                                                onClick={() => setQuizConfig(c => ({ ...c, mode: 'untimed' }))}
                                                className={`btn ${quizConfig.mode === 'untimed' ? 'btn-primary' : ''}`}
                                                style={{ padding: '0.5rem', opacity: quizConfig.mode === 'untimed' ? 1 : 0.6 }}
                                            >
                                                Untimed
                                            </button>
                                            <button
                                                onClick={() => setQuizConfig(c => ({ ...c, mode: 'timed' }))}
                                                className={`btn ${quizConfig.mode === 'timed' ? 'btn-primary' : ''}`}
                                                style={{ padding: '0.5rem', opacity: quizConfig.mode === 'timed' ? 1 : 0.6 }}
                                            >
                                                Timed
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                                    <button onClick={() => setQuizMode(null)} className="btn" style={{ background: 'rgba(255,255,255,0.1)' }}>Cancel</button>
                                    <button onClick={startQuiz} className="btn btn-primary" style={{ padding: '0.75rem 2rem', fontSize: '1.1rem' }}>Start</button>
                                </div>
                            </div>
                        )}

                        {quizMode === 'active' && currentQuizCard && (
                            <div className="glass-panel" style={{ marginBottom: '2rem', padding: '3rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{ marginBottom: '1rem', opacity: 0.7 }}>
                                    Remaining: {quizQueue.length} | Wrong Attempts: {quizStats.wrong}
                                </div>

                                <div style={{
                                    fontSize: '4rem',
                                    fontWeight: 'bold',
                                    marginBottom: '1rem',
                                    color: 'var(--primary)',
                                    minHeight: '120px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem'
                                }}>
                                    <div>
                                        {quizQuestionType === 'digits' ? currentQuizCard.number : quizPromptWord}
                                    </div>
                                    {quizFeedback.status === 'wrong' && (
                                        <div className="animate-fade-in" style={{
                                            fontSize: '1.5rem',
                                            color: 'var(--error)',
                                            fontWeight: 'normal'
                                        }}>
                                            → {quizQuestionType === 'digits' ? (
                                                [...(currentQuizCard.persons || []), ...(currentQuizCard.actions || []), ...(currentQuizCard.objects || [])].slice(0, 3).join(' / ') || (currentQuizCard.images?.[0] || '???')
                                            ) : currentQuizCard.number}
                                        </div>
                                    )}
                                </div>

                                <form onSubmit={handleQuizSubmit} style={{ width: '100%', maxWidth: '350px' }}>
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        className="input-field"
                                        placeholder={quizQuestionType === 'digits' ? "Type the word..." : "Type the digits..."}
                                        value={quizInput}
                                        onChange={(e) => setQuizInput(e.target.value)}
                                        autoFocus
                                        disabled={!!quizFeedback.status}
                                        style={{
                                            textAlign: 'center',
                                            fontSize: '1rem',
                                            marginBottom: '0.75rem',
                                            padding: '0.5rem',
                                            borderColor: quizFeedback.status === 'correct' ? 'var(--success)' : quizFeedback.status === 'wrong' ? 'var(--error)' : undefined
                                        }}
                                    />
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        style={{ width: '100%', padding: '0.5rem 1rem', fontSize: '0.95rem' }}
                                        disabled={!!quizFeedback.status}
                                    >
                                        Check
                                    </button>
                                </form>

                                {quizFeedback.status && (
                                    <div className="animate-fade-in" style={{
                                        marginTop: '1.5rem',
                                        fontSize: '1.2rem',
                                        fontWeight: 'bold',
                                        color: quizFeedback.status === 'correct' ? 'var(--success)' : 'var(--error)'
                                    }}>
                                        {quizFeedback.status === 'correct' ? '✓ Correct!' : '✗ Wrong!'}
                                    </div>
                                )}

                                <button
                                    onClick={() => {
                                        endCurrentSession(false);
                                        setQuizMode('config');
                                    }}
                                    className="btn"
                                    style={{
                                        marginTop: '2rem',
                                        background: 'rgba(255,255,255,0.05)',
                                        fontSize: '0.9rem',
                                        padding: '0.5rem 1rem'
                                    }}
                                >
                                    Stop Drill
                                </button>
                            </div>
                        )}

                        {quizMode === 'result' && (
                            <div className="glass-panel" style={{ marginBottom: '2rem', padding: '2rem' }}>
                                <h2 style={{ fontSize: '2rem', marginBottom: '1rem', color: 'var(--success)', textAlign: 'center' }}>Quiz Complete!</h2>
                                <p style={{ fontSize: '1.2rem', marginBottom: '2rem', textAlign: 'center' }}>
                                    You successfully completed {quizConfig.turns} turn{quizConfig.turns > 1 ? 's' : ''} of the selected cards.
                                </p>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', maxWidth: '600px', margin: '0 auto 2rem' }}>
                                    <div className="glass" style={{ padding: '1rem', textAlign: 'center' }}>
                                        <div style={{ opacity: 0.7, fontSize: '0.9rem' }}>Total Time</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                                            {((quizStats.endTime - quizStats.startTime) / 1000).toFixed(1)}s
                                        </div>
                                    </div>
                                    <div className="glass" style={{ padding: '1rem', textAlign: 'center' }}>
                                        <div style={{ opacity: 0.7, fontSize: '0.9rem' }}>Total Attempts</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                                            {quizStats.correct + quizStats.wrong}
                                        </div>
                                    </div>
                                    <div className="glass" style={{ padding: '1rem', textAlign: 'center' }}>
                                        <div style={{ opacity: 0.7, fontSize: '0.9rem' }}>Mistakes</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: quizStats.wrong > 0 ? 'var(--error)' : 'var(--success)' }}>
                                            {quizStats.wrong}
                                        </div>
                                    </div>
                                </div>

                                {/* Per-Card Stats */}
                                <div style={{ marginBottom: '2rem' }}>
                                    <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', textAlign: 'center' }}>Per-Card Performance</h3>
                                    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 100px 120px', gap: '0.5rem', padding: '0.5rem', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.1)', position: 'sticky', top: 0, background: 'var(--background)', zIndex: 1 }}>
                                            <div>Number</div>
                                            <div>Word</div>
                                            <div>Attempts</div>
                                            <div>Time Taken</div>
                                        </div>
                                        {Array.from(cardStats.entries())
                                            .sort((a, b) => {
                                                const aAvgTime = a[1].attemptTimes.length > 0
                                                    ? a[1].attemptTimes.reduce((sum, t) => sum + t, 0) / a[1].attemptTimes.length
                                                    : 0;
                                                const bAvgTime = b[1].attemptTimes.length > 0
                                                    ? b[1].attemptTimes.reduce((sum, t) => sum + t, 0) / b[1].attemptTimes.length
                                                    : 0;
                                                return bAvgTime - aAvgTime; // Descending order
                                            })
                                            .map(([cardNum, stats]) => {
                                                const card = majorSystem.find(c => c.number === cardNum);
                                                const avgTime = stats.attemptTimes.length > 0
                                                    ? (stats.attemptTimes.reduce((sum, t) => sum + t, 0) / stats.attemptTimes.length / 1000).toFixed(1)
                                                    : 'N/A';
                                                // Color based on whether all attempts were successful (attempts = times seen)
                                                const isGood = stats.masteredTime > 0; // Mastered means got it right
                                                return (
                                                    <div key={cardNum} className="glass" style={{ display: 'grid', gridTemplateColumns: '80px 1fr 100px 120px', gap: '0.5rem', padding: '0.75rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                                                        <div style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{cardNum}</div>
                                                        <div>{card?.images?.[0] || '???'}</div>
                                                        <div style={{ color: isGood ? 'var(--success)' : 'var(--error)' }}>
                                                            {stats.attempts}
                                                        </div>
                                                        <div style={{ opacity: 0.8 }}>{avgTime}s</div>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>

                                <div style={{ textAlign: 'center' }}>
                                    <button onClick={() => setQuizMode(null)} className="btn btn-primary">Done</button>
                                </div>
                            </div>
                        )}

                        {/* Default View: Card Grid */}
                        {!quizMode && (
                            <>
                                {/* View Switcher */}
                                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                                    <button
                                        onClick={() => setMajorViewMode('cards')}
                                        style={{
                                            opacity: majorViewMode === 'cards' ? 1 : 0.5,
                                            fontWeight: majorViewMode === 'cards' ? 'bold' : 'normal',
                                            background: 'none',
                                            border: 'none',
                                            color: 'white',
                                            cursor: 'pointer',
                                            padding: '0.5rem 1rem',
                                            borderBottom: majorViewMode === 'cards' ? '2px solid var(--primary)' : '2px solid transparent',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        Cards
                                    </button>
                                    <button
                                        onClick={() => setMajorViewMode('analytics')}
                                        style={{
                                            opacity: majorViewMode === 'analytics' ? 1 : 0.5,
                                            fontWeight: majorViewMode === 'analytics' ? 'bold' : 'normal',
                                            background: 'none',
                                            border: 'none',
                                            color: 'white',
                                            cursor: 'pointer',
                                            padding: '0.5rem 1rem',
                                            borderBottom: majorViewMode === 'analytics' ? '2px solid var(--primary)' : '2px solid transparent',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        Analytics
                                    </button>
                                </div>

                                {/* Common Header (Time Filter) */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                                    <h3 style={{ fontSize: '1.1rem' }}>{majorViewMode === 'cards' ? 'Major System Cards' : 'Card Performance History'}</h3>
                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                        {/* Time Filter */}
                                        <select
                                            value={timeFilter}
                                            onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
                                            className="input-field"
                                            style={{ padding: '0.5rem', fontSize: '0.9rem', width: 'auto' }}
                                        >
                                            <option value="1h">1 hr</option>
                                            <option value="2h">2 hrs</option>
                                            <option value="12h">12 hrs</option>
                                            <option value="1d">Today</option>
                                            <option value="1w">This Week</option>
                                            <option value="1m">This Month</option>
                                            <option value="1y">This Year</option>
                                            <option value="all">All Time</option>
                                        </select>

                                        {majorViewMode === 'cards' && (
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                {/* Migration: copy images[0] → objects[0] for PAO structure */}
                                                <button
                                                    onClick={async () => {
                                                        setMigrating(true);
                                                        const result = await migrateMajorImagesToPao();
                                                        setMigrateResult(result);
                                                        setMigrating(false);
                                                        if (result.migrated > 0) {
                                                            const data = await import('@/lib/firebase').then(m => m.getImageVaultData());
                                                            if (data) setMajorSystem(data.majorSystem);
                                                        }
                                                    }}
                                                    className="btn btn-secondary"
                                                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                                                    disabled={migrating}
                                                    title="Copy legacy images[] into objects[] so the PAO structure is canonical"
                                                >
                                                    {migrating ? 'Migrating…' : migrateResult ? `✓ ${migrateResult.migrated} migrated` : 'Migrate images → PAO'}
                                                </button>
                                                <button
                                                    onClick={() => setQuizMode('config')}
                                                    className="btn btn-primary"
                                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                                >
                                                    <span>⚡</span> Start Drill
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {majorViewMode === 'cards' ? (
                                    <>
                                        {/* Difficulty Filters */}
                                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                                            {(['all', 'platinum', 'gold', 'silver', 'bronze'] as const).map(diff => {
                                                const isActive = diff === 'all'
                                                    ? selectedDifficultyFilters.has('unknown') && selectedDifficultyFilters.has('platinum') && selectedDifficultyFilters.has('gold') && selectedDifficultyFilters.has('silver') && selectedDifficultyFilters.has('bronze')
                                                    : selectedDifficultyFilters.has(diff);

                                                // Calculate card count for this difficulty
                                                let cardCount = 0;
                                                if (diff === 'all') {
                                                    cardCount = majorSystem.filter(e => {
                                                        const matchesSearch = e.number.includes(searchQuery) ||
                                                            e.images?.some(img => img.toLowerCase().includes(searchQuery.toLowerCase()));
                                                        return matchesSearch;
                                                    }).length;
                                                } else {
                                                    cardCount = majorSystem.filter(e => {
                                                        const matchesSearch = e.number.includes(searchQuery) ||
                                                            e.images?.some(img => img.toLowerCase().includes(searchQuery.toLowerCase()));
                                                        if (!matchesSearch) return false;
                                                        const difficulty = getCardDifficulty(e.number);
                                                        return difficulty === diff;
                                                    }).length;
                                                }

                                                return (
                                                    <button
                                                        key={diff}
                                                        onClick={() => toggleDifficultyFilter(diff)}
                                                        style={{
                                                            padding: '0.4rem 1rem',
                                                            borderRadius: '999px',
                                                            border: '1px solid',
                                                            borderColor: isActive ? 'transparent' : 'rgba(255,255,255,0.1)',
                                                            background: isActive
                                                                ? (diff === 'platinum' ? 'linear-gradient(135deg, rgba(229, 228, 226, 0.55) 0%, rgba(156, 163, 175, 0.55) 50%, rgba(229, 228, 226, 0.55) 100%)' :
                                                                    diff === 'gold' ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.5) 0%, rgba(245, 158, 11, 0.5) 50%, rgba(251, 191, 36, 0.5) 100%)' :
                                                                        diff === 'silver' ? 'linear-gradient(135deg, rgba(203, 213, 225, 0.45) 0%, rgba(148, 163, 184, 0.45) 50%, rgba(203, 213, 225, 0.45) 100%)' :
                                                                            diff === 'bronze' ? 'linear-gradient(135deg, rgba(205, 127, 50, 0.4) 0%, rgba(180, 83, 9, 0.4) 50%, rgba(205, 127, 50, 0.4) 100%)' :
                                                                                'rgba(99, 102, 241, 0.35)')
                                                                : 'rgba(255,255,255,0.03)',
                                                            color: isActive ? 'white' : 'rgba(255,255,255,0.5)',
                                                            fontSize: '0.85rem',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.4rem',
                                                            boxShadow: diff === 'platinum' && isActive ? '0 0 20px rgba(229, 228, 226, 0.5), 0 0 40px rgba(156, 163, 175, 0.25)' :
                                                                diff === 'gold' && isActive ? '0 0 15px rgba(251, 191, 36, 0.4)' :
                                                                    diff === 'silver' && isActive ? '0 0 12px rgba(203, 213, 225, 0.35)' :
                                                                        diff === 'bronze' && isActive ? '0 0 10px rgba(205, 127, 50, 0.3)' : 'none'
                                                        }}
                                                    >
                                                        <span style={{
                                                            width: '8px',
                                                            height: '8px',
                                                            borderRadius: '50%',
                                                            background: diff === 'platinum' ? 'linear-gradient(135deg, #e5e4e2 0%, #9ca3af 50%, #e5e4e2 100%)' :
                                                                diff === 'gold' ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #fbbf24 100%)' :
                                                                    diff === 'silver' ? 'linear-gradient(135deg, #cbd5e1 0%, #94a3b8 50%, #cbd5e1 100%)' :
                                                                        diff === 'bronze' ? 'linear-gradient(135deg, #cd7f32 0%, #b45309 50%, #cd7f32 100%)' :
                                                                            '#6366f1',
                                                            boxShadow: diff === 'platinum' ? '0 0 10px rgba(229, 228, 226, 0.7)' :
                                                                diff === 'gold' ? '0 0 8px rgba(251, 191, 36, 0.6)' :
                                                                    diff === 'silver' ? '0 0 6px rgba(203, 213, 225, 0.5)' :
                                                                        diff === 'bronze' ? '0 0 5px rgba(205, 127, 50, 0.4)' : 'none'
                                                        }} />
                                                        {diff === 'all' ? 'All' :
                                                            diff === 'platinum' ? 'Platinum' :
                                                                diff === 'gold' ? 'Gold' :
                                                                    diff === 'silver' ? 'Silver' :
                                                                        'Bronze'}
                                                        <span style={{ opacity: 0.7, fontSize: '0.8rem' }}>({cardCount})</span>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Eye Icon Toggle */}
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                                            <button
                                                onClick={() => setWordsVisible(!wordsVisible)}
                                                style={{
                                                    background: 'rgba(255,255,255,0.1)',
                                                    border: '1px solid rgba(255,255,255,0.2)',
                                                    borderRadius: '0.5rem',
                                                    padding: '0.5rem 1rem',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem',
                                                    color: 'white',
                                                    fontSize: '0.9rem',
                                                    transition: 'all 0.2s'
                                                }}
                                                title={wordsVisible ? 'Hide words' : 'Show words'}
                                            >
                                                <span style={{ fontSize: '1.2rem' }}>
                                                    {wordsVisible ? '👁️' : '👁️‍🗨️'}
                                                </span>
                                                {wordsVisible ? 'Hide Words' : 'Show Words'}
                                            </button>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '1rem' }}>
                                            {filteredMajor.map((entry) => {
                                                const stats = cardPerformanceStats.get(entry.number);
                                                const bgColor = getCardPerformanceColor(stats);

                                                // Determine tier for styling
                                                let tier: 'diamond' | 'gold' | 'silver' | 'bronze' | 'none' = 'none';
                                                let boxShadow = 'none';
                                                let border = '2px solid rgba(255,255,255,0.1)';
                                                let solidBgColor = bgColor;

                                                if (stats && stats.totalAttempts > 0) {
                                                    const avgTimeInSeconds = stats.averageTime / 1000;
                                                    const score = stats.performanceScore;

                                                    if (stats.mistakes === 0 && avgTimeInSeconds < 2) {
                                                        tier = 'diamond';
                                                        // Diamond: Soft glowing silver (not too bright)
                                                        solidBgColor = 'linear-gradient(135deg, #d1d5db 0%, #f3f4f6 50%, #d1d5db 100%)';
                                                        boxShadow = '0 0 12px rgba(209, 213, 219, 0.5)'; // Soft silver glow
                                                        border = '1px solid rgba(229, 231, 235, 0.6)';
                                                    } else if (score >= 75) {
                                                        tier = 'gold';
                                                        // Gold: Vibrant gold (most colorful)
                                                        solidBgColor = 'linear-gradient(135deg, #d97706 0%, #fbbf24 50%, #d97706 100%)';
                                                        boxShadow = '0 0 10px rgba(217, 119, 6, 0.3)';
                                                        border = 'none';
                                                    } else if (score >= 50) {
                                                        tier = 'silver';
                                                        // Silver: Slightly muted silver-grey
                                                        solidBgColor = 'linear-gradient(135deg, #9ca3af 0%, #d1d5db 50%, #9ca3af 100%)';
                                                        boxShadow = 'none';
                                                        border = 'none';
                                                    } else {
                                                        tier = 'bronze';
                                                        // Bronze: Muted grey-brown (least colorful)
                                                        solidBgColor = 'linear-gradient(135deg, #78716c 0%, #a8a29e 50%, #78716c 100%)';
                                                        boxShadow = 'none';
                                                        border = '1px solid rgba(120, 113, 108, 0.2)';
                                                    }
                                                }

                                                return (
                                                    <div
                                                        key={entry.id}
                                                        onClick={() => toggleCardFlip(entry.id)}
                                                        className="glass"
                                                        style={{
                                                            aspectRatio: '3/4',
                                                            cursor: 'pointer',
                                                            perspective: '1000px',
                                                            position: 'relative',
                                                            padding: 0,
                                                            overflow: 'visible',
                                                            border: 'none'
                                                        }}
                                                    >
                                                        <div style={{
                                                            width: '100%', height: '100%',
                                                            transition: 'transform 0.6s',
                                                            transformStyle: 'preserve-3d',
                                                            transform: flippedCards.has(entry.id) ? 'rotateY(180deg)' : 'rotateY(0deg)',
                                                            position: 'relative',
                                                            borderRadius: '0.5rem'
                                                        }}>
                                                            {/* Front (Number + Word) */}
                                                            <div style={{
                                                                position: 'absolute', width: '100%', height: '100%',
                                                                backfaceVisibility: 'hidden',
                                                                WebkitBackfaceVisibility: 'hidden',
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                color: tier === 'diamond' ? '#0f172a' : '#ffffff', // Dark text for light diamond background
                                                                background: solidBgColor,
                                                                borderRadius: '0.5rem',
                                                                border: border,
                                                                boxShadow: boxShadow,
                                                                padding: '0.5rem',
                                                                textShadow: tier === 'diamond' ? 'none' : '0 2px 4px rgba(0,0,0,0.5)', // Remove shadow for diamond
                                                                overflow: 'hidden'
                                                            }}>
                                                                {/* Angled solid shimmer for Gold only */}
                                                                {tier === 'gold' && (
                                                                    <div style={{
                                                                        position: 'absolute',
                                                                        top: '-50%',
                                                                        left: '-50%',
                                                                        width: '200%',
                                                                        height: '200%',
                                                                        background: 'linear-gradient(to right, transparent 45%, rgba(255, 255, 255, 0.7) 50%, transparent 55%)',
                                                                        transform: 'rotate(45deg)',
                                                                        animation: 'shine 3s ease-in-out infinite',
                                                                        pointerEvents: 'none'
                                                                    }} />
                                                                )}
                                                                <div style={{ fontSize: '2rem', fontWeight: 'bold', lineHeight: 1, position: 'relative', zIndex: 1 }}>{entry.number}</div>
                                                                {wordsVisible && (
                                                                    <div style={{ fontSize: '0.75rem', opacity: 1, marginTop: '0.5rem', textAlign: 'center', wordBreak: 'break-word', lineHeight: 1.2, position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                        {entry.persons && entry.persons.length > 0 && <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>P: {entry.persons[0]}</div>}
                                                                        {entry.actions && entry.actions.length > 0 && <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>A: {entry.actions[0]}</div>}
                                                                        {entry.objects && entry.objects.length > 0 && <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>O: {entry.objects[0]}</div>}
                                                                        {(!entry.persons?.length && !entry.actions?.length && !entry.objects?.length) && (
                                                                            <div>{entry.images?.[0] || '???'}</div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Back (Stats) */}
                                                            <div style={{
                                                                position: 'absolute', width: '100%', height: '100%',
                                                                backfaceVisibility: 'hidden',
                                                                WebkitBackfaceVisibility: 'hidden',
                                                                transform: 'rotateY(180deg)',
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                fontSize: '0.9rem',
                                                                fontWeight: '500',
                                                                color: tier === 'diamond' ? '#0f172a' : '#ffffff', // Dark text for light diamond background
                                                                background: solidBgColor,
                                                                borderRadius: '0.5rem',
                                                                border: border,
                                                                boxShadow: boxShadow,
                                                                padding: '0.5rem',
                                                                textAlign: 'center',
                                                                textShadow: tier === 'diamond' ? 'none' : '0 2px 4px rgba(0,0,0,0.5)', // Remove shadow for diamond
                                                                overflow: 'hidden'
                                                            }}>
                                                                {/* Angled solid shimmer for Gold only */}
                                                                {tier === 'gold' && (
                                                                    <div style={{
                                                                        position: 'absolute',
                                                                        top: '-50%',
                                                                        left: '-50%',
                                                                        width: '200%',
                                                                        height: '200%',
                                                                        background: 'linear-gradient(to right, transparent 45%, rgba(255, 255, 255, 0.7) 50%, transparent 55%)',
                                                                        transform: 'rotate(45deg)',
                                                                        animation: 'shine 3s ease-in-out infinite',
                                                                        pointerEvents: 'none'
                                                                    }} />
                                                                )}
                                                                {stats && stats.totalAttempts > 0 ? (
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%', position: 'relative', zIndex: 1 }}>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '0.8rem' }}>
                                                                            <span style={{ opacity: 0.8 }}>Seen:</span>
                                                                            <b>{stats.totalAttempts}</b>
                                                                        </div>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '0.8rem' }}>
                                                                            <span style={{ opacity: 0.8 }}>Failed:</span>
                                                                            <b style={{ color: stats.mistakes > 0 ? '#fca5a5' : 'inherit' }}>{stats.mistakes}</b>
                                                                        </div>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '0.8rem' }}>
                                                                            <span style={{ opacity: 0.8 }}>Time:</span>
                                                                            <b>{(stats.averageTime / 1000).toFixed(1)}s</b>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div style={{ opacity: 0.7, fontSize: '0.85rem' }}>
                                                                        No data yet
                                                                    </div>
                                                                )}

                                                                <button
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        setEditingMajor(entry.number);
                                                                    }}
                                                                    onMouseDown={(e) => e.stopPropagation()}
                                                                    style={{
                                                                        marginTop: '0.5rem',
                                                                        background: 'rgba(255,255,255,0.2)',
                                                                        border: 'none',
                                                                        borderRadius: '4px',
                                                                        padding: '4px 12px',
                                                                        fontSize: '0.8rem',
                                                                        color: 'white',
                                                                        cursor: 'pointer',
                                                                        position: 'relative',
                                                                        zIndex: 100,
                                                                        pointerEvents: 'auto',
                                                                        transition: 'background 0.2s'
                                                                    }}
                                                                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
                                                                    onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                                                                >
                                                                    Edit PAO
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Edit Modal */}
                                        {/* Edit Modal */}
                                        {editingMajor && mounted && createPortal(
                                            <div style={{
                                                position: 'fixed',
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                bottom: 0,
                                                background: 'rgba(0,0,0,0.8)',
                                                zIndex: 2147483647,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                backdropFilter: 'blur(5px)',
                                                overflow: 'auto',
                                                padding: '1rem'
                                            }} onClick={() => setEditingMajor(null)}>
                                                <div
                                                    className="glass-panel"
                                                    style={{
                                                        width: '90%',
                                                        maxWidth: '600px',
                                                        padding: '2rem',
                                                        maxHeight: '90vh',
                                                        overflowY: 'auto',
                                                        margin: 'auto'
                                                    }}
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    <h3 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{editingMajor}</span>
                                                        PAO Setup
                                                    </h3>

                                                    {(() => {
                                                        const entry = majorSystem.find(e => e.number === editingMajor);
                                                        if (!entry) return null;

                                                        return (
                                                            <div>
                                                                {/* Persons */}
                                                                <div style={{ marginBottom: '1.5rem' }}>
                                                                    <h4 style={{ fontSize: '1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.9 }}>
                                                                        <span style={{ fontWeight: 'bold' }}>P:</span> Persons
                                                                    </h4>
                                                                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                                                        <input
                                                                            type="text"
                                                                            className="input-field"
                                                                            placeholder="Add person..."
                                                                            value={newMajorPerson}
                                                                            onChange={e => setNewMajorPerson(e.target.value)}
                                                                            onKeyDown={e => {
                                                                                if (e.key === 'Enter' && newMajorPerson.trim()) {
                                                                                    addMajorPerson(editingMajor, newMajorPerson);
                                                                                    setNewMajorPerson('');
                                                                                }
                                                                            }}
                                                                            style={{ flex: 1 }}
                                                                        />
                                                                        <button
                                                                            className="btn btn-primary"
                                                                            onClick={() => {
                                                                                if (newMajorPerson.trim()) {
                                                                                    addMajorPerson(editingMajor, newMajorPerson);
                                                                                    setNewMajorPerson('');
                                                                                }
                                                                            }}
                                                                            style={{ padding: '0.5rem 1rem' }}
                                                                        >
                                                                            +
                                                                        </button>
                                                                    </div>
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                                        {(!entry.persons || entry.persons.length === 0) && (
                                                                            <div style={{ opacity: 0.5, fontStyle: 'italic', padding: '0.5rem', textAlign: 'left', fontSize: '0.9rem' }}>
                                                                                No persons yet
                                                                            </div>
                                                                        )}
                                                                        {(entry.persons || []).map((item, i) => (
                                                                            <div key={i} className="glass" style={{ padding: '0.5rem 0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                                <span style={{ textAlign: 'left', flex: 1 }}>{item}</span>
                                                                                <button
                                                                                    onClick={() => deleteMajorPerson(editingMajor, item)}
                                                                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', opacity: 0.7, fontSize: '1.2rem', padding: '0 0.5rem' }}
                                                                                >
                                                                                    ×
                                                                                </button>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>

                                                                {/* Actions */}
                                                                <div style={{ marginBottom: '1.5rem' }}>
                                                                    <h4 style={{ fontSize: '1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.9 }}>
                                                                        <span style={{ fontWeight: 'bold' }}>A:</span> Actions
                                                                    </h4>
                                                                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                                                        <input
                                                                            type="text"
                                                                            className="input-field"
                                                                            placeholder="Add action..."
                                                                            value={newMajorAction}
                                                                            onChange={e => setNewMajorAction(e.target.value)}
                                                                            onKeyDown={e => {
                                                                                if (e.key === 'Enter' && newMajorAction.trim()) {
                                                                                    addMajorAction(editingMajor, newMajorAction);
                                                                                    setNewMajorAction('');
                                                                                }
                                                                            }}
                                                                            style={{ flex: 1 }}
                                                                        />
                                                                        <button
                                                                            className="btn btn-primary"
                                                                            onClick={() => {
                                                                                if (newMajorAction.trim()) {
                                                                                    addMajorAction(editingMajor, newMajorAction);
                                                                                    setNewMajorAction('');
                                                                                }
                                                                            }}
                                                                            style={{ padding: '0.5rem 1rem' }}
                                                                        >
                                                                            +
                                                                        </button>
                                                                    </div>
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                                        {(!entry.actions || entry.actions.length === 0) && (
                                                                            <div style={{ opacity: 0.5, fontStyle: 'italic', padding: '0.5rem', textAlign: 'left', fontSize: '0.9rem' }}>
                                                                                No actions yet
                                                                            </div>
                                                                        )}
                                                                        {(entry.actions || []).map((item, i) => (
                                                                            <div key={i} className="glass" style={{ padding: '0.5rem 0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                                <span style={{ textAlign: 'left', flex: 1 }}>{item}</span>
                                                                                <button
                                                                                    onClick={() => deleteMajorAction(editingMajor, item)}
                                                                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', opacity: 0.7, fontSize: '1.2rem', padding: '0 0.5rem' }}
                                                                                >
                                                                                    ×
                                                                                </button>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>

                                                                {/* Objects */}
                                                                <div style={{ marginBottom: '1.5rem' }}>
                                                                    <h4 style={{ fontSize: '1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.9 }}>
                                                                        <span style={{ fontWeight: 'bold' }}>O:</span> Objects
                                                                    </h4>
                                                                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                                                        <input
                                                                            type="text"
                                                                            className="input-field"
                                                                            placeholder="Add object..."
                                                                            value={newMajorObject}
                                                                            onChange={e => setNewMajorObject(e.target.value)}
                                                                            onKeyDown={e => {
                                                                                if (e.key === 'Enter' && newMajorObject.trim()) {
                                                                                    addMajorObject(editingMajor, newMajorObject);
                                                                                    setNewMajorObject('');
                                                                                }
                                                                            }}
                                                                            style={{ flex: 1 }}
                                                                        />
                                                                        <button
                                                                            className="btn btn-primary"
                                                                            onClick={() => {
                                                                                if (newMajorObject.trim()) {
                                                                                    addMajorObject(editingMajor, newMajorObject);
                                                                                    setNewMajorObject('');
                                                                                }
                                                                            }}
                                                                            style={{ padding: '0.5rem 1rem' }}
                                                                        >
                                                                            +
                                                                        </button>
                                                                    </div>
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                                        {(!entry.objects || entry.objects.length === 0) && (
                                                                            <div style={{ opacity: 0.5, fontStyle: 'italic', padding: '0.5rem', textAlign: 'left', fontSize: '0.9rem' }}>
                                                                                No objects yet
                                                                            </div>
                                                                        )}
                                                                        {(entry.objects || []).map((item, i) => (
                                                                            <div key={i} className="glass" style={{ padding: '0.5rem 0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                                <span style={{ textAlign: 'left', flex: 1 }}>{item}</span>
                                                                                <button
                                                                                    onClick={() => deleteMajorObject(editingMajor, item)}
                                                                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', opacity: 0.7, fontSize: '1.2rem', padding: '0 0.5rem' }}
                                                                                >
                                                                                    ×
                                                                                </button>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}

                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                                        <button
                                                            className="btn"
                                                            onClick={() => setEditingMajor(null)}
                                                            style={{ background: 'rgba(255,255,255,0.1)' }}
                                                        >
                                                            Done
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>,
                                            document.body
                                        )}

                                        {filteredMajor.length === 0 && (
                                            <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>
                                                No cards found.
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        {/* Combined Analytics Chart */}
                                        <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                                            <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                                                <h4 style={{ fontSize: '1rem', opacity: 0.9, margin: 0 }}>Performance Analytics by Day</h4>
                                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                                    <label style={{ opacity: 0.8, fontSize: '0.9rem' }}>Card:</label>
                                                    <select
                                                        value={selectedCardForStats}
                                                        onChange={(e) => setSelectedCardForStats(e.target.value)}
                                                        className="input-field"
                                                        style={{ width: 'auto', minWidth: '200px', padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}
                                                    >
                                                        {majorSystem.map(card => (
                                                            <option key={card.id} value={card.number}>
                                                                ```
                                                                {card.number} - {card.persons?.[0] || card.actions?.[0] || card.objects?.[0] || card.images?.[0] || 'Empty'}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            {globalStats.length > 0 ? (
                                                <div style={{ height: '400px', width: '100%', minHeight: '400px', minWidth: '300px' }}>
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <ComposedChart data={(() => {
                                                            // Merge global and card stats by date
                                                            const dateMap = new Map<string, any>();

                                                            // Add global stats
                                                            globalStats.forEach(stat => {
                                                                dateMap.set(stat.date, {
                                                                    date: stat.date,
                                                                    globalErrorRate: stat.errorRate,
                                                                    globalAvgTime: stat.averageTime,
                                                                });
                                                            });

                                                            // Add card-specific stats only for days that have data
                                                            cardDailyStats.forEach(stat => {
                                                                const existing = dateMap.get(stat.date) || { date: stat.date };
                                                                existing.cardErrorRate = stat.errorRate;
                                                                existing.cardAvgTime = stat.averageTime;
                                                                dateMap.set(stat.date, existing);
                                                            });

                                                            return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
                                                        })()}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                                            <XAxis
                                                                dataKey="date"
                                                                stroke="rgba(255,255,255,0.5)"
                                                                label={{ value: 'Date', position: 'insideBottom', offset: -5, fill: 'rgba(255,255,255,0.5)' }}
                                                            />
                                                            <YAxis
                                                                yAxisId="left"
                                                                stroke="rgba(255,255,255,0.5)"
                                                                label={{ value: 'Error Rate (%)', angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.5)' }}
                                                                domain={[0, 100]}
                                                            />
                                                            <YAxis
                                                                yAxisId="right"
                                                                orientation="right"
                                                                stroke="rgba(255,255,255,0.5)"
                                                                label={{ value: 'Time (seconds)', angle: 90, position: 'insideRight', fill: 'rgba(255,255,255,0.5)' }}
                                                            />
                                                            <Tooltip
                                                                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem' }}
                                                                itemStyle={{ color: '#fff' }}
                                                                formatter={(value: any, name: string) => {
                                                                    // Handle null/undefined values
                                                                    if (value === null || value === undefined || typeof value !== 'number') {
                                                                        return ['N/A', name || ''];
                                                                    }
                                                                    if (name && name.includes('ErrorRate')) {
                                                                        return [`${value.toFixed(1)}%`, name.replace('globalErrorRate', 'Global Error Rate').replace('cardErrorRate', `Card ${selectedCardForStats || ''} Error Rate`)];
                                                                    }
                                                                    if (name) {
                                                                        return [`${value.toFixed(2)}s`, name.replace('globalAvgTime', 'Global Avg Time').replace('cardAvgTime', `Card ${selectedCardForStats || ''} Avg Time`)];
                                                                    }
                                                                    return [`${value.toFixed(2)}s`, 'Time'];
                                                                }}
                                                                labelFormatter={(label) => `Date: ${label}`}
                                                            />
                                                            <Legend
                                                                wrapperStyle={{ paddingTop: '20px' }}
                                                                formatter={(value: string) => {
                                                                    if (!value) return '';
                                                                    const labels: Record<string, string> = {
                                                                        'globalErrorRate': 'Global Error Rate',
                                                                        'cardErrorRate': `Card ${selectedCardForStats || ''} Error Rate`,
                                                                        'globalAvgTime': 'Global Avg Time',
                                                                        'cardAvgTime': `Card ${selectedCardForStats || ''} Avg Time`
                                                                    };
                                                                    return labels[value] || value;
                                                                }}
                                                            />
                                                            {/* Global Error Rate - Solid Line */}
                                                            <Line
                                                                yAxisId="left"
                                                                type="monotone"
                                                                dataKey="globalErrorRate"
                                                                stroke="#ef4444"
                                                                strokeWidth={2}
                                                                dot={false}
                                                                activeDot={{ r: 5 }}
                                                                connectNulls
                                                            />
                                                            {/* Global Avg Time - Solid Line */}
                                                            <Line
                                                                yAxisId="right"
                                                                type="monotone"
                                                                dataKey="globalAvgTime"
                                                                stroke="#10b981"
                                                                strokeWidth={2}
                                                                dot={false}
                                                                activeDot={{ r: 5 }}
                                                                connectNulls
                                                            />
                                                            {/* Card-Specific Error Rate - Scatter */}
                                                            <Scatter
                                                                yAxisId="left"
                                                                dataKey="cardErrorRate"
                                                                fill="#f97316"
                                                                shape="circle"
                                                            />
                                                            {/* Card-Specific Avg Time - Scatter */}
                                                            <Scatter
                                                                yAxisId="right"
                                                                dataKey="cardAvgTime"
                                                                fill="#14b8a6"
                                                                shape="circle"
                                                            />
                                                        </ComposedChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            ) : (
                                                <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                                                    No data available for the selected time range.
                                                </div>
                                            )}
                                        </div>

                                        {/* Session History List */}
                                        <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                                            <h4 style={{ fontSize: '1rem', marginBottom: '1.5rem', opacity: 0.9 }}>Session History</h4>

                                            {sessionHistory.length > 0 ? (
                                                <div className="space-y-6">
                                                    {Object.entries(sessionHistory.reduce((acc, session) => {
                                                        const date = new Date(session.startTime).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                                                        if (!acc[date]) acc[date] = [];
                                                        acc[date].push(session);
                                                        return acc;
                                                    }, {} as Record<string, TrainingSession[]>)).map(([date, sessions]) => (
                                                        <div key={date}>
                                                            <h5 style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>{date}</h5>
                                                            <div className="space-y-3">
                                                                {sessions.map(session => (
                                                                    <div key={session.sessionId} style={{
                                                                        background: 'rgba(255,255,255,0.03)',
                                                                        borderRadius: '0.5rem',
                                                                        padding: '1rem',
                                                                        display: 'flex',
                                                                        justifyContent: 'space-between',
                                                                        alignItems: 'center'
                                                                    }}>
                                                                        <div>
                                                                            <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
                                                                                {session.exerciseType === 'major-drill' ? 'Major System Drill' :
                                                                                    session.exerciseType === 'palace-drill' ? 'Memory Palace Drill' :
                                                                                        session.exerciseType}
                                                                            </div>
                                                                            <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                                                                                {new Date(session.startTime).toLocaleTimeString()} • {formatDuration(session.duration || 0)}
                                                                                {session.exerciseType === 'major-drill' && session.metadata?.config && ` • ${session.metadata.config.type} • ${session.metadata.config.cardDifficulty}`}
                                                                                {session.exerciseType === 'palace-drill' && session.metadata && ` • ${session.metadata.turns} turns • ${session.metadata.timed ? 'Timed' : 'Untimed'}`}
                                                                            </div>
                                                                        </div>
                                                                        <div style={{ textAlign: 'right' }}>
                                                                            <div style={{
                                                                                color: session.metadata?.stats?.wrong === 0 ? '#10b981' : '#ef4444',
                                                                                fontWeight: 600
                                                                            }}>
                                                                                {session.metadata?.stats ? (
                                                                                    `${Math.round((session.metadata.stats.correct / (session.metadata.stats.correct + session.metadata.stats.wrong)) * 100)}%`
                                                                                ) : 'N/A'}
                                                                            </div>
                                                                            <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                                                                                {session.metadata?.stats?.wrong || 0} errors ({session.metadata?.stats ? Math.round((session.metadata.stats.wrong / (session.metadata.stats.correct + session.metadata.stats.wrong)) * 100) : 0}%)
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div style={{ opacity: 0.5, textAlign: 'center', padding: '2rem' }}>
                                                    No session history found.
                                                </div>
                                            )}
                                        </div>

                                        {/* Individual Card Attempt History */}
                                        <div className="glass-panel" style={{ padding: '1.5rem' }}>
                                            <h4 style={{ fontSize: '1rem', marginBottom: '1.5rem', opacity: 0.9 }}>Individual Attempt History</h4>
                                            <div style={{ marginBottom: '1rem', opacity: 0.6, fontSize: '0.9rem' }}>
                                                Total Attempts: {cardHistory.length}
                                            </div>

                                            {cardHistory.length > 0 ? (
                                                <div style={{ height: '400px', width: '100%', minHeight: '400px' }}>
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <LineChart data={cardHistory.map((h, i) => ({
                                                            attempt: i + 1,
                                                            time: h.responseTime / 1000,
                                                            isCorrect: h.isCorrect,
                                                            timestamp: new Date(h.timestamp).toLocaleDateString()
                                                        }))}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                                            <XAxis
                                                                dataKey="attempt"
                                                                stroke="rgba(255,255,255,0.5)"
                                                                label={{ value: 'Attempt #', position: 'insideBottom', offset: -5, fill: 'rgba(255,255,255,0.5)' }}
                                                            />
                                                            <YAxis
                                                                stroke="rgba(255,255,255,0.5)"
                                                                label={{ value: 'Recall Time (s)', angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.5)' }}
                                                            />
                                                            <Tooltip
                                                                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem' }}
                                                                itemStyle={{ color: '#fff' }}
                                                                formatter={(value: any, name: any) => {
                                                                    // Handle null/undefined values
                                                                    if (value === null || value === undefined || typeof value !== 'number') {
                                                                        return ['N/A', name || 'Value'];
                                                                    }
                                                                    return [`${value}s`, name || 'Time'];
                                                                }}
                                                                labelFormatter={(label, payload) => {
                                                                    if (payload && payload.length > 0) {
                                                                        return `Attempt #${label} (${payload[0].payload.timestamp})`;
                                                                    }
                                                                    return `Attempt #${label}`;
                                                                }}
                                                            />
                                                            <Line
                                                                type="monotone"
                                                                dataKey="time"
                                                                stroke="#8884d8"
                                                                strokeWidth={2}
                                                                dot={(props: any) => {
                                                                    const { cx, cy, payload } = props;
                                                                    return (
                                                                        <circle
                                                                            cx={cx}
                                                                            cy={cy}
                                                                            r={5}
                                                                            fill={payload.isCorrect ? '#10b981' : '#ef4444'}
                                                                            stroke="white"
                                                                            strokeWidth={1}
                                                                        />
                                                                    );
                                                                }}
                                                            />
                                                        </LineChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            ) : (
                                                <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                                                    No history found for this card in the selected time range.
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* Card PAO System Tab */}
                {activeTab === 'card-pao' && (
                    <div className="animate-fade-in">
                        {/* Add New Entry */}
                        <div className="glass card" style={{ marginBottom: '2rem' }}>
                            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Add Card PAO Entry</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.5rem', opacity: 0.7 }}>Card</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        placeholder="AS"
                                        value={newCardPaoCard}
                                        onChange={(e) => setNewCardPaoCard(e.target.value.toUpperCase().slice(0, 2))}
                                        maxLength={2}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.5rem', opacity: 0.7 }}>Person</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        placeholder="Albert Einstein"
                                        value={newCardPaoPerson}
                                        onChange={(e) => setNewCardPaoPerson(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.5rem', opacity: 0.7 }}>Action</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        placeholder="Calculating"
                                        value={newCardPaoAction}
                                        onChange={(e) => setNewCardPaoAction(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.5rem', opacity: 0.7 }}>Object</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        placeholder="Chalkboard"
                                        value={newCardPaoObject}
                                        onChange={(e) => setNewCardPaoObject(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && addCardPaoEntry()}
                                    />
                                </div>
                                <button className="btn btn-primary" onClick={addCardPaoEntry}>
                                    Add
                                </button>
                            </div>
                        </div>

                        {/* Entries List */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {filteredCardPao.length === 0 ? (
                                <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
                                    {searchQuery ? 'No results found' : 'No Card PAO entries yet. Add your first one above!'}
                                </div>
                            ) : (
                                filteredCardPao.map((entry) => (
                                    <div key={entry.id} className="glass-panel" style={{ padding: '1rem' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr auto', gap: '1rem', alignItems: 'center' }}>
                                            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--accent)' }}>
                                                {entry.card}
                                            </div>
                                            <input
                                                type="text"
                                                className="input-field"
                                                value={entry.person}
                                                onChange={(e) => updateCardPaoEntry(entry.id, 'person', e.target.value)}
                                                style={{ padding: '0.5rem' }}
                                            />
                                            <input
                                                type="text"
                                                className="input-field"
                                                value={entry.action}
                                                onChange={(e) => updateCardPaoEntry(entry.id, 'action', e.target.value)}
                                                style={{ padding: '0.5rem' }}
                                            />
                                            <input
                                                type="text"
                                                className="input-field"
                                                value={entry.object}
                                                onChange={(e) => updateCardPaoEntry(entry.id, 'object', e.target.value)}
                                                style={{ padding: '0.5rem' }}
                                            />
                                            <button
                                                onClick={() => deleteCardPaoEntry(entry.id)}
                                                style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '1.5rem' }}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* Digit PAO System Tab */}
                {activeTab === 'digit-pao' && (
                    <div className="animate-fade-in">
                        {/* Add New Entry */}
                        <div className="glass card" style={{ marginBottom: '2rem' }}>
                            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Add Digit PAO Entry</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.5rem', opacity: 0.7 }}>Number</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        placeholder="00"
                                        value={newDigitPaoNumber}
                                        onChange={(e) => setNewDigitPaoNumber(e.target.value.replace(/\D/g, '').slice(0, 2))}
                                        maxLength={2}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.5rem', opacity: 0.7 }}>Person</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        placeholder="Person Name"
                                        value={newDigitPaoPerson}
                                        onChange={(e) => setNewDigitPaoPerson(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.5rem', opacity: 0.7 }}>Action</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        placeholder="Doing something"
                                        value={newDigitPaoAction}
                                        onChange={(e) => setNewDigitPaoAction(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.5rem', opacity: 0.7 }}>Object</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        placeholder="With something"
                                        value={newDigitPaoObject}
                                        onChange={(e) => setNewDigitPaoObject(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && addDigitPaoEntry()}
                                    />
                                </div>
                                <button className="btn btn-primary" onClick={addDigitPaoEntry}>
                                    Add
                                </button>
                            </div>
                        </div>

                        {/* Entries List */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {filteredDigitPao.length === 0 ? (
                                <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
                                    {searchQuery ? 'No results found' : 'No Digit PAO entries yet. Add your first one above!'}
                                </div>
                            ) : (
                                filteredDigitPao.map((entry) => (
                                    <div key={entry.id} className="glass-panel" style={{ padding: '1rem' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr auto', gap: '1rem', alignItems: 'center' }}>
                                            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--accent)' }}>
                                                {entry.number}
                                            </div>
                                            <input
                                                type="text"
                                                className="input-field"
                                                value={entry.person}
                                                onChange={(e) => updateDigitPaoEntry(entry.id, 'person', e.target.value)}
                                                style={{ padding: '0.5rem' }}
                                            />
                                            <input
                                                type="text"
                                                className="input-field"
                                                value={entry.action}
                                                onChange={(e) => updateDigitPaoEntry(entry.id, 'action', e.target.value)}
                                                style={{ padding: '0.5rem' }}
                                            />
                                            <input
                                                type="text"
                                                className="input-field"
                                                value={entry.object}
                                                onChange={(e) => updateDigitPaoEntry(entry.id, 'object', e.target.value)}
                                                style={{ padding: '0.5rem' }}
                                            />
                                            <button
                                                onClick={() => deleteDigitPaoEntry(entry.id)}
                                                style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '1.5rem' }}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* Memory Palaces Tab */}
                {activeTab === 'palace' && (
                    <div className="animate-fade-in">
                        {palaceDrillMode ? (
                            <div className="glass-panel" style={{ padding: '2rem' }}>
                                <div style={{ marginBottom: '1rem' }}>
                                    <button onClick={exitPalaceDrill} className="btn btn-secondary">← Exit Drill</button>
                                </div>

                                {palaceDrillMode === 'config' && selectedPalaceForDrill && (
                                    <div style={{ maxWidth: '500px', margin: '0 auto', textAlign: 'center' }}>
                                        <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Drill: {selectedPalaceForDrill.name}</h2>

                                        <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
                                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Turns (Multiplier)</label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="10"
                                                value={drillTurns}
                                                onChange={(e) => setDrillTurns(parseInt(e.target.value) || 1)}
                                                className="input-field"
                                            />
                                            <p style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.5rem' }}>
                                                Total Words: {selectedPalaceForDrill.locations.length * drillTurns}
                                            </p>
                                        </div>

                                        <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={drillIsTimed}
                                                    onChange={(e) => setDrillIsTimed(e.target.checked)}
                                                />
                                                Timed Mode
                                            </label>
                                        </div>

                                        {drillIsTimed && (
                                            <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
                                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Time Limit (Seconds)</label>
                                                <input
                                                    type="number"
                                                    min="10"
                                                    value={drillTimeLimit}
                                                    onChange={(e) => setDrillTimeLimit(parseInt(e.target.value) || 60)}
                                                    className="input-field"
                                                />
                                            </div>
                                        )}

                                        <button onClick={startMemorizePhase} className="btn btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}>
                                            Start Memorization
                                        </button>
                                    </div>
                                )}

                                {palaceDrillMode === 'memorize' && selectedPalaceForDrill && (
                                    <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                                        <h3 style={{ opacity: 0.7, marginBottom: '1rem' }}>Memorize Phase</h3>
                                        <div style={{ fontSize: '1.2rem', marginBottom: '2rem', color: 'var(--accent)' }}>
                                            Location {currentDrillIndex % selectedPalaceForDrill.locations.length + 1}: {selectedPalaceForDrill.locations[currentDrillIndex % selectedPalaceForDrill.locations.length]}
                                        </div>

                                        <div className="card glass" style={{ padding: '3rem', fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '2rem', display: 'inline-block', minWidth: '300px' }}>
                                            {drillWords[currentDrillIndex]}
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                                            <button onClick={prevMemorizeItem} disabled={currentDrillIndex === 0} className="btn btn-secondary">Previous</button>
                                            <button onClick={nextMemorizeItem} className="btn btn-primary">
                                                {currentDrillIndex < drillWords.length - 1 ? 'Next Word' : 'Start Recall'}
                                            </button>
                                        </div>
                                        <div style={{ marginTop: '1rem', opacity: 0.5 }}>
                                            {currentDrillIndex + 1} / {drillWords.length}
                                        </div>
                                    </div>
                                )}

                                {palaceDrillMode === 'recall' && selectedPalaceForDrill && (
                                    <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                                        <h3 style={{ opacity: 0.7, marginBottom: '1rem' }}>Recall Phase</h3>
                                        <div style={{ fontSize: '1.2rem', marginBottom: '2rem', color: 'var(--accent)' }}>
                                            Location {currentDrillIndex % selectedPalaceForDrill.locations.length + 1}: {selectedPalaceForDrill.locations[currentDrillIndex % selectedPalaceForDrill.locations.length]}
                                        </div>

                                        <div style={{ marginBottom: '2rem' }}>
                                            <input
                                                type="text"
                                                value={currentRecallInput}
                                                onChange={(e) => setCurrentRecallInput(e.target.value)}
                                                onKeyPress={(e) => e.key === 'Enter' && !lastRecallFeedback && submitRecallItem()}
                                                placeholder="Type the word..."
                                                className="input-field"
                                                style={{ fontSize: '1.5rem', textAlign: 'center', maxWidth: '400px' }}
                                                autoFocus
                                                disabled={!!lastRecallFeedback}
                                            />
                                        </div>

                                        {lastRecallFeedback && (
                                            <div className={`animate-fade-in`} style={{
                                                fontSize: '1.2rem',
                                                fontWeight: 'bold',
                                                color: lastRecallFeedback === 'correct' ? '#10b981' : '#ef4444',
                                                marginBottom: '1rem'
                                            }}>
                                                {lastRecallFeedback === 'correct' ? 'Correct!' : `Wrong! It was: ${lastRecallCorrectWord}`}
                                            </div>
                                        )}

                                        {!lastRecallFeedback && (
                                            <button onClick={submitRecallItem} className="btn btn-primary">Submit</button>
                                        )}

                                        <div style={{ marginTop: '1rem', opacity: 0.5 }}>
                                            {currentDrillIndex + 1} / {drillWords.length}
                                        </div>
                                    </div>
                                )}

                                {palaceDrillMode === 'result' && palaceStats && (
                                    <div style={{ textAlign: 'center' }}>
                                        <h2 style={{ fontSize: '2rem', marginBottom: '2rem' }}>Drill Complete!</h2>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                                            <div className="glass-panel" style={{ padding: '1.5rem' }}>
                                                <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>Success Rate</div>
                                                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--accent)' }}>
                                                    {((drillItemStats.filter(s => s.isCorrect).length / drillItemStats.length) * 100).toFixed(1)}%
                                                </div>
                                            </div>
                                            <div className="glass-panel" style={{ padding: '1.5rem' }}>
                                                <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>Avg Recall Time</div>
                                                <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                                                    {(drillItemStats.reduce((acc, curr) => acc + curr.recallTime, 0) / drillItemStats.length / 1000).toFixed(2)}s
                                                </div>
                                            </div>
                                        </div>

                                        <h3 style={{ textAlign: 'left', marginBottom: '1rem' }}>Detailed Breakdown</h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'left' }}>
                                            {drillItemStats.map((stat, idx) => (
                                                <div key={idx} className="glass-panel" style={{
                                                    padding: '1rem',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    borderLeft: `4px solid ${stat.isCorrect ? '#10b981' : '#ef4444'}`
                                                }}>
                                                    <div>
                                                        <span style={{ fontWeight: 'bold', marginRight: '1rem' }}>{stat.word}</span>
                                                        <span style={{ opacity: 0.7, fontSize: '0.9rem' }}>
                                                            Loc: {selectedPalaceForDrill?.locations[stat.locationIndex]}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        {(stat.recallTime / 1000).toFixed(2)}s
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <button onClick={() => setPalaceDrillMode(null)} className="btn btn-primary" style={{ marginTop: '2rem' }}>
                                            Back to Palaces
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                                {/* Add New Palace */}
                                <div className="glass card" style={{ marginBottom: '2rem' }}>
                                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Add New Palace</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'end' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.5rem', opacity: 0.7 }}>Palace Name</label>
                                            <input
                                                type="text"
                                                className="input-field"
                                                placeholder="My Memory Palace"
                                                value={newPalaceName}
                                                onChange={(e) => setNewPalaceName(e.target.value)}
                                                onKeyPress={(e) => e.key === 'Enter' && addPalace()}
                                            />
                                        </div>
                                        <button className="btn btn-primary" onClick={addPalace}>
                                            Create Palace
                                        </button>
                                    </div>
                                </div>

                                {/* Palaces List */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    {filteredPalaces.length === 0 ? (
                                        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
                                            {searchQuery ? 'No results found' : 'No palaces yet. Create your first one above!'}
                                        </div>
                                    ) : (
                                        filteredPalaces.map((palace) => (
                                            <div key={palace.id} className="glass-panel" style={{ padding: '1.5rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                        {editingPalace === palace.id ? (
                                                            <input
                                                                type="text"
                                                                className="input-field"
                                                                value={palace.name}
                                                                onChange={(e) => updatePalaceName(palace.id, e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        setEditingPalace(null);
                                                                    } else if (e.key === 'Escape') {
                                                                        setEditingPalace(null);
                                                                    }
                                                                }}
                                                                onBlur={() => setEditingPalace(null)}
                                                                autoFocus
                                                                style={{ fontSize: '1.1rem', fontWeight: 'bold', maxWidth: '300px' }}
                                                            />
                                                        ) : (
                                                            <h3
                                                                style={{ fontSize: '1.1rem', color: 'var(--accent)', cursor: 'pointer' }}
                                                                onClick={() => setEditingPalace(palace.id)}
                                                            >
                                                                {palace.name} ({palace.locations.length} locations)
                                                            </h3>
                                                        )}
                                                        <button
                                                            onClick={() => startPalaceDrillConfig(palace)}
                                                            className="btn btn-primary"
                                                            style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                                            disabled={palace.locations.length === 0}
                                                        >
                                                            <span>⚡</span> Drill
                                                        </button>
                                                    </div>
                                                    <button
                                                        onClick={() => deletePalace(palace.id)}
                                                        style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '0.9rem' }}
                                                    >
                                                        Delete Palace
                                                    </button>
                                                </div>

                                                {/* Add Location */}
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', marginBottom: '1rem' }}>
                                                    <input
                                                        type="text"
                                                        className="input-field"
                                                        placeholder="Add new location..."
                                                        value={newLocationMap.get(palace.id) || ''}
                                                        onChange={(e) => {
                                                            setNewLocationMap(prev => {
                                                                const next = new Map(prev);
                                                                next.set(palace.id, e.target.value);
                                                                return next;
                                                            });
                                                        }}
                                                        onKeyPress={(e) => e.key === 'Enter' && addLocation(palace.id)}
                                                        onFocus={() => setActiveLocationInput(palace.id)}
                                                        onBlur={() => setActiveLocationInput(null)}
                                                        style={{ padding: '0.5rem' }}
                                                    />
                                                    <button
                                                        className="btn btn-secondary"
                                                        onClick={() => addLocation(palace.id)}
                                                        style={{ padding: '0.5rem 1rem' }}
                                                    >
                                                        Add
                                                    </button>
                                                </div>

                                                {/* Locations List */}
                                                <div style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                                                    gap: '0.5rem'
                                                }}>
                                                    {palace.locations.map((location, idx) => {
                                                        const isEditing = editingLocation?.palaceId === palace.id && editingLocation?.index === idx;
                                                        const isDragging = draggedItem?.palaceId === palace.id && draggedItem?.index === idx;
                                                        const isDragOver = dragOverItem?.palaceId === palace.id && dragOverItem?.index === idx;

                                                        return (
                                                            <div
                                                                key={idx}
                                                                draggable={!isEditing}
                                                                onDragStart={() => !isEditing && handleDragStart(palace.id, idx)}
                                                                onDragEnter={() => handleDragEnter(palace.id, idx)}
                                                                onDragEnd={handleDragEnd}
                                                                onDragOver={(e) => e.preventDefault()}
                                                                style={{
                                                                    padding: '0.5rem',
                                                                    background: isDragOver ? 'rgba(99, 102, 241, 0.3)' : 'rgba(0,0,0,0.2)',
                                                                    borderRadius: '0.5rem',
                                                                    display: 'flex',
                                                                    flexDirection: 'column',
                                                                    gap: '0.25rem',
                                                                    cursor: isEditing ? 'default' : 'grab',
                                                                    opacity: isDragging ? 0.5 : 1,
                                                                    border: isDragOver ? '2px solid var(--primary)' : '2px solid transparent',
                                                                    transition: 'all 0.2s',
                                                                    transform: isDragging ? 'scale(0.98)' : 'scale(1)',
                                                                    minHeight: '60px',
                                                                    position: 'relative'
                                                                }}
                                                                onMouseEnter={(e) => {
                                                                    if (!isDragging && !isEditing) {
                                                                        e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
                                                                    }
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    if (!isDragOver && !isEditing) {
                                                                        e.currentTarget.style.background = 'rgba(0,0,0,0.2)';
                                                                    }
                                                                }}
                                                            >
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                                    <span style={{
                                                                        opacity: 0.5,
                                                                        fontSize: '0.7rem',
                                                                        fontWeight: 'bold'
                                                                    }}>
                                                                        {idx + 1}
                                                                    </span>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            deleteLocation(palace.id, location);
                                                                        }}
                                                                        style={{
                                                                            background: 'rgba(239, 68, 68, 0.2)',
                                                                            border: 'none',
                                                                            borderRadius: '0.25rem',
                                                                            padding: '0.1rem 0.3rem',
                                                                            color: 'var(--error)',
                                                                            cursor: 'pointer',
                                                                            fontSize: '0.75rem',
                                                                            transition: 'all 0.2s',
                                                                            lineHeight: 1
                                                                        }}
                                                                        onMouseEnter={(e) => {
                                                                            e.currentTarget.style.background = 'var(--error)';
                                                                            e.currentTarget.style.color = 'white';
                                                                        }}
                                                                        onMouseLeave={(e) => {
                                                                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                                                                            e.currentTarget.style.color = 'var(--error)';
                                                                        }}
                                                                    >
                                                                        ✕
                                                                    </button>
                                                                </div>
                                                                {isEditing ? (
                                                                    <input
                                                                        type="text"
                                                                        className="input-field"
                                                                        value={location}
                                                                        onChange={(e) => updateLocation(palace.id, idx, e.target.value)}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter' || e.key === 'Escape') {
                                                                                setEditingLocation(null);
                                                                            }
                                                                        }}
                                                                        onBlur={() => setEditingLocation(null)}
                                                                        autoFocus
                                                                        style={{ fontSize: '0.8rem', padding: '0.4rem' }}
                                                                    />
                                                                ) : (
                                                                    <div
                                                                        style={{
                                                                            fontSize: '0.8rem',
                                                                            cursor: 'pointer',
                                                                            flex: 1,
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            wordBreak: 'break-word',
                                                                            lineHeight: 1.2
                                                                        }}
                                                                        onClick={() => setEditingLocation({ palaceId: palace.id, index: idx })}
                                                                    >
                                                                        {location}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                    {palace.locations.length === 0 && (
                                                        <div style={{ padding: '1rem', textAlign: 'center', opacity: 0.5, fontSize: '0.9rem' }}>
                                                            No locations yet. Add your first one above!
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}

            </main>
        </>
    );
}
