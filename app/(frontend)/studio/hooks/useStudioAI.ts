'use client';

import { useStudio, Slide, SlideType } from '../components/StudioContext';
import { DEFAULTS, DC, DN } from '../components/constants';

export function useStudioAI() {
    const { aiLoading, setAiLoading, setDeck, setActiveId, patchActive, activeSlide } = useStudio();

    const nid = () => Math.random().toString(36).slice(2, 9);

    const aiStyle = async () => {
        if (!activeSlide) return;
        setAiLoading(true);
        const s = activeSlide.state;
        const textFields: Record<string, string> = {};
        (['headline', 'leadParagraph', 'bodyLeft', 'bodyRight', 'body', 'bodyMono', 'bodyParagraph', 'quote'].forEach((k: string) => { if (s[k]) textFields[k] = s[k]; }));
        try {
            const res = await fetch('/api/radar/studio-ai/style', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fields: textFields, bg: 'light', accent: (s.accent || '#DC2626') }),
            });
            const data = await res.json();
            if (data.styledFields) patchActive(data.styledFields);
        } catch (e) { console.error(e); alert('Erreur IA styling'); }
        setAiLoading(false);
    };

    const aiGenerateDeck = async (articleInput: string, aiEnabledTypes: SlideType[]) => {
        if (!articleInput.trim()) return;
        setAiLoading(true);
        try {
            const res = await fetch('/api/radar/studio-ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ article: articleInput, enabledTypes: aiEnabledTypes }),
            });
            const data = await res.json();

            if (data.error) {
                alert(`Erreur IA:\n${data.error}`);
                setAiLoading(false);
                return;
            }

            if (data.deck && Array.isArray(data.deck) && data.deck.length > 0) {
                const ALL_VALID_TYPES: SlideType[] = ['COVER', 'NEWS', 'MANIFESTO', 'MAXTEXT', 'GRANULAR', 'BIG_NUM', 'VERSUS', 'CHECKLIST', 'INFO', 'ANALYSIS', 'OUTRO', 'COMPARISON_CHART', 'STACKED_DATA', 'VOTE_TRACKER', 'TERRITORY_RADAR', 'DECODING', 'CHRONO_LOCK', 'IMPACT_QUOTE', 'SOCIAL_COST', 'VIDEO_NOTE'];
                
                const resolveImageUrl = (url: string | undefined, defaultUrl: string) => {
                    if (!url) return defaultUrl;
                    if (url.startsWith('http://') || url.startsWith('https://')) return url;
                    return `https://picsum.photos/seed/${encodeURIComponent(url.trim())}/1200/800`;
                };

                const newDeck: Slide[] = data.deck
                    .filter((s: any) => ALL_VALID_TYPES.includes(s.type))
                    .map((s: any, i: number) => {
                        const state = { ...(DEFAULTS[s.type as SlideType] || DN), ...s.state };
                        if ('imageUrl' in state) {
                            state.imageUrl = resolveImageUrl(state.imageUrl, (DEFAULTS[s.type as SlideType] as any).imageUrl || DC.imageUrl);
                        }
                        return { id: nid(), type: s.type as SlideType, label: `Slide ${i + 1} — ${s.type}`, state };
                    });
                
                if (newDeck.length > 0) {
                    setDeck(newDeck);
                    setActiveId(newDeck[0].id);
                }
            }
        } catch (e: any) {
            alert(`Erreur réseau:\n${e.message}`);
        }
        setAiLoading(false);
    };

    return { aiStyle, aiGenerateDeck };
}
