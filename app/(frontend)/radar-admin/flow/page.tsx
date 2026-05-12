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

const DEFAULT_PROMPT = "(Géré par les blocs de prompt en base de données)";

const NODE_TYPES = {
    inbound: {
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
    },
    pipeline: {
        'ingestion': { 
            label: 'Ingestion (N1)', icon: 'sensors', color: 'text-slate-900', bg: 'bg-slate-100', 
            settings: [
                { key: 'scrapingInterval', label: 'Polling Interval (min)', value: '60' },
                { key: 'rss_lookback_hours', label: 'Lookback Period (h)', value: '24' }
            ]
        },
        'dedup': { 
            label: 'Deduplicator (N2)', icon: 'content_copy', color: 'text-purple-600', bg: 'bg-purple-50', 
            settings: [
                { key: 'similarityThreshold', label: 'Similarity Threshold', value: '0.45' },
                { key: 'dedupLookbackHours', label: 'Deduplication Lookback (h)', value: '24' }
            ] 
        },
        'research': { 
            label: 'Researcher (N3)', icon: 'psychology', color: 'text-emerald-600', bg: 'bg-emerald-50', 
            settings: [
                { key: 'aiModelFlash', label: 'AI Model (Flash)', value: 'gemini-3.1-flash-lite-preview' },
                { key: 'max_articles', label: 'Max Articles/Scan', value: '5' },
                { key: 'max_concurrent_tasks', label: 'Concurrency limit', value: '3' }
            ] 
        },
        'editor': { 
            label: 'Editorialist (N4)', icon: 'edit_note', color: 'text-amber-600', bg: 'bg-amber-50', 
            settings: [
                { key: 'aiModelPro', label: 'AI Model (Pro)', value: 'gemini-3.1-pro-preview' }
            ] 
        },
        'validator': { 
            label: 'Validator (N5)', icon: 'fact_check', color: 'text-rose-600', bg: 'bg-rose-50', 
            settings: [{ key: 'aiModelValidator', label: 'AI Model (Lite)', value: 'gemini-3.1-flash-lite-preview' }] 
        },
        'media': { 
            label: 'Media (N6)', icon: 'image', color: 'text-indigo-600', bg: 'bg-indigo-50', 
            settings: [{ key: 'allowSourceImages', label: 'Allow Source Images', value: true }] 
        },
    },
    outbound: {
        'publisher': { 
            label: 'Publisher (N7)', icon: 'rocket_launch', color: 'text-rose-600', bg: 'bg-rose-50', 
            settings: [
                { key: 'enableAutoPublish', label: 'Auto-publish', value: true },
                { key: 'minPublishDelay', label: 'Min Delay (min)', value: '60' }
            ] 
        },
        'matrix': { 
            label: 'Social Matrix', icon: 'share', color: 'text-blue-600', bg: 'bg-blue-50', 
            settings: [
                { key: 'enableDiscord', label: 'Discord', value: true },
                { key: 'enableX', label: 'X (Twitter)', value: false },
                { key: 'enableMastodon', label: 'Mastodon', value: false },
                { key: 'enableBluesky', label: 'Bluesky', value: false },
                { key: 'enablePayloadCMS', label: 'Payload CMS', value: true },
            ] 
        },
    }
};

