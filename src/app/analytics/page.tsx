"use client";

import { useState, useEffect, useMemo } from 'react';
import Header from '@/components/Header';
import {
    getGameResults, getTimeStats, getPersonalRecords, getCardStats, getCardPerformanceColor,
    GameResult, TimeStats, PersonalRecords, CardStats, TimeFilter,
} from '@/lib/firebase';
import Loader from '@/components/Loader';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, AreaChart, Area,
} from 'recharts';
import { getGameConfig } from '@/lib/game-config';
import {
    computeStreaks, groupByDay, formatDuration, avg, buildDrillSummaries, DrillSummary,
} from '@/lib/analytics-utils';

type Tab = 'overview' | 'disciplines' | 'systems' | 'time';

const TIME_FILTERS: { label: string; value: TimeFilter | 'all' }[] = [
    { label: '24h', value: '1d' },
    { label: '1w', value: '1w' },
    { label: '1m', value: '1m' },
    { label: '1y', value: '1y' },
    { label: 'All', value: 'all' },
];

const CHART_TOOLTIP_STYLE = {
    contentStyle: { backgroundColor: '#1e293b', border: 'none', borderRadius: '0.5rem' },
    itemStyle: { color: '#e2e8f0' },
    cursor: { fill: 'rgba(255,255,255,0.05)' },
};

function StatChip({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
    return (
        <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
            <div style={{ fontSize: '1.9rem', fontWeight: 'bold', color: color || 'inherit' }}>{value}</div>
            {sub && <div style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '0.25rem' }}>{sub}</div>}
        </div>
    );
}

// ─── OVERVIEW TAB ───────────────────────────────────────────────────────────

