'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ModernDashboardLayout } from '../components/ModernDashboardLayout';
import { FlowCanvas } from './components/FlowCanvas';
import { NodeInspector } from '../components/NodeInspector';
import { useRadarAdmin } from '../components/RadarAdminContext';
import { useUI } from '../context/UIContext';
import { motion, AnimatePresence } from 'framer-motion';

interface Node {
    id: string;
    x: number;
    y: number;
    label: string;
    type: string;
    icon: string;
    color: string;
    bg: string;
    settings?: any[];
}

interface Connection {
    id: string;
    from: string;
    to: string;
}

const DEFAULT_PROMPT = "Tu es l'éditorialiste de L'Assez, un média OSINT. Ton rôle est de rédiger des flashs infos percutants, neutres et sourcés à partir des données collectées. Style: Direct, professionnel, sans fioritures.";

const NODE_TYPES = {
    source: {
        'rss': { 
            label: 'RSS Feed', icon: 'rss_feed', color: 'text-orange-500', bg: 'bg-orange-50', 
            settings: [{ key: 'rss_feeds', label: 'RSS Feed URLs', value: '' }]
        },
        'telegram': { 
            label: 'Telegram', icon: 'send', color: 'text-blue-500', bg: 'bg-blue-50', 
            settings: [{ key: 'telegram_channels', label: 'Channels', value: '' }]
        },
        'google-news': { 
            label: 'Google News', icon: 'search', color: 'text-blue-600', bg: 'bg-blue-100', 
            settings: [{ key: 'google_news_queries', label: 'Search Queries', value: '' }]
        },
        'x': { 
            label: 'X / Twitter', icon: 'close', color: 'text-slate-900', bg: 'bg-slate-50', 
            settings: [{ key: 'x_accounts', label: 'Accounts', value: '' }]
        },
    },
    processor: {
        'dedup': { 
            label: 'Deduplicator', icon: 'content_copy', color: 'text-purple-600', bg: 'bg-purple-50', 
            settings: [
                { key: 'dedup_similarity_threshold', label: 'Similarity Threshold', value: '0.65' },
                { key: 'dedup_recent_hours', label: 'Lookback Period', value: '24' }
            ] 
        },
        'distribution': { 
            label: 'Distribution', icon: 'share', color: 'text-indigo-600', bg: 'bg-indigo-50', 
            settings: [{ key: 'social_targets_by_type_json', label: 'Targets Config', value: '{}' }] 
        },
    },
    agent: {
        'research': { 
            label: 'Researcher', icon: 'travel_explore', color: 'text-emerald-600', bg: 'bg-emerald-50', 
            settings: [
                { key: 'ai_model_breaking', label: 'AI Model', value: 'gpt-4o' },
                { key: 'google_search_breaking_enabled', label: 'Web Search', value: true }
            ] 
        },
        'editor': { 
            label: 'Editorialist', icon: 'edit_note', color: 'text-amber-600', bg: 'bg-amber-50', 
            settings: [
                { key: 'ai_model_main', label: 'AI Model', value: 'gpt-4o' },
                { key: 'ai_prompt', label: 'System Prompt', value: DEFAULT_PROMPT }
            ] 
        },
        'validator': { 
            label: 'Validator', icon: 'fact_check', color: 'text-rose-600', bg: 'bg-rose-50', 
            settings: [
                { key: 'auto_approve_enabled', label: 'Auto Approve', value: false },
                { key: 'auto_pilot_enabled', label: 'Auto Pilot', value: false }
            ] 
        },
    },
    target: {
        'payload': { label: 'L\'Assez CMS', icon: 'publish', color: 'text-slate-900', bg: 'bg-slate-100' },
        'discord': { label: 'Discord', icon: 'chat', color: 'text-indigo-500', bg: 'bg-indigo-50' },
    }
};

const INITIAL_NODES: Node[] = [
    { id: 'source-rss', x: 100, y: 150, label: 'RSS Feed', type: 'rss', icon: 'rss_feed', color: 'text-orange-500', bg: 'bg-orange-50', settings: NODE_TYPES.source.rss.settings },
    { id: 'source-telegram', x: 100, y: 280, label: 'Telegram', type: 'telegram', icon: 'send', color: 'text-blue-500', bg: 'bg-blue-50', settings: NODE_TYPES.source.telegram.settings },
    { id: 'source-google', x: 100, y: 410, label: 'Google News', type: 'google-news', icon: 'search', color: 'text-blue-600', bg: 'bg-blue-100', settings: NODE_TYPES.source['google-news'].settings },
    { id: 'proc-dedup', x: 350, y: 320, label: 'Deduplicator', type: 'dedup', icon: 'content_copy', color: 'text-purple-600', bg: 'bg-purple-50', settings: NODE_TYPES.processor.dedup.settings },
    { id: 'agent-research', x: 600, y: 180, label: 'Researcher', type: 'research', icon: 'travel_explore', color: 'text-emerald-600', bg: 'bg-emerald-50', settings: NODE_TYPES.agent.research.settings },
    { id: 'agent-editor', x: 850, y: 280, label: 'Editorialist', type: 'editor', icon: 'edit_note', color: 'text-amber-600', bg: 'bg-amber-50', settings: NODE_TYPES.agent.editor.settings },
    { id: 'agent-validator', x: 1100, y: 380, label: 'Validator', type: 'validator', icon: 'fact_check', color: 'text-rose-600', bg: 'bg-rose-50', settings: NODE_TYPES.agent.validator.settings },
    { id: 'proc-dist', x: 1350, y: 480, label: 'Distribution', type: 'distribution', icon: 'share', color: 'text-indigo-600', bg: 'bg-indigo-50', settings: NODE_TYPES.processor.distribution.settings },
    { id: 'target-cms', x: 1600, y: 400, label: 'L\'Assez CMS', type: 'payload', icon: 'publish', color: 'text-slate-900', bg: 'bg-slate-100' },
    { id: 'target-discord', x: 1600, y: 550, label: 'Discord', type: 'discord', icon: 'chat', color: 'text-indigo-500', bg: 'bg-indigo-50' }
];