const INITIAL_NODES: Node[] = [
    { id: 'in-rss', x: 80, y: 150, label: 'RSS Feed', type: 'rss', icon: 'rss_feed', color: 'text-orange-500', bg: 'bg-orange-50', settings: NODE_TYPES.inbound.rss.settings },
    { id: 'in-telegram', x: 80, y: 280, label: 'Telegram', type: 'telegram', icon: 'send', color: 'text-blue-500', bg: 'bg-blue-50', settings: NODE_TYPES.inbound.telegram.settings },
    
    { id: 'p-ingestion', x: 300, y: 220, label: 'Ingestion (N1)', type: 'ingestion', icon: 'sensors', color: 'text-slate-900', bg: 'bg-slate-100', settings: NODE_TYPES.pipeline.ingestion.settings },
    { id: 'p-dedup', x: 520, y: 220, label: 'Deduplicator (N2)', type: 'dedup', icon: 'content_copy', color: 'text-purple-600', bg: 'bg-purple-50', settings: NODE_TYPES.pipeline.dedup.settings },
    { id: 'p-research', x: 740, y: 220, label: 'Researcher (N3)', type: 'research', icon: 'psychology', color: 'text-emerald-600', bg: 'bg-emerald-50', settings: NODE_TYPES.pipeline.research.settings },
    { id: 'p-editor', x: 960, y: 220, label: 'Editorialist (N4)', type: 'editor', icon: 'edit_note', color: 'text-amber-600', bg: 'bg-amber-50', settings: NODE_TYPES.pipeline.editor.settings },
    { id: 'p-validator', x: 1180, y: 220, label: 'Validator (N5)', type: 'validator', icon: 'fact_check', color: 'text-rose-600', bg: 'bg-rose-50', settings: NODE_TYPES.pipeline.validator.settings },
    { id: 'p-media', x: 1400, y: 220, label: 'Media (N6)', type: 'media', icon: 'image', color: 'text-indigo-600', bg: 'bg-indigo-50', settings: NODE_TYPES.pipeline.media.settings },
    
    { id: 'p-publisher', x: 1620, y: 220, label: 'Publisher (N7)', type: 'publisher', icon: 'rocket_launch', color: 'text-rose-600', bg: 'bg-rose-50', settings: NODE_TYPES.outbound.publisher.settings },
    { id: 'out-matrix', x: 1840, y: 220, label: 'Social Matrix', type: 'matrix', icon: 'share', color: 'text-blue-600', bg: 'bg-blue-50', settings: NODE_TYPES.outbound.matrix.settings },
];

const INITIAL_CONNECTIONS: Connection[] = [
    { id: 'c1', from: 'in-rss', to: 'p-ingestion' },
    { id: 'c2', from: 'in-telegram', to: 'p-ingestion' },
    { id: 'c3', from: 'p-ingestion', to: 'p-dedup' },
    { id: 'c4', from: 'p-dedup', to: 'p-research' },
    { id: 'c5', from: 'p-research', to: 'p-editor' },
    { id: 'c6', from: 'p-editor', to: 'p-validator' },
    { id: 'c7', from: 'p-validator', to: 'p-media' },
    { id: 'c8', from: 'p-media', to: 'p-publisher' },
    { id: 'c9', from: 'p-publisher', to: 'out-matrix' },
];