function OverviewTab({ results, timeStats }: { results: GameResult[]; timeStats: TimeStats | null }) {
    const dates = useMemo(() => results.map(r => r.date).filter(Boolean), [results]);
    const { current: currentStreak, longest: longestStreak } = useMemo(() => computeStreaks(dates), [dates]);

    const totalSessions = results.length;
    const totalTimeMs = timeStats?.totalTime ?? 0;

    const summaries = useMemo(() => buildDrillSummaries(results), [results]);

    // Activity stacked bar by day
    const playedTypes = useMemo(() => Array.from(new Set(results.map(r => r.type))).sort(), [results]);
    const activityData = useMemo(() => {
        const sorted = [...results].sort((a, b) => a.timestamp - b.timestamp);
        const dayMap = new Map<string, Record<string, number | string>>();
        sorted.forEach(r => {
            const label = new Date(r.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            const entry: Record<string, number | string> = dayMap.get(label) ?? { date: label };
            entry[r.type] = ((entry[r.type] as number) ?? 0) + 1;
            dayMap.set(label, entry);
        });
        return Array.from(dayMap.values());
    }, [results]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Streak + time chips */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
                <StatChip label="Current Streak" value={`${currentStreak}d`} color={currentStreak >= 7 ? 'var(--success)' : currentStreak >= 3 ? 'orange' : 'inherit'} />
                <StatChip label="Longest Streak" value={`${longestStreak}d`} color="var(--accent)" />
                <StatChip label="Total Sessions" value={totalSessions} />
                <StatChip label="Total Time" value={formatDuration(totalTimeMs)} sub="from session tracking" />
            </div>

            {/* Activity chart */}
            {activityData.length > 0 && (
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                    <h3 style={{ marginBottom: '1.5rem' }}>Daily Activity</h3>
                    <div style={{ height: '280px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={activityData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} allowDecimals={false} />
                                <Tooltip {...CHART_TOOLTIP_STYLE} />
                                <Legend />
                                {playedTypes.map(type => (
                                    <Bar key={type} dataKey={type} name={getGameConfig(type).label}
                                        fill={getGameConfig(type).color} stackId="a" />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Per-drill summary table */}
            {summaries.length > 0 && (
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                    <h3 style={{ marginBottom: '1rem' }}>Drill Summary</h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                    {['Drill', 'Sessions', 'Avg Precision', 'Best Precision', 'Best Count', 'Best Speed'].map(h => (
                                        <th key={h} style={{ textAlign: h === 'Drill' ? 'left' : 'center', padding: '0.6rem 0.75rem', opacity: 0.6, fontWeight: 600 }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {summaries.map((s, i) => (
                                    <tr key={s.type} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : undefined }}>
                                        <td style={{ padding: '0.6rem 0.75rem' }}>
                                            <span style={{ display: 'inline-block', padding: '0.15rem 0.45rem', borderRadius: '0.25rem', background: `${getGameConfig(s.type).color}33`, color: getGameConfig(s.type).color, fontSize: '0.78rem', fontWeight: 700 }}>
                                                {getGameConfig(s.type).label}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center', padding: '0.6rem 0.75rem' }}>{s.sessions}</td>
                                        <td style={{ textAlign: 'center', padding: '0.6rem 0.75rem', color: s.avgPrecision >= 80 ? 'var(--success)' : s.avgPrecision >= 50 ? 'orange' : 'var(--error)' }}>{s.avgPrecision}%</td>
                                        <td style={{ textAlign: 'center', padding: '0.6rem 0.75rem', fontWeight: 600 }}>{s.bestPrecision}%</td>
                                        <td style={{ textAlign: 'center', padding: '0.6rem 0.75rem' }}>{s.bestCount}</td>
                                        <td style={{ textAlign: 'center', padding: '0.6rem 0.75rem', color: 'var(--accent)' }}>
                                            {s.bestEncodingSpeed > 0 ? `${s.bestEncodingSpeed}/min` : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── DISCIPLINES TAB ─────────────────────────────────────────────────────────

function DisciplinesTab({ results, personalRecords }: { results: GameResult[]; personalRecords: PersonalRecords | null }) {
    const playedTypes = useMemo(() => Array.from(new Set(results.map(r => r.type))).sort(), [results]);
    const [selectedGame, setSelectedGame] = useState<string>(() => playedTypes[0] ?? 'number-wall');

    const filtered = useMemo(() =>
        results.filter(r => r.type === selectedGame).sort((a, b) => a.timestamp - b.timestamp),
        [results, selectedGame]
    );

    const pr = personalRecords?.records[selectedGame] ?? null;

    const stats = useMemo(() => {
        if (filtered.length === 0) return null;
        const precisions = filtered.map(r => r.precision ?? r.accuracy ?? r.percentage);
        const speeds = filtered.map(r => r.encodingSpeed ?? 0).filter(s => s > 0);
        return {
            sessions: filtered.length,
            avgPrecision: avg(precisions),
            bestPrecision: Math.max(...precisions),
            bestCount: Math.max(...filtered.map(r => r.count)),
            avgSpeed: avg(speeds),
            bestSpeed: speeds.length ? Math.max(...speeds) : 0,
        };
    }, [filtered]);

    const chartData = useMemo(() => filtered.map(r => ({
        date: new Date(r.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        fullDate: new Date(r.timestamp).toLocaleString(),
        precision: r.precision ?? r.accuracy ?? r.percentage,
        completeness: r.completeness ?? r.recallPercentage ?? 100,
        count: r.count,
        encodingSpeed: r.encodingSpeed ?? null,
    })), [filtered]);

    const hasSpeed = chartData.some(d => d.encodingSpeed != null);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Drill picker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <label style={{ opacity: 0.7, fontSize: '0.9rem' }}>Drill</label>
                <select value={selectedGame} onChange={e => setSelectedGame(e.target.value)}
                    className="input-field" style={{ width: 'auto', minWidth: '220px' }}>
                    {playedTypes.map(type => (
                        <option key={type} value={type}>{getGameConfig(type).label}</option>
                    ))}
                </select>
            </div>

            {filtered.length === 0 ? (
                <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', opacity: 0.6 }}>No data for this drill yet.</div>
            ) : (
                <>
                    {/* Stat chips */}
                    {stats && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                            <StatChip label="Sessions" value={stats.sessions} />
                            <StatChip label="Avg Precision" value={`${stats.avgPrecision}%`}
                                color={stats.avgPrecision >= 80 ? 'var(--success)' : stats.avgPrecision >= 50 ? 'orange' : 'var(--error)'} />
                            <StatChip label="Best Precision" value={`${stats.bestPrecision}%`} color="var(--success)"
                                sub={pr ? `PR: ${pr.bestPrecision}%` : undefined} />
                            <StatChip label="Best Count" value={stats.bestCount}
                                sub={`${getGameConfig(selectedGame).unit}`} />
                            {hasSpeed && (
                                <StatChip label="Best Speed" value={`${stats.bestSpeed}/min`} color="var(--accent)"
                                    sub="items/min at ≥90% prec" />
                            )}
                        </div>
                    )}

                    {/* Precision trend */}
                    <div className="glass-panel" style={{ padding: '1.5rem' }}>
                        <h3 style={{ marginBottom: '1.25rem' }}>Precision Trend</h3>
                        <div style={{ height: '260px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="gradPrec" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--success)" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="var(--success)" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="gradComp" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                    <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                                    <YAxis stroke="#94a3b8" domain={[0, 100]} tick={{ fontSize: 11 }} />
                                    <Tooltip {...CHART_TOOLTIP_STYLE} labelFormatter={(_, p) => p?.[0]?.payload?.fullDate ?? ''} />
                                    <Legend />
                                    <Area type="monotone" dataKey="precision" stroke="var(--success)" fill="url(#gradPrec)" name="Precision %" />
                                    <Area type="monotone" dataKey="completeness" stroke="var(--accent)" fill="url(#gradComp)" name="Completeness %" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Encoding speed trend — only when data exists */}
                    {hasSpeed && (
                        <div className="glass-panel" style={{ padding: '1.5rem' }}>
                            <h3 style={{ marginBottom: '1.25rem' }}>Encoding Speed (items/min)</h3>
                            <div style={{ height: '220px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                        <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                                        <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                                        <Tooltip {...CHART_TOOLTIP_STYLE} labelFormatter={(_, p) => p?.[0]?.payload?.fullDate ?? ''} />
                                        <Line type="monotone" dataKey="encodingSpeed" stroke="var(--accent)"
                                            strokeWidth={2} dot={{ r: 3 }} connectNulls name="items/min" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Volume / count progression */}
                    <div className="glass-panel" style={{ padding: '1.5rem' }}>
                        <h3 style={{ marginBottom: '1.25rem' }}>Volume ({getGameConfig(selectedGame).unit})</h3>
                        <div style={{ height: '220px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                    <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                                    <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                                    <Tooltip {...CHART_TOOLTIP_STYLE} labelFormatter={(_, p) => p?.[0]?.payload?.fullDate ?? ''} />
                                    <Line type="stepAfter" dataKey="count" stroke="var(--primary)"
                                        strokeWidth={2} dot={{ r: 3 }} name={getGameConfig(selectedGame).unit} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Recent table */}
                    <div className="glass-panel" style={{ padding: '1.5rem' }}>
                        <h3 style={{ marginBottom: '1rem' }}>Recent Sessions</h3>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                        {['Date', 'Count', 'Precision', 'Completeness', 'Speed'].map(h => (
                                            <th key={h} style={{ textAlign: h === 'Date' ? 'left' : 'center', padding: '0.6rem 0.75rem', opacity: 0.6, fontWeight: 600 }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...filtered].reverse().slice(0, 12).map((r, i) => {
                                        const prec = r.precision ?? r.accuracy ?? r.percentage;
                                        const comp = r.completeness ?? r.recallPercentage ?? 100;
                                        return (
                                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                <td style={{ padding: '0.6rem 0.75rem', opacity: 0.8 }}>{new Date(r.timestamp).toLocaleString()}</td>
                                                <td style={{ textAlign: 'center', padding: '0.6rem 0.75rem' }}>{r.count}</td>
                                                <td style={{ textAlign: 'center', padding: '0.6rem 0.75rem', fontWeight: 600, color: prec >= 80 ? 'var(--success)' : prec >= 50 ? 'orange' : 'var(--error)' }}>{prec}%</td>
                                                <td style={{ textAlign: 'center', padding: '0.6rem 0.75rem', opacity: 0.8 }}>{comp}%</td>
                                                <td style={{ textAlign: 'center', padding: '0.6rem 0.75rem', color: 'var(--accent)' }}>
                                                    {r.encodingSpeed ? `${r.encodingSpeed}/min` : '—'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// ─── SYSTEMS TAB ─────────────────────────────────────────────────────────────

const TIER_COLORS: Record<string, string> = {
    platinum: '#e5e4e2',
    gold: '#f59e0b',
    silver: '#94a3b8',
    bronze: '#b45309',
    none: '#334155',
};

function getTier(color: string): string {
    if (color === '#e5e4e2' || color.includes('e5e4e2')) return 'platinum';
    if (color === '#f59e0b' || color.includes('f59e0b')) return 'gold';
    if (color === '#94a3b8' || color.includes('94a3b8')) return 'silver';
    if (color === '#b45309' || color.includes('b45309')) return 'bronze';
    return 'none';
}

function SystemsTab({ personalRecords }: { personalRecords: PersonalRecords | null }) {
    const [cardStats, setCardStats] = useState<Map<string, CardStats> | null>(null);
    const [loadingCards, setLoadingCards] = useState(false);

    useEffect(() => {
        setLoadingCards(true);
        getCardStats().then(stats => {
            setCardStats(stats);
            setLoadingCards(false);
        }).catch(() => setLoadingCards(false));
    }, []);

    const prs = personalRecords?.records ?? {};
    const prEntries = Object.values(prs).sort((a, b) => b.bestPrecision - a.bestPrecision);

    // Major system 00–99 grid
    const majorNumbers = Array.from({ length: 100 }, (_, i) => i.toString().padStart(2, '0'));
    const tierCounts = useMemo(() => {
        const counts = { platinum: 0, gold: 0, silver: 0, bronze: 0, none: 0 };
        if (!cardStats) return counts;
        for (const num of majorNumbers) {
            const stats = cardStats.get(num);
            const color = getCardPerformanceColor(stats);
            const tier = getTier(color);
            counts[tier as keyof typeof counts]++;
        }
        return counts;
    }, [cardStats]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Personal Records table */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>Personal Records</h3>
                {prEntries.length === 0 ? (
                    <p style={{ opacity: 0.5 }}>No personal records yet. Complete some drills to start tracking PRs.</p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                    {['Drill', 'Best Precision', 'Best Count', 'Best Speed', 'Achieved'].map(h => (
                                        <th key={h} style={{ textAlign: h === 'Drill' ? 'left' : 'center', padding: '0.6rem 0.75rem', opacity: 0.6, fontWeight: 600 }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {prEntries.map((pr, i) => (
                                    <tr key={pr.drillType} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : undefined }}>
                                        <td style={{ padding: '0.6rem 0.75rem' }}>
                                            <span style={{ display: 'inline-block', padding: '0.15rem 0.45rem', borderRadius: '0.25rem', background: `${getGameConfig(pr.drillType).color}33`, color: getGameConfig(pr.drillType).color, fontSize: '0.78rem', fontWeight: 700 }}>
                                                {getGameConfig(pr.drillType).label}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center', padding: '0.6rem 0.75rem', fontWeight: 600, color: pr.bestPrecision >= 80 ? 'var(--success)' : 'orange' }}>{pr.bestPrecision}%</td>
                                        <td style={{ textAlign: 'center', padding: '0.6rem 0.75rem' }}>{pr.bestCount}</td>
                                        <td style={{ textAlign: 'center', padding: '0.6rem 0.75rem', color: 'var(--accent)' }}>
                                            {pr.bestEncodingSpeed > 0 ? `${pr.bestEncodingSpeed}/min` : '—'}
                                        </td>
                                        <td style={{ textAlign: 'center', padding: '0.6rem 0.75rem', opacity: 0.7, fontSize: '0.8rem' }}>
                                            {new Date(pr.achievedAt).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Major System 00–99 tier grid */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <h3 style={{ margin: 0 }}>Major System — 00 to 99</h3>
                    {cardStats && (
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            {(['platinum', 'gold', 'silver', 'bronze', 'none'] as const).map(tier => (
                                tierCounts[tier] > 0 && (
                                    <span key={tier} style={{ fontSize: '0.78rem', color: TIER_COLORS[tier], opacity: 0.9 }}>
                                        {tier === 'none' ? 'untrained' : tier} {tierCounts[tier]}
                                    </span>
                                )
                            ))}
                        </div>
                    )}
                </div>

                {loadingCards ? (
                    <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>Loading card stats…</div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '4px' }}>
                        {majorNumbers.map(num => {
                            const stats = cardStats?.get(num);
                            const color = getCardPerformanceColor(stats);
                            const tier = getTier(color);
                            return (
                                <div key={num} title={stats ? `${num}: ${stats.totalAttempts} attempts, score ${stats.performanceScore}` : `${num}: untrained`}
                                    style={{
                                        background: color,
                                        borderRadius: '4px',
                                        aspectRatio: '1',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.6rem',
                                        fontWeight: 700,
                                        color: tier === 'none' ? '#64748b' : tier === 'platinum' ? '#1e293b' : '#fff',
                                        cursor: 'default',
                                    }}>
                                    {num}
                                </div>
                            );
                        })}
                    </div>
                )}

                {!loadingCards && cardStats && cardStats.size === 0 && (
                    <p style={{ opacity: 0.5, marginTop: '1rem' }}>No major system attempts yet. Use Image Vault or System Checker to train.</p>
                )}
            </div>
        </div>
    );
}

// ─── TIME TAB ────────────────────────────────────────────────────────────────

function TimeTab({ timeStats }: { timeStats: TimeStats | null }) {
    if (!timeStats) {
        return (
            <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', opacity: 0.6 }}>
                No session time data available yet. Session tracking requires Firebase.
            </div>
        );
    }

    const completionRate = timeStats.sessionCount > 0
        ? Math.round((timeStats.completedSessions / timeStats.sessionCount) * 100)
        : 0;

    const avgSessionMs = timeStats.sessionCount > 0
        ? timeStats.totalTime / timeStats.sessionCount
        : 0;

    // Bar chart: time by exercise
    const exerciseData = Object.entries(timeStats.byExercise)
        .map(([type, data]) => ({
            name: getGameConfig(type).label,
            type,
            minutes: Math.round(data.totalTime / 60_000),
            sessions: data.sessionCount,
        }))
        .filter(d => d.minutes > 0)
        .sort((a, b) => b.minutes - a.minutes)
        .slice(0, 15);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Summary chips */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
                <StatChip label="Total Time" value={formatDuration(timeStats.totalTime)} />
                <StatChip label="Total Sessions" value={timeStats.sessionCount} />
                <StatChip label="Avg Session" value={formatDuration(avgSessionMs)} />
                <StatChip label="Completion Rate" value={`${completionRate}%`}
                    color={completionRate >= 80 ? 'var(--success)' : completionRate >= 50 ? 'orange' : 'var(--error)'}
                    sub={`${timeStats.completedSessions} of ${timeStats.sessionCount}`} />
            </div>

            {/* Time by exercise */}
            {exerciseData.length > 0 && (
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                    <h3 style={{ marginBottom: '1.25rem' }}>Time by Exercise (minutes)</h3>
                    <div style={{ height: Math.max(200, exerciseData.length * 36) + 'px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={exerciseData} layout="vertical" margin={{ left: 16, right: 16 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" horizontal={false} />
                                <XAxis type="number" stroke="#94a3b8" tick={{ fontSize: 11 }} unit="m" />
                                <YAxis type="category" dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} width={130} />
                                <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: number) => [`${v} min`, 'Time']} />
                                <Bar dataKey="minutes" fill="var(--primary)" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Detailed exercise table */}
            {exerciseData.length > 0 && (
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                    <h3 style={{ marginBottom: '1rem' }}>Session Breakdown</h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                    {['Exercise', 'Sessions', 'Total Time', 'Avg/Session'].map(h => (
                                        <th key={h} style={{ textAlign: h === 'Exercise' ? 'left' : 'center', padding: '0.6rem 0.75rem', opacity: 0.6, fontWeight: 600 }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {exerciseData.map((d, i) => {
                                    const ex = timeStats.byExercise[d.type];
                                    return (
                                        <tr key={d.type} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : undefined }}>
                                            <td style={{ padding: '0.6rem 0.75rem' }}>
                                                <span style={{ display: 'inline-block', padding: '0.15rem 0.45rem', borderRadius: '0.25rem', background: `${getGameConfig(d.type).color}33`, color: getGameConfig(d.type).color, fontSize: '0.78rem', fontWeight: 700 }}>
                                                    {d.name}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'center', padding: '0.6rem 0.75rem' }}>{ex.sessionCount}</td>
                                            <td style={{ textAlign: 'center', padding: '0.6rem 0.75rem' }}>{formatDuration(ex.totalTime)}</td>
                                            <td style={{ textAlign: 'center', padding: '0.6rem 0.75rem', opacity: 0.8 }}>{formatDuration(ex.totalTime / ex.sessionCount)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── PAGE SHELL ───────────────────────────────────────────────────────────────

export default function Analytics() {
    const [tab, setTab] = useState<Tab>('overview');
    const [timeFilter, setTimeFilter] = useState<TimeFilter | 'all'>('all');
    const [results, setResults] = useState<GameResult[]>([]);
    const [timeStats, setTimeStats] = useState<TimeStats | null>(null);
    const [personalRecords, setPersonalRecords] = useState<PersonalRecords | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        const tf = timeFilter === 'all' ? undefined : timeFilter as TimeFilter;
        Promise.all([
            getGameResults(tf),
            getTimeStats(undefined, tf),
            getPersonalRecords(),
        ]).then(([r, ts, pr]) => {
            setResults(r);
            setTimeStats(ts);
            setPersonalRecords(pr);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [timeFilter]);

    const TABS: { id: Tab; label: string }[] = [
        { id: 'overview', label: 'Overview' },
        { id: 'disciplines', label: 'Disciplines' },
        { id: 'systems', label: 'Systems' },
        { id: 'time', label: 'Time' },
    ];

    return (
        <>
            <Header />
            <main className="container">
                {/* Page header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h1 style={{ fontSize: '2rem', background: 'linear-gradient(to right, var(--primary), var(--accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
                        Analytics
                    </h1>
                    {/* Time range filter */}
                    <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem', padding: '0.25rem' }}>
                        {TIME_FILTERS.map(f => (
                            <button key={f.value} onClick={() => setTimeFilter(f.value)}
                                style={{
                                    padding: '0.35rem 0.75rem', borderRadius: '0.35rem', border: 'none',
                                    background: timeFilter === f.value ? 'var(--primary)' : 'transparent',
                                    color: timeFilter === f.value ? '#fff' : 'rgba(255,255,255,0.6)',
                                    cursor: 'pointer', fontSize: '0.85rem', fontWeight: timeFilter === f.value ? 600 : 400,
                                    transition: 'all 0.15s',
                                }}>
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tab bar */}
                <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '2rem' }}>
                    {TABS.map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            style={{
                                padding: '0.65rem 1.25rem', border: 'none', background: 'transparent',
                                color: tab === t.id ? 'var(--primary)' : 'rgba(255,255,255,0.5)',
                                borderBottom: tab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
                                cursor: 'pointer', fontSize: '0.9rem', fontWeight: tab === t.id ? 600 : 400,
                                transition: 'color 0.15s',
                            }}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <Loader />
                ) : results.length === 0 && tab !== 'systems' && tab !== 'time' ? (
                    <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
                        <p style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>No game data{timeFilter !== 'all' ? ` in this time range` : ''} yet.</p>
                        <p style={{ opacity: 0.6 }}>Play some drills to start tracking your progress.</p>
                    </div>
                ) : (
                    <>
                        {tab === 'overview' && <OverviewTab results={results} timeStats={timeStats} />}
                        {tab === 'disciplines' && <DisciplinesTab results={results} personalRecords={personalRecords} />}
                        {tab === 'systems' && <SystemsTab personalRecords={personalRecords} />}
                        {tab === 'time' && <TimeTab timeStats={timeStats} />}
                    </>
                )}
            </main>
        </>
    );
}
