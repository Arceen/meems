export interface HistoricEvent {
    year: number;
    event: string;
    category: 'ancient' | 'medieval' | 'modern' | 'contemporary';
}

export const historicEvents: HistoricEvent[] = [
    // Ancient
    { year: -776, event: 'First recorded Olympic Games in ancient Greece', category: 'ancient' },
    { year: -753, event: 'Traditional founding of Rome', category: 'ancient' },
    { year: -490, event: 'Battle of Marathon — Greeks defeat Persians', category: 'ancient' },
    { year: -399, event: 'Socrates sentenced to death in Athens', category: 'ancient' },
    { year: -356, event: 'Alexander the Great born in Pella, Macedonia', category: 'ancient' },
    { year: -323, event: 'Death of Alexander the Great in Babylon', category: 'ancient' },
    { year: -221, event: 'Qin Shi Huang unifies China, first emperor', category: 'ancient' },
    { year: -44, event: 'Assassination of Julius Caesar on the Ides of March', category: 'ancient' },
    { year: -31, event: 'Battle of Actium — Octavian defeats Mark Antony', category: 'ancient' },
    { year: 79, event: 'Mount Vesuvius erupts, destroying Pompeii', category: 'ancient' },
    { year: 313, event: 'Edict of Milan — Constantine grants religious tolerance', category: 'ancient' },
    { year: 476, event: 'Fall of the Western Roman Empire', category: 'ancient' },

    // Medieval
    { year: 622, event: "Muhammad's Hijra from Mecca to Medina — start of Islamic calendar", category: 'medieval' },
    { year: 732, event: 'Battle of Tours — Charles Martel halts Muslim advance into Europe', category: 'medieval' },
    { year: 800, event: 'Charlemagne crowned Holy Roman Emperor', category: 'medieval' },
    { year: 1066, event: 'Norman Conquest — Battle of Hastings, William defeats Harold', category: 'medieval' },
    { year: 1096, event: 'First Crusade launched by Pope Urban II', category: 'medieval' },
    { year: 1215, event: 'Magna Carta signed by King John of England', category: 'medieval' },
    { year: 1271, event: 'Marco Polo begins his journey to Asia', category: 'medieval' },
    { year: 1348, event: 'Black Death reaches Europe, killing a third of the population', category: 'medieval' },
    { year: 1368, event: 'Ming dynasty founded in China', category: 'medieval' },
    { year: 1431, event: 'Joan of Arc burned at the stake in Rouen', category: 'medieval' },
    { year: 1453, event: 'Fall of Constantinople — end of the Byzantine Empire', category: 'medieval' },

    // Early Modern
    { year: 1492, event: 'Christopher Columbus reaches the Americas', category: 'modern' },
    { year: 1517, event: 'Martin Luther posts his 95 Theses, starting the Reformation', category: 'modern' },
    { year: 1543, event: 'Copernicus publishes heliocentric model of the solar system', category: 'modern' },
    { year: 1588, event: 'Spanish Armada defeated by England', category: 'modern' },
    { year: 1609, event: 'Galileo first uses a telescope to observe the night sky', category: 'modern' },
    { year: 1687, event: 'Newton publishes Principia Mathematica', category: 'modern' },
    { year: 1776, event: 'United States Declaration of Independence signed', category: 'modern' },
    { year: 1789, event: 'French Revolution begins — storming of the Bastille', category: 'modern' },
    { year: 1799, event: 'Napoleon Bonaparte seizes power in France', category: 'modern' },
    { year: 1804, event: 'Napoleon crowns himself Emperor of France', category: 'modern' },
    { year: 1815, event: "Battle of Waterloo — Napoleon's final defeat", category: 'modern' },
    { year: 1848, event: 'Year of Revolutions sweeps across Europe', category: 'modern' },
    { year: 1859, event: 'Darwin publishes On the Origin of Species', category: 'modern' },
    { year: 1865, event: 'US Civil War ends, Lincoln assassinated', category: 'modern' },
    { year: 1869, event: 'Suez Canal opens', category: 'modern' },
    { year: 1879, event: 'Edison demonstrates the first practical incandescent light bulb', category: 'modern' },
    { year: 1885, event: 'Karl Benz builds the first gasoline-powered automobile', category: 'modern' },
    { year: 1895, event: 'Lumière brothers hold first public cinema screening', category: 'modern' },
    { year: 1896, event: 'First modern Olympic Games held in Athens', category: 'modern' },
    { year: 1898, event: 'Marie Curie discovers polonium and radium', category: 'modern' },

    // Contemporary
    { year: 1903, event: 'Wright brothers achieve first powered flight at Kitty Hawk', category: 'contemporary' },
    { year: 1905, event: 'Einstein publishes Special Theory of Relativity', category: 'contemporary' },
    { year: 1912, event: 'Titanic sinks on its maiden voyage', category: 'contemporary' },
    { year: 1914, event: 'World War I begins with assassination of Archduke Franz Ferdinand', category: 'contemporary' },
    { year: 1917, event: 'Russian Revolution — Bolsheviks seize power', category: 'contemporary' },
    { year: 1918, event: 'World War I ends on the 11th hour of the 11th day of the 11th month', category: 'contemporary' },
    { year: 1928, event: 'Alexander Fleming discovers penicillin', category: 'contemporary' },
    { year: 1929, event: 'Wall Street Crash triggers the Great Depression', category: 'contemporary' },
    { year: 1939, event: 'World War II begins with Germany\'s invasion of Poland', category: 'contemporary' },
    { year: 1945, event: 'World War II ends — atomic bombs dropped on Hiroshima and Nagasaki', category: 'contemporary' },
    { year: 1948, event: 'State of Israel declared, Universal Declaration of Human Rights signed', category: 'contemporary' },
    { year: 1953, event: 'DNA double helix structure discovered by Watson and Crick', category: 'contemporary' },
    { year: 1957, event: 'Sputnik 1 launched — space age begins', category: 'contemporary' },
    { year: 1961, event: 'Yuri Gagarin becomes first human in space', category: 'contemporary' },
    { year: 1963, event: 'President Kennedy assassinated in Dallas', category: 'contemporary' },
    { year: 1969, event: 'Neil Armstrong walks on the Moon — Apollo 11', category: 'contemporary' },
    { year: 1989, event: 'Fall of the Berlin Wall', category: 'contemporary' },
    { year: 1991, event: 'Soviet Union dissolves — Cold War ends', category: 'contemporary' },
    { year: 1994, event: 'Nelson Mandela elected first Black president of South Africa', category: 'contemporary' },
    { year: 2001, event: '9/11 terrorist attacks on the United States', category: 'contemporary' },
    { year: 2008, event: 'Global financial crisis — Lehman Brothers collapses', category: 'contemporary' },
    { year: 2020, event: 'COVID-19 declared a global pandemic by WHO', category: 'contemporary' },
];

