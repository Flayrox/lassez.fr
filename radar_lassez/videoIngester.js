/**
 * ═══════════════════════════════════════════════════════════════
 *  RADAR L'ASSEZ — MODULE OSINT VIDÉO
 *  
 *  Pipeline intelligent de traitement vidéo Telegram :
 *  1. Pré-filtre IA (Gemini 2 Flash) → OUI/NON pertinent ?
 *  2. Téléchargement via yt-dlp
 *  3. Extraction audio MP3 via ffmpeg (jamais la vidéo à l'IA)
 *  4. Transcription audio via Gemini
 * ═══════════════════════════════════════════════════════════════
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { execSync, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const TMP_DIR = path.join(__dirname, 'tmp-videos');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Créer le dossier temporaire s'il n'existe pas
if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
}

/**
 * Détecte si un message Telegram contient une URL vidéo.
 * @param {string} text - Texte du message
 * @returns {string|null} - URL vidéo trouvée ou null
 */
export function detectVideoUrl(text) {
    if (!text) return null;

    // Patterns de vidéo courants
    const patterns = [
        /https?:\/\/(?:www\.)?youtube\.com\/watch\?v=[\w-]+/i,
        /https?:\/\/youtu\.be\/[\w-]+/i,
        /https?:\/\/(?:www\.)?twitter\.com\/\w+\/status\/\d+/i,
        /https?:\/\/x\.com\/\w+\/status\/\d+/i,
        /https?:\/\/(?:www\.)?tiktok\.com\/@[\w.]+\/video\/\d+/i,
        /https?:\/\/(?:www\.)?instagram\.com\/(?:reel|p)\/[\w-]+/i,
        /https?:\/\/(?:www\.)?dailymotion\.com\/video\/[\w]+/i,
        /https?:\/\/t\.me\/[\w]+\/\d+/i, // Vidéos Telegram
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) return match[0];
    }

    return null;
}

/**
 * Pré-filtre IA rapide (Gemini 2 Flash — quasi-gratuit).
 * Analyse le texte accompagnant la vidéo pour décider si elle vaut le coup.
 * 
 * @param {string} messageText - Texte du message Telegram contenant la vidéo
 * @returns {Promise<boolean>} - true si pertinent
 */
export async function shouldProcessVideo(messageText, options = {}) {
    const minChars = Number(options.prefilterMinChars || 20);
    const prefilterModel = options.prefilterModel || 'gemini-2.0-flash';
    const prefilterPrompt = options.prefilterPrompt || `Tu es un filtre de pertinence pour un média d'investigation politique de gauche.
Analyse ce message Telegram et réponds UNIQUEMENT par "OUI" ou "NON".
La vidéo associée est-elle liée à un sujet politique, social, judiciaire, ou d'intérêt public majeur ?

Exemples de sujets pertinents : manifestation, vote à l'Assemblée, garde à vue d'un politique, discours politique, répression policière, scandale d'État.
Exemples de sujets NON pertinents : pub, divertissement, sport, météo, cuisine, people.

Message : "{{MESSAGE}}"

Réponds uniquement OUI ou NON :`;
    if (!messageText || messageText.length < minChars) return false;

    try {
        const model = genAI.getGenerativeModel({
            model: prefilterModel,
        });

        const prompt = prefilterPrompt.replace('{{MESSAGE}}', messageText.substring(0, 500));
        const result = await model.generateContent(prompt);

        const answer = result.response.text().trim().toUpperCase();
        const isRelevant = answer.startsWith('OUI');

        console.log(`  ⚡ [PRÉ-FILTRE] "${messageText.substring(0, 50)}..." → ${isRelevant ? '✅ OUI' : '❌ NON'}`);     
        return isRelevant;
    } catch (e) {
        console.warn(`  ⚠️ [PRÉ-FILTRE] Erreur Gemini Flash:`, e.message);
        return false; // En cas d'erreur, on skip (économie de ressources)
    }
}

/**
 * Télécharge une vidéo et en extrait l'audio MP3.
 * 
 * @param {string} videoUrl - URL de la vidéo
 * @returns {Promise<{audioPath: string, videoPath: string}|null>}
 */
export async function downloadAndExtractAudio(videoUrl) {
    const timestamp = Date.now();
    const videoPath = path.join(TMP_DIR, `video_${timestamp}.mp4`);
    const audioPath = path.join(TMP_DIR, `audio_${timestamp}.mp3`);

    try {
        // Étape 1 : Télécharger la vidéo via yt-dlp
        console.log(`  📥 [OSINT] Téléchargement : ${videoUrl}`);
        
        execSync(
            `yt-dlp --no-check-certificates --format "bestvideo[height<=720]+bestaudio/best[height<=720]/best" --merge-output-format mp4 -o "${videoPath}" "${videoUrl}"`,
            { timeout: 120000, stdio: 'pipe' } // 2 min max
        );

        if (!fs.existsSync(videoPath)) {
            console.warn('  ⚠️ [OSINT] Fichier vidéo non trouvé après téléchargement.');
            return null;
        }

        const videoSize = fs.statSync(videoPath).size;
        console.log(`  ✅ [OSINT] Vidéo téléchargée (${(videoSize / 1024 / 1024).toFixed(1)} Mo)`);

        // Étape 2 : Extraire l'audio en MP3 léger (64kbps, mono)
        console.log(`  🎧 [OSINT] Extraction audio MP3...`);
        
        execSync(
            `ffmpeg -i "${videoPath}" -vn -acodec libmp3lame -ab 64k -ac 1 -y "${audioPath}"`,
            { timeout: 60000, stdio: 'pipe' }
        );

        if (!fs.existsSync(audioPath)) {
            console.warn('  ⚠️ [OSINT] Fichier audio non trouvé après extraction.');
            return null;
        }

        const audioSize = fs.statSync(audioPath).size;
        console.log(`  ✅ [OSINT] Audio extrait (${(audioSize / 1024).toFixed(0)} Ko)`);

        return { audioPath, videoPath };
    } catch (e) {
        console.error(`  ❌ [OSINT] Erreur téléchargement/extraction:`, e.message);
        // Nettoyage en cas d'erreur
        try { if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath); } catch (_) {}
        try { if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath); } catch (_) {}
        return null;
    }
}

