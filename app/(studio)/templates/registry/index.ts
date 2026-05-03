import { StudioTemplate } from '../core/types';
import { CoverTemplate } from './cover';
import { NewsTemplate } from './news';
import { ManifestoTemplate } from './manifesto';
import { MaxTextTemplate } from './maxtext';
import { GranularTemplate } from './granular';
import { BigNumTemplate } from './bignum';
import { VoteTrackerTemplate } from './votetracker';
import { VersusTemplate } from './versus';
import { ChecklistTemplate } from './checklist';
import { InfoTemplate } from './info';
import { AnalysisTemplate } from './analysis';
import { OutroTemplate } from './outro';
import { ComparisonChartTemplate } from './comparisonchart';
import { StackedDataTemplate } from './stackeddata';
import { TerritoryRadarTemplate } from './territoryradar';
import { DecodingTemplate } from './decoding';
import { ChronoLockTemplate } from './chronolock';
import { ImpactQuoteTemplate } from './impactquote';
import { SocialCostTemplate } from './socialcost';
import { VideoNoteTemplate } from './videonote';

export const TemplateRegistry: Record<string, StudioTemplate> = {
    'COVER': CoverTemplate,
    'NEWS': NewsTemplate,
    'MANIFESTO': ManifestoTemplate,
    'MAXTEXT': MaxTextTemplate,
    'GRANULAR': GranularTemplate,
    'BIG_NUM': BigNumTemplate,
    'VOTE_TRACKER': VoteTrackerTemplate,
    'VERSUS': VersusTemplate,
    'CHECKLIST': ChecklistTemplate,
    'INFO': InfoTemplate,
    'ANALYSIS': AnalysisTemplate,
    'OUTRO': OutroTemplate,
    'COMPARISON_CHART': ComparisonChartTemplate,
    'STACKED_DATA': StackedDataTemplate,
    'TERRITORY_RADAR': TerritoryRadarTemplate,
    'DECODING': DecodingTemplate,
    'CHRONO_LOCK': ChronoLockTemplate,
    'IMPACT_QUOTE': ImpactQuoteTemplate,
    'SOCIAL_COST': SocialCostTemplate,
    'VIDEO_NOTE': VideoNoteTemplate,
};

export const getTemplate = (id: string): StudioTemplate | undefined => {
    return TemplateRegistry[id];
};

export const getAllTemplates = () => Object.values(TemplateRegistry);
