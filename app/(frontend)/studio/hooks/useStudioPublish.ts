'use client';

export async function publishToRadar(postId: number | string, titre: string | null, content: string | null, imageDataUrl: string | null) {
    try {
        const res = await fetch('/api/radar/studio-publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: postId, titre, content, imageBase64: imageDataUrl })
        });
        return await res.json();
    } catch (e) {
        return { success: false, error: (e as Error).message };
    }
}