const INITIAL_CONNECTIONS: Connection[] = [
    { id: 'c1', from: 'source-rss', to: 'proc-dedup' },
    { id: 'c2', from: 'source-telegram', to: 'proc-dedup' },
    { id: 'c3', from: 'source-google', to: 'proc-dedup' },
    { id: 'c4', from: 'proc-dedup', to: 'agent-research' },
    { id: 'c5', from: 'agent-research', to: 'agent-editor' },
    { id: 'c6', from: 'agent-editor', to: 'agent-validator' },
    { id: 'c7', from: 'agent-validator', to: 'proc-dist' },
    { id: 'c8', from: 'proc-dist', to: 'target-cms' },
    { id: 'c9', from: 'proc-dist', to: 'target-discord' }
];

export default function FlowPage() {
    const { settings, fetchSettings } = useRadarAdmin();
    const [nodes, setNodes] = useState<Node[]>([]);
    const [connections, setConnections] = useState<Connection[]>([]);
    const [isHydrated, setIsHydrated] = useState(false);
    const { selectedNodeId, setSelectedNodeId } = useUI();

    const saveToLocal = (n: Node[], c: Connection[]) => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('radar-flow-pro-v4', JSON.stringify({ nodes: n, connections: c }));
        }
    };

    useEffect(() => {
        if (!isHydrated || !settings) return;

        setNodes(prevNodes => prevNodes.map(node => {
            if (!node.settings) return node;
            const nextSettings = node.settings.map((s: any) => {
                const dbValue = settings[s.key];
                if (dbValue !== undefined) {
                    if (typeof dbValue === 'string') {
                        if (dbValue.startsWith('[') && dbValue.endsWith(']')) {
                            try {
                                const parsed = JSON.parse(dbValue);
                                if (Array.isArray(parsed)) return { ...s, value: parsed.join('\n') };
                            } catch (e) {}
                        }
                        if (dbValue.startsWith('{') && dbValue.endsWith('}')) {
                            try {
                                const parsed = JSON.parse(dbValue);
                                return { ...s, value: JSON.stringify(parsed, null, 4) };
                            } catch (e) {}
                        }
                    }
                    if (Array.isArray(dbValue)) return { ...s, value: dbValue.join('\n') };
                    return { ...s, value: dbValue };
                }
                return s;
            });
            if (JSON.stringify(nextSettings) !== JSON.stringify(node.settings)) {
                return { ...node, settings: nextSettings };
            }
            return node;
        }));
    }, [settings, isHydrated]);

    useEffect(() => {
        const saved = localStorage.getItem('radar-flow-pro-v4');
        if (saved) {
            try {
                const { nodes: sn, connections: sc } = JSON.parse(saved);
                const enrichedNodes = sn.map((node: any) => {
                    let baseConfig = null;
                    for (const cat of Object.values(NODE_TYPES)) {
                        const match = Object.entries(cat).find(([k, v]) => v.label === node.label || k === node.type);
                        if (match) { baseConfig = match[1]; break; }
                    }
                    const settingsToUse = (node.settings && node.settings.length > 0) ? node.settings : (baseConfig?.settings || []);
                    return { ...node, settings: settingsToUse };
                });
                setNodes(enrichedNodes.length > 0 ? enrichedNodes : INITIAL_NODES);
                setConnections(sc);
            } catch (e) { 
                setNodes(INITIAL_NODES);
                setConnections(INITIAL_CONNECTIONS);
            }
        } else {
            setNodes(INITIAL_NODES);
            setConnections(INITIAL_CONNECTIONS);
        }
        setIsHydrated(true);
    }, []);

    const updateNodeData = async (id: string, updates: any) => {
        const nextNodes = nodes.map(n => n.id === id ? { ...n, ...updates } : n);
        setNodes(nextNodes);
        saveToLocal(nextNodes, connections);
        
        if (updates.settings) {
            const payload: any = {};
            updates.settings.forEach((s: any) => {
                if (s.key) {
                    const k = s.key.toLowerCase();
                    if (k.includes('feeds') || k.includes('channels') || k.includes('queries') || k.includes('accounts')) {
                        const arr = (s.value || '').split('\n').map((str: string) => str.trim()).filter(Boolean);
                        payload[s.key] = JSON.stringify(arr);
                    } else if (k.includes('json')) {
                        try { payload[s.key] = JSON.stringify(JSON.parse(s.value)); } catch (e) { payload[s.key] = s.value; }
                    } else {
                        payload[s.key] = s.value;
                    }
                }
            });
            
            const res = await fetch('/api/radar/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('Sync failed');
            await fetchSettings();
        }
    };

    const handleReset = () => {
        if (confirm('Revert pipeline to Studio Defaults? (Layout & Connections)')) {
            localStorage.removeItem('radar-flow-pro-v4');
            setNodes(JSON.parse(JSON.stringify(INITIAL_NODES)));
            setConnections(JSON.parse(JSON.stringify(INITIAL_CONNECTIONS)));
        }
    };

    const addNode = (type: string, category: string) => {
        const config = (NODE_TYPES as any)[category][type];
        const newNode: Node = {
            id: `${type}-${Date.now()}`,
            x: 100, y: 100,
            label: config.label,
            type: type,
            icon: config.icon,
            color: config.color,
            bg: config.bg,
            settings: config.settings
        };
        const next = [...nodes, newNode];
        setNodes(next);
        saveToLocal(next, connections);
    };

    const deleteNode = (id: string) => {
        if (confirm('Delete this node and all its connections?')) {
            const nextNodes = nodes.filter(n => n.id !== id);
            const nextConns = connections.filter(c => c.from !== id && c.to !== id);
            setNodes(nextNodes);
            setConnections(nextConns);
            saveToLocal(nextNodes, nextConns);
            setSelectedNodeId(null);
        }
    };

    return (
        <ModernDashboardLayout title="Pipeline" fullBleed={true} actions={
            <div className="flex items-center gap-2">
                <button onClick={handleReset} className="px-4 py-1.5 border border-slate-200 text-[10px] font-black uppercase rounded-sm hover:bg-slate-50 transition-colors">Reset</button>
                <button className="px-4 py-1.5 bg-black text-white text-[10px] font-black uppercase rounded-sm shadow-lg hover:bg-zinc-800 transition-colors">Deploy</button>
            </div>
        }>
            <div className="flex-1 relative w-full h-full overflow-hidden bg-white">
                {isHydrated && (
                    <>
                        <FlowCanvas 
                            nodes={nodes} 
                            connections={connections} 
                            onNodeClick={() => {}}
                            onNodeMove={(id, x, y) => {
                                const next = nodes.map(n => n.id === id ? { ...n, x, y } : n);
                                setNodes(next);
                                saveToLocal(next, connections);
                            }}
                            onNodeMoveEnd={() => {}}
                            onConnect={(f, t) => {
                                const next = [...connections, { id: `c-${Date.now()}`, from: f, to: t }];
                                setConnections(next);
                                saveToLocal(nodes, next);
                            }}
                            onDisconnect={(id) => {
                                const next = connections.filter(c => c.id !== id);
                                setConnections(next);
                                saveToLocal(nodes, next);
                            }}
                            activeNodeId={selectedNodeId}
                            isDaemonRunning={false}
                        />

                        {/* Node Palette (Floating Dock) */}
                        <div className="fixed left-8 top-1/2 -translate-y-1/2 z-[500] flex flex-col gap-6">
                            {Object.entries(NODE_TYPES).map(([cat, types]) => (
                                <div key={cat} className="flex flex-col gap-2 p-2 bg-white border border-slate-200 rounded-sm shadow-xl">
                                    <span className="text-[7px] font-black uppercase text-slate-300 tracking-widest text-center mb-1">{cat}</span>
                                    {Object.entries(types).map(([type, config]: [string, any]) => (
                                        <button 
                                            key={type}
                                            onClick={() => addNode(type, cat)}
                                            className={`w-10 h-10 flex items-center justify-center rounded-sm transition-all hover:scale-110 hover:shadow-lg ${config.bg} ${config.color} group relative`}
                                        >
                                            <span className="material-symbols-outlined text-[20px]">{config.icon}</span>
                                            <div className="absolute left-full ml-4 px-3 py-1.5 bg-black text-white text-[8px] font-black uppercase whitespace-nowrap rounded-sm opacity-0 group-hover:opacity-100 pointer-events-none transition-all tracking-widest translate-x-[-10px] group-hover:translate-x-0">
                                                Add {config.label}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ))}
                        </div>

                        <NodeInspector 
                            nodes={nodes} 
                            onUpdateNode={updateNodeData} 
                            onDeleteNode={deleteNode}
                        />
                    </>
                )}
            </div>
        </ModernDashboardLayout>
    );
}
