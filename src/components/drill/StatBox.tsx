"use client";

import { CSSProperties, ReactNode } from 'react';

interface StatBoxProps {
    label: string;
    value: ReactNode;
    sublabel?: ReactNode;
    valueColor?: string;
    span?: number;
}

export default function StatBox({ label, value, sublabel, valueColor, span }: StatBoxProps) {
    const style: CSSProperties = {
        background: 'rgba(0,0,0,0.2)',
        padding: '1rem',
        borderRadius: '0.5rem',
        textAlign: 'center',
        ...(span ? { gridColumn: `span ${span}` } : {})
    };
    return (
        <div style={style}>
            <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>{label}</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', ...(valueColor ? { color: valueColor } : {}) }}>{value}</div>
            {sublabel && <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{sublabel}</div>}
        </div>
    );
}
