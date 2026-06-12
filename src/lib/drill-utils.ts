// Shared helpers for memorization drills.

export const generateDigits = (count: number): string => {
    let result = "";
    for (let i = 0; i < count; i++) {
        result += Math.floor(Math.random() * 10).toString();
    }
    return result;
};

export const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const shuffle = <T,>(array: T[]): T[] => {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
};

/** Lenient answer comparison: lowercase, trimmed, collapsed whitespace, no punctuation. */
export const normalize = (text: string): string =>
    text.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');

export const clamp = (value: number, min: number, max: number): number => {
    if (!Number.isFinite(value)) return min;
    return Math.max(min, Math.min(max, Math.floor(value)));
};
