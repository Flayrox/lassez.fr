'use client';

import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { motion, useDragControls, AnimatePresence } from 'framer-motion';
import { useUI } from '../../context/UIContext';

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
    settings?: any[];
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
    onNodeMoveEnd: () => void;
    onConnect: (from: string, to: string) => void;
    onDisconnect: (id: string) => void;
    activeNodeId: string | null;
    isDaemonRunning: boolean;
}

// Memoized Connection Path for performance
const ConnectionLine = memo(({ conn, nodes, onDisconnect }: { conn: Connection, nodes: Node[], onDisconnect: (id: string) => void }) => {
    const fromNode = nodes.find(n => n.id === conn.from);
    const toNode = nodes.find(n => n.id === conn.to);
    if (!fromNode || !toNode) return null;
    
    const x1 = fromNode.x + 192;
    const y1 = fromNode.y + 30; // Aligned with ports
    const x2 = toNode.x;
    const y2 = toNode.y + 30;

    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    const getSmartPath = (x1: number, y1: number, x2: number, y2: number) => {
        const dx = Math.abs(x2 - x1);
        const horizontalControl = Math.min(dx / 1.5, 150);
        return `M ${x1} ${y1} C ${x1 + horizontalControl} ${y1}, ${x2 - horizontalControl} ${y2}, ${x2} ${y2}`;
    };

    return (
        <g className="group pointer-events-auto cursor-default">
            <path d={getSmartPath(x1, y1, x2, y2)} fill="none" stroke="#e2e8f0" strokeWidth="4" className="transition-all duration-300 group-hover:stroke-blue-50 opacity-0 group-hover:opacity-100" />
            <path d={getSmartPath(x1, y1, x2, y2)} fill="none" stroke="#e2e8f0" strokeWidth="1" className="group-hover:stroke-blue-500 transition-colors" />
            <g transform={`translate(${midX - 12}, ${midY - 12})`} className="opacity-0 group-hover:opacity-100 transition-all cursor-pointer" onClick={(e) => { e.stopPropagation(); onDisconnect(conn.id); }}>
                <circle r="12" cx="12" cy="12" fill="white" className="shadow-sm" stroke="#e2e8f0" strokeWidth="1" />
                <text x="12" y="17" textAnchor="middle" fontSize="14" fill="#64748b" fontWeight="bold" className="select-none font-sans">×</text>
            </g>
        </g>
    );
});

ConnectionLine.displayName = 'ConnectionLine';

