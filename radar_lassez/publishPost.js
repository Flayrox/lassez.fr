import Database from 'better-sqlite3';
import path from 'path';
import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { generateSmartCacheImage } from './imageProcessor.js';
import { broadcastToSocials } from './socials.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const db = new Database(path.join(__dirname, 'radar.db'));

async function uploadMediaToWordPress(authHeader, localImagePath, fileName) {
    if (!fs.existsSync(localImagePath)) return null;

    try {
        const formData = new FormData();
        formData.append('file', fs.createReadStream(localImagePath), fileName);

        console.log(`[WP-PUBLISH] Upload de l'image sur WordPress...`);
        const response = await axios.post(`${process.env.WP_URL}/wp-json/wp/v2/media`, formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': authHeader,
                'User-Agent': 'lassez-radar/1.0'
            }
        });

        console.log(`[WP-PUBLISH] Image uploadée avec succès. ID: ${response.data.id}`);
        return response.data.id;
    } catch (e) {
        console.error(`[WP-PUBLISH] Erreur d'upload d'image:`, e.response?.data?.message || e.message);
        return null; // On continue même sans image
    }
}

async function publishPost(postId) {
    if (!process.env.WP_URL || !process.env.WP_USER || !process.env.WP_PASSWORD) {
        console.error("⚠️ Identifiants WordPress manquants dans le .env du radar.");
        return;
    }

    const post = db.prepare('SELECT id, source_title, flash_content, image_keyword, tags, punchline, video_path FROM radar_posts WHERE id = ?').get(postId);

    if (!post) {
        console.error(`❌ Impossible de trouver le post ID ${postId} dans la DB.`);
        return;
    }

    try {
        console.log(`[WP-PUBLISH] Récupération du token WordPress (JWT Auth)...`);
        const tokenResponse = await axios.post(`${process.env.WP_URL}/wp-json/jwt-auth/v1/token`, {
            username: process.env.WP_USER,
            password: process.env.WP_PASSWORD
        }, {
            headers: { 'User-Agent': 'lassez-radar/1.0' }
        });
        const authHeader = `Bearer ${tokenResponse.data.token}`;

        // 1. Génération de l'image (Smart Cache)
        let featuredMediaId = null;
        let generatedImageUrl = '';

        // post.image_keyword contient l'URL source si elle existe, ou sinon le keyword de backup IA
        const imageResult = await generateSmartCacheImage(post.image_keyword, post.source_title, post.source_title, post.punchline);

        if (imageResult) {
            // 2. Upload sur WordPress
            const fileName = path.basename(imageResult.localPath);
            featuredMediaId = await uploadMediaToWordPress(authHeader, imageResult.localPath, fileName);
            generatedImageUrl = imageResult.publicUrl; // Nom dans le dossier public/
        }

        // 3. Publication de l'Article
        console.log(`[WP-PUBLISH] Publication de l'article sur WordPress...`);
        
        // On extrait la première ligne pour le titre (souvent l'accroche avec emoji)
        const lines = post.flash_content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const firstLineAsTitle = lines.length > 0 ? lines[0] : `RADAR: ${post.source_title}`;
        
        // Le contenu WordPress : on enlève la première ligne si c'est elle qui sert de titre
        const remainingContent = lines.length > 1 ? lines.slice(1).join('\n\n') : post.flash_content;

        // Résoudre les tags WordPress depuis les tags locaux
        let wpTagIds = [];
        if (post.tags && post.tags.trim()) {
            const localTags = post.tags.split(',').map(t => t.trim()).filter(Boolean);
            for (const tagName of localTags) {
                try {
                    // Chercher si le tag existe déjà
                    const searchRes = await axios.get(`${process.env.WP_URL}/wp-json/wp/v2/tags`, {
                        params: { search: tagName, per_page: 5 },
                        headers: { 
                            'Authorization': authHeader,
                            'User-Agent': 'lassez-radar/1.0'
                        }
                    });
                    const existing = searchRes.data.find(t => t.name.toLowerCase() === tagName.toLowerCase());
                    if (existing) {
                        wpTagIds.push(existing.id);
                    } else {
                        // Créer le tag
                        const createRes = await axios.post(`${process.env.WP_URL}/wp-json/wp/v2/tags`,
                            { name: tagName },
                            { headers: { 'Authorization': authHeader } }
                        );
                        wpTagIds.push(createRes.data.id);
                    }
                } catch (e) {
                    console.warn(`[WP-PUBLISH] Tag "${tagName}" ignoré:`, e.response?.data?.message || e.message);
                }
            }
            console.log(`[WP-PUBLISH] ${wpTagIds.length} tags WordPress résolus.`);
        }

        const postPayload = {
            title: firstLineAsTitle,
            content: remainingContent,
            status: 'publish',
            categories: [parseInt(process.env.WP_CATEGORY_ID || '12', 10)],
            tags: wpTagIds
        };

        if (featuredMediaId) {
            postPayload.featured_media = featuredMediaId;
        }

        const wpResponse = await axios.post(`${process.env.WP_URL}/wp-json/wp/v2/posts`, postPayload, {
            headers: {
                'Authorization': authHeader,
                'User-Agent': 'lassez-radar/1.0'
            }
        });

        console.log(`🚀 [SUCCÈS] Article publié sur WP ! Post ID : ${wpResponse.data.id}`);
        
        // 4. CROSS-POSTING RÉSEAUX SOCIAUX
        // Un article est considéré FLASH s'il contient #FLASH ou s'il a le tag FLASH
        const isFlash = post.flash_content.includes('#FLASH') || 
                        (post.tags && post.tags.split(',').map(t => t.trim().toUpperCase()).includes('FLASH'));
        const skipLink = isFlash;

        let wpArticleUrl = wpResponse.data.link || `${process.env.WP_URL}/?p=${wpResponse.data.id}`;
        const frontendUrl = process.env.FRONTEND_URL || 'https://lassez.fr';
        
        // On s'assure que l'URL pointe vers le frontend et non l'API WordPress
        if (wpArticleUrl.includes('api.lassez.fr')) {
            wpArticleUrl = wpArticleUrl.replace('api.lassez.fr', new URL(frontendUrl).hostname);
        }

        await broadcastToSocials(post.flash_content, imageResult?.localPath, wpArticleUrl, skipLink, post.video_path);

        // Update de la base locale
        db.prepare('UPDATE radar_posts SET status = ?, wp_id = ?, image_keyword = ? WHERE id = ?')
            .run('PUBLISHED', wpResponse.data.id, generatedImageUrl || post.image_keyword, postId);

        // Nettoyage du fichier vidéo après publication réussie
        if (post.video_path) {
            try {
                const fs = await import('fs');
                if (fs.default.existsSync(post.video_path)) {
                    fs.default.unlinkSync(post.video_path);
                    console.log(`🧹 [PUBLISH] Vidéo temporaire nettoyée : ${post.video_path}`);
                }
            } catch (e) { /* ignore */ }
        }

    } catch (err) {
        console.error("❌ Échec de la publication globale :", err.response?.data?.message || err.message);
        // Si échec WP on passe en FAILED ou on laisse APPROVED pour le re-tester
        db.prepare("UPDATE radar_posts SET status = 'APPROVED' WHERE id = ?").run(postId);
    }
}

// Support CLI Mode (Ex: node publishPost.js <ID>)
const args = process.argv.slice(2);
if (args[0]) {
    publishPost(args[0]).then(() => process.exit(0));
}
