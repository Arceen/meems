"use client";

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import Link from 'next/link';
import Image from 'next/image';
import { saveGameResult } from '@/lib/firebase';
import { IMAGE_BANK } from '@/data/imageBank';

type GameState = 'setup' | 'loading' | 'memorize' | 'recall' | 'result';

export default function ImageSequence() {
    const [gameState, setGameState] = useState<GameState>('setup');
    const [imageCount, setImageCount] = useState(20);
    const [speed, setSpeed] = useState(1000); // ms per image
    const [sequence, setSequence] = useState<{ id: number, url: string }[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userSequence, setUserSequence] = useState<number[]>([]); // IDs
    const [availableImages, setAvailableImages] = useState<{ id: number, url: string }[]>([]);
    const [imagesLoaded, setImagesLoaded] = useState(0);

    const [startTime, setStartTime] = useState(0);
    const [memorizeTime, setMemorizeTime] = useState(0);

    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const preloadImages = (images: { id: number, url: string }[]) => {
        setImagesLoaded(0);
        let loaded = 0;

        images.forEach((img) => {
            const image = new window.Image();
            image.onload = () => {
                loaded++;
                setImagesLoaded(loaded);
                if (loaded === images.length) {
                    // All images loaded, start memorization
                    setTimeout(() => startMemorization(), 500);
                }
            };
            image.onerror = () => {
                loaded++;
                setImagesLoaded(loaded);
                if (loaded === images.length) {
                    setTimeout(() => startMemorization(), 500);
                }
            };
            image.src = img.url;
        });
    };

    const startGame = () => {
        // Pick random images from bank
        const shuffledBank = [...IMAGE_BANK].sort(() => Math.random() - 0.5);
        const selected = shuffledBank.slice(0, imageCount);

        setSequence(selected);
        setAvailableImages([...selected].sort(() => Math.random() - 0.5));
        setCurrentIndex(0);
        setUserSequence([]);
        setGameState('loading');

        // Preload all images
        preloadImages(selected);
    };

    const startMemorization = () => {
        setGameState('memorize');
        setStartTime(Date.now());
        setCurrentIndex(0);

        // Auto-advance with precise timing
        let currentIdx = 0;
        const startTimestamp = Date.now();

        const advanceImage = () => {
            currentIdx++;
            const expectedTime = startTimestamp + (currentIdx * speed);
            const now = Date.now();
            const drift = now - expectedTime;

            if (currentIdx >= imageCount) {
                setTimeout(startRecall, 500);
            } else {
                setCurrentIndex(currentIdx);
                // Adjust next timeout to compensate for drift
                const nextDelay = Math.max(0, speed - drift);
                setTimeout(advanceImage, nextDelay);
            }
        };

        // Start the first transition after initial delay
        setTimeout(advanceImage, speed);
    };

    const startRecall = () => {
        setMemorizeTime(Date.now() - startTime);
        setGameState('recall');
        setStartTime(Date.now());
        setUserSequence([]);
    };

    const selectImage = (id: number) => {
        // Check if already selected
        const existingIndex = userSequence.indexOf(id);

        if (existingIndex !== -1) {
            // Unselect: remove from sequence
            const newSeq = userSequence.filter((_, i) => i !== existingIndex);
            setUserSequence(newSeq);
        } else {
            // Select: add to sequence
            const newSeq = [...userSequence, id];
            setUserSequence(newSeq);

            if (newSeq.length === sequence.length) {
                finishGame(newSeq);
            }
        }
    };

    const finishGame = async (finalSeq: number[]) => {
        const endTime = Date.now();
        setGameState('result');

        let correct = 0;
        finalSeq.forEach((id, idx) => {
            if (id === sequence[idx].id) correct++;
        });

        await saveGameResult({
            type: 'image-sequence',
            count: imageCount,
            correct,
            total: imageCount,
            percentage: Math.round((correct / imageCount) * 100),
            memorizeTime: memorizeTime / 1000,
            recallTime: (endTime - startTime) / 1000,
            precision: Math.round((correct / imageCount) * 100),
            completeness: 100,
        });
    };

    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    return (
        <>
            <Header />
            <main className="container" style={{ maxWidth: '1200px' }}>
                <div style={{ marginBottom: '2rem' }}>
                    <Link href="/training" style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '0.5rem', display: 'inline-block' }}>
                        ← Back to Training
                    </Link>
                    <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Image Sequence</h1>
                </div>

                {gameState === 'setup' && (
                    <div className="glass card animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
                        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.2rem' }}>Configuration</h2>
                        <div style={{ display: 'grid', gap: '1.5rem', marginBottom: '2rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Number of Images</label>
                                <input type="number" className="input-field" value={imageCount} onChange={(e) => setImageCount(parseInt(e.target.value) || 0)} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Speed (ms per image)</label>
                                <input type="number" className="input-field" value={speed} onChange={(e) => setSpeed(parseInt(e.target.value) || 0)} />
                            </div>
                        </div>
                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={startGame}>Start Sequence</button>
                    </div>
                )}

                {gameState === 'loading' && (
                    <div className="animate-fade-in" style={{ textAlign: 'center', padding: '4rem 0' }}>
                        <div style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Loading Images...</div>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                            {imagesLoaded} / {imageCount}
                        </div>
                        <div style={{ width: '300px', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', margin: '1rem auto', overflow: 'hidden' }}>
                            <div style={{ width: `${(imagesLoaded / imageCount) * 100}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.3s' }} />
                        </div>

                        {/* Preload images invisibly */}
                        <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
                            {sequence.map((img) => (
                                <Image key={img.id} src={img.url} alt="" width={400} height={300} unoptimized />
                            ))}
                        </div>
                    </div>
                )}

                {gameState === 'memorize' && (
                    <div className="animate-fade-in" style={{ textAlign: 'center', height: '60vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                        <div style={{ marginBottom: '1rem', opacity: 0.7, fontSize: '0.9rem' }}>Image {currentIndex + 1} / {imageCount}</div>

                        {/* Stack all images */}
                        <div style={{ position: 'relative', width: '400px', height: '300px', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
                            {sequence.map((img, idx) => (
                                <div
                                    key={img.id}
                                    style={{
                                        position: 'absolute',
                                        inset: 0,
                                        transform: idx === currentIndex ? 'translateX(0)' : idx < currentIndex ? 'translateX(-100%)' : 'translateX(100%)',
                                        transition: 'transform 0.3s ease-out',
                                        zIndex: idx === currentIndex ? 10 : 1
                                    }}
                                >
                                    <Image
                                        src={img.url}
                                        alt="Memory Image"
                                        fill
                                        style={{ objectFit: 'cover' }}
                                        unoptimized
                                        priority
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {gameState === 'recall' && (
                    <div className="animate-fade-in">
                        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                            <h2>Reconstruct the Sequence</h2>
                            <p style={{ opacity: 0.7 }}>Click images in order (click again to unselect) - {userSequence.length} / {imageCount}</p>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
                            {availableImages.map((img) => {
                                const selectedIndex = userSequence.indexOf(img.id);
                                const isSelected = selectedIndex !== -1;
                                return (
                                    <button
                                        key={img.id}
                                        onClick={() => selectImage(img.id)}
                                        className="glass"
                                        style={{
                                            padding: 0,
                                            border: 'none',
                                            borderRadius: '0.5rem',
                                            overflow: 'hidden',
                                            position: 'relative',
                                            height: '120px',
                                            opacity: isSelected ? 0.6 : 1,
                                            cursor: 'pointer',
                                            transform: isSelected ? 'scale(0.95)' : 'scale(1)',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <Image src={img.url} alt="Option" fill style={{ objectFit: 'cover' }} unoptimized />
                                        {isSelected && (
                                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', color: 'white', fontWeight: 'bold', fontSize: '1.5rem' }}>
                                                {selectedIndex + 1}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {gameState === 'result' && (
                    <div className="glass card animate-fade-in">
                        <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', textAlign: 'center' }}>Results</h2>
                        {(() => {
                            let correct = 0;
                            userSequence.forEach((id, idx) => {
                                if (id === sequence[idx].id) correct++;
                            });
                            const percentage = Math.round((correct / imageCount) * 100);

                            return (
                                <>
                                    <div style={{ textAlign: 'center', fontSize: '3rem', fontWeight: 'bold', color: percentage === 100 ? 'var(--success)' : 'var(--primary)', marginBottom: '2rem' }}>
                                        {percentage}%
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '1rem' }}>
                                        {sequence.map((img, idx) => {
                                            const userId = userSequence[idx];
                                            const isCorrect = userId === img.id;
                                            const userImg = availableImages.find(i => i.id === userId);

                                            return (
                                                <div key={idx} style={{ textAlign: 'center' }}>
                                                    <div style={{ position: 'relative', width: '100%', height: '80px', marginBottom: '0.5rem', borderRadius: '0.25rem', overflow: 'hidden', border: isCorrect ? '2px solid var(--success)' : '2px solid var(--error)' }}>
                                                        <Image src={img.url} alt="Correct" fill style={{ objectFit: 'cover' }} unoptimized />
                                                    </div>
                                                    {!isCorrect && userImg && (
                                                        <div style={{ position: 'relative', width: '100%', height: '80px', borderRadius: '0.25rem', overflow: 'hidden', opacity: 0.7 }}>
                                                            <Image src={userImg.url} alt="Your Pick" fill style={{ objectFit: 'cover' }} unoptimized />
                                                        </div>
                                                    )}
                                                    <div style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                                                        {isCorrect ? '✓' : '✗'}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <button className="btn btn-primary" style={{ width: '100%', marginTop: '2rem' }} onClick={() => setGameState('setup')}>Try Again</button>
                                </>
                            );
                        })()}
                    </div>
                )}
            </main>
        </>
    );
}
