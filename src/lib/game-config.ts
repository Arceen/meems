// Single source of truth for game-type display metadata,
// shared by the analytics dashboard, training hub, and review queue.

export interface GameConfigEntry {
    label: string;
    color: string;
    unit: string;
}

export const GAME_CONFIG: Record<string, GameConfigEntry> = {
    'digit': { label: 'Digit Memory', color: '#3b82f6', unit: 'digits' },
    'word': { label: 'Word Memory', color: '#8b5cf6', unit: 'words' },
    'card-blitz': { label: 'Card Blitz', color: '#ef4444', unit: 'cards' },
    'names-gauntlet': { label: 'Names Gauntlet', color: '#10b981', unit: 'names' },
    'number-wall': { label: 'Number Wall', color: '#06b6d4', unit: 'digits' },
    'binary-surge': { label: 'Binary Surge', color: '#6366f1', unit: 'digits' },
    'spoken-numbers': { label: 'Spoken Numbers', color: '#f59e0b', unit: 'digits' },
    'abstract-matrix': { label: 'Abstract Matrix', color: '#ec4899', unit: 'cells' },
    'n-back': { label: 'N-Back', color: '#8b5cf6', unit: 'n-level' },
    'quick-math': { label: 'Quick Math', color: '#f97316', unit: 'problems' },
    'card-sequence': { label: 'Card Sequence', color: '#ef4444', unit: 'cards' },
    'names-international': { label: 'Intl. Names', color: '#10b981', unit: 'names' },
    'image-sequence': { label: 'Image Sequence', color: '#ec4899', unit: 'images' },
    'word-palace': { label: 'Word Palace', color: '#14b8a6', unit: 'words' },
    'decathlon': { label: 'Decathlon', color: '#eab308', unit: 'items' },
    'multilingual-list': { label: 'Multilingual List', color: '#a855f7', unit: 'words' },
    'instant-visualization': { label: 'Instant Visualization', color: '#22c55e', unit: 'items' },
    'sensory-walkthrough': { label: 'Sensory Walkthrough', color: '#0ea5e9', unit: 'questions' },
    'system-checker': { label: 'System Checker', color: '#6366f1', unit: 'items' },
    'philosophical-attribution': { label: 'Philosophical Attribution', color: '#d946ef', unit: 'quotes' },
    'visualization-latency': { label: 'Visualization Latency', color: '#84cc16', unit: 'items' },
    'urban-locus-tracer': { label: 'Urban Locus Tracer', color: '#f43f5e', unit: 'landmarks' },
    'chain-reaction': { label: 'Chain Reaction', color: '#fb923c', unit: 'links' },
    'focus-shifter': { label: 'Focus Shifter', color: '#2dd4bf', unit: 'items' },
    'image-vault-quiz': { label: 'Image Vault Quiz', color: '#818cf8', unit: 'items' },
    'historic-dates': { label: 'Historic Dates', color: '#c084fc', unit: 'events' },
    'spoken-words': { label: 'Spoken Words', color: '#fbbf24', unit: 'words' },
    'srs-review': { label: 'SRS Review', color: '#34d399', unit: 'items' },
    // Fallback for unknown types
    'default': { label: 'Training', color: '#94a3b8', unit: 'items' }
};

export const getGameConfig = (type: string): GameConfigEntry =>
    GAME_CONFIG[type] || { label: type.replace(/-/g, ' '), color: GAME_CONFIG['default'].color, unit: 'items' };
