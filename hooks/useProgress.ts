import { useState, useEffect } from 'react';

/**
 * Hook to manage reading progress using browser's localStorage.
 * Keeps track of which articles (by ID) have been marked as "understood".
 */
export function useProgress() {
    const [completedArticles, setCompletedArticles] = useState<number[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        // Load from localStorage on mount
        const stored = localStorage.getItem('lassez_progress');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    setCompletedArticles(parsed);
                }
            } catch (e) {
                console.error("Failed to parse progress from localStorage", e);
            }
        }
        setIsLoaded(true);
    }, []);

    const markAsCompleted = (articleId: number) => {
        setCompletedArticles(prev => {
            if (prev.includes(articleId)) return prev;
            const updated = [...prev, articleId];
            localStorage.setItem('lassez_progress', JSON.stringify(updated));
            return updated;
        });
    };

    const isCompleted = (articleId: number) => {
        return completedArticles.includes(articleId);
    };

    const getProgressPercentage = (totalArticles: number) => {
        if (totalArticles === 0) return 0;
        return Math.round((completedArticles.length / totalArticles) * 100);
    };

    // Finds the next article in 'allArticles' that hasn't been completed yet.
    // 'allArticles' should be sorted in the desired reading order.
    const getNextArticle = (allArticles: { id: number, slug: string }[]) => {
        return allArticles.find(article => !isCompleted(article.id));
    };

    return {
        completedArticles,
        markAsCompleted,
        isCompleted,
        getProgressPercentage,
        getNextArticle,
        isLoaded
    };
}
