'use client';

import { useRef, useState } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

/**
 * Hook to manage FFmpeg.WASM initialization and status.
 * Traces to REQ-STUDIO-REFACTOR.
 */
export function useFFmpeg() {
    const ffmpegRef = useRef<FFmpeg | null>(null);
    const [exportProgress, setExportProgress] = useState<string | null>(null);

    const loadFFmpeg = async () => {
        if (ffmpegRef.current) return ffmpegRef.current;
        
        const ffmpeg = new FFmpeg();
        setExportProgress("Chargement du moteur vidéo...");
        
        ffmpeg.on('log', ({ message }) => {
            console.log("FFMPEG LOG:", message);
        });

        // Use a stable version from unpkg
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
        try {
            await ffmpeg.load({
                coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
            });
            ffmpegRef.current = ffmpeg;
            return ffmpeg;
        } catch (error: any) {
            console.error("FFmpeg Load Error:", error);
            setExportProgress(`Erreur: ${error.message}`);
            throw error;
        }
    };

    return {
        ffmpegRef,
        exportProgress,
        setExportProgress,
        loadFFmpeg
    };
}
