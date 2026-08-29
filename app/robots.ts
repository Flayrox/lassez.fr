import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: ['/api/'],
            },
        ],
        sitemap: [
            'https://lassez.fr/sitemap.xml',
            'https://lassez.fr/news-sitemap.xml'
        ],
    };
}

