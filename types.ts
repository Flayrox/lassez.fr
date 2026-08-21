/**
 * Types domaine — front L'Assez (clean, sans Payload/WordPress)
 * Remplace payload-types.ts + alias WP*.
 * Le futur provider implémentera ces interfaces.
 */

export interface Category {
  id: any;
  name: string;
  slug: string;
  description?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  sortOrder?: number | null;
  enabled?: boolean | null;
  showInHeader?: boolean | null;
  updatedAt: string;
  createdAt: string;
}

export interface Tag {
  id: any;
  name: string;
  slug: string;
  updatedAt: string;
  createdAt: string;
}

export interface Media {
  id: any;
  url?: string | null;
  thumbnailURL?: string | null;
  filename?: string | null;
  alt?: string | null;
  caption?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  focalX?: number | null;
  focalY?: number | null;
  updatedAt: string;
  createdAt: string;
}

export interface Author {
  id: any;
  name: string;
  slug: string;
  bio?: string | null;
  avatar?: (number | string | null) | Media;
  email?: string;
  roles?: string[];
  updatedAt: string;
  createdAt: string;
}

// Lexical RichText minimal
export type RichText = {
  root: {
    type: string;
    children: { type: any; version: number; [k: string]: unknown }[];
    direction: ('ltr' | 'rtl') | null;
    format: string;
    indent: number;
    version: number;
  };
  [k: string]: unknown;
};

export interface Post {
  id: any;
  title: string;
  slug: string;
  excerpt?: string | null;
  content: RichText;
  content_html?: string | null;
  categories: (number | string | Category)[];
  tags?: (number | string | Tag)[] | null;
  author?: (number | string | null) | Author;
  featuredImage?: (number | string | null) | Media;
  publishedAt?: string | null;
  updatedAt: string;
  createdAt: string;
  _status?: 'draft' | 'published' | null;
  meta?: { title?: string | null; description?: string | null; image?: (number | string | null) | Media } | null;
  // legacy Payload acf
  acf?: Record<string, any> | null;
}

export interface Revelation {
  id: any;
  titre: string;
  slug: string;
  contenu_rapide: RichText;
  contenu_rapide_html?: string | null;
  niveau_alerte?: ('Public' | 'Confidentiel') | null;
  zone_geo?: ('france' | 'international') | null;
  tags?: (number | string | Tag)[] | null;
  author?: (number | string | null) | Author;
  updatedAt: string;
  createdAt: string;
  _status?: 'draft' | 'published' | null;
}

export interface Lesson {
  id: any;
  title: string;
  slug: string;
  content: RichText;
  content_html?: string | null;
  chapitre: string;
  numero_lecon: number;
  updatedAt: string;
  createdAt: string;
}

// Aliases compat (à retirer après migration front)
export type WPPost = Post;
export type WPCategory = Category;
export type WPTerm = Tag;
export type WPAuthor = Author;
export type WPMedia = Media;

export interface NavItem {
  slug: string;
  label: string;
  path: string;
  enabled: boolean;
  badge: string | null;
  sort_order: number;
}

export type Page = 'home' | 'enquetes' | 'revelations' | 'podcasts' | 'soutenir' | 'a-propos' | 'search' | 'category';

// Globals front
export interface Setting {
  id: any;
  seoGeminiModel?: string | null;
  displaySettings?: { flashInfoEnabled?: boolean | null; showHeader?: boolean | null; showFooter?: boolean | null } | null;
  flashInfoText?: string | null;
  tickerItems?: { text: string; active?: boolean | null; id?: string | null }[] | null;
  communication?: {
    maintenanceMode?: boolean | null;
    maintenanceMessage?: string | null;
    popupEnabled?: boolean | null;
    popupTitle?: string | null;
    popupLinkLabel?: string | null;
    popupText?: string | null;
    popupLinkUrl?: string | null;
  } | null;
  navigation?: { label: string; enabled?: boolean | null; badge?: string | null; linkType?: ('custom' | 'category') | null; customUrl?: string | null; category?: (number | string | null) | Category; id?: string | null }[] | null;
  socialLinks?: Record<string, string | null> | null;
  matomoSettings?: { matomoId?: string | null; matomoUrl?: string | null } | null;
  manifest: { siteName: string; shortName?: string | null; description?: string | null; themeColor?: string | null; backgroundColor?: string | null };
  updatedAt?: string | null;
  createdAt?: string | null;
}

export interface About {
  id: any;
  title: string;
  version?: string | null;
  introText: string;
  quote?: string | null;
  manifestoSections?: { title: string; content: RichText; variant?: ('red' | 'black') | null; id?: string | null }[] | null;
  signature?: { line1?: string | null; line2?: string | null } | null;
  team?: { name: string; role: string; avatar?: (number | string | null) | Media; id?: string | null }[] | null;
  updatedAt?: string | null;
  createdAt?: string | null;
}

export interface Legal {
  id: any;
  title: string;
  lastUpdated?: string | null;
  sections?: { title: string; content: RichText; highlightBox?: RichText | null; id?: string | null }[] | null;
  updatedAt?: string | null;
  createdAt?: string | null;
}
