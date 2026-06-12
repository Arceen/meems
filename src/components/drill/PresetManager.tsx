"use client";

import { useState, useEffect } from 'react';
import { getDrillPresets, saveDrillPreset, deleteDrillPreset, DrillPreset } from '@/lib/firebase';

interface PresetManagerProps<TConfig> {
    gameType: string;
    currentConfig: TConfig;
    onLoad: (config: TConfig) => void;
}

export default function PresetManager<TConfig extends object>({
    gameType,
    currentConfig,
    onLoad,
}: PresetManagerProps<TConfig>) {
    const [presets, setPresets] = useState<DrillPreset[]>([]);
    const [newName, setNewName] = useState('');
    const [saving, setSaving] = useState(false);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        getDrillPresets().then(doc => setPresets(doc.presets[gameType] ?? []));
    }, [gameType]);

    const handleSave = async () => {
        const name = newName.trim() || `Preset ${presets.length + 1}`;
        setSaving(true);
        const saved = await saveDrillPreset(gameType, { name, config: currentConfig as unknown as Record<string, unknown> });
        if (saved) {
            setPresets(prev => [...prev, saved]);
            setNewName('');
        }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        const ok = await deleteDrillPreset(gameType, id);
        if (ok) setPresets(prev => prev.filter(p => p.id !== id));
    };

    return (
        <div style={{ marginTop: '0.5rem' }}>
            <button
                onClick={() => setExpanded(e => !e)}
                style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem', padding: '0.2rem 0',
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                }}
            >
                <span style={{ transform: expanded ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 0.15s' }}>▶</span>
                Presets {presets.length > 0 && `(${presets.length})`}
            </button>

            {expanded && (
                <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {/* Save current config */}
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                            className="input-field"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            placeholder="Preset name…"
                            style={{ flex: 1, padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
                            onKeyDown={e => e.key === 'Enter' && handleSave()}
                        />
                        <button
                            className="btn btn-secondary"
                            onClick={handleSave}
                            disabled={saving}
                            style={{ fontSize: '0.82rem', padding: '0.35rem 0.75rem', whiteSpace: 'nowrap' }}
                        >
                            {saving ? '…' : 'Save current'}
                        </button>
                    </div>

                    {/* Preset list */}
                    {presets.length === 0 ? (
                        <p style={{ opacity: 0.45, fontSize: '0.8rem', margin: 0 }}>No saved presets yet.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            {presets.map(p => (
                                <div key={p.id} style={{
                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                    padding: '0.4rem 0.6rem', borderRadius: '0.4rem',
                                    background: 'rgba(255,255,255,0.04)',
                                }}>
                                    <button
                                        onClick={() => onLoad(p.config as TConfig)}
                                        style={{
                                            flex: 1, background: 'none', border: 'none',
                                            cursor: 'pointer', textAlign: 'left',
                                            color: 'var(--primary)', fontSize: '0.85rem', padding: 0,
                                        }}
                                    >
                                        {p.name}
                                    </button>
                                    <span style={{ opacity: 0.35, fontSize: '0.75rem' }}>
                                        {new Date(p.createdAt).toLocaleDateString()}
                                    </span>
                                    <button
                                        onClick={() => handleDelete(p.id)}
                                        style={{
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            color: 'var(--error)', opacity: 0.6, fontSize: '0.8rem', padding: '0 0.2rem',
                                        }}
                                        title="Delete preset"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
