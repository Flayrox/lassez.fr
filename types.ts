
export interface WPMedia {
  source_url: string;
}

export interface WPAuthor {
  name: string;
  avatar_urls?: {
    [key: string]: string;
  };
}

export interface WPTerm {
  id: number;
  name: string;
  slug: string;
}

export interface WPCategory {
  id: number;
  name: string;
  slug: string;
  count: number;
}

export interface WPPost {
  id: number;
  date: string;
  slug: string;
  title: {
    rendered: string;
  };
  excerpt: {
    rendered: string;
  };
  content: {
    rendered: string;
  };
  _embedded?: {
    author: WPAuthor[];
    'wp:featuredmedia'?: WPMedia[];
    'wp:term'?: WPTerm[][];
  };
  // Support for Advanced Custom Fields (ACF)
  acf?: {
    key_points?: string | string[]; // Can be a textarea string or array depending on setup
    chart_data?: string; // JSON string for BarChart
    source_pdf_url?: string;
    security_level?: string;
    chapitre_comprendre?: string;
    lecon_comprendre?: number;
  };
  categories: number[];
}

export interface NavItem {
  slug: string;
  label: string;
  path: string;
  enabled: boolean;
  badge: string | null;
  sort_order: number;
}

export type Page = 'home' | 'enquetes' | 'revelations' | 'podcasts' | 'soutenir' | 'a-propos' | 'search' | 'category';
