import { ResearcherAgent } from '../agents/ResearcherAgent.js';
import { EditorAgent } from '../agents/EditorAgent.js';
import { ValidatorAgent } from '../agents/ValidatorAgent.js';
import { searchArchives } from '../../politicalMemory.js';

export class JournalisticPipeline {
    constructor(apiKey, settings = {}, graph = null, db = null) {
        this.graph = graph;
        this.db = db;
        
        // Configuration dynamique basée sur les réglages du Radar
        this.researcher = new ResearcherAgent(
            apiKey, 
            settings.aiModelFlash || 'gemini-3-flash-preview'
        );
        this.editor = new EditorAgent(
            apiKey, 
            settings.aiModelPro || 'gemini-3-flash-preview',
            settings.customPromptModifier || ''
        );
        this.validator = new ValidatorAgent(
            apiKey,
            settings.aiModelValidator || 'gemini-3.1-flash-lite-preview'
        );
        this.discordWebhook = 'https://discord.com/api/webhooks/1501249195477307605/l9bk9HPS38PL2ctC4a5HWp-7l3DSFssTveiEjwDjJDXghsSgeUaOOx8bU2eTGDjkIsW3';
    }

    async sendToDiscord(data) {
        try {
            await fetch(this.discordWebhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    embeds: [{
                        title: `🚀 Nouveau Draft : ${data.shortTitle || 'Sans Titre'}`,
                        description: `\`\`\`json\n${JSON.stringify(data, null, 2).substring(0, 3900)}\n\`\`\``,
                        color: 0x00ff00,
                        footer: { text: "Radar Cortex v3.0 - Industrial Payload" }
                    }]
                })
            });
        } catch (e) {
            console.error('[Pipeline] Failed to send to Discord:', e.message);
        }
    }

    async runResearcherBatch(rawArticles) {
        const activeTypes = this.graph?.nodes ? new Set(this.graph.nodes.map(n => n.type)) : null;
        if (!activeTypes || activeTypes.has('research')) {
            console.log(`[Pipeline] 🔍 Fast triage for batch of ${rawArticles.length} articles`);
            return await this.researcher.researchBatch(rawArticles);
        } else {
            console.log('[Pipeline] ⏭️ Skipping Research (node not in graph)');
            return rawArticles.map(a => String(a.id || '')); // All accepted if skipped
        }
    }

    async processSingle(rawArticle, targetType = 'BREAKING') {
        const activeTypes = this.graph?.nodes ? new Set(this.graph.nodes.map(n => n.type)) : null;

        console.log(`\n[Pipeline] 🎬 Édition de l'article retenu : ${rawArticle.title}`);

        // Extract entities loosely for RAG
        const extractEntitiesFromTitles = (title) => {
            const KNOWN_ENTITIES = ['Macron', 'Mélenchon', 'Le Pen', 'Bardella', 'Darmanin', 'Borne', 'Attal', 'Panot', 'Ruffin', 'Roussel', 'Jadot', 'Tondelier'];
            return KNOWN_ENTITIES.filter(e => title.includes(e));
        };
        const entities = extractEntitiesFromTitles(rawArticle.title);

        let ragContext = "";
        if (this.db && entities.length > 0) {
            ragContext = searchArchives(entities, this.db);
        }

        const fullContext = `Contexte SQLite (Casier Politique):\n${ragContext}`;

        // Phase 2: Editorial Rewrite
        console.log('[Pipeline] 🖋️ Phase 2: Generating editorial draft with Thinking...');
        // We pass single article as an array to editor since it expects an array now, or modify editor to handle both
        const draftedFlash = await this.editor.rewrite([rawArticle], fullContext, targetType);
        if (!draftedFlash) {
            console.error('[Pipeline] ❌ Editorial rewrite failed (returned null)');
            return null;
        }
        console.log('[Pipeline] ✅ Draft generated.');

        await this.sendToDiscord(draftedFlash);

        // Phase 3: Validation
        if (!activeTypes || activeTypes.has('validator')) {
            console.log('[Pipeline] ⚖️ Phase 3: Validating draft...');
            const validation = await this.validator.validate(draftedFlash, rawArticle.content);
            if (validation.isValid) {
                console.log(`[Pipeline] ✅ Article successfully validated: ${draftedFlash.shortTitle}`);
                return validation.corrections || draftedFlash;
            } else {
                console.warn(`[Pipeline] ❌ Article rejected by validator: ${validation.reason}`);
                return null;
            }
        } else {
            console.log('[Pipeline] ⏭️ Skipping Validation (node not in graph)');
            return draftedFlash;
        }
    }
}
