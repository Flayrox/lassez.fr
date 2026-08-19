import { NextResponse } from 'next/server';
import { getPayloadClient } from '@/lib/payload';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const payload = await getPayloadClient();
        const settings = await payload.findGlobal({ slug: 'settings' });
        const communication = (settings as any)?.communication || {};

        const config = {
            maintenance_mode: communication.maintenanceMode === true,
            maintenance_message: communication.maintenanceMessage || '',
            popup_enabled: communication.popupEnabled === true,
            popup_title: communication.popupTitle || '',
            popup_text: communication.popupText || '',
            popup_link_url: communication.popupLinkUrl || '',
            popup_link_label: communication.popupLinkLabel || ''
        };

        return NextResponse.json({
            success: true,
            config
        }, {
            headers: {
                'Cache-Control': 's-maxage=30, stale-while-revalidate=10', // Cache court pour réactivité
                'Access-Control-Allow-Origin': '*', // Autoriser l'accès cross-origin
            }
        });
    } catch (error: any) {
        console.error("Erreur API Config publique:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
