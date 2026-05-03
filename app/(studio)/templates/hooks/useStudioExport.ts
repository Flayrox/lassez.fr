'use client';

import { useState } from 'react';
import { toPng } from 'html-to-image';
import { useStudio, SlideType } from '../components/StudioContext';
import { publishToRadar } from './useStudioPublish';
import { fetchFile } from '@ffmpeg/util';

export function useStudioExport(exportRef: React.RefObject<HTMLDivElement | null>, loadFFmpeg: () => Promise<any>, setExportProgress: (p: string | null) => void, postId?: string | null) {
    const { deck, activeId, setActiveId, activeSlide } = useStudio();
    const { articleInput } = useStudio();

    const embedImages = async (node: HTMLElement) => {
        const imgs = Array.from(node.querySelectorAll<HTMLImageElement>('img'));
        await Promise.all(imgs.map(async img => {
            const src = img.getAttribute('src') || img.src;
            if (!src || src.startsWith('data:') || src.startsWith('blob:')) return;
            
            // If already local or same origin, skip proxy
            if (src.startsWith('/') || src.startsWith(window.location.origin)) return;

            try {
                const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(src)}`;
                const res = await fetch(proxyUrl);
                if (!res.ok) throw new Error(`Proxy failed: ${res.status}`);
                const blob = await res.blob();
                const dataUrl = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
                img.setAttribute('src', dataUrl);
                img.src = dataUrl;
                
                await new Promise<void>(r => {
                    if (img.complete && img.naturalWidth > 0) { r(); return; }
                    img.onload = () => r();
                    img.onerror = () => r();
                    setTimeout(r, 2000);
                });
            } catch (e) { 
                console.warn('[Studio Export] Failed to proxy image:', src, e);
            }
        }));
    };

    const handleExport = async () => {
        if (!exportRef.current || !activeSlide) return;

        const template = activeSlide.type;

        if (template === 'VIDEO_NOTE') {
            const vn = activeSlide.state;
            const isYt = vn.videoUrl.includes('youtube') || vn.videoUrl.includes('youtu.be');
            const liveZone = exportRef.current.querySelector<HTMLElement>('[data-export="live"]');

            if (!isYt && vn.videoUrl && liveZone) {
                setExportProgress("Initialisation...");
                
                const exportRect = exportRef.current.getBoundingClientRect();
                const liveRect = liveZone.getBoundingClientRect();
                const scaleX = 1080 / exportRect.width;
                const scaleY = 1350 / exportRect.height;
                const vx = Math.round((liveRect.left - exportRect.left) * scaleX);
                const vy = Math.round((liveRect.top - exportRect.top) * scaleY);
                const vw = Math.round(liveRect.width * scaleX);
                const vh = Math.round(liveRect.height * scaleY);

                const vz = vn.videoZoom || 1;
                const vpx = vn.videoX || 0;
                const vpy = vn.videoY || 0;

                let overlayBase64: string;
                try {
                    const uiOverlays = exportRef.current.querySelectorAll<HTMLElement>('.edit-overlay,.edit-sticker,.brut-tb');
                    uiOverlays.forEach(el => el.style.display = 'none');
                    const liveNode = exportRef.current.querySelector<HTMLElement>('[data-export="live"]');
                    if (liveNode) liveNode.style.visibility = 'hidden';
                    
                    const prevBgClass = exportRef.current.classList.contains('bg-black');
                    if (prevBgClass) exportRef.current.classList.remove('bg-black');
                    exportRef.current.style.backgroundColor = 'rgba(0,0,0,0)';

                    overlayBase64 = await toPng(exportRef.current, {
                        quality: 1, pixelRatio: 2, canvasWidth: 1080, canvasHeight: 1350,
                        backgroundColor: 'rgba(0,0,0,0)', style: { margin: '0' },
                        filter: (node: Node) => !(node instanceof HTMLElement && (node.tagName === 'VIDEO' || node.tagName === 'IFRAME')),
                    });

                    if (liveNode) liveNode.style.visibility = 'visible';
                    if (prevBgClass) exportRef.current.classList.add('bg-black');
                    exportRef.current.style.backgroundColor = '';
                    uiOverlays.forEach(el => el.style.display = '');
                } catch (e) {
                    setExportProgress(null);
                    alert("Erreur capture template.");
                    return;
                }

                try {
                    const ffmpeg = await loadFFmpeg();
                    let videoBlob: Blob;
                    if (vn.videoUrl.startsWith('blob:')) {
                        setExportProgress("Préparation de la vidéo locale...");
                        const res = await fetch(vn.videoUrl);
                        videoBlob = await res.blob();
                    } else {
                        setExportProgress("Téléchargement de la vidéo...");
                        const videoRes = await fetch(`/api/proxy-image?url=${encodeURIComponent(vn.videoUrl)}`);
                        if (!videoRes.ok) throw new Error("Erreur proxy vidéo");
                        videoBlob = await videoRes.blob();
                    }

                    const vFile = await fetchFile(videoBlob);
                    const oFile = await fetchFile(overlayBase64);
                    await ffmpeg.writeFile('input.mp4', vFile);
                    await ffmpeg.writeFile('overlay.png', oFile);

                    setExportProgress("Montage vidéo...");
                    ffmpeg.on('progress', ({ progress }: any) => {
                        setExportProgress(`Montage: ${Math.round(progress * 100)}%`);
                    });

                    const filterComplex = [
                        `[0:v]scale='if(gt(a,${vw}/${vh}),-1,${vw})':'if(gt(a,${vw}/${vh}),${vh},-1)'[scaled]`,
                        `[scaled]scale=iw*${vz}:ih*${vz}[zoomed]`,
                        `[zoomed]crop=${vw}:${vh}:(iw-${vw})/2-${vpx * scaleX}:(ih-${vh})/2-${vpy * scaleY}[v]`,
                        `color=black:s=1080x1350:r=30:d=999[bg]`,
                        `[1:v]scale=1080:1350:force_original_aspect_ratio=disable[ov]`,
                        `[bg][v]overlay=${vx}:${vy}:shortest=1[base]`,
                        `[base][ov]overlay=0:0:shortest=0:format=auto,format=yuv420p[out]`,
                    ].join(';');

                    await ffmpeg.exec([
                        '-i', 'input.mp4', '-loop', '1', '-framerate', '30', '-i', 'overlay.png',
                        '-filter_complex', filterComplex, '-map', '[out]', '-map', '0:a?',
                        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-c:a', 'aac', '-shortest', 'output.mp4',
                    ]);

                    const data = await ffmpeg.readFile('output.mp4');
                    const blob = new Blob([data as any], { type: 'video/mp4' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `lassez-${activeSlide.label.replace(/\s+/g, '-').toLowerCase()}.mp4`;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 5000);
                    setExportProgress(null);
                } catch (e: any) {
                    setExportProgress(null);
                    alert(`Erreur export: ${e.message}`);
                }
                return;
            }

            // PNG fallback for YouTube/No URL
            const staticZone = exportRef.current.querySelector<HTMLElement>('[data-export="static"]');
            const prevLive = liveZone?.style.display ?? '';
            const prevStatic = staticZone?.style.display ?? '';
            if (liveZone) liveZone.style.display = 'none';
            if (staticZone) staticZone.style.display = 'flex';
            await new Promise(r => setTimeout(r, 80));
            try {
                const overlays = exportRef.current.querySelectorAll<HTMLElement>('.edit-overlay,.edit-sticker,.brut-tb');
                overlays.forEach(el => el.style.display = 'none');
                const dataUrl = await toPng(exportRef.current, { quality: 1, pixelRatio: 2, canvasWidth: 1080, canvasHeight: 1350 });
                overlays.forEach(el => el.style.display = '');
                    const a = document.createElement('a');
                    a.download = `lassez-${activeSlide.label.replace(/\s+/g, '-').toLowerCase()}.png`;
                    a.href = dataUrl; a.click();

                    // If this export is linked to a Radar post, send to publish endpoint
                    if (postId) {
                        try {
                            const title = (articleInput || activeSlide.state.headline || '').split('\n')[0] || null;
                            const content = articleInput || null;
                            publishToRadar(postId, title, content, dataUrl);
                        } catch (e) { /* ignore */ }
                    }
            } catch (e) { }
            if (liveZone) liveZone.style.display = prevLive;
            if (staticZone) staticZone.style.display = prevStatic;
            return;
        }

            try {
                await embedImages(exportRef.current);
                await new Promise(r => setTimeout(r, 100)); // Cool down
                
                const overlays = exportRef.current.querySelectorAll<HTMLElement>('.edit-overlay,.edit-sticker,.brut-tb');
                overlays.forEach(el => el.style.display = 'none');
                
                const dataUrl = await toPng(exportRef.current, { 
                    quality: 1, 
                    pixelRatio: 2, 
                    canvasWidth: 1080, 
                    canvasHeight: 1350,
                    cacheBust: true,
                });
                
                overlays.forEach(el => el.style.display = '');
                
                const a = document.createElement('a');
                a.download = `lassez-${activeSlide.label?.replace(/\s+/g, '-').toLowerCase() || 'slide'}.png`;
                a.href = dataUrl; a.click();

                if (postId) {
                    try {
                        const title = (articleInput || activeSlide.state.headline || '').split('\n')[0] || null;
                        const content = articleInput || null;
                        publishToRadar(postId, title, content, dataUrl);
                    } catch (e) { /* ignore */ }
                }
            } catch (e: any) { 
                console.error('[Studio Export] PNG Error:', e);
                alert(`Erreur d'export : ${e instanceof Error ? e.message : 'Problème de ressources (images/polices)'}`);
            }
    };

    const handleExportAll = async () => {
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        const currentId = activeId;
        
        for (let i = 0; i < deck.length; i++) {
            setActiveId(deck[i].id);
            await new Promise(r => setTimeout(r, 400));
            if (!exportRef.current) continue;
            await embedImages(exportRef.current);
            const overlays = exportRef.current.querySelectorAll<HTMLElement>('.edit-overlay,.edit-sticker,.brut-tb');
            overlays.forEach(el => el.style.display = 'none');
            const dataUrl = await toPng(exportRef.current, { quality: 1, pixelRatio: 2, canvasWidth: 1080, canvasHeight: 1350 });
            overlays.forEach(el => el.style.display = '');
            const b64 = dataUrl.split(',')[1];
            zip.file(`slide-${String(i + 1).padStart(2, '0')}-${deck[i].type.toLowerCase()}.png`, b64, { base64: true });
        }
        
        const blob = await zip.generateAsync({ type: 'blob' });
        const a = document.createElement('a'); a.download = `lassez-deck-${Date.now()}.zip`;
        a.href = URL.createObjectURL(blob); a.click();
        setActiveId(currentId);
    };

    const handleExportJSON = () => {
        const cleanDeck = deck.map(s => ({ type: s.type, state: s.state }));
        const jsonStr = JSON.stringify({ deck: cleanDeck }, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const a = document.createElement('a');
        a.download = `lassez-deck-${Date.now()}.json`;
        a.href = URL.createObjectURL(blob);
        a.click();
    };

    return { handleExport, handleExportAll, handleExportJSON };
}
