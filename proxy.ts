import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Proxy minimal — front clean (Radar/Studio supprimés)
 * Garde le rate limiting léger pour les APIs publiques si besoin
 * TODO: ajouter auth du futur provider si nécessaire
 */
export async function proxy(req: NextRequest) {
  // Pas de logique Radar/Studio — on laisse passer
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images/).*)'],
};
