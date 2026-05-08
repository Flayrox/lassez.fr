'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface RadarPost {
    id: string;
    source_title: string;
    flash_content: string;
    status: 'PENDING' | 'APPROVED' | 'PUBLISHED' | 'REJECTED' | 'IGNORED' | 'INGESTED' | 'RESEARCHED' | 'DRAFTED' | 'QUEUED';
    geo: 'france' | 'international';
    tags: string;
    created_at: string;
    image_keyword?: string;
    type_ouverture?: string;
}

export interface RadarSource {
    id: string;
    url: string;
    type: 'RSS' | 'TELEGRAM' | 'GOOGLE_NEWS';
    source_name: string;
    source_bias: string;
    trust_score: number;
    allowSourceImages: boolean;
}

interface RadarAdminContextType {
    posts: RadarPost[];
    setPosts: React.Dispatch<React.SetStateAction<RadarPost[]>>;
    loading: boolean;
    setLoading: React.Dispatch<React.SetStateAction<boolean>>;
    settings: any;
    sources: RadarSource[];
    fetchSettings: () => Promise<void>;
    fetchSources: () => Promise<void>;
    fetchQueue: (status?: string, geo?: string, tag?: string | null) => Promise<void>;
    updateStatus: (id: string, status: string, content?: string, imageUrl?: string, title?: string) => Promise<void>;
    triggerScan: () => Promise<void>;
    isDaemonRunning: boolean;
    countdown: string | null;
}

const RadarAdminContext = createContext<RadarAdminContextType | undefined>(undefined);

export function RadarAdminProvider({ children }: { children: React.ReactNode }) {
    const [posts, setPosts] = useState<RadarPost[]>([]);
    const [sources, setSources] = useState<RadarSource[]>([]);
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState<any>(null);
    const [nextScanAt, setNextScanAt] = useState<Date | null>(null);
    const [countdown, setCountdown] = useState<string | null>(null);

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/radar/settings');
            const data = await res.json();
            if (data.success) {
                setSettings(data.settings);
                if (data.settings?.next_scan_at) setNextScanAt(new Date(data.settings.next_scan_at));
            }
        } catch (e) { console.error(e); }
    };

    const fetchSources = async () => {
        try {
            const res = await fetch('/api/radar/sources');
            const data = await res.json();
            if (data.success) setSources(data.sources);
        } catch (e) { console.error(e); }
    };

    const fetchQueue = async (status = 'PENDING', geo = 'all', tag = null) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ status });
            if (geo !== 'all') params.set('geo', geo);
            if (tag) params.set('tag', tag);
            const res = await fetch(`/api/radar?${params.toString()}`);
            const data = await res.json();
            if (data.success) setPosts(data.posts);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const updateStatus = async (id: string, status: string, content?: string, imageUrl?: string, title?: string) => {
        try {
            const res = await fetch('/api/radar', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status, flash_content: content, image_keyword: imageUrl, source_title: title })
            });
            if (res.ok) setPosts(prev => prev.filter(p => p.id !== id));
        } catch (e) { console.error(e); }
    };

    const triggerScan = async () => {
        try {
            await fetch('/api/radar/trigger', { method: 'POST' });
            fetchQueue();
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        fetchSettings();
        fetchSources();
        const interval = setInterval(() => {
            fetchSettings();
            fetchSources();
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const tick = () => {
            if (!nextScanAt) { setCountdown(null); return; }
            const diffMs = nextScanAt.getTime() - Date.now();
            if (diffMs <= 0 && diffMs > -(5 * 60 * 1000)) { setCountdown('SCANNING...'); return; }
            if (diffMs <= - (5 * 60 * 1000)) { setCountdown('IDLE'); return; }
            const h = Math.floor(diffMs / 3600000);
            const m = Math.floor((diffMs % 3600000) / 60000);
            const s = Math.floor((diffMs % 60000) / 1000);
            setCountdown(`${h > 0 ? h + 'h ' : ''}${m}m ${s}s`);
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [nextScanAt]);

    return (
        <RadarAdminContext.Provider value={{ 
            posts, setPosts, loading, setLoading, settings, sources,
            fetchSettings, fetchSources, fetchQueue, updateStatus, triggerScan,
            isDaemonRunning: !!settings?.enableAutoPublish,
            countdown
        }}>
            {children}
        </RadarAdminContext.Provider>
    );
}

export function useRadarAdmin() {
    const context = useContext(RadarAdminContext);
    if (context === undefined) throw new Error('useRadarAdmin must be used within a RadarAdminProvider');
    return context;
}
