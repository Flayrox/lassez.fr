'use client';

import React, { useState, useEffect } from 'react';
import { ModernDashboardLayout } from '../components/ModernDashboardLayout';
import { useRadarAdmin } from '../components/RadarAdminContext';
import { FlowCanvas } from '@/app/(frontend)/radar-admin/flow/components/FlowCanvas';
import { FlowSidebar } from '@/app/(frontend)/radar-admin/flow/components/FlowSidebar';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';

const NODE_TYPES = {
    source: {
        'rss': { label: 'RSS Feed', icon: 'rss_feed', color: 'text-orange-500', bg: 'bg-orange-50', settingKey: 'rss_feeds', description: 'Monitor RSS news feeds' },
        'telegram': { label: 'Telegram', icon: 'send', color: 'text-blue-500', bg: 'bg-blue-50', settingKey: 'telegram_channels', description: 'Monitor Telegram channels' },
        'google-news': { label: 'Google News', icon: 'search', color: 'text-blue-600', bg: 'bg-blue-100', settingKey: 'google_news_queries', description: 'Monitor Google News search' },
        'x': { label: 'X / Twitter', icon: 'close', color: 'text-slate-900', bg: 'bg-slate-50', settingKey: 'x_accounts', description: 'Monitor X accounts' },
    },
    processor: {
        'dedup': { label: 'Deduplicator', icon: 'content_copy', color: 'text-purple-600', bg: 'bg-purple-50', description: 'Remove similar content', settings: ['dedup_similarity_threshold', 'dedup_recent_hours'] },
        'distribution': { label: 'Distribution', icon: 'share', color: 'text-indigo-600', bg: 'bg-indigo-50', description: 'Social Routing', settings: ['social_targets_by_type_json'] },
    },
    agent: {
        'research': { label: 'Researcher', icon: 'travel_explore', color: 'text-emerald-600', bg: 'bg-emerald-50', settings: ['ai_model_breaking', 'google_search_breaking_enabled'] },
        'editor': { label: 'Editorialist', icon: 'edit_note', color: 'text-amber-600', bg: 'bg-amber-50', settings: ['ai_model_main', 'ai_prompt'] },
        'validator': { label: 'Validator', icon: 'fact_check', color: 'text-rose-600', bg: 'bg-rose-50', settings: ['auto_approve_enabled', 'auto_pilot_enabled'] },
    },
    target: {
        'payload': { label: 'L\'Assez CMS', icon: 'publish', color: 'text-slate-900', bg: 'bg-slate-100' },
        'discord': { label: 'Discord', icon: 'chat', color: 'text-indigo-600', bg: 'bg-indigo-50' },
    }
};

const INITIAL_NODES = [
    { id: 'node-1', ...NODE_TYPES.source.rss, x: 80, y: 80 },
    { id: 'node-2', ...NODE_TYPES.source.telegram, x: 80, y: 180 },
    { id: 'node-3', ...(NODE_TYPES.source['google-news'] as any), x: 80, y: 280 },
    { id: 'node-4', ...NODE_TYPES.processor.dedup, x: 340, y: 180 },
    { id: 'node-5', ...NODE_TYPES.agent.research, x: 620, y: 80 },
    { id: 'node-6', ...NODE_TYPES.agent.editor, x: 620, y: 180 },
    { id: 'node-7', ...NODE_TYPES.agent.validator, x: 620, y: 280 },
    { id: 'node-8', ...NODE_TYPES.processor.distribution, x: 880, y: 180 },
    { id: 'node-9', ...NODE_TYPES.target.payload, x: 1140, y: 140 },
    { id: 'node-10', ...NODE_TYPES.target.discord, x: 1140, y: 240 },
];

const INITIAL_CONNECTIONS = [
    { id: 'c1', from: 'node-1', to: 'node-4' },
    { id: 'c2', from: 'node-2', to: 'node-4' },
    { id: 'c3', from: 'node-3', to: 'node-4' },
    { id: 'c4', from: 'node-4', to: 'node-5' },
    { id: 'c5', from: 'node-4', to: 'node-6' },
    { id: 'c6', from: 'node-4', to: 'node-7' },
    { id: 'c7', from: 'node-5', to: 'node-6' },
    { id: 'c8', from: 'node-6', to: 'node-7' },
    { id: 'c9', from: 'node-7', to: 'node-8' },
    { id: 'c10', from: 'node-8', to: 'node-9' },
    { id: 'c11', from: 'node-8', to: 'node-10' },
];

