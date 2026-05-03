'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

export type SlideType = 'COVER' | 'NEWS' | 'MANIFESTO' | 'MAXTEXT' | 'GRANULAR' | 'BIG_NUM' | 'VERSUS' | 'CHECKLIST' | 'INFO' | 'ANALYSIS' | 'OUTRO' | 'COMPARISON_CHART' | 'STACKED_DATA' | 'VOTE_TRACKER' | 'TERRITORY_RADAR' | 'DECODING' | 'CHRONO_LOCK' | 'IMPACT_QUOTE' | 'SOCIAL_COST' | 'VIDEO_NOTE';

export interface Slide {
    id: string;
    type: SlideType;
    label: string;
    state: any;
}

interface StudioContextType {
    deck: Slide[];
    setDeck: React.Dispatch<React.SetStateAction<Slide[]>>;
    activeId: string;
    setActiveId: (id: string) => void;
    activeSlide: Slide | null;
    patchActive: (patch: any) => void;
    addSlide: (type: SlideType) => void;
    duplicateSlide: (id: string) => void;
    deleteSlide: (id: string) => void;
    moveSlide: (id: string, dir: -1 | 1) => void;
    renameSlide: (id: string, label: string) => void;
    aiLoading: boolean;
    setAiLoading: (loading: boolean) => void;
    articleInput: string;
    setArticleInput: (input: string) => void;
}

const StudioContext = createContext<StudioContextType | undefined>(undefined);

const nid = () => Math.random().toString(36).slice(2, 9);

import { DEFAULTS } from './constants';
import { getTemplate, TemplateRegistry } from '../registry';

export function StudioProvider({ children, initialDeck, initialActiveId }: { children: React.ReactNode, initialDeck?: Slide[], initialActiveId?: string }) {
    const [deck, setDeck] = useState<Slide[]>(initialDeck || []);
    const [activeId, setActiveId] = useState<string>(initialActiveId || '');
    const [aiLoading, setAiLoading] = useState(false);
    const [articleInput, setArticleInput] = useState('');

    const activeSlide = deck.find(s => s.id === activeId) || (deck.length > 0 ? deck[0] : null);

    const patchActive = (patch: any) => {
        setDeck(prev => prev.map(s => s.id === activeId ? { ...s, state: { ...s.state, ...patch } } : s));
    };

    const addSlide = (type: SlideType) => {
        const idx = deck.length + 1;
        const modularTemplate = getTemplate(type);
        const initialState = modularTemplate 
            ? JSON.parse(JSON.stringify(modularTemplate.defaultState)) 
            : JSON.parse(JSON.stringify(DEFAULTS[type] || {}));

        const newSlide: Slide = { 
            id: nid(), 
            type, 
            label: `Slide ${idx} — ${modularTemplate?.name || type}`, 
            state: initialState
        };
        setDeck(d => [...d, newSlide]);
        setActiveId(newSlide.id);
    };

    const duplicateSlide = (id: string) => {
        const src = deck.find(s => s.id === id);
        if (!src) return;
        const dup: Slide = { ...src, id: nid(), label: src.label + ' (copie)', state: { ...src.state } };
        setDeck(d => {
            const i = d.findIndex(s => s.id === id);
            const r = [...d];
            r.splice(i + 1, 0, dup);
            return r;
        });
        setActiveId(dup.id);
    };

    const deleteSlide = (id: string) => {
        if (deck.length <= 1) return;
        setDeck(d => {
            const n = d.filter(s => s.id !== id);
            if (id === activeId) setActiveId(n[0].id);
            return n;
        });
    };

    const moveSlide = (id: string, dir: -1 | 1) => {
        setDeck(d => {
            const i = d.findIndex(s => s.id === id);
            if (i < 0) return d;
            const j = i + dir;
            if (j < 0 || j >= d.length) return d;
            const r = [...d];
            [r[i], r[j]] = [r[j], r[i]];
            return r;
        });
    };

    const renameSlide = (id: string, label: string) => {
        setDeck(d => d.map(s => s.id === id ? { ...s, label } : s));
    };

    return (
        <StudioContext.Provider value={{
            deck, setDeck, activeId, setActiveId, activeSlide, patchActive,
            addSlide, duplicateSlide, deleteSlide, moveSlide, renameSlide,
            aiLoading, setAiLoading, articleInput, setArticleInput
        }}>
            {children}
        </StudioContext.Provider>
    );
}

export function useStudio() {
    const context = useContext(StudioContext);
    if (context === undefined) throw new Error('useStudio must be used within a StudioProvider');
    return context;
}
