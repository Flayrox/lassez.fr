
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WP_API_URL = 'https://lassez.fr/wp-json/wp/v2'; // Replace with actual API URL if different
const SITE_URL = 'https://lassez.fr';

async function fetchAll(endpoint) {
    let page = 1;
    let allData = [];
    while (true) {
        try {
            const res = await fetch(`${WP_API_URL}/${endpoint}?per_page=100&page=${page}`);
            if (!res.ok) break;
            const data = await res.json();
            if (data.length === 0) break;
            allData = allData.concat(data);
            page++;
        } catch (e) {
            console.error(`Error fetching ${endpoint}:`, e);
            break;
        }
    }
    return allData;
}

async function generateSitemap() {
    console.log('Generating sitemap...');

    const [posts, categories] = await Promise.all([
        fetchAll('posts'),
        fetchAll('categories')
    ]);

    const staticPages = [
        '',
        'enquetes',
        'revelations',
        'podcasts',
        'soutenir',
        'a-propos',
        'mentions-legales'
    ];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

    // Static Pages
    staticPages.forEach(page => {
        xml += `
  <url>
    <loc>${SITE_URL}/${page}</loc>
    <changefreq>weekly</changefreq>
    <priority>${page === '' ? '1.0' : '0.8'}</priority>
  </url>`;
    });

    // Categories
    categories.forEach(cat => {
        xml += `
  <url>
    <loc>${SITE_URL}/category/${cat.slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
    });

    // Posts
    posts.forEach(post => {
        xml += `
  <url>
    <loc>${SITE_URL}/article/${post.slug}</loc>
    <lastmod>${post.modified_gmt ? post.modified_gmt.split('T')[0] : post.date_gmt.split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`;
    });

    xml += `
</urlset>`;

    const publicDir = path.join(__dirname, '../public');
    fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), xml);
    console.log(`Sitemap generated with ${posts.length} posts and ${categories.length} categories.`);
}

generateSitemap();
