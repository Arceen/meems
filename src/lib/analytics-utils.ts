import { GameResult } from './firebase';

/** Returns current and longest consecutive training-day streaks from a list of ISO date strings. */
export function computeStreaks(dates: string[]): { current: number; longest: number } {
    if (dates.length === 0) return { current: 0, longest: 0 };

    const unique = Array.from(new Set(dates)).sort();
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];

    let longest = 1;
    let run = 1;
    for (let i = 1; i < unique.length; i++) {
        const prev = new Date(unique[i - 1]);
        const curr = new Date(unique[i]);
        const diff = (curr.getTime() - prev.getTime()) / 86_400_000;
        if (diff === 1) {
            run++;
            if (run > longest) longest = run;
        } else {
            run = 1;
        }
    }

    const lastDay = unique[unique.length - 1];
    const current = lastDay === today || lastDay === yesterday ? run : 0;

    return { current, longest };
}

/** Groups results by calendar date label (e.g. "Jun 12") for activity charts. */
export function groupByDay(results: GameResult[]): Map<string, GameResult[]> {
    const map = new Map<string, GameResult[]>();
    for (const r of results) {
        const label = new Date(r.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const bucket = map.get(label) ?? [];
        bucket.push(r);
        map.set(label, bucket);
    }
    return map;
}

/** Format milliseconds as "Xh Ym" or "Ym" or "Xs". */
export function formatDuration(ms: number): string {
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

/** Average of an array of numbers, or 0 if empty. */
export function avg(values: number[]): number {
    if (values.length === 0) return 0;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

/** Build per-drill summary rows from a flat list of results. */
export interface DrillSummary {
    type: string;
    sessions: number;
    avgPrecision: number;
    bestPrecision: number;
    bestCount: number;
    avgEncodingSpeed: number;
    bestEncodingSpeed: number;
    lastPlayed: number;
}

export function buildDrillSummaries(results: GameResult[]): DrillSummary[] {
    const map = new Map<string, GameResult[]>();
    for (const r of results) {
        const bucket = map.get(r.type) ?? [];
        bucket.push(r);
        map.set(r.type, bucket);
    }

    const summaries: DrillSummary[] = [];
    for (const [type, rows] of map) {
        const precisions = rows.map(r => r.precision ?? r.accuracy ?? r.percentage);
        const speeds = rows.map(r => r.encodingSpeed ?? 0).filter(s => s > 0);
        summaries.push({
            type,
            sessions: rows.length,
            avgPrecision: avg(precisions),
            bestPrecision: Math.max(...precisions),
            bestCount: Math.max(...rows.map(r => r.count)),
            avgEncodingSpeed: avg(speeds),
            bestEncodingSpeed: speeds.length ? Math.max(...speeds) : 0,
            lastPlayed: Math.max(...rows.map(r => r.timestamp)),
        });
    }

    return summaries.sort((a, b) => b.lastPlayed - a.lastPlayed);
}
