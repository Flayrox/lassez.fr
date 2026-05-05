'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Node {
    id: string;
    x: number;
    y: number;
    label: string;
    icon: string;
    type: string;
    color: string;
    bg: string;
    description?: string;
    settingKey?: string;
    settings?: string[];
}

interface Connection {
    id: string;
    from: string;
    to: string;
}

interface FlowCanvasProps {
    nodes: Node[];
    connections: Connection[];
    onNodeClick: (node: Node) => void;
    onNodeMove: (id: string, x: number, y: number) => void;
    onConnect: (from: string, to: string) => void;
    onDisconnect: (id: string) => void;
    activeNodeId: string | null;
    isDaemonRunning: boolean;
}

export function FlowCanvas({ nodes, connections, onNodeClick, onNodeMove, onConnect, onDisconnect, activeNodeId, isDaemonRunning }: FlowCanvasProps) {
    const [viewPort, setViewPort] = useState({ x: 0, y: 0, zoom: 1 });
    const [draggingConnection, setDraggingConnection] = useState<{ from: string, x: number, y: number } | null>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const isDraggingCanvas = useRef(false);

    // Grid size for snapping
    const GRID_SIZE = 20;

    // Zoom handler (Center-aware zoom)
    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            const newZoom = Math.min(Math.max(viewPort.zoom * delta, 0.1), 3);
            setViewPort(prev => ({ ...prev, zoom: newZoom }));
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('canvas-background')) {
            isDraggingCanvas.current = true;
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        // Handle Canvas Panning
        if (isDraggingCanvas.current) {
            setViewPort(prev => ({
                ...prev,
                x: prev.x + e.movementX,
                y: prev.y + e.movementY
            }));
        }
        
        // Handle Cable Dragging
        if (draggingConnection && canvasRef.current) {
            const rect = canvasRef.current.getBoundingClientRect();
            setDraggingConnection(prev => prev ? {
                ...prev,
                x: (e.clientX - rect.left - viewPort.x) / viewPort.zoom,
                y: (e.clientY - rect.top - viewPort.y) / viewPort.zoom
            } : null);
        }
    };

    const handleMouseUp = () => {
        isDraggingCanvas.current = false;
        setDraggingConnection(null);
    };

    const startConnection = (nodeId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const node = nodes.find(n => n.id === nodeId)!;
        setDraggingConnection({
            from: nodeId,
            x: node.x + 192, // Port X
            y: node.y + 40   // Port Y
        });
    };

    const endConnection = (nodeId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (draggingConnection && draggingConnection.from !== nodeId) {
            onConnect(draggingConnection.from, nodeId);
        }
        setDraggingConnection(null);
    };

    const getBezierPath = (startX: number, startY: number, endX: number, endY: number) => {
        const dx = Math.abs(endX - startX) * 0.5;
        const cp1x = startX + dx;
        const cp2x = endX - dx;
        return `M ${startX} ${startY} C ${cp1x} ${startY}, ${cp2x} ${endY}, ${endX} ${endY}`;
    };

    return (
        <div 
            ref={canvasRef}
            className="w-full h-full bg-[#f8fafc] relative overflow-hidden cursor-grab active:cursor-grabbing select-none canvas-background"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            {/* Grid Pattern */}
            <div 
                className="absolute inset-0 pointer-events-none"
                style={{
                    backgroundImage: `radial-gradient(#e2e8f0 1.5px, transparent 1.5px)`,
                    backgroundSize: `${GRID_SIZE * viewPort.zoom}px ${GRID_SIZE * viewPort.zoom}px`,
                    backgroundPosition: `${viewPort.x}px ${viewPort.y}px`,
                }}
            />

            <motion.div
                style={{ x: viewPort.x, y: viewPort.y, scale: viewPort.zoom, transformOrigin: '0 0' }}
                className="absolute inset-0 pointer-events-none"
            >
                <svg className="absolute inset-0 w-[10000px] h-[10000px] pointer-events-none">
                    <defs>
                        <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
                        </marker>
                    </defs>

                    {/* Existing Connections */}
                    {connections.map((conn) => {
                        const from = nodes.find(n => n.id === conn.from);
                        const to = nodes.find(n => n.id === conn.to);
                        if (!from || !to) return null;

                        const path = getBezierPath(from.x + 192, from.y + 40, to.x, to.y + 40);
                        const isActive = activeNodeId === from.id || activeNodeId === to.id;

                        return (
                            <g key={conn.id} className="group pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); onDisconnect(conn.id); }}>
                                <path d={path} stroke="transparent" strokeWidth={20} fill="none" />
                                <path
                                    d={path}
                                    stroke={isActive ? "#3b82f6" : "#cbd5e1"}
                                    strokeWidth={isActive ? 3 : 2}
                                    fill="none"
                                    className="transition-all duration-300 group-hover:stroke-red-400"
                                />
                                {(isActive || isDaemonRunning) && (
                                    <motion.path
                                        d={path}
                                        stroke="#3b82f6"
                                        strokeWidth={3}
                                        fill="none"
                                        strokeDasharray="10, 20"
                                        animate={{ strokeDashoffset: [0, -60] }}
                                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                        className="opacity-40"
                                    />
                                )}
                            </g>
                        );
                    })}

                    {/* Pending Connection Cable */}
                    {draggingConnection && (
                        <path
                            d={getBezierPath(draggingConnection.x, draggingConnection.y, nodes.find(n => n.id === draggingConnection.from)!.x + 192, nodes.find(n => n.id === draggingConnection.from)!.y + 40)}
                            stroke="#3b82f6"
                            strokeWidth={2}
                            strokeDasharray="5, 5"
                            fill="none"
                        />
                    )}
                </svg>

                {nodes.map((node) => (
                    <motion.div
                        key={node.id}
                        drag
                        dragMomentum={false}
                        onDrag={(e, info) => {
                            const newX = Math.round((node.x + info.delta.x / viewPort.zoom) / GRID_SIZE) * GRID_SIZE;
                            const newY = Math.round((node.y + info.delta.y / viewPort.zoom) / GRID_SIZE) * GRID_SIZE;
                            onNodeMove(node.id, newX, newY);
                        }}
                        style={{ x: node.x, y: node.y }}
                        className="absolute pointer-events-auto"
                    >
                        {/* Node Container */}
                        <div
                            onClick={(e) => { e.stopPropagation(); onNodeClick(node); }}
                            className={`w-48 group bg-white rounded-xl border transition-all duration-200 ${
                                activeNodeId === node.id 
                                    ? 'border-blue-500 ring-4 ring-blue-50 shadow-xl scale-105' 
                                    : 'border-slate-200 hover:border-slate-400 hover:shadow-md'
                            }`}
                        >
                            {/* Input Port */}
                            <div 
                                onMouseUp={(e) => endConnection(node.id, e)}
                                className="absolute -left-2 top-[34px] w-4 h-4 rounded-full bg-white border-2 border-slate-300 hover:border-blue-500 hover:scale-125 transition-all z-10 cursor-crosshair"
                            />

                            <div className="p-3 flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg ${node.bg} flex items-center justify-center shrink-0 shadow-sm`}>
                                    <span className={`material-symbols-outlined text-[20px] ${node.color}`}>{node.icon}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest truncate">{node.type}</p>
                                    <p className="text-[11px] font-bold text-slate-900 truncate">{node.label}</p>
                                </div>
                            </div>

                            {/* Output Port */}
                            <div 
                                onMouseDown={(e) => startConnection(node.id, e)}
                                className="absolute -right-2 top-[34px] w-4 h-4 rounded-full bg-white border-2 border-slate-300 hover:border-blue-500 hover:scale-125 transition-all z-10 cursor-crosshair"
                            />
                        </div>
                    </motion.div>
                ))}
            </motion.div>

            {/* Navigator Mini-Map */}
            <div className="absolute top-6 right-6 w-48 h-32 bg-white/60 backdrop-blur-md border border-slate-200 rounded-xl overflow-hidden shadow-2xl hidden md:block z-50">
                <div className="relative w-full h-full transform scale-[0.05] origin-top-left translate-x-4 translate-y-4">
                    {nodes.map(n => <div key={n.id} className={`absolute w-44 h-20 rounded-2xl ${n.bg} border-4 border-slate-300`} style={{ left: n.x, top: n.y }} />)}
                    <motion.div 
                        drag dragMomentum={false}
                        onDrag={(e, info) => setViewPort(prev => ({ ...prev, x: prev.x - info.delta.x * 20, y: prev.y - info.delta.y * 20 }))}
                        animate={{ left: -viewPort.x / viewPort.zoom, top: -viewPort.y / viewPort.zoom, width: canvasRef.current?.clientWidth ? canvasRef.current.clientWidth / viewPort.zoom : 1000, height: canvasRef.current?.clientHeight ? canvasRef.current.clientHeight / viewPort.zoom : 800 }}
                        className="absolute border-8 border-blue-500 bg-blue-500/10 rounded-3xl"
                    />
                </div>
            </div>

            {/* Footer Stats */}
            <div className="absolute bottom-6 left-6 flex items-center gap-3 z-50">
                <div className="bg-white/80 backdrop-blur-md border border-slate-200 rounded-xl px-4 py-2 shadow-lg flex items-center gap-6">
                    <div className="flex flex-col"><span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Nodes</span><span className="text-xs font-bold">{nodes.length}</span></div>
                    <div className="w-px h-6 bg-slate-100" />
                    <div className="flex flex-col"><span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Wiring</span><span className="text-xs font-bold">{connections.length}</span></div>
                    <div className="w-px h-6 bg-slate-100" />
                    <div className="flex flex-col"><span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Zoom</span><span className="text-xs font-bold">{Math.round(viewPort.zoom * 100)}%</span></div>
                </div>
                <div className="bg-blue-600 text-white rounded-xl px-4 py-2 shadow-lg text-[10px] font-bold uppercase tracking-widest">Manual Mode</div>
            </div>
        </div>
    );
}
