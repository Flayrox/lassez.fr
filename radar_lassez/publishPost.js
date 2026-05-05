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

    const MAX_ATTEMPTS = 3;
    let attempt = 0;
    let success = false;

    while (attempt < MAX_ATTEMPTS && !success) {
        attempt++;
        try {
            console.log(`\n[PAYLOAD-PUBLISH] tentative ${attempt}/${MAX_ATTEMPTS} pour le post ID ${postId}...`);
            
            console.log(`[PAYLOAD-PUBLISH] Récupération du token Payload...`);
            const tokenResponse = await axios.post(`${API_PREFIX}/authors/login`, {
                email: process.env.PAYLOAD_BOT_EMAIL,
                password: process.env.PAYLOAD_BOT_PASSWORD
            }, {
                headers: { 'User-Agent': 'lassez-radar/1.0' },
                timeout: 10000
            });
            const token = tokenResponse.data.token || tokenResponse.data.user?.token;

            if (!token) throw new Error("Token d'authentification nul retourné par l'API Payload");

            // 1. Image handling
            let featuredMediaId = null;
            let generatedImageUrl = '';
            let imageResult = null;

            try {
                if (post.image_keyword && fs.existsSync(post.image_keyword)) {
                    console.log(`[PAYLOAD-PUBLISH] Image locale détectée: ${post.image_keyword}`);
                    const fileName = path.basename(post.image_keyword);
                    featuredMediaId = await uploadMediaToPayload(token, post.image_keyword, fileName);
                    generatedImageUrl = post.image_keyword;
                }
            } catch (e) { console.warn('[PAYLOAD-PUBLISH] Échec upload image locale, tentative génération...'); }

            if (!featuredMediaId) {
                imageResult = await generateSmartCacheImage(post.image_keyword, post.source_title, post.source_title, post.punchline);
                if (imageResult) {
                    const fileName = path.basename(imageResult.localPath);
                    featuredMediaId = await uploadMediaToPayload(token, imageResult.localPath, fileName);
                    generatedImageUrl = imageResult.publicUrl;
                }
            }

            // 3. Publication de l'Article
            console.log(`[PAYLOAD-PUBLISH] Création de l'article...`);
            const contentParagraphs = post.flash_content.split('\n\n').map(p => p.trim()).filter(p => p.length > 0);
            const firstLineAsTitle = contentParagraphs.length > 0 ? contentParagraphs[0] : `RADAR: ${post.source_title}`;
            const remainingContent = contentParagraphs.length > 1 ? contentParagraphs.slice(1).join('\n\n') : '';

            // Résoudre les tags
            let payloadTagIds = [];
            if (post.tags && post.tags.trim()) {
                const localTags = post.tags.split(',').map(t => t.trim()).filter(Boolean);
                for (const tagName of localTags) {
                    try {
                        const searchRes = await axios.get(`${API_PREFIX}/tags`, {
                            params: { 'where[name][equals]': tagName, limit: 1 },
                            headers: { 'Authorization': `JWT ${token}`, 'User-Agent': 'lassez-radar/1.0' }
                        });
                        const existing = searchRes.data.docs?.[0];
                        if (existing) {
                            payloadTagIds.push(existing.id);
                        } else {
                            const createRes = await axios.post(`${API_PREFIX}/tags`, { name: tagName }, { headers: { 'Authorization': `JWT ${token}` } });
                            payloadTagIds.push(createRes.data.doc.id);
                        }
                    } catch (e) { /* ignore tag error */ }
                }
            }

            const lexicalContent = {
                root: {
                    type: "root", format: "", indent: 0, version: 1,
                    children: remainingContent.split('\n\n').filter(p => p.trim().length > 0).map(paragraph => ({
                        type: "paragraph", format: "", indent: 0, version: 1,
                        children: [{ mode: "normal", text: paragraph, type: "text", version: 1 }]
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
                meta: featuredMediaId ? { image: featuredMediaId } : {}
            };

            const payloadResponse = await axios.post(`${API_PREFIX}/revelations`, postPayload, {
                headers: { 'Authorization': `JWT ${token}`, 'User-Agent': 'lassez-radar/1.0' },
                timeout: 15000
            });
            
            const newPostId = payloadResponse.data.doc.id;
            console.log(`🚀 [SUCCÈS] Article publié sur Payload ! ID: ${newPostId}`);
            
            // 4. CROSS-POSTING
            const isFlash = post.flash_content.includes('#FLASH') || (post.tags && post.tags.split(',').map(t => t.trim().toUpperCase()).includes('FLASH'));
            const articleUrl = `${process.env.FRONTEND_URL || 'https://lassez.fr'}/revelations/${newPostId}`;
            const localImageForBroadcast = imageResult?.localPath || (post.image_keyword && fs.existsSync(post.image_keyword) ? post.image_keyword : null);
            
            await broadcastToSocials(post.flash_content, localImageForBroadcast, articleUrl, isFlash, post.video_path, post.type_ouverture);

            // Update DB locale
            db.prepare('UPDATE radar_posts SET status = ?, payload_id = ?, image_keyword = ? WHERE id = ?')
                .run('PUBLISHED', newPostId, generatedImageUrl || post.image_keyword, postId);

            // Cleanup vidéo
            if (post.video_path && fs.existsSync(post.video_path)) {
                try { fs.unlinkSync(post.video_path); } catch (e) {}
            }

            success = true;

        } catch (err) {
            console.error(`❌ Échec tentative ${attempt}/${MAX_ATTEMPTS}:`, err.response?.data?.message || err.message);
            if (attempt < MAX_ATTEMPTS) {
                const waitSec = attempt * 5;
                console.log(`⏳ Attente de ${waitSec}s avant nouvelle tentative...`);
                await new Promise(r => setTimeout(r, waitSec * 1000));
            } else {
                db.prepare("UPDATE radar_posts SET status = 'FAILED' WHERE id = ?").run(postId);
            }
        }
    }
}

// Support CLI Mode (Ex: node publishPost.js <ID>)
const args = process.argv.slice(2);
if (args[0]) {
    publishPost(args[0]).then(() => process.exit(0));
}
