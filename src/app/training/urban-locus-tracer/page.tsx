"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { saveLandmark, getLandmarks, deleteLandmark, updateLandmark, saveGameResult, type Landmark } from '@/lib/firebase';
import RealMap from '@/components/RealMap';

type GamePhase = 'add' | 'recall' | 'result';

interface RecallResult {
    landmarkId: string;
    correctName: string;
    correctLat: number;
    correctLng: number;
    selectedLat: number;
    selectedLng: number;
    distanceError: number; // in meters
    timeTakenMs: number;
}

// Haversine formula to calculate distance between two lat/lng points in meters
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
}

function formatDuration(ms: number) {
    if (!ms || ms < 0) return '0.0s';
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const mins = Math.floor(seconds / 60);
    const remainingSeconds = seconds - mins * 60;
    return `${mins}m ${remainingSeconds.toFixed(1)}s`;
}

// Hardcoded user ID for now (in production, use actual auth)
const USER_ID = 'default_user';

const typeIconMap: Record<string, string> = {
    school: '🏫',
    school_college: '🏫',
    college: '🏫',
    university: '🎓',
    hospital: '🏥',
    restaurant: '🍽️',
    cafe: '☕',
    shopping: '🛍️',
    food_market: '🛒',
    park: '🌳',
    museum: '🏛️',
    historical: '🏺',
    mosque: '🕌',
    stadium: '🏟️',
    government: '🏢',
    power_gas: '⚡',
    police: '🚓',
    post_office: '📮',
    bank: '🏦',
    hotel: '🏨',
    road_arterial: '🛣️',
    road_highway_start: '🛣️',
    area: '🗺️',
    dncc: '🏙️',
    dscc: '🏙️',
    factory: '🏭',
    bus_stand: '🚌',
    shopping_complex: '🏬',
    mall: '🛍️',
    road: '🛣️',
    river: '🌊',
    graveyard: '🪦',
    church: '⛪',
    lake: '🌊',
    other: '📍'
};

const getTypeIcon = (type: string) => typeIconMap[type] || '📍';
const formatType = (type: string) => type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

