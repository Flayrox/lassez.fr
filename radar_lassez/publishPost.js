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

async function uploadMediaToPayload(token, localImagePath, fileName) {
    if (!fs.existsSync(localImagePath)) return null;

    try {
        const formData = new FormData();
        formData.append('file', fs.createReadStream(localImagePath), fileName);

        console.log(`[PAYLOAD-PUBLISH] Upload de l'image sur Payload...`);
        const response = await axios.post(`${process.env.PAYLOAD_URL}/api/media`, formData, {
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
    if (!process.env.PAYLOAD_URL || !process.env.PAYLOAD_BOT_EMAIL || !process.env.PAYLOAD_BOT_PASSWORD) {
        console.error("⚠️ Identifiants Payload manquants dans le .env du radar.");
        return;
    }

    const post = db.prepare('SELECT id, source_title, flash_content, image_keyword, tags, punchline, video_path FROM radar_posts WHERE id = ?').get(postId);

    if (!post) {
        console.error(`❌ Impossible de trouver le post ID ${postId} dans la DB.`);
        return;
    }

    try {
        console.log(`[PAYLOAD-PUBLISH] Récupération du token Payload...`);
        const tokenResponse = await axios.post(`${process.env.PAYLOAD_URL}/api/authors/login`, {
            email: process.env.PAYLOAD_BOT_EMAIL,
            password: process.env.PAYLOAD_BOT_PASSWORD
        }, {
            headers: { 'User-Agent': 'lassez-radar/1.0' }
        });
        const token = tokenResponse.data.token || tokenResponse.data.user?.token; // Try both based on Payload response structure

        if (!token) {
            throw new Error("Token d'authentification nul retourné par l'API Payload");
        }

        // 1. Génération de l'image (Smart Cache)
        let featuredMediaId = null;
        let generatedImageUrl = '';

        // post.image_keyword contient l'URL source si elle existe, ou sinon le keyword de backup IA
        const imageResult = await generateSmartCacheImage(post.image_keyword, post.source_title, post.source_title, post.punchline);

        if (imageResult) {
            // 2. Upload sur Payload
            const fileName = path.basename(imageResult.localPath);
            featuredMediaId = await uploadMediaToPayload(token, imageResult.localPath, fileName);
            generatedImageUrl = imageResult.publicUrl; // Nom dans le dossier public/
        }

        // 3. Publication de l'Article
        console.log(`[PAYLOAD-PUBLISH] Publication de l'article sur Payload...`);
        
        // On extrait la première ligne pour le titre (souvent l'accroche avec emoji)
        const lines = post.flash_content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const firstLineAsTitle = lines.length > 0 ? lines[0] : `RADAR: ${post.source_title}`;
        
        // Le contenu Payload : on enlève la première ligne si c'est elle qui sert de titre
        const remainingContent = lines.length > 1 ? lines.slice(1).join('\n\n') : post.flash_content;

        // Résoudre les tags Payload depuis les tags locaux
        let payloadTagIds = [];
        if (post.tags && post.tags.trim()) {
            const localTags = post.tags.split(',').map(t => t.trim()).filter(Boolean);
            for (const tagName of localTags) {
                try {
                    // Chercher si le tag existe déjà
                    const searchRes = await axios.get(`${process.env.PAYLOAD_URL}/api/tags`, {
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
                        const createRes = await axios.post(`${process.env.PAYLOAD_URL}/api/tags`,
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
                children: remainingContent.split('\n\n').map(paragraph => ({
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

        const payloadResponse = await axios.post(`${process.env.PAYLOAD_URL}/api/revelations`, postPayload, {
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

        await broadcastToSocials(post.flash_content, imageResult?.localPath, articleUrl, skipLink, post.video_path);

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
