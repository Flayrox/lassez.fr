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

const API_PREFIX = process.env.PAYLOAD_API_URL || (process.env.PAYLOAD_SERVER_URL ? process.env.PAYLOAD_SERVER_URL + '/api/payload' : process.env.PAYLOAD_URL + '/api');

async function uploadMediaToPayload(token, localImagePath, fileName) {
    if (!fs.existsSync(localImagePath)) return null;

    try {
        const formData = new FormData();
        formData.append('file', fs.createReadStream(localImagePath), fileName);

        console.log(`[PAYLOAD-PUBLISH] Upload de l'image sur Payload...`);
        const response = await axios.post(`${API_PREFIX}/media`, formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': `JWT ${token}`,
                'User-Agent': 'lassez-radar/1.0'
            }
        });

        console.log(`[PAYLOAD-PUBLISH] Image uploadée avec succès. ID: ${response.data.doc.id}`);
        return response.data.doc.id;
    } catch (e) {
        console.error(`[PAYLOAD-PUBLISH] Erreur d'upload d'image:`, e.response?.data?.errors?.[0]?.message || e.message);
        return null; // On continue même sans image
    }
}

async function publishPost(postId) {
    if (!API_PREFIX || !process.env.PAYLOAD_BOT_EMAIL || !process.env.PAYLOAD_BOT_PASSWORD) {
        console.error("⚠️ Identifiants Payload manquants dans le .env du radar.");
        return;
    }

    const post = db.prepare('SELECT id, source_title, flash_content, image_keyword, tags, punchline, video_path, type_ouverture FROM radar_posts WHERE id = ?').get(postId);

    if (!post) {
        console.error(`❌ Impossible de trouver le post ID ${postId} dans la DB.`);
        return;
    }

    try {
        console.log(`[PAYLOAD-PUBLISH] Récupération du token Payload...`);
        const tokenResponse = await axios.post(`${API_PREFIX}/authors/login`, {
            email: process.env.PAYLOAD_BOT_EMAIL,
            password: process.env.PAYLOAD_BOT_PASSWORD
        }, {
            headers: { 'User-Agent': 'lassez-radar/1.0' }
        });
        const token = tokenResponse.data.token || tokenResponse.data.user?.token; // Try both based on Payload response structure

        if (!token) {
            throw new Error("Token d'authentification nul retourné par l'API Payload");
        }

        // 1. Image handling: prefer an existing local image path, else try smart generation
        let featuredMediaId = null;
        let generatedImageUrl = '';
        let imageResult = null;

        // If image_keyword is already a local file path (studio tmp or similar), upload it directly
        try {
            if (post.image_keyword && fs.existsSync(post.image_keyword)) {
                console.log(`[PAYLOAD-PUBLISH] Found local image at ${post.image_keyword}, uploading directly.`);
                const fileName = path.basename(post.image_keyword);
                featuredMediaId = await uploadMediaToPayload(token, post.image_keyword, fileName);
                generatedImageUrl = post.image_keyword;
            }
        } catch (e) {
            // ignore and fallback to generation
        }

        // If no local image was uploaded, try to generate or fetch via smart cache
        if (!featuredMediaId) {
            imageResult = await generateSmartCacheImage(post.image_keyword, post.source_title, post.source_title, post.punchline);
            if (imageResult) {
                const fileName = path.basename(imageResult.localPath);
                featuredMediaId = await uploadMediaToPayload(token, imageResult.localPath, fileName);
                generatedImageUrl = imageResult.publicUrl; // Nom dans le dossier public/
            }
        }

        // 3. Publication de l'Article
        console.log(`[PAYLOAD-PUBLISH] Publication de l'article sur Payload...`);
        
        // Séparer titre et contenu : 
        // - Titre = première ligne/paragraphe (avec emoji alerte)
        // - Contenu = tout le reste
        const contentParagraphs = post.flash_content
            .split('\n\n')
            .map(p => p.trim())
            .filter(p => p.length > 0);
        
        const firstLineAsTitle = contentParagraphs.length > 0 ? contentParagraphs[0] : `RADAR: ${post.source_title}`;
        const remainingContent = contentParagraphs.length > 1 ? contentParagraphs.slice(1).join('\n\n') : '';

        // Résoudre les tags Payload depuis les tags locaux
        let payloadTagIds = [];
        if (post.tags && post.tags.trim()) {
            const localTags = post.tags.split(',').map(t => t.trim()).filter(Boolean);
            for (const tagName of localTags) {
                try {
                    // Chercher si le tag existe déjà
                    const searchRes = await axios.get(`${API_PREFIX}/tags`, {
                        params: { 'where[name][equals]': tagName, limit: 1 },
                        headers: { 
                            'Authorization': `JWT ${token}`,
                            'User-Agent': 'lassez-radar/1.0'
                        }
                    });
                    const existing = searchRes.data.docs?.[0];
                    if (existing) {
                        payloadTagIds.push(existing.id);
                    } else {
                        // Créer le tag
                        const createRes = await axios.post(`${API_PREFIX}/tags`,
                            { name: tagName },
                            { headers: { 'Authorization': `JWT ${token}` } }
                        );
                        payloadTagIds.push(createRes.data.doc.id);
                    }
                } catch (e) {
                    console.warn(`[PAYLOAD-PUBLISH] Tag "${tagName}" ignoré:`, e.response?.data?.errors?.[0]?.message || e.message);
                }
            }
            console.log(`[PAYLOAD-PUBLISH] ${payloadTagIds.length} tags Payload résolus.`);
        }

        const lexicalContent = {
            root: {
                type: "root",
                format: "",
                indent: 0,
                version: 1,
                children: remainingContent
                    .split('\n\n')
                    .filter(p => p.trim().length > 0)
                    .map(paragraph => ({
                        type: "paragraph",
                        format: "",
                        indent: 0,
                        version: 1,
                        children: [{
                            mode: "normal",
                            text: paragraph,
                            type: "text",
                            version: 1
                        }]
                    }))
            }
        };

        const isInternational = post.tags && post.tags.split(',').map(t => t.trim().toUpperCase()).includes('INTERNATIONAL');

        const postPayload = {
            titre: firstLineAsTitle,
            contenu_rapide: lexicalContent,
            _status: 'published',
            niveau_alerte: 'Public',
            zone_geo: isInternational ? 'international' : 'france',
            tags: payloadTagIds,
            meta: {}
        };

        if (featuredMediaId) {
            postPayload.meta.image = featuredMediaId;
        }

        const payloadResponse = await axios.post(`${API_PREFIX}/revelations`, postPayload, {
            headers: {
                'Authorization': `JWT ${token}`,
                'User-Agent': 'lassez-radar/1.0'
            }
        });
        
        const newPostId = payloadResponse.data.doc.id;

        console.log(`🚀 [SUCCÈS] Article publié sur Payload ! Post ID : ${newPostId}`);
        
        // 4. CROSS-POSTING RÉSEAUX SOCIAUX
        // Un article est considéré FLASH s'il contient #FLASH ou s'il a le tag FLASH
        const isFlash = post.flash_content.includes('#FLASH') || 
                        (post.tags && post.tags.split(',').map(t => t.trim().toUpperCase()).includes('FLASH'));
        const skipLink = isFlash;

        const frontendUrl = process.env.FRONTEND_URL || 'https://lassez.fr';
        let articleUrl = `${frontendUrl}/revelations/${newPostId}`;

        const localImageForBroadcast = imageResult?.localPath || (post.image_keyword && fs.existsSync(post.image_keyword) ? post.image_keyword : null);
        await broadcastToSocials(post.flash_content, localImageForBroadcast, articleUrl, skipLink, post.video_path, post.type_ouverture);

        // Update de la base locale
        db.prepare('UPDATE radar_posts SET status = ?, payload_id = ?, image_keyword = ? WHERE id = ?')
            .run('PUBLISHED', newPostId, generatedImageUrl || post.image_keyword, postId);

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