export function FlowCanvas({ nodes, connections, onNodeClick, onNodeMove, onNodeMoveEnd, onConnect, onDisconnect, activeNodeId, isDaemonRunning }: FlowCanvasProps) {
    const [viewPort, setViewPort] = useState({ x: 0, y: 0, zoom: 1 });
    const [draggingConnection, setDraggingConnection] = useState<{ from: string, startX: number, startY: number, currentX: number, currentY: number } | null>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const isDraggingCanvas = useRef(false);

    const GRID_SIZE = 20;

    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            const newZoom = Math.min(Math.max(viewPort.zoom * delta, 0.15), 2.5);
            setViewPort(prev => ({ ...prev, zoom: newZoom }));
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.target === canvasRef.current) isDraggingCanvas.current = true;
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDraggingCanvas.current) {
            setViewPort(prev => ({ ...prev, x: prev.x + e.movementX, y: prev.y + e.movementY }));
        }
        if (draggingConnection) {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (rect) {
                setDraggingConnection(prev => prev ? ({
                    ...prev,
                    currentX: (e.clientX - rect.left - viewPort.x) / viewPort.zoom,
                    currentY: (e.clientY - rect.top - viewPort.y) / viewPort.zoom
                }) : null);
            }
        }
    };

    const handleMouseUp = () => {
        isDraggingCanvas.current = false;
        setDraggingConnection(null);
    };

    return (
        <div 
            ref={canvasRef} onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
            className="w-full h-full absolute inset-0 bg-[#fafafa] overflow-hidden cursor-auto selection:bg-none"
            style={{ 
                backgroundImage: 'radial-gradient(#cbd5e1 0.75px, transparent 0.75px)',
                backgroundSize: `${32 * viewPort.zoom}px ${32 * viewPort.zoom}px`,
                backgroundPosition: `${viewPort.x}px ${viewPort.y}px`
            }}
        >
            <motion.div style={{ x: viewPort.x, y: viewPort.y, scale: viewPort.zoom, transformOrigin: '0 0' }} className="absolute inset-0 pointer-events-none">
                <svg className="absolute inset-0 w-[10000px] h-[10000px] overflow-visible">
                    {connections.map(conn => (
                        <ConnectionLine key={conn.id} conn={conn} nodes={nodes} onDisconnect={onDisconnect} />
                    ))}

                    {draggingConnection && (
                        <path
                            d={`M ${draggingConnection.startX} ${draggingConnection.startY} L ${draggingConnection.currentX} ${draggingConnection.currentY}`}
                            fill="none" stroke="#3b82f6" strokeWidth="1" strokeDasharray="4 4"
                        />
                    )}
                </svg>

                {nodes.map(node => (
                    <NodeComponent 
                        key={node.id} node={node} viewPort={viewPort} GRID_SIZE={GRID_SIZE} activeNodeId={activeNodeId}
                        onNodeMove={onNodeMove} onNodeMoveEnd={onNodeMoveEnd} onNodeClick={onNodeClick}
                        onStartConnection={(x, y) => setDraggingConnection({ from: node.id, startX: x, startY: y, currentX: x, currentY: y })}
                        onEndConnection={() => {
                            if (draggingConnection && draggingConnection.from !== node.id) onConnect(draggingConnection.from, node.id);
                        }}
                    />
                ))}
            </motion.div>

            {/* Zoom Widget */}
            <div className="absolute top-8 right-8 z-50 flex flex-col items-end gap-4">
                <div className="bg-white border border-slate-200 rounded-sm shadow-sm flex flex-col overflow-hidden">
                    <button onClick={() => setViewPort(v => ({ ...v, zoom: Math.min(v.zoom * 1.2, 2.5) }))} className="w-8 h-8 flex items-center justify-center hover:bg-slate-50 border-b border-slate-100 transition-all">
                        <span className="material-symbols-outlined text-slate-400 text-[18px]">add</span>
                    </button>
                    <button onClick={() => setViewPort(v => ({ ...v, zoom: Math.max(v.zoom / 1.2, 0.15) }))} className="w-8 h-8 flex items-center justify-center hover:bg-slate-50 border-b border-slate-100 transition-all">
                        <span className="material-symbols-outlined text-slate-400 text-[18px]">remove</span>
                    </button>
                    <button onClick={() => setViewPort({ x: 0, y: 0, zoom: 1 })} className="w-8 h-8 flex items-center justify-center hover:bg-slate-50 transition-all">
                        <span className="material-symbols-outlined text-slate-400 text-[18px]">center_focus_strong</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

const NodeComponent = memo(({ node, viewPort, GRID_SIZE, activeNodeId, onNodeMove, onNodeMoveEnd, onNodeClick, onStartConnection, onEndConnection }: any) => {
    const dragControls = useDragControls();
    const { setSelectedNodeId } = useUI();
    const startPos = useRef({ x: node.x, y: node.y });

    return (
        <motion.div
            drag dragControls={dragControls} dragListener={false} dragMomentum={false}
            onDragStart={(e) => { e.stopPropagation(); startPos.current = { x: node.x, y: node.y }; }}
            onDrag={(e, info) => {
                const newX = Math.round((startPos.current.x + info.offset.x / viewPort.zoom) / GRID_SIZE) * GRID_SIZE;
                const newY = Math.round((startPos.current.y + info.offset.y / viewPort.zoom) / GRID_SIZE) * GRID_SIZE;
                onNodeMove(node.id, newX, newY);
            }}
            onDragEnd={onNodeMoveEnd}
            style={{ x: node.x, y: node.y }}
            className="absolute pointer-events-auto"
        >
            <div className={`w-48 group bg-white rounded-sm border transition-all duration-200 ${ activeNodeId === node.id ? 'border-black ring-4 ring-slate-100 shadow-xl' : 'border-slate-200 shadow-sm hover:border-slate-300' }`}>
                <motion.div 
                    onPointerDown={(e) => { e.stopPropagation(); dragControls.start(e); }}
                    onTap={() => { setSelectedNodeId(node.id); onNodeClick(node); }}
                    className="p-3.5 flex items-center gap-3.5 cursor-grab active:cursor-grabbing select-none"
                >
                    <div className={`w-9 h-9 rounded-sm ${node.bg} flex items-center justify-center shrink-0 border border-slate-100`}>
                        <span className={`material-symbols-outlined text-[18px] ${node.color}`}>{node.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest truncate">{node.type}</p>
                        <p className="text-[11px] font-black text-black truncate leading-tight mt-0.5">{node.label}</p>
                    </div>
                </motion.div>

                {/* Ports - Payload Precision Style */}
                <div onPointerUp={(e) => { e.stopPropagation(); onEndConnection(); }} onPointerDown={(e) => e.stopPropagation()} className="absolute -left-1.5 top-[25px] w-3 h-3 flex items-center justify-center z-[130] cursor-crosshair group-hover:scale-125 transition-all">
                    <div className="w-1.5 h-1.5 rounded-full bg-white border border-slate-200 group-hover:border-black shadow-sm" />
                </div>
                <div onPointerDown={(e) => { e.stopPropagation(); onStartConnection(node.x + 192, node.y + 30); }} className="absolute -right-1.5 top-[25px] w-3 h-3 flex items-center justify-center z-[130] cursor-crosshair group-hover:scale-125 transition-all">
                    <div className="w-1.5 h-1.5 rounded-full bg-white border border-slate-200 group-hover:border-black shadow-sm" />
                </div>
            </div>
        </motion.div>
    );
});

NodeComponent.displayName = 'NodeComponent';
