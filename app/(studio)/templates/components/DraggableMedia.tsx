'use client';

import React, { useRef, useEffect } from 'react';

export function DraggableImage({ src, zoom, grayscale, posX, posY, onPosChange }: {
    src: string; zoom: number; grayscale: number;
    posX: number; posY: number; onPosChange: (x: number, y: number) => void;
}) {
    const isDragging = useRef(false);
    const startMouse = useRef({ x: 0, y: 0 });
    const startPos = useRef({ x: 0, y: 0 });

    const onMouseDown = (e: React.MouseEvent) => {
        isDragging.current = true;
        startMouse.current = { x: e.clientX, y: e.clientY };
        startPos.current = { x: posX, y: posY };
        e.preventDefault();
    };
    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!isDragging.current) return;
            const dx = e.clientX - startMouse.current.x;
            const dy = e.clientY - startMouse.current.y;
            onPosChange(startPos.current.x + dx, startPos.current.y + dy);
        };
        const onUp = () => { isDragging.current = false; };
        window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
        return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    }, [onPosChange]);

    const filter = `grayscale(${grayscale / 100}) contrast(${1 + (grayscale / 100) * 0.5}) brightness(${1 - (grayscale / 100) * 0.25})`;
    const sz = `${zoom * 100}%`;
    const left = `calc(${(1 - zoom) * 50}% + ${posX}px)`;
    const top = `calc(${(1 - zoom) * 50}% + ${posY}px)`;

    return (
        <div
            onMouseDown={onMouseDown}
            style={{
                position: 'absolute',
                width: sz, height: sz,
                left, top,
                filter,
                cursor: 'grab',
            }}
        >
            <img
                crossOrigin="anonymous" alt="" src={src} draggable={false}
                style={{
                    width: '100%', height: '100%',
                    objectFit: 'cover',
                    userSelect: 'none',
                    pointerEvents: 'none',
                }}
            />
        </div>
    );
}

export function DraggableVideo({ src, zoom, posX, posY, onPosChange }: {
    src: string; zoom: number;
    posX: number; posY: number; onPosChange: (x: number, y: number) => void;
}) {
    const isDragging = useRef(false);
    const startMouse = useRef({ x: 0, y: 0 });
    const startPos = useRef({ x: 0, y: 0 });

    const onMouseDown = (e: React.MouseEvent) => {
        isDragging.current = true;
        startMouse.current = { x: e.clientX, y: e.clientY };
        startPos.current = { x: posX, y: posY };
        e.preventDefault();
        e.stopPropagation();
    };

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!isDragging.current) return;
            const dx = e.clientX - startMouse.current.x;
            const dy = e.clientY - startMouse.current.y;
            onPosChange(startPos.current.x + dx, startPos.current.y + dy);
        };
        const onUp = () => { isDragging.current = false; };
        window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
        return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    }, [onPosChange]);

    const sz = `${zoom * 100}%`;
    const left = `calc(${(1 - zoom) * 50}% + ${posX}px)`;
    const top = `calc(${(1 - zoom) * 50}% + ${posY}px)`;

    return (
        <div
            onMouseDown={onMouseDown}
            style={{
                position: 'absolute',
                width: sz, height: sz,
                left, top,
                cursor: 'grab',
            }}
        >
            <video
                src={src} autoPlay muted loop
                style={{
                    width: '100%', height: '100%',
                    objectFit: 'cover',
                    userSelect: 'none',
                    pointerEvents: 'none',
                }}
            />
        </div>
    );
}