export default function FlowPage() {
    const { settings, fetchSettings, isDaemonRunning } = useRadarAdmin();
    const [nodes, setNodes] = useState(INITIAL_NODES);
    const [connections, setConnections] = useState(INITIAL_CONNECTIONS);
    const [editingNode, setEditingNode] = useState<any | null>(null);
    const [editValues, setEditValues] = useState<Record<string, any>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [showAddMenu, setShowAddMenu] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('radar-flow-pro-v4');
        if (saved) {
            try {
                const { nodes: sn, connections: sc } = JSON.parse(saved);
                setNodes(sn);
                setConnections(sc);
            } catch (e) { console.error(e); }
        }
    }, []);

    const saveToLocal = (newNodes: any, newConns: any) => {
        localStorage.setItem('radar-flow-pro-v4', JSON.stringify({ nodes: newNodes, connections: newConns }));
    };

    const handleNodeMove = (id: string, x: number, y: number) => {
        setNodes(prev => {
            const next = prev.map(n => n.id === id ? { ...n, x, y } : n);
            saveToLocal(next, connections);
            return next;
        });
    };

    const handleConnect = (from: string, to: string) => {
        // Prevent duplicate connections
        if (connections.some(c => c.from === from && c.to === to)) return;
        const newConn = { id: `c-${Date.now()}`, from, to };
        const nextConns = [...connections, newConn];
        setConnections(nextConns);
        saveToLocal(nodes, nextConns);
    };

    const handleDisconnect = (id: string) => {
        const nextConns = connections.filter(c => c.id !== id);
        setConnections(nextConns);
        saveToLocal(nodes, nextConns);
    };

    const deleteNode = (id: string) => {
        const nextNodes = nodes.filter(n => n.id !== id);
        const nextConns = connections.filter(c => c.from !== id && c.to !== id);
        setNodes(nextNodes);
        setConnections(nextConns);
        saveToLocal(nextNodes, nextConns);
        setEditingNode(null);
    };

    const addNode = (category: string, type: string) => {
        const config = (NODE_TYPES as any)[category][type];
        const newNode = { id: `node-${Date.now()}`, ...config, x: 200, y: 200 };
        const nextNodes = [...nodes, newNode];
        setNodes(nextNodes);
        saveToLocal(nextNodes, connections);
        setShowAddMenu(false);
    };

    const handleNodeClick = (node: any) => {
        setEditingNode(node);
        const vals: any = {};
        if (node.settingKey) {
            try { vals[node.settingKey] = JSON.parse(settings[node.settingKey] || '[]').join('\n'); } catch { vals[node.settingKey] = ''; }
        } else if (node.settings) {
            node.settings.forEach((key: string) => { vals[key] = settings[key]; });
        }
        setEditValues(vals);
    };

    const handleSave = async () => {
        if (!editingNode) return;
        setIsSaving(true);
        const payload: any = {};
        if (editingNode.settingKey) {
            const arr = editValues[editingNode.settingKey].split('\n').map((s: string) => s.trim()).filter(Boolean);
            payload[editingNode.settingKey] = JSON.stringify(arr);
        } else {
            Object.assign(payload, editValues);
        }
        try {
            await fetch('/api/radar/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            await fetchSettings();
            setEditingNode(null);
        } catch (e) { console.error(e); }
        finally { setIsSaving(false); }
    };

    return (
        <ModernDashboardLayout 
            title="Command Center" 
            subtitle="Autonomous Journalism Pipeline v4.0"
            fullBleed
            actions={
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setShowAddMenu(!showAddMenu)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl"
                    >
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        New Node
                    </button>
                    <Link href="/templates" className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl">
                        <span className="material-symbols-outlined text-[18px]">dashboard_customize</span>
                        Templates
                    </Link>
                </div>
            }
        >
            <div className="flex-1 relative bg-slate-50 flex flex-col">
                <FlowCanvas 
                    nodes={nodes} 
                    connections={connections} 
                    onNodeClick={handleNodeClick} 
                    onNodeMove={handleNodeMove}
                    onConnect={handleConnect}
                    onDisconnect={handleDisconnect}
                    activeNodeId={editingNode?.id || null}
                    isDaemonRunning={isDaemonRunning}
                />

                <AnimatePresence>
                    {showAddMenu && (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="absolute top-6 left-6 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[100] p-6 space-y-6"
                        >
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Node Library</h3>
                                <button onClick={() => setShowAddMenu(false)} className="material-symbols-outlined text-slate-300 text-sm hover:text-slate-900">close</button>
                            </div>
                            {Object.entries(NODE_TYPES).map(([category, types]) => (
                                <div key={category} className="space-y-2">
                                    <h4 className="text-[9px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-1">{category}</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        {Object.entries(types).map(([type, config]: [string, any]) => (
                                            <button key={type} onClick={() => addNode(category, type)} className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50 transition-all text-left">
                                                <span className={`material-symbols-outlined text-sm ${config.color}`}>{config.icon}</span>
                                                <span className="text-[10px] font-bold text-slate-700 truncate">{config.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </motion.div>
                    )}

                    {editingNode && (
                        <FlowSidebar 
                            editingNode={editingNode}
                            onClose={() => setEditingNode(null)}
                            editValues={editValues}
                            setEditValues={setEditValues}
                            onSave={handleSave}
                            onDelete={deleteNode}
                            isSaving={isSaving}
                        />
                    )}
                </AnimatePresence>
            </div>
        </ModernDashboardLayout>
    );
}
