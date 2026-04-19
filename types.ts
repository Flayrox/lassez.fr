import type { Post as PayloadPost, Category as PayloadCategory, Tag as PayloadTag, Media as PayloadMedia, Author as PayloadAuthor } from './payload-types';

export type WPPost = PayloadPost;
export type WPCategory = PayloadCategory;
export type WPTerm = PayloadTag;
export type WPAuthor = PayloadAuthor;
export type WPMedia = PayloadMedia;

export interface NavItem {
  slug: string;
  label: string;
  path: string;
  enabled: boolean;
  badge: string | null;
  sort_order: number;
}

export type Page = 'home' | 'enquetes' | 'revelations' | 'podcasts' | 'soutenir' | 'a-propos' | 'search' | 'category';