export default function FlowPage() {
    const { settings, fetchSettings } = useRadarAdmin();
    const [nodes, setNodes] = useState<Node[]>([]);
    const [connections, setConnections] = useState<Connection[]>([]);
    const [isHydrated, setIsHydrated] = useState(false);
    const [isDeploying, setIsDeploying] = useState(false);
    const [scannerState, setScannerState] = useState<{status: string, message: string}>({status: 'idle', message: ''});
    const { selectedNodeId, setSelectedNodeId } = useUI();

    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const res = await fetch('/api/radar/daemon-status');
                const data = await res.json();
                if (data.success && data.status) {
                    setScannerState({
                        status: data.status.scanner_status,
                        message: data.status.scanner_message
                    });
                }
            } catch(e) {}
        }, 3000);
        return () => clearInterval(interval);
    }, []);

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
        const loadGraph = async () => {
            let loadedNodes = INITIAL_NODES;
            let loadedConns = INITIAL_CONNECTIONS;
            
            try {
                const res = await fetch('/api/radar/settings');
                const data = await res.json();
                if (data.success && data.settings?.pipelineGraphJson) {
                    const parsed = JSON.parse(data.settings.pipelineGraphJson);
                    if (parsed.nodes && parsed.nodes.length > 0) {
                        loadedNodes = parsed.nodes;
                        loadedConns = parsed.connections || [];
                    }
                }
            } catch (e) {
                console.warn("Could not load graph from DB, falling back to local/default", e);
            }

            const enrichedNodes = loadedNodes.map((node: any) => {
                let baseConfig = null;
                for (const cat of Object.values(NODE_TYPES)) {
                    const match = Object.entries(cat).find(([k, v]) => v.label === node.label || k === node.type);
                    if (match) { baseConfig = match[1]; break; }
                }
                const settingsToUse = (node.settings && node.settings.length > 0) ? node.settings : (baseConfig?.settings || []);
                return { ...node, settings: settingsToUse };
            });
            setNodes(enrichedNodes);
            setConnections(loadedConns);
            setIsHydrated(true);
        };
        
        loadGraph();
    }, []);

    const updateNodeData = async (id: string, updates: any) => {
        // Just update local graph UI state (Draft mode)
        const nextNodes = nodes.map(n => n.id === id ? { ...n, ...updates } : n);
        setNodes(nextNodes);
        saveToLocal(nextNodes, connections);
        
        // Push settings straight to DB ONLY when we click "Apply Config" which uses full graph deploy later,
        // BUT NodeInspector still calls this to save settings individually. 
        // We will make NodeInspector only call this on "Apply Config" so we CAN persist here,
        // meaning when we arrive here, it's explicitly triggered by the user.
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
                        // For booleans passed as true/false or 'true'/'false'
                        if (s.value === 'true') payload[s.key] = true;
                        else if (s.value === 'false') payload[s.key] = false;
                        else payload[s.key] = s.value;
                    }
                }
            });
            
            try {
                const res = await fetch('/api/radar/settings', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!res.ok) throw new Error('Sync failed');
                await fetchSettings(); // Refresh global settings to reflect changes
            } catch (e) {
                console.error("Partial sync failed", e);
                throw e;
            }
        }
    };
    
    const handleDeploy = async () => {
        setIsDeploying(true);
        try {
            const res = await fetch('/api/radar/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pipelineGraphJson: JSON.stringify({ nodes, connections })
                })
            });
            
            if (!res.ok) throw new Error('Deploy failed');
            
            await fetch('/api/radar/trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'scan' })
            });

            alert('Pipeline déployée et synchronisée avec le Daemon ! Le scan démarre...');
        } catch (e) {
            console.error(e);
            alert('Échec du déploiement. Vérifiez la console.');
        } finally {
            setIsDeploying(false);
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
        <ModernDashboardLayout title="Orchestrateur (Flow)" fullBleed={true} actions={
            <div className="flex items-center gap-2">
                <button 
                    onClick={handleReset} 
                    className="h-8 px-4 border border-slate-200 text-[11px] font-medium rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 text-slate-600 shadow-sm"
                >
                    <span className="material-symbols-outlined text-[14px]">undo</span>
                    Reset Template
                </button>
                <button 
                    onClick={handleDeploy} 
                    disabled={isDeploying}
                    className={`h-8 px-5 bg-slate-900 text-white text-[11px] font-medium rounded-lg shadow-md hover:bg-black transition-all flex items-center gap-2 ${isDeploying ? 'opacity-70 cursor-not-allowed' : 'hover:scale-[1.02]'}`}
                >
                    {isDeploying ? (
                        <>
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Synchronisation...
                        </>
                    ) : (
                        <>
                            <span className="material-symbols-outlined text-[14px]">cloud_upload</span>
                            Déployer le Graphe
                        </>
                    )}
                </button>
            </div>
        }>
            <div className="flex-1 relative w-full h-full overflow-hidden bg-slate-50/50">
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                
                {/* Scanner Status Badge (Top Center) */}
                {scannerState.status !== 'idle' && scannerState.status !== undefined && scannerState.status !== 'ok' && scannerState.status !== 'late' && scannerState.status !== 'paused' && scannerState.status !== 'unknown' && scannerState.status !== 'running' && (
                    <motion.div 
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="absolute top-6 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900/90 backdrop-blur-md text-white shadow-xl rounded-full px-5 py-2 flex items-center gap-3 border border-slate-700/50"
                    >
                        <span className="material-symbols-outlined text-emerald-400 animate-spin text-[16px]">autorenew</span>
                        <span className="text-[11px] font-medium tracking-wide">{scannerState.message || scannerState.status}</span>
                    </motion.div>
                )}
                
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

                        <div className="fixed left-6 top-1/2 -translate-y-1/2 z-[500] flex flex-col gap-3">
                            {Object.entries(NODE_TYPES).map(([cat, types]) => (
                                <div key={cat} className="flex flex-col gap-1.5 p-1.5 bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-xl shadow-xl">
                                    <span className="text-[8px] font-bold uppercase text-slate-400 tracking-wider text-center mb-1">{cat}</span>
                                    {Object.entries(types).map(([type, config]: [string, any]) => (
                                        <button 
                                            key={type}
                                            onClick={() => addNode(type, cat)}
                                            className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 ${config.color} group relative`}
                                        >
                                            <span className="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform">{config.icon}</span>
                                            <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 text-white text-[10px] font-medium whitespace-nowrap rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-x-[-8px] group-hover:translate-x-0 shadow-lg">
                                                Add {config.label}
                                                <div className="absolute left-[-4px] top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-slate-900"></div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ))}
                        </div>

                        <NodeInspector 
                            nodes={nodes} 
                            settings={settings}
                            onUpdateNode={updateNodeData} 
                            onDeleteNode={deleteNode}
                        />
                    </>
                )}
            </div>
        </ModernDashboardLayout>
    );
}
