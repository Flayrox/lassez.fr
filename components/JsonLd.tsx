'use client';

import { useEffect } from 'react';

type JsonLdProps = {
    id: string;
    data: unknown;
};

export default function JsonLd({ id, data }: JsonLdProps) {
    useEffect(() => {
        const existing = document.getElementById(id);
        const next = document.createElement('script');
        next.id = id;
        next.type = 'application/ld+json';
        next.textContent = JSON.stringify(data);

        if (existing?.parentNode) {
            existing.parentNode.replaceChild(next, existing);
            return () => {
                if (next.parentNode) next.parentNode.removeChild(next);
            };
        }

        document.head.appendChild(next);

        return () => {
            if (next.parentNode) next.parentNode.removeChild(next);
        };
    }, [data, id]);

    return null;
}