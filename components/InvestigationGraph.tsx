'use client';

import React, { useMemo, useRef, useState, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useRouter } from 'next/navigation';
import { usePosts } from '../hooks/usePosts';
import { useCategories } from '../hooks/useCategories';
import { getArticleUrl } from '../lib/getArticleUrl';

function getRenderedField(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object' && 'rendered' in value) {
        const rendered = (value as { rendered?: unknown }).rendered;
        return typeof rendered === 'string' ? rendered : '';
    }
    return '';
}

function toIdArray(values: unknown): number[] {
    if (!Array.isArray(values)) return [];
    return values
        .map((item) => (typeof item === 'object' && item !== null ? (item as { id?: unknown }).id : item))
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id));
}

const InvestigationGraph: React.FC = () => {
    const { posts: postsData, isLoading: postsLoading } = usePosts({ perPage: 50, depth: 1 });
    const { categories: categoriesData, isLoading: categoriesLoading } = useCategories();
    const router = useRouter();
    const graphRef = useRef<any>(null);
    const [highlightNodes, setHighlightNodes] = useState(new Set());
    const [highlightLinks, setHighlightLinks] = useState(new Set());
    const [hoverNode, setHoverNode] = useState<any | null>(null);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const data = useMemo(() => {
        if (!postsData || !categoriesData) return { nodes: [], links: [] };

        const nodes = postsData.map((post: any) => ({
            id: post.id,
            name: getRenderedField(post.title),
            val: 1,
            group: toIdArray(post.categories)[0] || 0,
            slug: post.slug,
            tags: toIdArray(post.tags),
            categories: toIdArray(post.categories),
            post
        }));

        const links: any[] = [];

        // Connect posts that share TAGS (Etiquettes)
        // We do NOT use categories to avoid linking everything in 'Enquêtes' together
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const nodeA = nodes[i];
                const nodeB = nodes[j];

                // Find common TAGS
                const commonTags = nodeA.tags.filter((tagId: number) =>
                    nodeB.tags.includes(tagId)
                );

                if (commonTags.length > 0) {
                    links.push({
                        source: nodeA.id,
                        target: nodeB.id,
                        common: commonTags
                    });
                }
            }
        }

        return { nodes, links };
    }, [postsData, categoriesData]);

    if (!isMounted) return <div className="w-full h-[calc(100vh-80px)] bg-black text-white flex items-center justify-center">Initialisation...</div>;

    const isLoading = postsLoading || categoriesLoading;

    const handleNodeClick = (node: any) => {
        router.push(getArticleUrl(node.post));
    };

    const handleNodeHover = (node: any) => {
        setHoverNode(node || null);
        const newHighlightNodes = new Set();
        const newHighlightLinks = new Set();

        if (node) {
            newHighlightNodes.add(node);
            data.links.forEach(link => {
                if (link.source.id === node.id || link.target.id === node.id) {
                    newHighlightLinks.add(link);
                    newHighlightNodes.add(link.source);
                    newHighlightNodes.add(link.target);
                }
            });
        }

        setHighlightNodes(newHighlightNodes);
        setHighlightLinks(newHighlightLinks);
    };

    return (
        <div className="w-full h-[calc(100vh-80px)] bg-black text-white relative overflow-hidden border-2 border-lassez-border">
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center z-20 bg-black">
                    <p className="animate-pulse font-mono text-lassez-red">CHARGEMENT DU GRAPHE...</p>
                </div>
            )}

            <div className="absolute top-4 left-4 z-10 bg-black/80 border border-lassez-border p-4 max-w-sm pointer-events-none">
                <h2 className="text-xl font-black uppercase text-lassez-red mb-2">Cartographie</h2>
                <p className="text-xs font-mono text-gray-400">
                    Visualisez les connexions entre les dossiers. Les liens représentent des thématiques communes.
                </p>
                {hoverNode && (
                    <div className="mt-4 pt-4 border-t border-gray-800 animate-in fade-in slide-in-from-bottom-2">
                        <span className="text-xs uppercase text-lassez-red">Dossier identifié :</span>
                        <p className="font-bold text-lg leading-tight mt-1">{hoverNode.name}</p>
                    </div>
                )}
            </div>

            <ForceGraph2D
                ref={graphRef}
                graphData={data}
                nodeLabel="name"
                nodeColor={node => highlightNodes.has(node) ? '#ff2a2a' : (node === hoverNode ? '#ff2a2a' : '#ffffff')}
                linkColor={link => highlightLinks.has(link) ? '#ff2a2a' : 'rgba(255,255,255,0.1)'}
                linkWidth={link => highlightLinks.has(link) ? 2 : 1}
                width={window.innerWidth} // Should probably be responsive container
                backgroundColor="#000000"
                onNodeClick={handleNodeClick}
                onNodeHover={handleNodeHover}
                nodeRelSize={6}
                cooldownTicks={100}
                onEngineStop={() => graphRef.current?.zoomToFit(400)}
            />
        </div>
    );
};

export default InvestigationGraph;
