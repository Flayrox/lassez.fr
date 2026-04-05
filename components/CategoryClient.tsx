'use client';

import React from 'react';
import { useCategories } from '../hooks/useCategories';
import { useInfinitePosts } from '../hooks/useInfinitePosts';
import ArticleListItem from './ArticleListItem';
import Breadcrumb from './Breadcrumb';
import { AlertTriangleIcon } from './icons';
import { WPPost, WPCategory } from '../types';

interface CategoryClientProps {
    slug: string;
    initialCategory: WPCategory | null;
    initialPosts: WPPost[];
}

const CategoryClient: React.FC<CategoryClientProps> = ({ slug, initialCategory, initialPosts }) => {
    const { categories } = useCategories();
    // We prefer categories from hook if available to get latest count, but initialCategory works too
    const category = categories.find(c => c.slug === slug) || initialCategory;
    const id = category?.id;

    const { posts, error, isLoading, isLoadingMore, isReachingEnd, setSize, size } = useInfinitePosts(id ? `categories=${id}` : null);

    const displayPosts = posts && posts.length > 0 ? posts : initialPosts;
    const categoryName = category?.name || 'Dossiers';

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-8 mt-8 px-4 md:px-0">
                <Breadcrumb items={[{ label: categoryName.toUpperCase() }]} />
            </div>

            <h1 className="text-3xl font-black mb-6 text-center uppercase">
                Dossiers par <span className="text-lassez-red underline decoration-4 underline-offset-4">Catégorie</span>
            </h1>

            {isLoading && size === 1 && <p className="text-center font-mono animate-pulse">Accès aux serveurs...</p>}

            {error && (
                <div className="bg-red-50 border-4 border-red-500 text-red-700 p-4 shadow-hard" role="alert">
                    <p className="font-bold flex items-center"><AlertTriangleIcon className="mr-2" />Erreur de chargement</p>
                    <p>Impossible de récupérer les articles pour cette catégorie.</p>
                </div>
            )}

            <div className="space-y-8">
                {displayPosts.map(post => (
                    <ArticleListItem key={post.id} post={post} />
                ))}
            </div>

            {!isReachingEnd && !isLoading && displayPosts.length > 0 && (
                <div className="text-center mt-12">
                    <button
                        onClick={() => setSize(size + 1)}
                        disabled={isLoadingMore}
                        className="bg-black text-white font-bold py-3 px-8 border-2 border-black hover:bg-lassez-red transition-colors disabled:bg-gray-400 uppercase tracking-widest"
                    >
                        {isLoadingMore ? 'Chargement...' : '[+] Voir plus de dossiers'}
                    </button>
                </div>
            )}

            {isReachingEnd && displayPosts.length > 0 && (
                <p className="text-center font-mono text-gray-500 mt-12 uppercase">/// Fin de l'index ///</p>
            )}

            {!isLoading && displayPosts.length === 0 && (
                <p className="text-center text-gray-500 mt-12 font-mono">AUCUN DOSSIER TROUVÉ DANS CETTE SECTION.</p>
            )}

        </div>
    );
};

export default CategoryClient;
