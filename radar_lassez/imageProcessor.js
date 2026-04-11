import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

import TextToSVG from 'text-to-svg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dossier public de Next.js
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const IMAGES_DIR = path.join(PUBLIC_DIR, 'radar-images');
const LOGO_PATH = path.join(PUBLIC_DIR, 'logo_lassez_white.svg');
const RADAR_DB_PATH = path.join(__dirname, 'radar.db');

const DEFAULT_IMAGE_SETTINGS = {
    image_overlay_enabled: true,
    image_overlay_opacity: 0.5,
    image_box_scale_169: 0.78,
    image_box_scale_1x1: 0.78
};

function clamp(num, min, max) {
    return Math.max(min, Math.min(max, num));
}

function toBool(value, fallback = true) {
    if (value === undefined || value === null || value === '') return fallback;
    return String(value).toLowerCase() === 'true';
}

function getImageEngineSettings() {
    const result = { ...DEFAULT_IMAGE_SETTINGS };
    try {
        const db = new Database(RADAR_DB_PATH, { readonly: true });
        const rows = db.prepare("SELECT key, value FROM radar_settings WHERE key IN ('image_overlay_enabled', 'image_overlay_opacity', 'image_box_scale_169', 'image_box_scale_1x1')").all();
        db.close();

        for (const row of rows) {
            if (row.key === 'image_overlay_enabled') {
                result.image_overlay_enabled = toBool(row.value, DEFAULT_IMAGE_SETTINGS.image_overlay_enabled);
            }
            if (row.key === 'image_overlay_opacity') {
                result.image_overlay_opacity = clamp(parseFloat(row.value || String(DEFAULT_IMAGE_SETTINGS.image_overlay_opacity)), 0, 1);
            }
            if (row.key === 'image_box_scale_169') {
                result.image_box_scale_169 = clamp(parseFloat(row.value || String(DEFAULT_IMAGE_SETTINGS.image_box_scale_169)), 0.55, 1);
            }
            if (row.key === 'image_box_scale_1x1') {
                result.image_box_scale_1x1 = clamp(parseFloat(row.value || String(DEFAULT_IMAGE_SETTINGS.image_box_scale_1x1)), 0.55, 1);
            }
        }
    } catch (e) {
        console.warn('[PROCESSOR] Settings image indisponibles, fallback par defaut.', e.message);
    }

    return result;
}

function buildBackgroundKeywords(sourceImageUrl, keywordFallback, articleTitle) {
    const raw = `${keywordFallback || ''} ${articleTitle || ''}`.replace(/https?:\/\/\S+/g, '').trim();
    const tokens = raw
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .filter(w => w.length > 2)
        .filter(w => !['avec', 'dans', 'pour', 'from', 'that', 'this', 'les', 'des', 'une', 'sur', 'par', 'du', 'and'].includes(w));

    if (!tokens.length && sourceImageUrl && sourceImageUrl.startsWith('http')) {
        return 'news politics protest';
    }
    if (!tokens.length) {
        return 'politics journalism protest';
    }
    return tokens.slice(0, 6).join(',');
}

async function fetchRoyaltyFreeBackgroundOverlay(query, width, height, opacity) {
    try {
        const sourceUrl = `https://source.unsplash.com/${Math.max(width, 1400)}x${Math.max(height, 900)}/?${encodeURIComponent(query)}`;
        const response = await axios.get(sourceUrl, { responseType: 'arraybuffer', timeout: 12000 });
        return await sharp(Buffer.from(response.data))
            .resize(width, height, { fit: 'cover', position: 'attention' })
            .grayscale()
            .modulate({ brightness: 0.85, contrast: 1.05 })
            .ensureAlpha(opacity)
            .png()
            .toBuffer();
    } catch (e) {
        console.warn('[PROCESSOR] Overlay keyword indisponible:', e.message);
        return null;
    }
}

// Chargement de la vraie police d'écriture statique Black (900) pour la transformation en Vecteurs Path purs
const playfairFontPath = path.join(PUBLIC_DIR, 'fonts', 'PlayfairDisplay-Black.ttf');
let textToSVG = null;
try {
    if (fs.existsSync(playfairFontPath)) {
        textToSVG = TextToSVG.loadSync(playfairFontPath);
    }
} catch (e) {
    console.warn("Impossible de charger text-to-svg pour Playfair Display", e);
}

