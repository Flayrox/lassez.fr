/**
 * Moteur de couleurs pour les nuances politiques — Charte L'Assez
 * Palette stricte : Noir, Blanc, Rouge, Gris. Pas d'arc-en-ciel.
 */

export interface NuanceConfig {
  bg: string;       // Couleur de fond de la barre
  text: string;     // Couleur du texte du badge
  badge: string;    // Fond du badge de nuance
  label: string;    // Libellé affiché
}

const NUANCE_MAP: Record<string, NuanceConfig> = {
  // ─── Gauche radicale (Rouge Lassez) ────────────────────────
  LFI: { bg: '#E11D48', text: '#ffffff', badge: '#E11D48', label: 'La France Insoumise' },
  PCF: { bg: '#E11D48', text: '#ffffff', badge: '#BE123C', label: 'Parti Communiste' },
  COM: { bg: '#E11D48', text: '#ffffff', badge: '#BE123C', label: 'Parti Communiste' },
  LO: { bg: '#E11D48', text: '#ffffff', badge: '#BE123C', label: 'Lutte Ouvrière' },
  NPA: { bg: '#E11D48', text: '#ffffff', badge: '#BE123C', label: 'Nouveau Parti Anticapitaliste' },
  LEXG: { bg: '#E11D48', text: '#ffffff', badge: '#BE123C', label: 'Extrême Gauche' },
  NFP: { bg: '#E11D48', text: '#ffffff', badge: '#9F1239', label: 'Nouveau Front Populaire' },
  LDVG: { bg: '#E11D48', text: '#ffffff', badge: '#E11D48', label: 'Divers Gauche' },
  DVG: { bg: '#E11D48', text: '#ffffff', badge: '#E11D48', label: 'Divers Gauche' },

  // ─── Socialistes (Orange) ──────────────────────────────────
  PS: { bg: '#F97316', text: '#ffffff', badge: '#EA580C', label: 'Parti Socialiste' },
  SOC: { bg: '#F97316', text: '#ffffff', badge: '#EA580C', label: 'Parti Socialiste' },
  LUG: { bg: '#F97316', text: '#ffffff', badge: '#EA580C', label: 'Union de la Gauche' },
  UG: { bg: '#F97316', text: '#ffffff', badge: '#EA580C', label: 'Union de la Gauche' },

  // ─── Écologistes (Vert) ────────────────────────────────────
  EELV: { bg: '#16A34A', text: '#ffffff', badge: '#15803D', label: 'Les Écologistes' },
  ECO: { bg: '#16A34A', text: '#ffffff', badge: '#15803D', label: 'Écologiste' },
  LE: { bg: '#16A34A', text: '#ffffff', badge: '#15803D', label: 'Les Écologistes' },

  // ─── Centre / Macronistes (Gris/Bleu clair) ────────────────
  REN: { bg: '#64748B', text: '#ffffff', badge: '#475569', label: 'Renaissance' },
  ENS: { bg: '#64748B', text: '#ffffff', badge: '#475569', label: 'Ensemble' },
  DVC: { bg: '#94A3B8', text: '#ffffff', badge: '#64748B', label: 'Divers Centre' },
  LUC: { bg: '#94A3B8', text: '#ffffff', badge: '#64748B', label: 'Union du Centre' },
  UC: { bg: '#94A3B8', text: '#ffffff', badge: '#64748B', label: 'Union du Centre' },

  // ─── Droite & Extrême Droite (Noir/Gris Foncé — Ligne Lassez) ────────
  LR: { bg: '#0F172A', text: '#ffffff', badge: '#020617', label: 'Les Républicains (ED)' },
  DVD: { bg: '#0F172A', text: '#ffffff', badge: '#020617', label: 'Divers Droite' },
  LUD: { bg: '#0F172A', text: '#ffffff', badge: '#020617', label: 'Union de la Droite' },
  UD: { bg: '#0F172A', text: '#ffffff', badge: '#020617', label: 'Union de la Droite' },
  RN: { bg: '#0F172A', text: '#ffffff', badge: '#020617', label: 'Rassemblement National (ED)' },
  REC: { bg: '#0F172A', text: '#ffffff', badge: '#020617', label: 'Reconquête (ED)' },
  LUXD: { bg: '#0F172A', text: '#ffffff', badge: '#020617', label: 'Union de l\'Extrême Droite' },
  UXD: { bg: '#0F172A', text: '#ffffff', badge: '#020617', label: 'Union de l\'Extrême Droite' },
  LEXD: { bg: '#0F172A', text: '#ffffff', badge: '#020617', label: 'Extrême Droite' },
  EXD: { bg: '#0F172A', text: '#ffffff', badge: '#020617', label: 'Extrême Droite' },

  // ─── Divers / Sans étiquette ───────────────────────────────
  DIV: { bg: '#94A3B8', text: '#ffffff', badge: '#64748B', label: 'Divers' },
};

const DEFAULT_NUANCE: NuanceConfig = {
  bg: '#6B7280',
  text: '#ffffff',
  badge: '#6B7280',
  label: '—',
};

/**
 * Retourne la config couleur pour une nuance donnée.
 * Recherche insensible à la casse + normalisation des espaces.
 * Gère le préfixe 'L' (ex: LSOC -> SOC).
 */
export function getNuanceConfig(nuance: string | null | undefined): NuanceConfig {
  if (!nuance) return DEFAULT_NUANCE;
  
  const originalKey = nuance.toUpperCase().trim();
  // On tente d'enlever le 'L' si la clé n'existe pas directement
  const strippedKey = originalKey.startsWith('L') ? originalKey.substring(1) : originalKey;
  
  // 1. Recherche exacte
  if (NUANCE_MAP[originalKey]) return NUANCE_MAP[originalKey];
  
  // 2. Recherche sans le 'L'
  if (NUANCE_MAP[strippedKey]) return NUANCE_MAP[strippedKey];

  // 3. Recherche normalisée (sans espaces ni tirets)
  const normKey = originalKey.replace(/[\s\-–]/g, '');
  const normStrippedKey = strippedKey.replace(/[\s\-–]/g, '');
  
  for (const [k, v] of Object.entries(NUANCE_MAP)) {
    const kNorm = k.replace(/[\s\-–]/g, '');
    if (kNorm === normKey || kNorm === normStrippedKey) return v;
  }
  
  return { ...DEFAULT_NUANCE, label: nuance };
}

export const STATUT_CONFIG = {
  elu: { label: 'ÉLU·E', bg: '#16A34A', text: '#ffffff', barred: false },
  qualifie: { label: 'QUALIFIÉ·E', bg: '#DC2626', text: '#ffffff', barred: false },
  elimine: { label: 'ÉLIMINÉ·E', bg: '#E5E7EB', text: '#6B7280', barred: true },
  retrait: { label: 'RETRAIT', bg: '#F3F4F6', text: '#9CA3AF', barred: true },
} as const;

export type StatutType = keyof typeof STATUT_CONFIG;
