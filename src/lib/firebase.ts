import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, addDoc, query, orderBy, getDocs, doc, setDoc, getDoc, deleteDoc, where } from "firebase/firestore";

export type TimeFilter = '1h' | '2h' | '12h' | '1d' | '1w' | '1m' | '1y' | 'all';

// Helper function to get time cutoffs for filters
export const getCalendarCutoff = (timeFilter: TimeFilter): number => {
    if (timeFilter === 'all') return 0;

    const now = Date.now();

    switch (timeFilter) {
        case '1h': // Last 1 hour
            return now - (1 * 60 * 60 * 1000);
        case '2h': // Last 2 hours
            return now - (2 * 60 * 60 * 1000);
        case '12h': // Last 12 hours
            return now - (12 * 60 * 60 * 1000);
        case '1d': // Today (last 24 hours)
            return now - (24 * 60 * 60 * 1000);
        case '1w': // This week (last 7 days)
            return now - (7 * 24 * 60 * 60 * 1000);
        case '1m': // This month (last 30 days)
            return now - (30 * 24 * 60 * 60 * 1000);
        case '1y': // This year (last 365 days)
            return now - (365 * 24 * 60 * 60 * 1000);
        default:
            return 0;
    }
};

// ... existing code ...

export const getCardHistory = async (
    cardNumber: string,
    userId: string = USER_ID,
    timeFilter?: TimeFilter
): Promise<CardAttempt[]> => {
    try {
        if (!firebaseConfig.apiKey) {
            return [];
        }

        const attemptsRef = collection(db, 'major_system_attempts', userId, 'attempts');
        // Fetch by card number, sort in memory to avoid index requirement issues
        const q = query(attemptsRef, where('cardNumber', '==', cardNumber));

        const snapshot = await getDocs(q);
        let attempts = snapshot.docs.map(doc => doc.data() as CardAttempt);

        // Sort by timestamp ascending
        attempts.sort((a, b) => a.timestamp - b.timestamp);

        // Filter by time using calendar-based cutoffs
        if (timeFilter && timeFilter !== 'all') {
            const cutoff = getCalendarCutoff(timeFilter);
            attempts = attempts.filter(a => a.timestamp >= cutoff);
        }

        return attempts;
    } catch (error) {
        console.error('Error fetching card history:', error);
        return [];
    }
};

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export interface GameResult {
    type: 'digit' | 'word' | 'number-wall' | 'card-blitz' | 'binary-surge' | 'spoken-numbers' | 'names-gauntlet' | 'word-palace' | 'decathlon' | 'abstract-matrix' | 'multilingual-list' | 'instant-visualization' | 'sensory-walkthrough' | 'system-checker' | 'philosophical-attribution' | 'n-back' | 'quick-math' | 'card-sequence' | 'names-international' | 'image-sequence' | 'visualization-latency' | 'urban-locus-tracer' | 'chain-reaction' | 'focus-shifter' | 'image-vault-quiz' | 'historic-dates' | 'spoken-words' | 'srs-review';
    count: number;
    correct: number;
    total: number;
    percentage: number;
    memorizeTime: number;
    recallTime: number;
    timestamp: number;
    date: string;
    // Legacy aliases kept for backward compatibility
    accuracy?: number;
    recallPercentage?: number;
    // Standardized metrics (Phase 2+)
    /** Items encoded per minute = (count / memorizeTime) * 60. Auto-computed in saveGameResult when memorizeTime > 0. */
    encodingSpeed?: number;
    /** Precision: correct / attempted * 100. Diagnoses image quality. */
    precision?: number;
    /** Completeness: attempted / total * 100. Diagnoses journey/capacity. */
    completeness?: number;
    /** True when the session used a standardized benchmark config. */
    isBenchmark?: boolean;
}

// Image Vault Data Structures
export interface MajorEntry {
    id: string;
    number: string;
    // Legacy support - keep for backward compatibility
    images?: string[];
    // New PAO-style structure
    persons: string[];
    actions: string[];
    objects: string[];
}

export interface PaoEntry {
    id: string;
    card: string;
    person: string;
    action: string;
    object: string;
}

export interface Palace {
    id: string;
    name: string;
    locations: string[];
}

export interface Landmark {
    id: string;
    name: string;
    type: string; // e.g., "school", "hospital", "restaurant", etc.
    lat: number;
    lng: number;
    createdAt: number;
    verified?: boolean;
}

export interface ImageVaultData {
    majorSystem: MajorEntry[];
    paoSystem: PaoEntry[];
    digitPaoSystem: DigitPaoEntry[];
    palaces: Palace[];
    lastUpdated: number;
}

export interface DigitPaoEntry {
    id: string;
    number: string;
    person: string;
    action: string;
    object: string;
}