// Chargement et préparation du Logo SVG L'Assez
let lassezSVGData = "";
try {
    const rawSvg = fs.readFileSync(LOGO_PATH, 'utf8');
    // On retire la balise <svg...> et </svg> pour extraire uniquement les vecteurs internes
    lassezSVGData = rawSvg.replace(/<svg[^>]*>/i, '').replace(/<\/svg>/i, '');
} catch(e) {
    console.error("Erreur de chargement du logo SVG L'Assez", e);
}
// Créer le dossier s'il n'existe pas
if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

export async function generateSmartCacheImage(sourceImageUrl, keywordFallback, articleTitle = '', subtext = '') {
    // Si pas d'image source on utilise un identifiant basé sur le keyword 
    const safeKeyword = (keywordFallback || 'generic').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const fileName = `${safeKeyword}_lassez_${Date.now()}.jpg`;
    const outputPath = path.join(IMAGES_DIR, fileName);

    console.log(`[PROCESSOR] Traitement de l'image (Brut Style) : ${sourceImageUrl || 'Aucune source'}`);

    try {
        const engineSettings = getImageEngineSettings();
        const isSquare = !(sourceImageUrl && sourceImageUrl.startsWith('http'));
        const W = isSquare ? 1080 : 1200;
        const H = isSquare ? 1080 : 675;

        // Configuration pour Sharp
        let imageBuffer;
        if (!isSquare) {
            const response = await axios.get(sourceImageUrl, { responseType: 'arraybuffer' });
            imageBuffer = Buffer.from(response.data);
        } else {
            // Pas d'image native : On utilise le fond militant par défaut L'Assez (fini les images IA !)
            try {
                const defaultBgResponse = await axios.get('https://lh3.googleusercontent.com/aida-public/AB6AXuBxrKloupICoto8P9PcaUl2BeFYY7vlA9WzsPd70b7Xpc3Ie4El3eTgATTthZl1HeusHgLapRthn_nh6ub3BdUqwNLAoz8dG38mw5v_7o1mDcj-3Eswk9yjcpUe3pjTyY2DPsnn20_f5TIsPKih5SG0_65YJlpDj1pHZtmUh1d_niOfjGHQDSWKOVk0yR3DVKKq8pJea_NHvzEyfk-NTPDJAEAoDFl57dYPgcuh9QBP5iKCZwJXDowY5bFG_oEkEoVczaJvzONMN3gG', { responseType: 'arraybuffer' });
                imageBuffer = Buffer.from(defaultBgResponse.data);
            } catch(e) {
                console.error("[PROCESSOR] Erreur fond de base Google Drive, fallback bg rouge.", e.message);
                imageBuffer = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 188, g: 1, b: 0, alpha: 1 } } }).png().toBuffer();
            }
        }

        // Effet Duotone L'Assez pour le format carré, effet standard pour 16:9
        let processed = sharp(imageBuffer).resize(W, H, { fit: 'cover', position: 'attention' });
        
        if (isSquare) {
            // Style Duotone Red : multiply par du rouge sur N&B + fort contraste
            processed = processed
                .grayscale()
                .modulate({ brightness: 0.8, contrast: 1.2 })
                .tint({ r: 188, g: 1, b: 0 }); // Rouge principal
        } else {
            processed = processed
                .grayscale()
                .modulate({ brightness: 0.75 })
                .linear(1.25, -32);
        }

        if (engineSettings.image_overlay_enabled) {
            const keywordQuery = buildBackgroundKeywords(sourceImageUrl, keywordFallback, articleTitle);
            const overlayInput = await fetchRoyaltyFreeBackgroundOverlay(keywordQuery, W, H, engineSettings.image_overlay_opacity);
            if (overlayInput) {
                processed = processed.composite([{ input: overlayInput, top: 0, left: 0, blend: 'over' }]);
            }
        }

        const titleText = articleTitle ? articleTitle : "LA COLÈRE GRONDE DANS LES RUES";
        const words = titleText.split(' ');
        const lines = [];
        let currentLine = '';
        
        // Tailles de texte différentes selon le format
        const fontSize = isSquare ? 80 : 44;
        const lineHeight = isSquare ? 85 : 48;
        const maxTextWidth = isSquare ? 850 : 630;

        const estimateLineWidthFallback = (text, fSize) => {
            let width = 0;
            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                if ("I1iijl!|.,:;'".includes(char)) width += 0.35;
                else if ("WM@".includes(char)) width += 1.35;
                else if ("OQGDC".includes(char)) width += 1.15;
                else if (" ".includes(char)) width += 0.45;
                else width += 0.95;
            }
            return width * (fSize * 0.70);
        };

        for (const word of words) {
            const testLine = currentLine ? currentLine + ' ' + word : word;
            let textWidth;
            if (textToSVG) {
                textWidth = textToSVG.getMetrics(testLine, { fontSize: fontSize }).width;
            } else {
                textWidth = estimateLineWidthFallback(testLine, fontSize);
            }

            if (textWidth > maxTextWidth && currentLine !== '') {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine) lines.push(currentLine);

        let typographyOverlay;

        if (isSquare) {
            // ==== Rendu SQUARE 1:1 sans image source ====
            const compactScale = clamp(engineSettings.image_box_scale_1x1, 0.55, 1);
            
            const totalTextHeight = lines.length * lineHeight;
            const startY = (H - totalTextHeight) / 2 - 40; // Centré + remonté légèrement
            
            let textPathsSVG = "";
            lines.forEach((line, index) => {
                const yPos = startY + (index * lineHeight);
                if (textToSVG) {
                    const textPath = textToSVG.getPath(line, {
                        x: W / 2, y: yPos, fontSize: fontSize, anchor: 'center top',
                        attributes: { fill: 'white', style: 'filter: url(#hard-shadow);' }
                    });
                    textPathsSVG += textPath;
                } else {
                    textPathsSVG += `<text x="${W/2}" y="${yPos + fontSize * 0.8}" fill="white" font-family="'Playfair Display', serif" font-weight="900" font-size="${fontSize}" text-anchor="middle" filter="url(#hard-shadow)">${line}</text>`;
                }
            });

            // On utilise la punchline (subtext), sinon le tag
            const tagsArray = (keywordFallback || '').split(',').map(t=>t.trim());
            const firstTag = tagsArray[0] ? tagsArray[0].toUpperCase() : 'ALERTE MAJEURE';
            const finalSubtext = subtext ? subtext.toUpperCase() : `INFO EXCLUSIVE L'ASSEZ - DOSSIER : ${firstTag}`;
            
            const subtextY = startY + totalTextHeight + 40;
            const borderStroke = Math.max(16, Math.round(32 * compactScale));
            const sideStripe = Math.max(10, Math.round(16 * compactScale));
            const flashWidth = Math.round(240 * compactScale);
            const flashHeight = Math.round(44 * compactScale);
            const flashY = Math.round(100 * compactScale);
            const flashFontSize = Math.max(13, Math.round(20 * compactScale));
            const dividerHalfWidth = Math.round(200 * compactScale);
            const subtextFontSize = Math.max(13, Math.round(20 * compactScale));
            const logoScale = 0.175 * compactScale;
            const logoOffsetX = Math.round((W / 2) - (180 * logoScale) / 2);
            const logoOffsetY = H - Math.round(90 * compactScale);

            typographyOverlay = Buffer.from(`
                <svg width="${W}" height="${H}">
                    <defs>
                        <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
                            <stop offset="20%" stop-color="transparent" />
                            <stop offset="100%" stop-color="rgba(0,0,0,0.8)" />
                        </radialGradient>
                        <filter id="hard-shadow">
                           <feDropShadow dx="6" dy="6" stdDeviation="0" flood-color="#000000" flood-opacity="1" />
                        </filter>
                    </defs>
                    <!-- Vignette par-dessus le fond Rouge Duotone -->
                    <rect width="${W}" height="${H}" fill="url(#vignette)" />
                    
                    <!-- Bordure noire (8px dans le div x2 environ = 16px) -->
                    <rect width="${W}" height="${H}" fill="none" stroke="#000000" stroke-width="${borderStroke}" />
                    
                    <!-- Bandes décoratives sombres/claires -->
                    <rect x="0" y="0" width="${sideStripe}" height="${H}" fill="rgba(0,0,0,0.3)" />
                    <rect x="${W - sideStripe}" y="0" width="${sideStripe}" height="${H}" fill="rgba(255,255,255,0.1)" />

                    <!-- Header: Flash Info (Petit) -->
                    <g transform="translate(0, ${flashY})">
                        <rect x="${W/2 - Math.round(flashWidth / 2)}" y="0" width="${flashWidth}" height="${flashHeight}" fill="#000000" />
                        <text x="${W/2}" y="${Math.round(flashHeight * 0.68)}" fill="#ffffff" font-family="'Space Grotesk', 'Arial', sans-serif" font-weight="bold" font-size="${flashFontSize}" text-anchor="middle" letter-spacing="3px">FLASH INFO</text>
                    </g>

                    <!-- Titre centré -->
                    ${textPathsSVG}
                    
                    <!-- Subtext avec ligne supérieure -->
                    <g transform="translate(0, ${subtextY})">
                        <line x1="${W/2 - dividerHalfWidth}" y1="0" x2="${W/2 + dividerHalfWidth}" y2="0" stroke="white" stroke-width="${Math.max(2, Math.round(4 * compactScale))}" />
                        <text x="${W/2}" y="${Math.round(36 * compactScale)}" fill="white" font-family="'Space Grotesk', 'Arial', sans-serif" font-weight="bold" font-size="${subtextFontSize}" letter-spacing="1px" text-anchor="middle">${finalSubtext}</text>
                    </g>

                    <!-- Footer / Vrai Logo SVG en bas au centre avec ombre (50% plus petit) -->
                    <g transform="translate(${logoOffsetX}, ${logoOffsetY}) scale(${logoScale})" filter="url(#hard-shadow)">
                        ${lassezSVGData ? lassezSVGData : '<rect x="0" y="0" width="180" height="50" fill="#000000" stroke="#ffffff" stroke-width="2" /><text x="90" y="35" fill="#ffffff" font-family="serif" font-weight="900" font-size="30" font-style="italic" text-anchor="middle">L\'ASSEZ</text>'}
                    </g>
                </svg>
            `);

        } else {
            // ==== Rendu HORIZONTAL 16:9 avec image source ====
            const compactScale = clamp(engineSettings.image_box_scale_169, 0.55, 1);
            
            const totalTextHeight = lines.length * lineHeight;
            const boxPaddingY = Math.max(18, Math.round(32 * compactScale));
            const boxPaddingX = Math.max(18, Math.round(32 * compactScale));
            const infoBarHeight = Math.max(26, Math.round(50 * compactScale));
            const contentBoxHeight = totalTextHeight + (boxPaddingY * 2) + infoBarHeight;

            const startX = 48;
            const startY = H - 48 - contentBoxHeight;

            let textPathsSVG = "";
            let dynamicMaxTextWidth = 0;
            lines.forEach((line, index) => {
                const yPos = startY + boxPaddingY - 12 + (index * lineHeight);
                let currentLineWidth = 0;
                if (textToSVG) {
                    currentLineWidth = textToSVG.getMetrics(line, { fontSize: fontSize }).width;
                    const textPath = textToSVG.getPath(line, {
                        x: startX + boxPaddingX + 8,
                        y: yPos,
                        fontSize: fontSize,
                        anchor: 'left top',
                        attributes: { fill: 'white' }
                    });
                    textPathsSVG += textPath;
                } else {
                    currentLineWidth = estimateLineWidthFallback(line, fontSize);
                    textPathsSVG += `<text x="${startX + boxPaddingX + 8}" y="${yPos + fontSize * 0.9}" fill="white" font-family="'Playfair Display', serif" font-weight="900" font-size="${fontSize}">${line}</text>`;
                }
                if (currentLineWidth > dynamicMaxTextWidth) dynamicMaxTextWidth = currentLineWidth;
            });

            const boxWidth = Math.max(320, dynamicMaxTextWidth + (boxPaddingX * 2) + 24);
            const dividerWidth = boxWidth - 64;
            const flashWidth = Math.round(150 * compactScale);
            const flashHeight = Math.round(32 * compactScale);
            const flashY = Math.max(0, startY - Math.round(36 * compactScale));
            const flashFontSize = Math.max(11, Math.round(16 * compactScale));
            const flashOffset = Math.round(10 * compactScale);
            const actFontSize = Math.max(140, Math.round(260 * compactScale));
            const actLineW = Math.max(64, Math.round(128 * compactScale));
            const actLineH = Math.max(2, Math.round(4 * compactScale));
            const logoScale = 0.175 * compactScale;

            const rightNow = new Date();
            const infoDateString = `${rightNow.getHours().toString().padStart(2, '0')}:${rightNow.getMinutes().toString().padStart(2, '0')} CET  |  Paris, France`;

            typographyOverlay = Buffer.from(`
                <svg width="${W}" height="${H}">
                    <defs>
                        <linearGradient id="grad" x1="0%" y1="100%" x2="0%" y2="0%">
                            <stop offset="0%" style="stop-color:#000000;stop-opacity:0.6" />
                            <stop offset="100%" style="stop-color:#000000;stop-opacity:0" />
                        </linearGradient>
                        <pattern id="dither" width="4" height="4" patternUnits="userSpaceOnUse">
                            <rect width="4" height="4" fill="none" />
                            <rect width="1" height="1" x="1" y="1" fill="#000000" fill-opacity="0.1" />
                        </pattern>
                        <filter id="hard-shadow-169">
                           <feDropShadow dx="4" dy="4" stdDeviation="0" flood-color="#000000" flood-opacity="1" />
                        </filter>
                    </defs>
                    <rect x="0" y="0" width="${W}" height="${H}" fill="url(#grad)" />
                    <rect x="0" y="0" width="${W}" height="${H}" fill="url(#dither)" opacity="0.3" /> 

                    <!-- Top Right Vrai Logo (50% plus petit avec ombre portée) -->
                    <g transform="translate(${W - 85}, 16) scale(${logoScale})" filter="url(#hard-shadow-169)">
                        ${lassezSVGData ? lassezSVGData : '<rect x="0" y="0" width="180" height="50" fill="#000000" stroke="#ffffff" stroke-width="2" /><text x="90" y="35" fill="#ffffff" font-family="serif" font-weight="900" font-size="30" font-style="italic" text-anchor="middle">L\'ASSEZ</text>'}
                    </g>

                    <text x="${W - 50}" y="${H - 45}" fill="#ffffff" fill-opacity="0.15" font-family="'Arial Black', sans-serif" font-weight="900" font-size="${actFontSize}" text-anchor="end">ACT</text>
                    <rect x="${W - actLineW}" y="${H / 2}" width="${actLineW}" height="${actLineH}" fill="#D32F2F" />

                    <!-- Flash Info Block -->
                    <g transform="translate(${startX}, ${flashY})">
                        <polygon points="${flashOffset},4 ${flashWidth + flashOffset},4 ${flashWidth - flashOffset},${flashHeight + 4} 0,${flashHeight + 4}" fill="#000000" />
                        <polygon points="${flashOffset - 4},0 ${flashWidth + flashOffset - 4},0 ${flashWidth - flashOffset - 4},${flashHeight} -4,${flashHeight}" fill="#D32F2F" />
                        <text x="${Math.round(flashWidth / 2)}" y="${Math.round(flashHeight * 0.68)}" fill="#ffffff" font-family="'Arial', sans-serif" font-weight="bold" font-size="${flashFontSize}" text-anchor="middle" letter-spacing="2px">FLASH INFO</text>
                    </g>

                    <!-- Main Text Background -->
                    <g transform="translate(${startX}, ${startY})">
                         <rect x="12" y="12" width="${boxWidth}" height="${contentBoxHeight}" fill="#ffffff" fill-opacity="0.2" />
                         <rect x="0" y="0" width="${boxWidth}" height="${contentBoxHeight}" fill="#000000" fill-opacity="0.95" />
                         <rect x="0" y="0" width="8" height="${contentBoxHeight}" fill="#D32F2F" />
                         <rect x="32" y="${boxPaddingY + totalTextHeight + 8}" width="${dividerWidth}" height="1" fill="#374151" />
                         <text x="32" y="${boxPaddingY + totalTextHeight + 36}" fill="#D1D5DB" font-family="'Arial', sans-serif" font-weight="400" font-size="14">${infoDateString}</text>
                    </g>
                    ${textPathsSVG}
                </svg>
            `);
        }

        processed = processed.composite([{
            input: typographyOverlay,
            top: 0,
            left: 0,
            blend: 'over'
        }]);

        await processed.jpeg({ quality: 90 }).toFile(outputPath);

        console.log(`[PROCESSOR] Image "Smart Cache" sauvegardée: ${outputPath}`);
        return {
            localPath: outputPath,
            publicUrl: `/radar-images/${fileName}`
        };
    } catch (e) {
        console.error(`[PROCESSOR] Échec du maquillage de l'image :`, e.message);
        return null;
    }
}
