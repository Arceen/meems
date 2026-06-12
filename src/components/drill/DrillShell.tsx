"use client";

import { ReactNode } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';

interface DrillShellProps {
    title: string;
    maxWidth?: string;
    children: ReactNode;
}

export default function DrillShell({ title, maxWidth = '800px', children }: DrillShellProps) {
    return (
        <>
            <Header />
            <main className="container" style={{ maxWidth }}>
                <div style={{ marginBottom: '2rem' }}>
                    <Link href="/training" style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '0.5rem', display: 'inline-block' }}>
                        ← Back to Training
                    </Link>
                    <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>{title}</h1>
                </div>
                {children}
            </main>
        </>
    );
}
