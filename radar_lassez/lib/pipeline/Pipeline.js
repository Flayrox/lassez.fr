import { ResearcherAgent } from '../agents/ResearcherAgent.js';
import { EditorAgent } from '../agents/EditorAgent.js';
import { ValidatorAgent } from '../agents/ValidatorAgent.js';

export class JournalisticPipeline {
    constructor(apiKey, settings = {}) {
        this.researcher = new ResearcherAgent(
            apiKey, 
            settings.ai_model_breaking || 'gemini-1.5-pro'
        );
        this.editor = new EditorAgent(
            apiKey, 
            settings.ai_model_main || 'gemini-1.5-pro',
            settings.ai_prompt || ''
        );
        this.validator = new ValidatorAgent(apiKey);
    }

    async processArticle(rawArticle, targetType = 'BREAKING') {
        console.log(`\n[Pipeline] Starting process for: ${rawArticle.title}`);

        // Phase 1: Research
        const research = await this.researcher.research(rawArticle);

        // Phase 2: Editorial Rewrite
        const draftedFlash = await this.editor.rewrite(rawArticle, research, targetType);
        if (!draftedFlash) return null;

        // Phase 3: Validation
        const validation = await this.validator.validate(draftedFlash, rawArticle.content);

        if (validation.isValid) {
            console.log(`[Pipeline] Article successfully validated: ${draftedFlash.shortTitle}`);
            return validation.corrections || draftedFlash;
        } else {
            console.warn(`[Pipeline] Article rejected by validator: ${validation.reason}`);
            return null;
        }
    }
}