/**
 * Transcrit un fichier audio MP3 via Gemini (modèle audio).
 * 
 * @param {string} audioPath - Chemin vers le fichier MP3
 * @returns {Promise<string>} - Texte transcrit
 */
export async function transcribeAudio(audioPath, options = {}) {
    try {
        if (!fs.existsSync(audioPath)) return '';

        const audioSize = fs.statSync(audioPath).size;
        const maxAudioMb = Number(options.maxAudioMb || 20);
        const transcribeModel = options.transcribeModel || 'gemini-2.0-flash';
        if (audioSize > maxAudioMb * 1024 * 1024) {
            console.warn(`  ⚠️ [OSINT] Audio trop volumineux pour la transcription (>${maxAudioMb}Mo).`);
            return '';
        }

        console.log(`  🎤 [OSINT] Transcription audio via Gemini...`);

        const model = genAI.getGenerativeModel({
            model: transcribeModel,
        });

        const audioData = fs.readFileSync(audioPath);
        const audioBase64 = audioData.toString('base64');

        const result = await model.generateContent([
            {
                inlineData: {
                    mimeType: 'audio/mp3',
                    data: audioBase64
                }
            },
            `Transcris intégralement cet audio en français. 
Ne résume PAS, transcris mot pour mot ce qui est dit.
Si l'audio contient des noms propres (personnalités politiques, lieux, institutions), écris-les correctement.
Si l'audio est inaudible ou vide, réponds "AUDIO INAUDIBLE".
Transcription :`
        ]);

        const transcription = result.response.text().trim();
        
        if (transcription === 'AUDIO INAUDIBLE' || transcription.length < 10) {
            console.log('  ⚠️ [OSINT] Audio inaudible ou trop court.');
            return '';
        }

        console.log(`  ✅ [OSINT] Transcription réussie (${transcription.length} caractères)`);
        return transcription;
    } catch (e) {
        console.error(`  ❌ [OSINT] Erreur transcription:`, e.message);
        return '';
    }
}

/**
 * Pipeline complet : pré-filtre → téléchargement → extraction → transcription.
 * 
 * @param {string} videoUrl - URL de la vidéo
 * @param {string} messageText - Texte du message Telegram
 * @returns {Promise<{transcription: string, videoPath: string}|null>}
 */
export async function processVideo(videoUrl, messageText, options = {}) {
    console.log(`  🎬 [OSINT] Pipeline vidéo démarré pour : ${videoUrl}`);
    if (options.enabled === false) return null;

    // Étape 1 : Pré-filtre IA
    const isRelevant = await shouldProcessVideo(messageText, options);
    if (!isRelevant) {
        console.log(`  ⏭️  [OSINT] Vidéo non pertinente, skip.`);
        return null;
    }

    // Étape 2 : Téléchargement + extraction audio
    const files = await downloadAndExtractAudio(videoUrl);
    if (!files) return null;

    // Étape 3 : Transcription
    const transcription = await transcribeAudio(files.audioPath, options);

    // Nettoyage de l'audio (on garde la vidéo pour publication)
    try { fs.unlinkSync(files.audioPath); } catch (_) {}

    if (!transcription) {
        // Si pas de transcription, pas la peine de garder la vidéo
        try { fs.unlinkSync(files.videoPath); } catch (_) {}
        return null;
    }

    return {
        transcription,
        videoPath: files.videoPath
    };
}

/**
 * Nettoie les fichiers temporaires de vidéos après publication.
 */
export function cleanupVideoFiles() {
    try {
        if (!fs.existsSync(TMP_DIR)) return;

        const files = fs.readdirSync(TMP_DIR);
        let cleaned = 0;
        
        for (const file of files) {
            const filePath = path.join(TMP_DIR, file);
            const stat = fs.statSync(filePath);
            
            // Supprimer les fichiers de plus de 24h
            if (Date.now() - stat.mtimeMs > 24 * 60 * 60 * 1000) {
                fs.unlinkSync(filePath);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`  🧹 [OSINT] ${cleaned} fichier(s) temporaire(s) nettoyé(s).`);
        }
    } catch (e) {
        console.warn('⚠️ [OSINT] Erreur nettoyage:', e.message);
    }
}
