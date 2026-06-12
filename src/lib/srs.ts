/**
 * SM-2-lite: implicit grading derived from response time + correctness.
 * No Again/Hard/Good/Easy buttons — grade 0–4 comes from the answer itself.
 *
 * Grade mapping (implicit):
 *   wrong          → 0 (lapse)
 *   correct >8s    → 2 (slow)
 *   correct 2–8s   → 3 (good)
 *   correct <2s    → 4 (easy / platinum threshold)
 */

export interface SrsItemState {
    itemKey: string;
    ease: number;        // EF factor, starts 2.5, min 1.3
    intervalDays: number; // current interval
    dueAt: number;       // Unix ms
    reps: number;        // successful recalls in a row
    lapses: number;      // total wrong answers
}

export interface SrsState {
    items: Record<string, SrsItemState>;
    lastUpdated: number;
}

// Existing tier → initial interval for cold-start seeding
export const TIER_SEED_DAYS: Record<string, number> = {
    platinum: 7,
    gold: 3,
    silver: 1,
    bronze: 0,
    none: 0,
};

const MIN_EASE = 1.3;
const MAX_INTERVAL = 365;
const MAX_NEW_PER_SESSION = 10;
const DAY_MS = 86_400_000;

/** Compute a grade (0–4) from response metadata. */
export function gradeFromResponse(isCorrect: boolean, responseTimeMs: number): number {
    if (!isCorrect) return 0;
    const secs = responseTimeMs / 1000;
    if (secs > 8) return 2;
    if (secs > 2) return 3;
    return 4;
}

/** Apply one review to an item state, returning the updated state. */
export function applyReview(prev: SrsItemState, grade: number): SrsItemState {
    const now = Date.now();

    if (grade < 2) {
        // Lapse: reset reps, shorten interval
        return {
            ...prev,
            ease: Math.max(MIN_EASE, prev.ease - 0.2),
            intervalDays: 1,
            dueAt: now + DAY_MS,
            reps: 0,
            lapses: prev.lapses + 1,
        };
    }

    // Successful recall — compute new interval
    let newInterval: number;
    if (prev.reps === 0) {
        newInterval = 1;
    } else if (prev.reps === 1) {
        newInterval = 3;
    } else {
        const multiplier = grade === 2 ? prev.ease * 0.8 : grade === 3 ? prev.ease : prev.ease * 1.3;
        newInterval = Math.min(MAX_INTERVAL, Math.round(prev.intervalDays * multiplier));
    }

    const newEase = grade === 4
        ? Math.min(prev.ease + 0.05, 3.0)
        : grade === 2
        ? Math.max(MIN_EASE, prev.ease - 0.15)
        : prev.ease;

    return {
        ...prev,
        ease: newEase,
        intervalDays: newInterval,
        dueAt: now + newInterval * DAY_MS,
        reps: prev.reps + 1,
        lapses: prev.lapses,
    };
}

/** Create a fresh item state due now. */
export function newItem(itemKey: string): SrsItemState {
    return {
        itemKey,
        ease: 2.5,
        intervalDays: 0,
        dueAt: Date.now(),
        reps: 0,
        lapses: 0,
    };
}

/** Seed an item from existing tier (cold-start). */
export function seedFromTier(itemKey: string, tier: string): SrsItemState {
    const days = TIER_SEED_DAYS[tier] ?? 0;
    return {
        itemKey,
        ease: tier === 'platinum' ? 2.8 : tier === 'gold' ? 2.5 : 2.0,
        intervalDays: days,
        dueAt: Date.now() + days * DAY_MS,
        reps: days === 0 ? 0 : 2,
        lapses: 0,
    };
}

/**
 * Compute the due queue from existing SRS state + all known card keys.
 * Items not yet in state are treated as new (due now), capped by MAX_NEW_PER_SESSION.
 */
export function computeDueQueue(
    state: SrsState,
    allKeys: string[],
    limit = 50
): SrsItemState[] {
    const now = Date.now();
    const due: SrsItemState[] = [];
    let newCount = 0;

    for (const key of allKeys) {
        if (due.length >= limit) break;
        const item = state.items[key];
        if (!item) {
            // New item
            if (newCount < MAX_NEW_PER_SESSION) {
                due.push(newItem(key));
                newCount++;
            }
        } else if (item.dueAt <= now) {
            due.push(item);
        }
    }

    // Sort: overdue first (lowest dueAt), then new
    return due.sort((a, b) => a.dueAt - b.dueAt);
}

/** Merge reviewed items back into the state doc. */
export function mergeReviews(state: SrsState, reviewed: SrsItemState[]): SrsState {
    const updated = { ...state.items };
    for (const item of reviewed) {
        updated[item.itemKey] = item;
    }
    return { items: updated, lastUpdated: Date.now() };
}
