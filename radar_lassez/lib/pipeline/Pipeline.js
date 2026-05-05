import { ResearcherAgent } from '../agents/ResearcherAgent.js';
import { EditorAgent } from '../agents/EditorAgent.js';
import { ValidatorAgent } from '../agents/ValidatorAgent.js';

export class JournalisticPipeline {
    constructor(apiKey, settings = {}, graph = null) {
        this.graph = graph;
        this.researcher = new ResearcherAgent(
            apiKey, 
            settings.ai_model_breaking || 'gemini-3.1-pro-preview'
        );
        this.editor = new EditorAgent(
            apiKey, 
            settings.ai_model_main || 'gemini-3-flash-preview',
            settings.ai_prompt || ''
        );
        this.validator = new ValidatorAgent(
            apiKey,
            settings.ai_model_validator || 'gemini-3.1-flash-lite-preview'
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

    async processArticle(rawArticle, targetType = 'BREAKING') {
        console.log(`\n[Pipeline] 🎬 Starting process for: ${rawArticle.title}`);

        const activeTypes = this.graph?.nodes ? new Set(this.graph.nodes.map(n => n.type)) : null;

        // Phase 1: Research (Optional)
        let research = null;
        if (!activeTypes || activeTypes.has('research')) {
            console.log('[Pipeline] 🔍 Phase 1: Researching context...');
            research = await this.researcher.research(rawArticle);
            console.log('[Pipeline] ✅ Research complete.');
        } else {
            console.log('[Pipeline] ⏭️ Skipping Research (node not in graph)');
        }

        // Phase 2: Editorial Rewrite (Required for flash creation)
        console.log('[Pipeline] 🖋️ Phase 2: Generating editorial draft...');
        const draftedFlash = await this.editor.rewrite(rawArticle, research, targetType);
        if (!draftedFlash) {
            console.error('[Pipeline] ❌ Editorial rewrite failed (returned null)');
            return null;
        }
        console.log('[Pipeline] ✅ Draft generated.');

        // Notification Discord du JSON brut
        await this.sendToDiscord(draftedFlash);

        // Phase 3: Validation (Optional)
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