// Word banks for fictional event generation
const FICTIONAL_SUBJECTS = [
    'the merchants\' guild', 'the river council', 'the eastern cartographers', 'a wandering philosopher',
    'the cathedral chapter', 'the city watch', 'the weavers\' union', 'a band of scholars',
    'the night market', 'the harbor commission', 'the royal astronomers', 'the salt traders',
];

const FICTIONAL_VERBS = [
    'collapses after', 'dissolves amid', 'declares independence from', 'signs a treaty with',
    'revolts against', 'discovers a route to', 'abolishes', 'establishes',
    'petitions the emperor regarding', 'burns the records of', 'merges with', 'challenges',
];

const FICTIONAL_OBJECTS = [
    'the northern provinces', 'a disputed tax', 'the old calendar system', 'the bridge tolls',
    'foreign spice imports', 'a buried library', 'the mountain passes', 'the grain reserves',
    'the coastal fortifications', 'the apprenticeship laws', 'the silver mines', 'the canal rights',
];

export function generateFictionalEvent(year: number): { year: number; event: string } {
    const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
    const event = `${pick(FICTIONAL_SUBJECTS)} ${pick(FICTIONAL_VERBS)} ${pick(FICTIONAL_OBJECTS)}`;
    return { year, event: event.charAt(0).toUpperCase() + event.slice(1) };
}

export function generateRandomYears(count: number, min = 1200, max = 1900): number[] {
    const years = new Set<number>();
    while (years.size < count) {
        years.add(Math.floor(Math.random() * (max - min + 1)) + min);
    }
    return Array.from(years);
}