// Game Results Functions
export const saveGameResult = async (result: Omit<GameResult, 'timestamp' | 'date'>) => {
    try {
        if (!firebaseConfig.apiKey) {
            console.warn("Firebase config missing. Results not saved.");
            return false;
        }

        // Auto-compute encoding speed when a meaningful memorize phase exists
        const encodingSpeed =
            result.memorizeTime > 0 && result.count > 0
                ? Math.round((result.count / result.memorizeTime) * 60)
                : undefined;

        const now = new Date();
        const data: GameResult = {
            ...result,
            ...(encodingSpeed !== undefined ? { encodingSpeed } : {}),
            timestamp: now.getTime(),
            date: now.toISOString().split('T')[0]
        };
        await addDoc(collection(db, "game_results"), data);

        // Update personal records silently — never block the caller on a PR failure
        updatePersonalRecord(result.type, data).catch(() => {});

        return true;
    } catch (e) {
        console.error("Error adding document: ", e);
        return false;
    }
};

export const getGameResults = async (timeFilter?: TimeFilter): Promise<GameResult[]> => {
    try {
        if (!firebaseConfig.apiKey) return [];
        const q = query(collection(db, "game_results"), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        const all = querySnapshot.docs.map(doc => doc.data() as GameResult);
        const cutoff = timeFilter ? getCalendarCutoff(timeFilter) : 0;
        const filtered = cutoff > 0 ? all.filter(r => r.timestamp >= cutoff) : all;
        return filtered.reverse();
    } catch (e) {
        console.error("Error getting documents: ", e);
        return [];
    }
};

// ===== LANDMARKS =====

export const saveLandmark = async (userId: string, landmark: Omit<Landmark, 'id'>) => {
    try {
        const landmarksRef = collection(db, 'landmarks', userId, 'entries');
        const docRef = await addDoc(landmarksRef, {
            ...landmark,
            verified: landmark.verified ?? false,
            createdAt: Date.now()
        });
        return docRef.id;
    } catch (error) {
        console.error('Error saving landmark:', error);
        throw error;
    }
};

export const getLandmarks = async (userId: string): Promise<Landmark[]> => {
    try {
        const landmarksRef = collection(db, 'landmarks', userId, 'entries');
        const q = query(landmarksRef, orderBy('createdAt', 'asc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Landmark));
    } catch (error) {
        console.error('Error getting landmarks:', error);
        throw error;
    }
};

export const deleteLandmark = async (userId: string, landmarkId: string) => {
    try {
        const landmarkRef = doc(db, 'landmarks', userId, 'entries', landmarkId);
        await deleteDoc(landmarkRef);
    } catch (error) {
        console.error('Error deleting landmark:', error);
        throw error;
    }
};

export const updateLandmark = async (userId: string, landmarkId: string, updates: Partial<Omit<Landmark, 'id'>>) => {
    try {
        const landmarkRef = doc(db, 'landmarks', userId, 'entries', landmarkId);
        await setDoc(landmarkRef, updates, { merge: true });
    } catch (error) {
        console.error('Error updating landmark:', error);
        throw error;
    }
};

// Image Vault Functions
const USER_ID = 'default_user'; // In a real app, this would be the authenticated user's ID

export const saveImageVaultData = async (data: Partial<ImageVaultData>) => {
    try {
        if (!firebaseConfig.apiKey) {
            console.warn("Firebase config missing. Data not saved.");
            return false;
        }

        const docRef = doc(db, "image_vault", USER_ID);
        const existingDoc = await getDoc(docRef);

        const updatedData: ImageVaultData = {
            majorSystem: [],
            paoSystem: [],
            digitPaoSystem: [],
            palaces: [],
            lastUpdated: Date.now(),
            ...(existingDoc.exists() ? existingDoc.data() as ImageVaultData : {}),
            ...data
        };

        await setDoc(docRef, updatedData);
        return true;
    } catch (e) {
        console.error("Error saving Image Vault data: ", e);
        return false;
    }
};

export const getImageVaultData = async (): Promise<ImageVaultData | null> => {
    try {
        if (!firebaseConfig.apiKey) {
            return null;
        }

        const docRef = doc(db, "image_vault", USER_ID);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data() as ImageVaultData;
            return {
                majorSystem: data.majorSystem || [],
                paoSystem: data.paoSystem || [],
                digitPaoSystem: data.digitPaoSystem || [],
                palaces: data.palaces || [],
                lastUpdated: data.lastUpdated
            };
        } else {
            return null;
        }
    } catch (e) {
        console.error("Error getting Image Vault data: ", e);
        return null;
    }
};

export const bootstrapDigitPaoSystem = async (defaultData: DigitPaoEntry[]) => {
    try {
        const currentData = await getImageVaultData();

        const updates: Partial<ImageVaultData> = {};
        let needsUpdate = false;

        // Bootstrap Digit PAO if missing
        if (!currentData || !currentData.digitPaoSystem || currentData.digitPaoSystem.length === 0) {
            updates.digitPaoSystem = defaultData;
            needsUpdate = true;
        }

        if (needsUpdate) {
            await saveImageVaultData(updates);
            console.log("Digit PAO system bootstrapped successfully.");
            return true;
        }
        return false;
    } catch (e) {
        console.error("Error bootstrapping Digit PAO system:", e);
        return false;
    }
};

export const bootstrapCardPaoSystem = async (defaultData: PaoEntry[]) => {
    try {
        const currentData = await getImageVaultData();
        // If no data exists, or if paoSystem is empty/missing, we bootstrap
        if (!currentData || !currentData.paoSystem || currentData.paoSystem.length === 0) {
            await saveImageVaultData({
                paoSystem: defaultData
            });
            console.log("Card PAO system bootstrapped successfully.");
            return true;
        }
        return false;
    } catch (e) {
        console.error("Error bootstrapping Card PAO system:", e);
        return false;
    }
};

export const bootstrapMajorSystem = async (defaultData: MajorEntry[]) => {
    try {
        const currentData = await getImageVaultData();
        // If no data exists, or if majorSystem is empty/missing, we bootstrap
        if (!currentData || !currentData.majorSystem || currentData.majorSystem.length === 0) {
            await saveImageVaultData({
                majorSystem: defaultData
            });
            console.log("Major System bootstrapped successfully.");
            return true;
        }
        return false;
    } catch (e) {
        console.error("Error bootstrapping Major System:", e);
        return false;
    }
};

// ===== TRAINING FAVORITES =====

export const getFavorites = async (userId: string = USER_ID): Promise<string[]> => {
    try {
        if (!firebaseConfig.apiKey) {
            return [];
        }
        const docRef = doc(db, 'training_favorites', userId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            return data.favorites || [];
        }
        return [];
    } catch (error) {
        console.error('Error loading favorites:', error);
        return [];
    }
};

export const saveFavorites = async (favorites: string[], userId: string = USER_ID): Promise<boolean> => {
    try {
        if (!firebaseConfig.apiKey) {
            console.warn("Firebase config missing. Favorites not saved.");
            return false;
        }
        const docRef = doc(db, 'training_favorites', userId);
        await setDoc(docRef, {
            favorites,
            lastUpdated: Date.now()
        });
        return true;
    } catch (error) {
        console.error('Error saving favorites:', error);
        return false;
    }
};

// ===== MAJOR SYSTEM CARD STATISTICS =====

export interface CardAttempt {
    cardNumber: string;
    isCorrect: boolean;
    responseTime: number; // milliseconds
    timestamp: number;
    questionType: 'digits' | 'words'; // which direction was tested
    /** Namespaced: 'cardpao:KH', 'digitpao:7'. Undefined = legacy bare major key '00'–'99'. */
    system?: 'major' | 'card-pao' | 'digit-pao';
}

export interface CardStats {
    cardNumber: string;
    totalAttempts: number;
    mistakes: number;
    averageTime: number; // milliseconds
    lastAttempt: number;
    performanceScore: number; // 0-100, higher is better
}

export const saveCardAttempt = async (attempt: CardAttempt, userId: string = USER_ID): Promise<boolean> => {
    try {
        if (!firebaseConfig.apiKey) {
            console.warn("Firebase config missing. Card attempt not saved.");
            return false;
        }

        const attemptsRef = collection(db, 'major_system_attempts', userId, 'attempts');
        await addDoc(attemptsRef, attempt);
        return true;
    } catch (error) {
        console.error('Error saving card attempt:', error);
        return false;
    }
};

export const getCardStats = async (
    userId: string = USER_ID,
    timeFilter?: TimeFilter
): Promise<Map<string, CardStats>> => {
    try {
        if (!firebaseConfig.apiKey) {
            return new Map();
        }

        const attemptsRef = collection(db, 'major_system_attempts', userId, 'attempts');
        let q = query(attemptsRef, orderBy('timestamp', 'desc'));

        const snapshot = await getDocs(q);
        const attempts: CardAttempt[] = snapshot.docs.map(doc => doc.data() as CardAttempt);

        // Apply time filter in memory using calendar-based cutoffs
        const filteredAttempts = timeFilter && timeFilter !== 'all'
            ? attempts.filter(a => {
                const cutoff = getCalendarCutoff(timeFilter);
                return a.timestamp >= cutoff;
            })
            : attempts;

        // Calculate stats per card
        const statsMap = new Map<string, CardStats>();

        filteredAttempts.forEach(attempt => {
            const existing = statsMap.get(attempt.cardNumber);

            if (existing) {
                const newTotal = existing.totalAttempts + 1;
                const newMistakes = existing.mistakes + (attempt.isCorrect ? 0 : 1);
                const newAvgTime = ((existing.averageTime * existing.totalAttempts) + attempt.responseTime) / newTotal;

                statsMap.set(attempt.cardNumber, {
                    cardNumber: attempt.cardNumber,
                    totalAttempts: newTotal,
                    mistakes: newMistakes,
                    averageTime: newAvgTime,
                    lastAttempt: Math.max(existing.lastAttempt, attempt.timestamp),
                    performanceScore: calculatePerformanceScore(newTotal, newMistakes, newAvgTime)
                });
            } else {
                statsMap.set(attempt.cardNumber, {
                    cardNumber: attempt.cardNumber,
                    totalAttempts: 1,
                    mistakes: attempt.isCorrect ? 0 : 1,
                    averageTime: attempt.responseTime,
                    lastAttempt: attempt.timestamp,
                    performanceScore: calculatePerformanceScore(1, attempt.isCorrect ? 0 : 1, attempt.responseTime)
                });
            }
        });

        return statsMap;
    } catch (error) {
        console.error('Error getting card stats:', error);
        return new Map();
    }
};

// Calculate performance score (0-100, higher is better)
// Factors: accuracy (70%), speed (30%)
const calculatePerformanceScore = (totalAttempts: number, mistakes: number, avgTime: number): number => {
    if (totalAttempts === 0) return 50; // neutral score for no data

    const accuracy = ((totalAttempts - mistakes) / totalAttempts) * 100;

    // Speed score: faster is better, normalize to 0-100
    // Assume 5 seconds is perfect (100), 15 seconds is poor (0)
    const avgTimeSeconds = avgTime / 1000;
    const speedScore = Math.max(0, Math.min(100, 100 - ((avgTimeSeconds - 5) / 10) * 100));

    // Weighted combination: 70% accuracy, 30% speed
    const score = (accuracy * 0.7) + (speedScore * 0.3);

    return Math.round(score);
};

export const getCardPerformanceColor = (stats: CardStats | undefined): string => {
    if (!stats || stats.totalAttempts === 0) {
        return 'rgba(99, 102, 241, 0.15)'; // Primary theme color (indigo) for no data
    }

    const score = stats.performanceScore;
    const avgTimeInSeconds = stats.averageTime / 1000;

    // Platinum: 0 mistakes AND average time < 2 seconds - Ultimate tier with radiant glow
    if (stats.mistakes === 0 && avgTimeInSeconds < 2) {
        return 'linear-gradient(135deg, rgba(229, 228, 226, 0.6) 0%, rgba(156, 163, 175, 0.6) 50%, rgba(229, 228, 226, 0.6) 100%)'; // Platinum gradient
    }
    // Gold: 75-100 (well memorized) - Premium tier with warm glow
    else if (score >= 75) {
        return 'linear-gradient(135deg, rgba(251, 191, 36, 0.5) 0%, rgba(245, 158, 11, 0.5) 50%, rgba(251, 191, 36, 0.5) 100%)'; // Gold gradient
    }
    // Silver: 50-74 (medium) - Mid tier with cool metallic shine
    else if (score >= 50) {
        return 'linear-gradient(135deg, rgba(203, 213, 225, 0.45) 0%, rgba(148, 163, 184, 0.45) 50%, rgba(203, 213, 225, 0.45) 100%)'; // Silver gradient
    }
    // Bronze: 0-49 (difficult) - Base tier with warm bronze tone
    else {
        return 'linear-gradient(135deg, rgba(205, 127, 50, 0.4) 0%, rgba(180, 83, 9, 0.4) 50%, rgba(205, 127, 50, 0.4) 100%)'; // Bronze gradient
    }
};

/**
 * One-time migration: copies each MajorEntry's `images[0]` into `objects[0]` so
 * the PAO structure becomes the canonical source. Keeps `images` for rollback.
 * Safe to call multiple times — skips entries that already have objects.
 */
export const migrateMajorImagesToPao = async (userId: string = USER_ID): Promise<{ migrated: number; skipped: number }> => {
    let migrated = 0;
    let skipped = 0;
    try {
        if (!firebaseConfig.apiKey) return { migrated, skipped };
        const docRef = doc(db, 'image_vault', userId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return { migrated, skipped };

        const data = snap.data() as ImageVaultData;
        const updated = (data.majorSystem ?? []).map(entry => {
            const hasObjects = entry.objects?.length > 0;
            const hasImage = entry.images && entry.images.length > 0;
            if (hasObjects || !hasImage) { skipped++; return entry; }
            migrated++;
            return { ...entry, objects: [entry.images![0]], ...(entry.persons ? {} : { persons: [] }), ...(entry.actions ? {} : { actions: [] }) };
        });

        await setDoc(docRef, { ...data, majorSystem: updated, lastUpdated: Date.now() });
        return { migrated, skipped };
    } catch (error) {
        console.error('Error migrating major images to PAO:', error);
        return { migrated, skipped };
    }
};

export interface DailyGlobalStats {
    date: string; // YYYY-MM-DD
    totalAttempts: number;
    mistakes: number;
    errorRate: number; // percentage
    averageTime: number; // seconds
}

export const getGlobalDailyStats = async (
    userId: string = USER_ID,
    timeFilter?: TimeFilter
): Promise<DailyGlobalStats[]> => {
    try {
        if (!firebaseConfig.apiKey) {
            return [];
        }

        const attemptsRef = collection(db, 'major_system_attempts', userId, 'attempts');
        // We fetch all and filter in memory to ensure consistent filtering logic
        const q = query(attemptsRef, orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        const attempts: CardAttempt[] = snapshot.docs.map(doc => doc.data() as CardAttempt);

        // Apply time filter
        const filteredAttempts = timeFilter && timeFilter !== 'all'
            ? attempts.filter(a => {
                const cutoff = getCalendarCutoff(timeFilter);
                return a.timestamp >= cutoff;
            })
            : attempts;

        // Group by day
        const dayMap = new Map<string, { totalTime: number; totalAttempts: number; mistakes: number }>();

        filteredAttempts.forEach(attempt => {
            const date = new Date(attempt.timestamp).toLocaleDateString('en-CA'); // YYYY-MM-DD
            const current = dayMap.get(date) || { totalTime: 0, totalAttempts: 0, mistakes: 0 };

            current.totalTime += attempt.responseTime;
            current.totalAttempts += 1;
            if (!attempt.isCorrect) {
                current.mistakes += 1;
            }

            dayMap.set(date, current);
        });

        // Convert to array and sort
        const stats: DailyGlobalStats[] = Array.from(dayMap.entries()).map(([date, data]) => ({
            date,
            totalAttempts: data.totalAttempts,
            mistakes: data.mistakes,
            errorRate: (data.mistakes / data.totalAttempts) * 100,
            averageTime: (data.totalTime / data.totalAttempts) / 1000 // convert ms to seconds
        }));

        // Sort by date ascending
        return stats.sort((a, b) => a.date.localeCompare(b.date));

    } catch (error) {
        console.error('Error getting global daily stats:', error);
        return [];
    }
};

export const getCardDailyStats = async (
    cardNumber: string,
    userId: string = USER_ID,
    timeFilter?: TimeFilter
): Promise<DailyGlobalStats[]> => {
    try {
        if (!firebaseConfig.apiKey) {
            return [];
        }

        const attemptsRef = collection(db, 'major_system_attempts', userId, 'attempts');
        const q = query(attemptsRef, orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        const attempts: CardAttempt[] = snapshot.docs.map(doc => doc.data() as CardAttempt);

        // Filter by card number and time
        const filteredAttempts = attempts.filter(a => {
            if (a.cardNumber !== cardNumber) return false;
            if (timeFilter && timeFilter !== 'all') {
                const cutoff = getCalendarCutoff(timeFilter);
                return a.timestamp >= cutoff;
            }
            return true;
        });

        // Group by day
        const dayMap = new Map<string, { totalTime: number; totalAttempts: number; mistakes: number }>();

        filteredAttempts.forEach(attempt => {
            const date = new Date(attempt.timestamp).toLocaleDateString('en-CA');
            const current = dayMap.get(date) || { totalTime: 0, totalAttempts: 0, mistakes: 0 };

            current.totalTime += attempt.responseTime;
            current.totalAttempts += 1;
            if (!attempt.isCorrect) {
                current.mistakes += 1;
            }

            dayMap.set(date, current);
        });

        // Convert to array and sort
        const stats: DailyGlobalStats[] = Array.from(dayMap.entries()).map(([date, data]) => ({
            date,
            totalAttempts: data.totalAttempts,
            mistakes: data.mistakes,
            errorRate: (data.mistakes / data.totalAttempts) * 100,
            averageTime: (data.totalTime / data.totalAttempts) / 1000
        }));

        return stats.sort((a, b) => a.date.localeCompare(b.date));

    } catch (error) {
        console.error('Error getting card daily stats:', error);
        return [];
    }
};

// ===== MEMORY PALACE STATISTICS =====

export interface PalaceItemStat {
    locationIndex: number;
    word: string;
    isCorrect: boolean;
    recallTime: number; // milliseconds
}

export interface PalaceAttempt {
    palaceId: string;
    timestamp: number;
    totalWords: number;
    correctCount: number;
    memorizeTime: number; // milliseconds
    recallTime: number; // milliseconds
    turns: number;
    isTimed: boolean;
    itemStats: PalaceItemStat[];
}

export interface PalaceLocationStat {
    timesUsed: number;
    timesFailed: number;
    avgRetrievalTime: number;
}

export interface PalaceStats {
    palaceId: string;
    totalDrills: number;
    avgSuccessRate: number;
    avgRecallTime: number; // per item
    locationStats: Record<number, PalaceLocationStat>;
}

export const savePalaceAttempt = async (attempt: PalaceAttempt, userId: string = USER_ID): Promise<boolean> => {
    try {
        if (!firebaseConfig.apiKey) return false;

        const attemptsRef = collection(db, 'memory_palace_attempts', userId, 'attempts');
        await addDoc(attemptsRef, attempt);
        return true;
    } catch (error) {
        console.error('Error saving palace attempt:', error);
        return false;
    }
};

export const getPalaceStats = async (palaceId: string, userId: string = USER_ID): Promise<PalaceStats> => {
    try {
        if (!firebaseConfig.apiKey) {
            return {
                palaceId,
                totalDrills: 0,
                avgSuccessRate: 0,
                avgRecallTime: 0,
                locationStats: {}
            };
        }

        const attemptsRef = collection(db, 'memory_palace_attempts', userId, 'attempts');
        const q = query(attemptsRef, where('palaceId', '==', palaceId));
        const snapshot = await getDocs(q);

        const attempts = snapshot.docs.map(doc => doc.data() as PalaceAttempt);

        if (attempts.length === 0) {
            return {
                palaceId,
                totalDrills: 0,
                avgSuccessRate: 0,
                avgRecallTime: 0,
                locationStats: {}
            };
        }

        let totalSuccessRate = 0;
        let totalRecallTime = 0;
        let totalItems = 0;
        const locationStats: Record<number, PalaceLocationStat> = {};

        attempts.forEach(attempt => {
            const successRate = (attempt.correctCount / attempt.totalWords) * 100;
            totalSuccessRate += successRate;

            attempt.itemStats.forEach(item => {
                totalRecallTime += item.recallTime;
                totalItems++;

                if (!locationStats[item.locationIndex]) {
                    locationStats[item.locationIndex] = {
                        timesUsed: 0,
                        timesFailed: 0,
                        avgRetrievalTime: 0
                    };
                }

                const locStat = locationStats[item.locationIndex];
                const totalLocTime = (locStat.avgRetrievalTime * locStat.timesUsed) + item.recallTime;

                locStat.timesUsed++;
                if (!item.isCorrect) locStat.timesFailed++;
                locStat.avgRetrievalTime = totalLocTime / locStat.timesUsed;
            });
        });

        return {
            palaceId,
            totalDrills: attempts.length,
            avgSuccessRate: totalSuccessRate / attempts.length,
            avgRecallTime: totalItems > 0 ? totalRecallTime / totalItems : 0,
            locationStats
        };
    } catch (error) {
        console.error('Error fetching palace stats:', error);
        return {
            palaceId,
            totalDrills: 0,
            avgSuccessRate: 0,
            avgRecallTime: 0,
            locationStats: {}
        };
    }
};

// ===== TRAINING TIME TRACKING =====

export interface TrainingSession {
    sessionId: string;
    exerciseType: string; // 'major-drill', 'palace-drill', 'n-back', etc.
    startTime: number;
    endTime?: number; // undefined if ongoing
    duration?: number; // milliseconds, calculated when session ends
    completed: boolean;
    metadata?: any; // exercise-specific data (score, config, etc.)
}

export interface TimeStats {
    totalTime: number; // milliseconds
    sessionCount: number;
    completedSessions: number;
    incompleteSessions: number;
    byExercise: Record<string, {
        totalTime: number;
        sessionCount: number;
    }>;
}

// Start a new training session
export const startTrainingSession = async (
    exerciseType: string,
    userId: string = USER_ID,
    metadata?: any
): Promise<string> => {
    try {
        if (!firebaseConfig.apiKey) return '';

        const sessionId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const session: TrainingSession = {
            sessionId,
            exerciseType,
            startTime: Date.now(),
            completed: false,
            metadata
        };

        const sessionsRef = collection(db, 'training_sessions', userId, 'sessions');
        await addDoc(sessionsRef, session);

        return sessionId;
    } catch (error) {
        console.error('Error starting training session:', error);
        return '';
    }
};

// End a training session
export const endTrainingSession = async (
    sessionId: string,
    userId: string = USER_ID,
    completed: boolean = true,
    metadata?: any
): Promise<boolean> => {
    try {
        if (!firebaseConfig.apiKey || !sessionId) return false;

        const sessionsRef = collection(db, 'training_sessions', userId, 'sessions');
        const q = query(sessionsRef, where('sessionId', '==', sessionId));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return false;

        const docRef = snapshot.docs[0].ref;
        const sessionData = snapshot.docs[0].data() as TrainingSession;

        const endTime = Date.now();
        const duration = endTime - sessionData.startTime;

        await setDoc(docRef, {
            ...sessionData,
            endTime,
            duration,
            completed,
            metadata: { ...sessionData.metadata, ...metadata }
        });

        return true;
    } catch (error) {
        console.error('Error ending training session:', error);
        return false;
    }
};

// Get time statistics — derived from game_results so all drills contribute
export const getTimeStats = async (
    userId: string = USER_ID,
    timeFilter?: TimeFilter
): Promise<TimeStats> => {
    try {
        if (!firebaseConfig.apiKey) {
            return { totalTime: 0, sessionCount: 0, completedSessions: 0, incompleteSessions: 0, byExercise: {} };
        }

        const results = await getGameResults(timeFilter);

        let totalTime = 0;
        const byExercise: Record<string, { totalTime: number; sessionCount: number }> = {};

        for (const r of results) {
            const durationMs = ((r.memorizeTime ?? 0) + (r.recallTime ?? 0)) * 1000;
            if (durationMs <= 0) continue;

            totalTime += durationMs;
            if (!byExercise[r.type]) byExercise[r.type] = { totalTime: 0, sessionCount: 0 };
            byExercise[r.type].totalTime += durationMs;
            byExercise[r.type].sessionCount++;
        }

        return {
            totalTime,
            sessionCount: results.length,
            completedSessions: results.length,
            incompleteSessions: 0,
            byExercise,
        };
    } catch (error) {
        console.error('Error getting time stats:', error);
        return { totalTime: 0, sessionCount: 0, completedSessions: 0, incompleteSessions: 0, byExercise: {} };
    }
};

// Get session history
export const getSessionHistory = async (
    userId: string = USER_ID,
    timeFilter?: TimeFilter,
    exerciseType?: string
): Promise<TrainingSession[]> => {
    try {
        if (!firebaseConfig.apiKey) return [];

        const sessionsRef = collection(db, 'training_sessions', userId, 'sessions');
        let q = query(sessionsRef, orderBy('startTime', 'desc'));

        const snapshot = await getDocs(q);
        let sessions = snapshot.docs.map(doc => doc.data() as TrainingSession);

        // Apply filters
        if (timeFilter && timeFilter !== 'all') {
            const cutoff = getCalendarCutoff(timeFilter);
            sessions = sessions.filter(s => s.startTime >= cutoff);
        }

        if (exerciseType) {
            sessions = sessions.filter(s => s.exerciseType === exerciseType);
        }

        return sessions;
    } catch (error) {
        console.error('Error getting session history:', error);
        return [];
    }
};

// ===== PERSONAL RECORDS =====

export interface PersonalRecord {
    drillType: string;
    /** Highest precision (correct/attempted %) in any session. */
    bestPrecision: number;
    /** Most items memorized at any accuracy level. */
    bestCount: number;
    /** Highest items/minute at ≥90% precision. */
    bestEncodingSpeed: number;
    /** Highest completeness (attempted/total %) in any session. */
    bestCompleteness: number;
    achievedAt: number;
    config?: Record<string, unknown>;
}

export interface PersonalRecords {
    records: Record<string, PersonalRecord>;
    lastUpdated: number;
}

const PR_EMPTY: PersonalRecord = {
    drillType: '',
    bestPrecision: 0,
    bestCount: 0,
    bestEncodingSpeed: 0,
    bestCompleteness: 0,
    achievedAt: 0,
};

export const getPersonalRecords = async (userId: string = USER_ID): Promise<PersonalRecords> => {
    try {
        if (!firebaseConfig.apiKey) return { records: {}, lastUpdated: 0 };
        const ref = doc(db, 'personal_records', userId);
        const snap = await getDoc(ref);
        if (snap.exists()) return snap.data() as PersonalRecords;
        return { records: {}, lastUpdated: 0 };
    } catch (error) {
        console.error('Error fetching personal records:', error);
        return { records: {}, lastUpdated: 0 };
    }
};

export const updatePersonalRecord = async (
    drillType: string,
    result: GameResult,
    userId: string = USER_ID
): Promise<boolean> => {
    try {
        if (!firebaseConfig.apiKey) return false;

        const ref = doc(db, 'personal_records', userId);
        const snap = await getDoc(ref);
        const existing: PersonalRecords = snap.exists()
            ? (snap.data() as PersonalRecords)
            : { records: {}, lastUpdated: 0 };

        const prev: PersonalRecord = existing.records[drillType] ?? { ...PR_EMPTY, drillType };

        const precision = result.precision ?? result.accuracy ?? result.percentage;
        const completeness = result.completeness ?? result.recallPercentage ?? 100;
        const encodingSpeed = result.encodingSpeed ?? 0;

        // Only write if at least one PR improved
        const precisionImproved = precision > prev.bestPrecision;
        const countImproved = result.count > prev.bestCount;
        const speedImproved = precision >= 90 && encodingSpeed > prev.bestEncodingSpeed;
        const completenessImproved = completeness > prev.bestCompleteness;

        if (!precisionImproved && !countImproved && !speedImproved && !completenessImproved) {
            return false;
        }

        const updated: PersonalRecord = {
            drillType,
            bestPrecision: precisionImproved ? precision : prev.bestPrecision,
            bestCount: countImproved ? result.count : prev.bestCount,
            bestEncodingSpeed: speedImproved ? encodingSpeed : prev.bestEncodingSpeed,
            bestCompleteness: completenessImproved ? completeness : prev.bestCompleteness,
            achievedAt: Date.now(),
        };

        await setDoc(ref, {
            records: { ...existing.records, [drillType]: updated },
            lastUpdated: Date.now(),
        });
        return true;
    } catch (error) {
        console.error('Error updating personal record:', error);
        return false;
    }
};

// ===== SRS STATE =====

export interface SrsItemState {
    itemKey: string;
    ease: number;
    intervalDays: number;
    dueAt: number;
    reps: number;
    lapses: number;
}

export interface SrsStateDoc {
    items: Record<string, SrsItemState>;
    lastUpdated: number;
}

export const getSrsState = async (userId: string = USER_ID): Promise<SrsStateDoc> => {
    try {
        if (!firebaseConfig.apiKey) return { items: {}, lastUpdated: 0 };
        const ref = doc(db, 'srs_state', userId);
        const snap = await getDoc(ref);
        if (snap.exists()) return snap.data() as SrsStateDoc;
        return { items: {}, lastUpdated: 0 };
    } catch (error) {
        console.error('Error getting SRS state:', error);
        return { items: {}, lastUpdated: 0 };
    }
};

export const saveSrsState = async (state: SrsStateDoc, userId: string = USER_ID): Promise<boolean> => {
    try {
        if (!firebaseConfig.apiKey) return false;
        const ref = doc(db, 'srs_state', userId);
        await setDoc(ref, { ...state, lastUpdated: Date.now() });
        return true;
    } catch (error) {
        console.error('Error saving SRS state:', error);
        return false;
    }
};

// ===== DRILL PRESETS =====

export interface DrillPreset {
    id: string;
    name: string;
    config: Record<string, unknown>;
    createdAt: number;
}

export interface DrillPresetsDoc {
    /** Keyed by gameType */
    presets: Record<string, DrillPreset[]>;
    lastUpdated: number;
}

export const getDrillPresets = async (userId: string = USER_ID): Promise<DrillPresetsDoc> => {
    try {
        if (!firebaseConfig.apiKey) return { presets: {}, lastUpdated: 0 };
        const ref = doc(db, 'drill_presets', userId);
        const snap = await getDoc(ref);
        if (snap.exists()) return snap.data() as DrillPresetsDoc;
        return { presets: {}, lastUpdated: 0 };
    } catch (error) {
        console.error('Error fetching drill presets:', error);
        return { presets: {}, lastUpdated: 0 };
    }
};

export const saveDrillPreset = async (
    gameType: string,
    preset: Omit<DrillPreset, 'id' | 'createdAt'>,
    userId: string = USER_ID
): Promise<DrillPreset | null> => {
    try {
        if (!firebaseConfig.apiKey) return null;
        const ref = doc(db, 'drill_presets', userId);
        const snap = await getDoc(ref);
        const existing: DrillPresetsDoc = snap.exists()
            ? (snap.data() as DrillPresetsDoc)
            : { presets: {}, lastUpdated: 0 };

        const newPreset: DrillPreset = {
            ...preset,
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            createdAt: Date.now(),
        };

        const updated = {
            presets: {
                ...existing.presets,
                [gameType]: [...(existing.presets[gameType] ?? []), newPreset],
            },
            lastUpdated: Date.now(),
        };

        await setDoc(ref, updated);
        return newPreset;
    } catch (error) {
        console.error('Error saving drill preset:', error);
        return null;
    }
};

export const deleteDrillPreset = async (
    gameType: string,
    presetId: string,
    userId: string = USER_ID
): Promise<boolean> => {
    try {
        if (!firebaseConfig.apiKey) return false;
        const ref = doc(db, 'drill_presets', userId);
        const snap = await getDoc(ref);
        if (!snap.exists()) return false;

        const existing = snap.data() as DrillPresetsDoc;
        const filtered = (existing.presets[gameType] ?? []).filter(p => p.id !== presetId);
        await setDoc(ref, {
            presets: { ...existing.presets, [gameType]: filtered },
            lastUpdated: Date.now(),
        });
        return true;
    } catch (error) {
        console.error('Error deleting drill preset:', error);
        return false;
    }
};
