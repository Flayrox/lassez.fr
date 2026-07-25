import { ImageResponse } from 'next/og';

export const runtime = 'edge';

/**
 * Route dynamique d'images OpenGraph & Twitter Cards (/api/og)
 * 
 * Cette route génère à la volée une carte visuelle PNG (1200x630px) haute définition
 * lors du partage d'un article sur Twitter/X, LinkedIn, Facebook ou WhatsApp.
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const title = searchParams.get('title') || "L'ASSEZ | Enquêtes & Révélations";
        const category = searchParams.get('category') || 'INVESTIGATION';

        return new ImageResponse(
            (
                <div
                    style={{
                        height: '100%',
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        backgroundColor: '#0F0F0F',
                        color: '#FBF9F4',
                        padding: '60px 80px',
                        fontFamily: 'sans-serif',
                        border: '12px solid #DC2626',
                    }}
                >
                    {/* Header avec Logo & Tag de Catégorie */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div
                            style={{
                                fontSize: 24,
                                fontWeight: 900,
                                letterSpacing: '0.25em',
                                color: '#DC2626',
                                textTransform: 'uppercase',
                            }}
                        >
                            L&apos;ASSEZ
                        </div>
                        <div
                            style={{
                                fontSize: 16,
                                fontWeight: 700,
                                backgroundColor: '#DC2626',
                                color: '#FFFFFF',
                                padding: '6px 16px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.15em',
                            }}
                        >
                            {category}
                        </div>
                    </div>

                    {/* Titre Principal d'investigation */}
                    <div
                        style={{
                            fontSize: 48,
                            fontWeight: 900,
                            lineHeight: 1.25,
                            maxHeight: '260px',
                            overflow: 'hidden',
                            textTransform: 'uppercase',
                            letterSpacing: '-0.02em',
                        }}
                    >
                        {title}
                    </div>

                    {/* Footer d'accréditation & Domaine */}
                    <div
                        style={{
                            display: 'flex',
                            justify: 'space-between',
                            alignItems: 'center',
                            borderTop: '2px solid rgba(255,255,255,0.2)',
                            paddingTop: '20px',
                            fontSize: 16,
                            color: 'rgba(255,255,255,0.6)',
                        }}
                    >
                        <span>JOURNALISME D&apos;INVESTIGATION INDÉPENDANT</span>
                        <span style={{ color: '#FBF9F4', fontWeight: 700 }}>lassez.fr</span>
                    </div>
                </div>
            ),
            {
                width: 1200,
                height: 630,
            }
        );
    } catch (e: any) {
        return new Response(`Failed to generate image`, { status: 500 });
    }
}