export default function UrbanLocusTracerPage() {
    
    // Game State
    const [phase, setPhase] = useState<GamePhase>('add');
    const [landmarks, setLandmarks] = useState<Landmark[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Map State
    const [cityCenter, setCityCenter] = useState<[number, number]>([23.8103, 90.4125]); // Dhaka
    const [cityZoom, setCityZoom] = useState(14);
    
    // Add Mode State
    const [newLandmarkName, setNewLandmarkName] = useState('');
    const [newLandmarkType, setNewLandmarkType] = useState('area');
    const [pendingLocation, setPendingLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [isDrawingMode, setIsDrawingMode] = useState(false);
    const [drawnRectangles, setDrawnRectangles] = useState<any[]>([]);
    
    // Recall Mode State
    const [recallQueue, setRecallQueue] = useState<Landmark[]>([]);
    const [currentLandmark, setCurrentLandmark] = useState<Landmark | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterTypes, setFilterTypes] = useState<string[]>([]);
    const [filterVerified, setFilterVerified] = useState<'all' | 'verified' | 'unverified'>('all');
    const [recallResults, setRecallResults] = useState<RecallResult[]>([]);
    const [pendingRecallClick, setPendingRecallClick] = useState(false);
    const [feedbackResult, setFeedbackResult] = useState<RecallResult | null>(null);
    const [questionStartTime, setQuestionStartTime] = useState<number | null>(null);
    const [recallStartTime, setRecallStartTime] = useState<number | null>(null);
    const [recallDurationMs, setRecallDurationMs] = useState<number | null>(null);
    const [recallCount, setRecallCount] = useState(5);
    const [recallOrder, setRecallOrder] = useState<'random' | 'sequential'>('random');
    const [isRecallConfigOpen, setIsRecallConfigOpen] = useState(false);
    const [recallFilterTypes, setRecallFilterTypes] = useState<string[]>([]);
    const [recallFilterVerified, setRecallFilterVerified] = useState<'all' | 'verified' | 'unverified'>('verified');
    
    // Edit Mode State
    const [editingLandmark, setEditingLandmark] = useState<Landmark | null>(null);
    const [editName, setEditName] = useState('');
    const [editType, setEditType] = useState('');
    const [quickEditLandmark, setQuickEditLandmark] = useState<Landmark | null>(null);
    const [quickEditSaving, setQuickEditSaving] = useState(false);
    const [quickEditResult, setQuickEditResult] = useState<{ name: string; lat: number; lng: number } | null>(null);
    
    // Selected landmark for map/sidebar sync
    const [selectedLandmarkId, setSelectedLandmarkId] = useState<string | null>(null);
    
    // Load landmarks on mount
    useEffect(() => {
        loadLandmarks();
    }, []);

    useEffect(() => {
        if (landmarks.length === 0) return;
        setRecallCount(prev => {
            const safeValue = Math.max(1, Math.min(prev, landmarks.length));
            return safeValue;
        });
    }, [landmarks.length]);
    
    const loadLandmarks = async () => {
        setIsLoading(true);
        try {
            const data = await getLandmarks(USER_ID);
            setLandmarks(data.map(l => ({
                ...l,
                verified: l.verified ?? false
            })));
        } catch (error) {
            console.error('Error loading landmarks:', error);
        }
        setIsLoading(false);
    };
    
    const handleMapClick = async (lat: number, lng: number) => {
        if (phase === 'add' && quickEditLandmark) {
            if (quickEditSaving) return;
            setQuickEditSaving(true);
            setLandmarks(prev => prev.map(l => 
                l.id === quickEditLandmark.id ? { ...l, lat, lng } : l
            ));
            setCityCenter([lat, lng]);
            setCityZoom(16);
            try {
                await updateLandmark(USER_ID, quickEditLandmark.id, {
                    lat,
                    lng
                });
                setQuickEditResult({
                    name: quickEditLandmark.name,
                    lat,
                    lng
                });
                setQuickEditLandmark(null);
                await loadLandmarks();
            } catch (error) {
                console.error('Error updating landmark via quick edit:', error);
                alert('Failed to update landmark location. Please try again.');
                await loadLandmarks();
            }
            setQuickEditSaving(false);
            return;
        }

        if (phase === 'add') {
            setPendingLocation({ lat, lng });
        } else if (phase === 'recall' && currentLandmark && pendingRecallClick) {
            // Calculate distance
            const distance = calculateDistance(
                currentLandmark.lat,
                currentLandmark.lng,
                lat,
                lng
            );
            const now = Date.now();
            const timeTaken = questionStartTime ? now - questionStartTime : 0;
            
            const newResult: RecallResult = {
                landmarkId: currentLandmark.id,
                correctName: currentLandmark.name,
                correctLat: currentLandmark.lat,
                correctLng: currentLandmark.lng,
                selectedLat: lat,
                selectedLng: lng,
                distanceError: distance,
                timeTakenMs: timeTaken
            };
            
            setRecallResults(prev => [...prev, newResult]);
            setPendingRecallClick(false);
            setFeedbackResult(newResult);
            setQuestionStartTime(null);
            setCurrentLandmark(null);
        }
    };
    
    const handleSaveLandmark = async () => {
        if (!pendingLocation || !newLandmarkName.trim()) return;
        
        try {
            await saveLandmark(USER_ID, {
                name: newLandmarkName.trim(),
                type: newLandmarkType,
                lat: pendingLocation.lat,
                lng: pendingLocation.lng,
                createdAt: Date.now(),
                verified: true
            });
            setNewLandmarkName('');
            setNewLandmarkType('area');
            setPendingLocation(null);
            await loadLandmarks();
        } catch (error) {
            console.error('Error saving landmark:', error);
        }
    };
    
    const handleDeleteLandmark = async (landmarkId: string) => {
        try {
            await deleteLandmark(USER_ID, landmarkId);
            await loadLandmarks();
        } catch (error) {
            console.error('Error deleting landmark:', error);
        }
    };
    
    const openRecallConfig = () => {
        if (verifiedLandmarks.length < 2) {
            alert('Verify at least 2 landmarks before starting recall!');
            return;
        }
        setIsRecallConfigOpen(true);
    };

    const startRecall = () => {
        // Apply filters to get candidates
        let candidates = landmarks.filter(l => {
            // Verification filter
            if (recallFilterVerified === 'verified' && !l.verified) return false;
            if (recallFilterVerified === 'unverified' && l.verified) return false;
            
            // Type filter
            if (recallFilterTypes.length > 0 && !recallFilterTypes.includes(l.type)) return false;
            
            return true;
        });

        if (candidates.length < 2) {
            alert('Not enough landmarks match your filters. Please adjust filters or verify more landmarks!');
            return;
        }

        const cappedCount = Math.max(1, Math.min(recallCount, candidates.length));
        if (recallOrder === 'random') {
            candidates = candidates.sort(() => Math.random() - 0.5);
        } else {
            candidates = candidates.sort((a, b) => a.name.localeCompare(b.name));
        }
        const selected = candidates.slice(0, cappedCount);

        setRecallQueue(selected.slice(1));
        setCurrentLandmark(selected[0]);
        setRecallResults([]);
        setFeedbackResult(null);
        setSearchQuery('');
        setPendingRecallClick(true);
        setPhase('recall');
        setQuestionStartTime(Date.now());
        setRecallStartTime(Date.now());
        setRecallDurationMs(null);
        
        // Reset to Dhaka center
        setCityCenter([23.8103, 90.4125]);
        setCityZoom(14);
    };

    const confirmRecallStart = () => {
        startRecall();
        setIsRecallConfigOpen(false);
    };
    
    const handleSaveEdit = async () => {
        if (!editingLandmark || !editName.trim()) return;
        
        try {
            await updateLandmark(USER_ID, editingLandmark.id, {
                name: editName.trim(),
                type: editType
            });
            setEditingLandmark(null);
            await loadLandmarks();
        } catch (error) {
            console.error('Error updating landmark:', error);
        }
    };

    const handleToggleVerified = async (id: string, currentStatus: boolean) => {
        try {
            await updateLandmark(USER_ID, id, { verified: !currentStatus });
            setLandmarks(landmarks.map(l => l.id === id ? { ...l, verified: !currentStatus } : l));
        } catch (error) {
            console.error("Error toggling verification:", error);
            alert("Failed to update status");
        }
    };

    const handleDeleteAllUnverified = async () => {
        const unverifiedCount = landmarks.filter(l => !l.verified).length;
        if (unverifiedCount === 0) {
            alert("No unverified landmarks to delete.");
            return;
        }

        if (!confirm(`Are you sure you want to delete all ${unverifiedCount} unverified landmarks? This action cannot be undone.`)) {
            return;
        }

        setIsLoading(true);
        try {
            const unverifiedLandmarks = landmarks.filter(l => !l.verified);
            for (const landmark of unverifiedLandmarks) {
                await deleteLandmark(USER_ID, landmark.id);
            }
            await loadLandmarks();
            alert(`Successfully deleted ${unverifiedCount} unverified landmarks.`);
        } catch (error) {
            console.error("Error deleting unverified landmarks:", error);
            alert("Failed to delete some landmarks. Check console for details.");
        } finally {
            setIsLoading(false);
        }
    };

    const beginQuickEdit = (landmark: Landmark) => {
        setQuickEditLandmark(landmark);
        setQuickEditResult(null);
        setPendingLocation(null);
        setEditingLandmark(null);
        setCityCenter([landmark.lat, landmark.lng]);
        setCityZoom(16);
    };

    const handleNextRecallStep = () => {
        if (recallQueue.length > 0) {
            const [next, ...rest] = recallQueue;
            setCurrentLandmark(next);
            setRecallQueue(rest);
            setFeedbackResult(null);
            setPendingRecallClick(true);
            setCityCenter([23.8103, 90.4125]);
            setCityZoom(14);
            setQuestionStartTime(Date.now());
        } else {
            setFeedbackResult(null);
            setPhase('result');
            setPendingRecallClick(false);
            setQuestionStartTime(null);
            if (recallStartTime) {
                setRecallDurationMs(Date.now() - recallStartTime);
            }
            setRecallStartTime(null);
        }
    };
    
    const resetGame = () => {
        setPhase('add');
        setRecallResults([]);
        setSearchQuery('');
        setCityCenter([23.8103, 90.4125]);
        setCityZoom(14);
    };
    
    const verifiedLandmarks = landmarks.filter(l => l.verified);
    const maxRecallSelectable = Math.max(1, verifiedLandmarks.length || 1);
    const effectiveRecallCount = verifiedLandmarks.length > 0
        ? Math.min(recallCount, verifiedLandmarks.length)
        : Math.min(recallCount, maxRecallSelectable);

    const filteredLandmarks = landmarks.filter(l => {
        // Search query filter
        if (!l.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        
        // Verification filter
        if (filterVerified === 'verified' && !l.verified) return false;
        if (filterVerified === 'unverified' && l.verified) return false;
        
        // Type filter
        if (filterTypes.length > 0 && !filterTypes.includes(l.type)) return false;
        
        return true;
    }).sort((a, b) => a.name.localeCompare(b.name));
    const remainingToAnswer = recallQueue.length + (currentLandmark ? 1 : 0);
    const totalRecallTargets = recallResults.length + remainingToAnswer;
    const totalRecallTimeMs = recallDurationMs ?? recallResults.reduce((sum, r) => sum + r.timeTakenMs, 0);
    const averageError = recallResults.length ? (recallResults.reduce((sum, r) => sum + r.distanceError, 0) / recallResults.length) : 0;
    const averageTimeMs = recallResults.length ? totalRecallTimeMs / recallResults.length : 0;
    const sortedByError = recallResults.length ? [...recallResults].sort((a, b) => a.distanceError - b.distanceError) : [];

    // Persist a summary once per finished run; a guess counts as correct under 100m
    // (same threshold the result list uses for its green highlight).
    const resultSavedRef = useRef(false);
    useEffect(() => {
        if (phase === 'add') {
            resultSavedRef.current = false;
            return;
        }
        if (phase !== 'result' || resultSavedRef.current || recallResults.length === 0) return;
        resultSavedRef.current = true;

        const correct = recallResults.filter(r => r.distanceError < 100).length;
        saveGameResult({
            type: 'urban-locus-tracer',
            count: recallResults.length,
            correct,
            total: recallResults.length,
            percentage: Math.round((correct / recallResults.length) * 100),
            memorizeTime: 0,
            recallTime: Math.round(totalRecallTimeMs / 1000),
            precision: Math.round((correct / recallResults.length) * 100),
            completeness: 100,
        }).catch(err => console.error('Failed to save urban-locus-tracer result:', err));
    }, [phase, recallResults, totalRecallTimeMs]);
    const bestResult = sortedByError[0];
    const worstResult = sortedByError.length > 0 ? sortedByError[sortedByError.length - 1] : undefined;
    
    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <h1 style={{ margin: 0 }}>🗺️ Urban Locus Tracer</h1>
                <Link href="/training" className="btn btn-secondary">← Back</Link>
            </div>
            
            {/* Phase Tabs */}
            <div style={{ padding: '1rem 2rem', display: 'flex', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <button 
                    className={`btn ${phase === 'add' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setPhase('add')}
                    disabled={phase === 'recall'}
                >
                    Add Landmarks ({landmarks.length})
                </button>
                <button 
                    className={`btn ${phase === 'recall' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={openRecallConfig}
                    disabled={phase === 'recall' || verifiedLandmarks.length < 2}
                >
                    Start Recall
                </button>
            </div>
            
            {/* Main Content */}
            <div style={{ display: 'flex', gap: 0, flex: 1, overflow: 'hidden' }}>
                
                {/* Map Area */}
                <div style={{ flex: 1, position: 'relative' }}>
                    <RealMap 
                        center={cityCenter}
                        zoom={cityZoom}
                        hideLabels={phase === 'recall'}
                        drawingMode={isDrawingMode && phase === 'add'}
                        drawnRectangles={drawnRectangles}
                        onRectangleDrawn={(rect) => setDrawnRectangles([...drawnRectangles, rect])}
                        onRectangleDeleted={(index) => setDrawnRectangles(drawnRectangles.filter((_, i) => i !== index))}
                        lines={phase === 'recall' && feedbackResult ? [{
                            id: `${feedbackResult.landmarkId}-line`,
                            points: [
                                [feedbackResult.selectedLat, feedbackResult.selectedLng],
                                [feedbackResult.correctLat, feedbackResult.correctLng]
                            ],
                            color: '#f97316',
                            weight: 3,
                            dashArray: '6 4'
                        }] : []}
                        markers={(() => {
                            if (phase === 'add') {
                                return [
                                    ...landmarks.map(l => ({
                                        id: l.id,
                                            lat: l.lat,
                                            lng: l.lng,
                                            title: `${l.name} • ${formatType(l.type)}`,
                                            color: l.verified ? '#22c55e' : '#3b82f6',
                                            popup: `${l.name} (${formatType(l.type)})${l.verified ? ' • Verified' : ''}`
                                    })),
                                    ...(pendingLocation
                                        ? [{
                                            id: 'pending',
                                            lat: pendingLocation.lat,
                                            lng: pendingLocation.lng,
                                            title: 'New Location',
                                            color: '#f59e0b',
                                            popup: 'Click to place'
                                        }]
                                        : [])
                                ];
                            }

                            if (phase === 'recall') {
                                if (feedbackResult) {
                                    return [
                                        {
                                            id: `${feedbackResult.landmarkId}-actual`,
                                            lat: feedbackResult.correctLat,
                                            lng: feedbackResult.correctLng,
                                            title: `${feedbackResult.correctName} (Actual)`,
                                            color: '#22c55e',
                                            popup: `${feedbackResult.correctName} • Actual`
                                        },
                                        {
                                            id: `${feedbackResult.landmarkId}-guess`,
                                            lat: feedbackResult.selectedLat,
                                            lng: feedbackResult.selectedLng,
                                            title: 'Your Guess',
                                            color: '#f97316',
                                            popup: `Your guess • ${Math.round(feedbackResult.distanceError)}m off`
                                        }
                                    ];
                                }

                                return [];
                            }

                            return [];
                        })()}
                        onMapClick={handleMapClick}
                        onMarkerClick={(id) => {
                            if (phase === 'add') {
                                setSelectedLandmarkId(id as string);
                                // Scroll to landmark in sidebar
                                const element = document.getElementById(`landmark-${id}`);
                                if (element) {
                                    element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                }
                            }
                        }}
                    />
                    
                    {phase === 'add' && quickEditLandmark && (
                        <div className="glass card" style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', padding: '1rem', zIndex: 1200, textAlign: 'center', maxWidth: '420px' }}>
                            <div style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                                Move {quickEditLandmark.name}
                            </div>
                            <div style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                                Click a new spot on the map to update its coordinates.
                            </div>
                            <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '0.75rem' }}>
                                {quickEditSaving ? 'Saving new location...' : 'Your change will save instantly.'}
                            </div>
                            <button 
                                className="btn btn-secondary" 
                                onClick={() => setQuickEditLandmark(null)}
                                disabled={quickEditSaving}
                                style={{ width: '100%' }}
                            >
                                Cancel
                            </button>
                        </div>
                    )}

                    {phase === 'add' && quickEditResult && !quickEditLandmark && (
                        <div className="glass card" style={{ position: 'absolute', top: '20px', right: '20px', padding: '1rem', zIndex: 1100, maxWidth: '260px' }}>
                            <div style={{ fontSize: '0.95rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                                Updated {quickEditResult.name}
                            </div>
                            <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '0.25rem' }}>
                                {quickEditResult.lat.toFixed(4)}, {quickEditResult.lng.toFixed(4)}
                            </div>
                            <button 
                                className="btn btn-primary" 
                                onClick={() => setQuickEditResult(null)}
                                style={{ width: '100%', fontSize: '0.8rem' }}
                            >
                                Dismiss
                            </button>
                        </div>
                    )}

                    {phase === 'add' && pendingLocation && !quickEditLandmark && (
                        <div className="glass card" style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', padding: '1rem', zIndex: 1000, minWidth: '300px' }}>
                            <div style={{ marginBottom: '0.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.25rem', opacity: 0.7 }}>Type</label>
                                <select 
                                    value={newLandmarkType}
                                    onChange={(e) => setNewLandmarkType(e.target.value)}
                                    style={{ width: '100%', marginBottom: '0.5rem' }}
                                >
                                    <option value="school">School</option>
                                    <option value="school_college">School & College</option>
                                    <option value="college">College</option>
                                    <option value="university">University</option>
                                    <option value="hospital">Hospital</option>
                                    <option value="restaurant">Restaurant</option>
                                    <option value="cafe">Cafe</option>
                                    <option value="shopping">Shopping Mall</option>
                                    <option value="food_market">Food Market</option>
                                    <option value="park">Park</option>
                                    <option value="mosque">Mosque</option>
                                    <option value="museum">Museum</option>
                                    <option value="historical">Historical</option>
                                    <option value="stadium">Stadium</option>
                                    <option value="government">Government Building</option>
                                    <option value="power_gas">Power/Gas</option>
                                    <option value="police">Police Station</option>
                                    <option value="post_office">Post Office</option>
                                    <option value="bank">Bank</option>
                                    <option value="hotel">Hotel</option>
                                    <option value="road_arterial">Road (Arterial)</option>
                                    <option value="road_highway_start">Road (Highway Start)</option>
                                    <option value="area">Area</option>
                                    <option value="dncc">DNCC</option>
                                    <option value="dscc">DSCC</option>
                                    <option value="factory">Factory</option>
                                    <option value="bus_stand">Bus Stand</option>
                                    <option value="shopping_complex">Shopping Complex</option>
                                    <option value="mall">Mall</option>
                                    <option value="road">Road</option>
                                    <option value="river">River</option>
                                    <option value="graveyard">Graveyard</option>
                                    <option value="church">Church</option>
                                    <option value="lake">Lake</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <input 
                                type="text"
                                placeholder="Enter landmark name..."
                                value={newLandmarkName}
                                onChange={(e) => setNewLandmarkName(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSaveLandmark()}
                                style={{ marginBottom: '0.5rem', width: '100%' }}
                                autoFocus
                            />
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn btn-primary" onClick={handleSaveLandmark} disabled={!newLandmarkName.trim()}>
                                    Save
                                </button>
                                <button className="btn btn-secondary" onClick={() => setPendingLocation(null)}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                    
                    {phase === 'recall' && currentLandmark && (
                        <div className="glass card" style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', padding: '1rem', zIndex: 1000, textAlign: 'center' }}>
                            <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                                Where is {currentLandmark.name}?
                            </div>
                            <div style={{ fontSize: '0.9rem', opacity: 0.7, marginTop: '0.5rem' }}>
                                Click on the map to guess
                            </div>
                        </div>
                    )}

                    {phase === 'recall' && feedbackResult && (
                        <div className="glass card" style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', padding: '1.25rem', zIndex: 1000, textAlign: 'center', maxWidth: '420px' }}>
                            <div style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                                {feedbackResult.correctName} revealed
                            </div>
                            <div style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                                Distance error: <strong>{Math.round(feedbackResult.distanceError)}m</strong>
                            </div>
                            <div style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: '0.25rem' }}>
                                Time taken: {formatDuration(feedbackResult.timeTakenMs)}
                            </div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.75 }}>
                                Actual: {feedbackResult.correctLat.toFixed(4)}, {feedbackResult.correctLng.toFixed(4)}
                            </div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.75, marginBottom: '0.5rem' }}>
                                Guess: {feedbackResult.selectedLat.toFixed(4)}, {feedbackResult.selectedLng.toFixed(4)}
                            </div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '0.75rem' }}>
                                Actual location pinned in green • your guess in orange
                            </div>
                            <button 
                                className="btn btn-primary" 
                                onClick={handleNextRecallStep}
                                style={{ width: '100%' }}
                            >
                                {recallQueue.length > 0 ? 'Next Location' : 'View Summary'}
                            </button>
                        </div>
                    )}
                </div>
                
                {/* Right Panel */}
                <div className="glass card" style={{ width: '280px', padding: '1.5rem', overflowY: 'auto', borderRadius: 0, borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                    {phase === 'add' && (
                        <>
                            <h3 style={{ marginBottom: '1rem' }}>Your Landmarks</h3>
                            <p style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '0.5rem' }}>
                                Click anywhere on the map to add a new landmark.
                            </p>
                            <input 
                                type="text"
                                placeholder="Search landmarks..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: 'white', marginBottom: '0.5rem' }}
                            />
                            
                            {/* Verification Filter */}
                            <div style={{ marginBottom: '0.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem', opacity: 0.7 }}>Verification Status</label>
                                <select 
                                    value={filterVerified}
                                    onChange={(e) => setFilterVerified(e.target.value as 'all' | 'verified' | 'unverified')}
                                    style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '0.85rem' }}
                                >
                                    <option value="all">All</option>
                                    <option value="verified">Verified Only</option>
                                    <option value="unverified">Unverified Only</option>
                                </select>
                            </div>
                            
                            {/* Place Type Filter */}
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem', opacity: 0.7 }}>Place Types</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', maxHeight: '120px', overflowY: 'auto', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.2)' }}>
                                    {Array.from(new Set(landmarks.map(l => l.type))).sort().map(type => (
                                        <button
                                            key={type}
                                            onClick={() => {
                                                if (filterTypes.includes(type)) {
                                                    setFilterTypes(filterTypes.filter(t => t !== type));
                                                } else {
                                                    setFilterTypes([...filterTypes, type]);
                                                }
                                            }}
                                            style={{
                                                padding: '0.25rem 0.5rem',
                                                fontSize: '0.7rem',
                                                borderRadius: '0.25rem',
                                                border: 'none',
                                                background: filterTypes.includes(type) ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                                                color: 'white',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {getTypeIcon(type)} {formatType(type)}
                                        </button>
                                    ))}
                                </div>
                                {filterTypes.length > 0 && (
                                    <button
                                        onClick={() => setFilterTypes([])}
                                        style={{
                                            marginTop: '0.25rem',
                                            padding: '0.25rem 0.5rem',
                                            fontSize: '0.7rem',
                                            borderRadius: '0.25rem',
                                            border: 'none',
                                            background: 'rgba(255,255,255,0.1)',
                                            color: 'white',
                                            cursor: 'pointer',
                                            width: '100%'
                                        }}
                                    >
                                        Clear ({filterTypes.length} selected)
                                    </button>
                                )}
                            </div>
                            
                            <button 
                                className={`btn ${isDrawingMode ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ width: '100%', marginBottom: '0.5rem', fontSize: '0.85rem' }}
                                onClick={() => setIsDrawingMode(!isDrawingMode)}
                            >
                                {isDrawingMode ? '🟦 Drawing Mode ON' : '⬜ Drawing Mode OFF'}
                            </button>

                            <button 
                                className="btn"
                                style={{ width: '100%', marginBottom: '1rem', fontSize: '0.85rem', background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.5)' }}
                                onClick={handleDeleteAllUnverified}
                            >
                                🗑️ Delete All Unverified
                            </button>
                            
                            {landmarks.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem' }}>
                                    <div style={{ opacity: 0.5, marginBottom: '1rem' }}>
                                        No landmarks yet.
                                    </div>
                                    <button 
                                        className="btn btn-primary"
                                        onClick={async () => {
                                            if (!confirm('Load all Dhaka landmarks? This will add 70+ landmarks to your database.')) return;
                                            setIsLoading(true);
                                            try {
                                                const { dhakaLandmarks } = await import('@/data/dhaka-landmarks');
                                                for (const landmark of dhakaLandmarks) {
                                                    await saveLandmark(USER_ID, {
                                                        name: landmark.name,
                                                        type: landmark.category,
                                                        lat: landmark.lat,
                                                        lng: landmark.lng,
                                                        createdAt: Date.now(),
                                                        verified: false
                                                    });
                                                }
                                                await loadLandmarks();
                                                alert('Successfully loaded all Dhaka landmarks!');
                                            } catch (error) {
                                                console.error('Error bootstrapping:', error);
                                                alert('Error loading landmarks. Check console.');
                                            }
                                            setIsLoading(false);
                                        }}
                                        disabled={isLoading}
                                    >
                                        {isLoading ? 'Loading...' : '📍 Load Dhaka Landmarks'}
                                    </button>
                                    <div style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '0.5rem' }}>
                                        Or click the map to add manually
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {filteredLandmarks.map(landmark => (
                                        <div 
                                            key={landmark.id} 
                                            id={`landmark-${landmark.id}`}
                                            className="glass" 
                                            style={{ 
                                                padding: '0.75rem', 
                                                borderRadius: '0.5rem', 
                                                display: 'flex', 
                                                justifyContent: 'space-between', 
                                                alignItems: 'center',
                                                cursor: 'pointer',
                                                border: selectedLandmarkId === landmark.id ? '2px solid #22c55e' : '2px solid transparent',
                                                background: selectedLandmarkId === landmark.id ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255,255,255,0.05)'
                                            }}
                                            onClick={() => {
                                                setSelectedLandmarkId(landmark.id);
                                                setCityCenter([landmark.lat, landmark.lng]);
                                                setCityZoom(16);
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <div>
                                                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem', display: 'flex', alignItems: 'center' }}>
                                                        <div style={{ 
                                                            width: '24px', 
                                                            height: '24px', 
                                                            borderRadius: '50%', 
                                                            background: 'rgba(255,255,255,0.1)', 
                                                            display: 'flex', 
                                                            alignItems: 'center', 
                                                            justifyContent: 'center',
                                                            fontSize: '0.75rem',
                                                            marginRight: '0.5rem',
                                                            flexShrink: 0
                                                        }}>
                                                            {getTypeIcon(landmark.type)}
                                                        </div>
                                                        {landmark.name}
                                                        {landmark.verified && (
                                                            <span style={{ color: '#22c55e', marginLeft: '0.4rem', display: 'flex', alignItems: 'center' }}>
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                                    <polyline points="20 6 9 17 4 12"></polyline>
                                                                </svg>
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', opacity: 0.7, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                        <span>{formatType(landmark.type)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                <button
                                                    className="btn btn-secondary"
                                                    title={landmark.verified ? 'Unverify' : 'Verify'}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleToggleVerified(landmark.id, landmark.verified || false);
                                                    }}
                                                    style={{ padding: '0.25rem', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                >
                                                    {landmark.verified ? (
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                                                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                                                        </svg>
                                                    ) : (
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                                                        </svg>
                                                    )}
                                                </button>
                                                <button
                                                    className="btn btn-secondary"
                                                    title="Move"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        beginQuickEdit(landmark);
                                                    }}
                                                    style={{ padding: '0.25rem', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                >
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="5 9 2 12 5 15"></polyline>
                                                        <polyline points="9 5 12 2 15 5"></polyline>
                                                        <polyline points="15 19 12 22 9 19"></polyline>
                                                        <polyline points="19 9 22 12 19 15"></polyline>
                                                        <line x1="2" y1="12" x2="22" y2="12"></line>
                                                        <line x1="12" y1="2" x2="12" y2="22"></line>
                                                    </svg>
                                                </button>
                                                <button
                                                    className="btn btn-secondary"
                                                    title="Edit"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingLandmark(landmark);
                                                        setEditName(landmark.name);
                                                        setEditType(landmark.type);
                                                    }}
                                                    style={{ padding: '0.25rem', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                >
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                    </svg>
                                                </button>
                                                <button
                                                    className="btn btn-secondary"
                                                    title="Delete"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteLandmark(landmark.id);
                                                    }}
                                                    style={{ padding: '0.25rem', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                >
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="3 6 5 6 21 6"></polyline>
                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                    
                    {phase === 'recall' && (
                        <>
                            <h3 style={{ marginBottom: '1rem' }}>Instructions</h3>
                            <div className="glass" style={{ padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
                                <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                                    <strong>Click on the map</strong> where you think <strong>{currentLandmark?.name || 'the hidden location'}</strong> is located.
                                </p>
                                <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                                    Your accuracy will be measured in meters.
                                </p>
                                <button 
                                    className="btn btn-secondary" 
                                    style={{ width: '100%', marginTop: '0.75rem' }}
                                    onClick={openRecallConfig}
                                >
                                    Recall Settings
                                </button>
                            </div>
                            
                            <div className="glass" style={{ padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
                                <div style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                                    Round size: {totalRecallTargets || effectiveRecallCount} landmarks
                                </div>
                                <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                                    Completed: {recallResults.length} • Remaining: {remainingToAnswer}
                                </div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                                    {feedbackResult 
                                        ? 'Review the revealed location, then continue.'
                                        : pendingRecallClick 
                                            ? 'Click on the map to lock in your guess.'
                                            : 'Preparing next location...'}
                                </div>
                            </div>
                        </>
                    )}
                    
                    {phase === 'result' && (
                        <>
                            <h3 style={{ marginBottom: '1rem' }}>Results</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                <div className="glass" style={{ padding: '0.75rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.75rem', fontWeight: 'bold' }}>
                                        {Math.round(averageError)}m
                                    </div>
                                    <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Average Error</div>
                                </div>
                                <div className="glass" style={{ padding: '0.75rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.35rem', fontWeight: 'bold' }}>
                                        {formatDuration(averageTimeMs)}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Avg Time per Guess</div>
                                </div>
                                <div className="glass" style={{ padding: '0.75rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.35rem', fontWeight: 'bold' }}>
                                        {formatDuration(totalRecallTimeMs)}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Total Session Time</div>
                                </div>
                            </div>

                            {bestResult && (
                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                                    <div className="glass" style={{ flex: 1, padding: '0.75rem', borderRadius: '0.5rem' }}>
                                        <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>Closest</div>
                                        <div style={{ fontWeight: 'bold' }}>{bestResult.correctName}</div>
                                        <div style={{ fontSize: '0.85rem' }}>{Math.round(bestResult.distanceError)}m • {formatDuration(bestResult.timeTakenMs)}</div>
                                    </div>
                                    {worstResult && worstResult !== bestResult && (
                                        <div className="glass" style={{ flex: 1, padding: '0.75rem', borderRadius: '0.5rem' }}>
                                            <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>Farthest</div>
                                            <div style={{ fontWeight: 'bold' }}>{worstResult.correctName}</div>
                                            <div style={{ fontSize: '0.85rem' }}>{Math.round(worstResult.distanceError)}m • {formatDuration(worstResult.timeTakenMs)}</div>
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                                {recallResults.map((result, i) => (
                                    <div key={i} className="glass" style={{ padding: '0.75rem', borderRadius: '0.5rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                                            <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{result.correctName}</span>
                                            <span style={{ 
                                                fontSize: '0.9rem', 
                                                fontWeight: 'bold',
                                                color: result.distanceError < 100 ? '#22c55e' : result.distanceError < 500 ? '#f59e0b' : '#ef4444'
                                            }}>
                                                {Math.round(result.distanceError)}m
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>
                                            Actual: {result.correctLat.toFixed(4)}, {result.correctLng.toFixed(4)}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>
                                            Your guess: {result.selectedLat.toFixed(4)}, {result.selectedLng.toFixed(4)}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>
                                            Time: {formatDuration(result.timeTakenMs)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            <button className="btn btn-primary" style={{ width: '100%' }} onClick={resetGame}>
                                Back to Add Mode
                            </button>
                        </>
                    )}
                </div>
            </div>
            
            {/* Edit Modal */}
            {editingLandmark && (
                <div style={{ 
                    position: 'fixed', 
                    top: 0, 
                    left: 0, 
                    right: 0, 
                    bottom: 0, 
                    background: 'rgba(0,0,0,0.8)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    zIndex: 2000
                }}>
                    <div className="glass card" style={{ width: '500px', maxWidth: '90vw', padding: '2rem' }}>
                        <h2 style={{ marginBottom: '1.5rem' }}>Edit Landmark</h2>
                        
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Name</label>
                            <input 
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                style={{ width: '100%' }}
                            />
                        </div>
                        
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Type</label>
                            <select 
                                value={editType}
                                onChange={(e) => setEditType(e.target.value)}
                                style={{ width: '100%' }}
                            >
                                <option value="school">School</option>
                                <option value="school_college">School & College</option>
                                <option value="college">College</option>
                                <option value="university">University</option>
                                <option value="hospital">Hospital</option>
                                <option value="restaurant">Restaurant</option>
                                <option value="cafe">Cafe</option>
                                <option value="shopping">Shopping Mall</option>
                                <option value="food_market">Food Market</option>
                                <option value="park">Park</option>
                                <option value="mosque">Mosque</option>
                                <option value="museum">Museum</option>
                                <option value="historical">Historical</option>
                                <option value="stadium">Stadium</option>
                                <option value="government">Government Building</option>
                                <option value="power_gas">Power/Gas</option>
                                <option value="police">Police Station</option>
                                <option value="post_office">Post Office</option>
                                <option value="bank">Bank</option>
                                <option value="hotel">Hotel</option>
                                <option value="road_arterial">Road (Arterial)</option>
                                <option value="road_highway_start">Road (Highway Start)</option>
                                <option value="area">Area</option>
                                <option value="dncc">DNCC</option>
                                <option value="dscc">DSCC</option>
                                <option value="factory">Factory</option>
                                <option value="bus_stand">Bus Stand</option>
                                <option value="shopping_complex">Shopping Complex</option>
                                <option value="mall">Mall</option>
                                <option value="road">Road</option>
                                <option value="river">River</option>
                                <option value="graveyard">Graveyard</option>
                                <option value="church">Church</option>
                                <option value="lake">Lake</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
                            <button className="btn btn-primary" onClick={handleSaveEdit} style={{ flex: 1 }}>
                                Save Changes
                            </button>
                            <button className="btn btn-secondary" onClick={() => {
                                setEditingLandmark(null);
                            }} style={{ flex: 1 }}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Recall Config Modal */}
            {isRecallConfigOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2500
                }}>
                    <div className="glass card" style={{ width: '480px', maxWidth: '90vw', padding: '2rem' }}>
                        <h2 style={{ marginBottom: '0.5rem' }}>Recall Settings</h2>
                        <p style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '1.5rem' }}>
                            Choose how many landmarks to include and their order. Starting a new recall session resets current progress.
                        </p>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                                Number of landmarks to test
                            </label>
                            <input
                                type="number"
                                min={1}
                                max={maxRecallSelectable}
                                value={effectiveRecallCount}
                                onChange={(e) => {
                                    const value = parseInt(e.target.value, 10);
                                    if (isNaN(value)) return;
                                    const capped = Math.max(1, Math.min(value, maxRecallSelectable));
                                    setRecallCount(capped);
                                }}
                                style={{ width: '100%' }}
                            />
                            <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '0.25rem' }}>
                                Verified available: {verifiedLandmarks.length}
                            </div>
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                                Order
                            </label>
                            <select 
                                value={recallOrder}
                                onChange={(e) => setRecallOrder(e.target.value as 'random' | 'sequential')}
                                style={{ width: '100%' }}
                            >
                                <option value="random">Randomized</option>
                                <option value="sequential">Alphabetical</option>
                            </select>
                        </div>
                        
                        {/* Verification Filter */}
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                                Verification Status
                            </label>
                            <select 
                                value={recallFilterVerified}
                                onChange={(e) => setRecallFilterVerified(e.target.value as 'all' | 'verified' | 'unverified')}
                                style={{ width: '100%' }}
                            >
                                <option value="all">All</option>
                                <option value="verified">Verified Only</option>
                                <option value="unverified">Unverified Only</option>
                            </select>
                        </div>
                        
                        {/* Place Type Filter */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                                Place Types
                            </label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', maxHeight: '150px', overflowY: 'auto', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.2)' }}>
                                {Array.from(new Set(landmarks.map(l => l.type))).sort().map(type => (
                                    <button
                                        key={type}
                                        onClick={() => {
                                            if (recallFilterTypes.includes(type)) {
                                                setRecallFilterTypes(recallFilterTypes.filter(t => t !== type));
                                            } else {
                                                setRecallFilterTypes([...recallFilterTypes, type]);
                                            }
                                        }}
                                        style={{
                                            padding: '0.35rem 0.6rem',
                                            fontSize: '0.75rem',
                                            borderRadius: '0.35rem',
                                            border: 'none',
                                            background: recallFilterTypes.includes(type) ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                                            color: 'white',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {getTypeIcon(type)} {formatType(type)}
                                    </button>
                                ))}
                            </div>
                            {recallFilterTypes.length > 0 && (
                                <button
                                    onClick={() => setRecallFilterTypes([])}
                                    style={{
                                        marginTop: '0.5rem',
                                        padding: '0.35rem 0.6rem',
                                        fontSize: '0.75rem',
                                        borderRadius: '0.35rem',
                                        border: 'none',
                                        background: 'rgba(255,255,255,0.1)',
                                        color: 'white',
                                        cursor: 'pointer',
                                        width: '100%'
                                    }}
                                >
                                    Clear All ({recallFilterTypes.length} selected)
                                </button>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button 
                                className="btn btn-primary"
                                onClick={confirmRecallStart}
                                style={{ flex: 1 }}
                                disabled={landmarks.length < 2}
                            >
                                Start Recall
                            </button>
                            <button 
                                className="btn btn-secondary"
                                onClick={() => setIsRecallConfigOpen(false)}
                                style={{ flex: 1 }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
