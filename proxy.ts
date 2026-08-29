import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Proxy minimal — le front ne fait que passer (studio et daemon à part)
 * Garde le rate limiting léger pour les APIs publiques si besoin
 * TODO: ajouter auth du futur provider si nécessaire
 */
export async function proxy(_req: NextRequest) {
  // Pas de logique applicative — on laisse passer
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images/).*)'],
};
