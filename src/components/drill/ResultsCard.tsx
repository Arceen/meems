"use client";

import { ReactNode } from 'react';
import Link from 'next/link';

interface ResultsCardProps {
    saving?: boolean;
    onNewGame: () => void;
    /** Stat boxes + any drill-specific comparison views. */
    children: ReactNode;
}

export default function ResultsCard({ saving = false, onNewGame, children }: ResultsCardProps) {
    return (
        <div className="glass card animate-fade-in">
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', textAlign: 'center' }}>Results</h2>
            {saving && (
                <p style={{ textAlign: 'center', marginBottom: '1rem', fontSize: '0.9rem', opacity: 0.7 }}>
                    Saving result…
                </p>
            )}

            {children}

            <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onNewGame}>
                    New Game
                </button>
                <Link href="/training" className="btn btn-primary" style={{ flex: 1 }}>
                    Back to Hub
                </Link>
            </div>
        </div>
    );
}
