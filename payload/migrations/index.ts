import * as migration_20260418_145544 from './20260418_145544';
import * as migration_20260418_183829 from './20260418_183829';
import * as migration_20260419_131500 from './20260419_131500';
import * as migration_20260501_194000_fix_schema from './20260501_194000_fix_schema';
import * as migration_20260501_214800_add_social_and_matomo from './20260501_214800_add_social_and_matomo';
import * as migration_20260501_220000_add_navigation from './20260501_220000_add_navigation';
import * as migration_20260501_220500_add_show_in_header from './20260501_220500_add_show_in_header';
import * as migration_20260501_224400_add_display_toggles from './20260501_224400_add_display_toggles';
import * as migration_20260501_225100_add_ticker_items from './20260501_225100_add_ticker_items';
import * as migration_20260502_002000_add_about_legal_manifest from './20260502_002000_add_about_legal_manifest';
import * as migration_20260502_002800_update_about_structure from './20260502_002800_update_about_structure';
import * as migration_20260502_002900_update_legal_structure from './20260502_002900_update_legal_structure';
import * as migration_20260503_000000_rbac_update from './20260503_000000_rbac_update';
import * as migration_20260815_113750 from './20260815_113750';
import * as migration_20260815_114500_add_discord_embed_settings from './20260815_114500_add_discord_embed_settings';
import * as migration_20260815_120000_fix_revelations_versions_author from './20260815_120000_fix_revelations_versions_author';
import * as migration_20260815_130000_add_social_publish_settings from './20260815_130000_add_social_publish_settings';
import * as migration_20260815_140000_add_gemini_api_key from './20260815_140000_add_gemini_api_key';
import * as migration_20260815_145000_add_communication_settings from './20260815_145000_add_communication_settings';
import * as migration_20260815_150000_add_log_settings from './20260815_150000_add_log_settings';
import * as migration_20260815_160000_add_elections from './20260815_160000_add_elections';
import * as migration_20260815_170000_add_signal_revelation_link from './20260815_170000_add_signal_revelation_link';
import * as migration_20260815_180000_fix_elections_locked_rels from './20260815_180000_fix_elections_locked_rels';
import * as migration_20260815_190000_templates_examples_array from './20260815_190000_templates_examples_array';

export const migrations = [
  {
    up: migration_20260418_145544.up,
    down: migration_20260418_145544.down,
    name: '20260418_145544',
  },
  {
    up: migration_20260418_183829.up,
    down: migration_20260418_183829.down,
    name: '20260418_183829',
  },
  {
    up: migration_20260419_131500.up,
    down: migration_20260419_131500.down,
    name: '20260419_131500',
  },
  {
    up: migration_20260501_194000_fix_schema.up,
    down: migration_20260501_194000_fix_schema.down,
    name: '20260501_194000_fix_schema',
  },
  {
    up: migration_20260501_214800_add_social_and_matomo.up,
    down: migration_20260501_214800_add_social_and_matomo.down,
    name: '20260501_214800_add_social_and_matomo',
  },
  {
    up: migration_20260501_220000_add_navigation.up,
    down: migration_20260501_220000_add_navigation.down,
    name: '20260501_220000_add_navigation',
  },
  {
    up: migration_20260501_220500_add_show_in_header.up,
    down: migration_20260501_220500_add_show_in_header.down,
    name: '20260501_220500_add_show_in_header',
  },
  {
    up: migration_20260501_224400_add_display_toggles.up,
    down: migration_20260501_224400_add_display_toggles.down,
    name: '20260501_224400_add_display_toggles',
  },
  {
    up: migration_20260501_225100_add_ticker_items.up,
    down: migration_20260501_225100_add_ticker_items.down,
    name: '20260501_225100_add_ticker_items',
  },
  {
    up: migration_20260502_002000_add_about_legal_manifest.up,
    down: migration_20260502_002000_add_about_legal_manifest.down,
    name: '20260502_002000_add_about_legal_manifest',
  },
  {
    up: migration_20260502_002800_update_about_structure.up,
    down: migration_20260502_002800_update_about_structure.down,
    name: '20260502_002800_update_about_structure',
  },
  {
    up: migration_20260502_002900_update_legal_structure.up,
    down: migration_20260502_002900_update_legal_structure.down,
    name: '20260502_002900_update_legal_structure',
  },
  {
    up: migration_20260503_000000_rbac_update.up,
    down: migration_20260503_000000_rbac_update.down,
    name: '20260503_000000_rbac_update',
  },
  {
    up: migration_20260815_113750.up,
    down: migration_20260815_113750.down,
    name: '20260815_113750'
  },
  {
    up: migration_20260815_114500_add_discord_embed_settings.up,
    down: migration_20260815_114500_add_discord_embed_settings.down,
    name: '20260815_114500_add_discord_embed_settings'
  },
  {
    up: migration_20260815_120000_fix_revelations_versions_author.up,
    down: migration_20260815_120000_fix_revelations_versions_author.down,
    name: '20260815_120000_fix_revelations_versions_author'
  },
  {
    up: migration_20260815_130000_add_social_publish_settings.up,
    down: migration_20260815_130000_add_social_publish_settings.down,
    name: '20260815_130000_add_social_publish_settings'
  },
  {
    up: migration_20260815_140000_add_gemini_api_key.up,
    down: migration_20260815_140000_add_gemini_api_key.down,
    name: '20260815_140000_add_gemini_api_key'
  },
  {
    up: migration_20260815_145000_add_communication_settings.up,
    down: migration_20260815_145000_add_communication_settings.down,
    name: '20260815_145000_add_communication_settings'
  },
  {
    up: migration_20260815_150000_add_log_settings.up,
    down: migration_20260815_150000_add_log_settings.down,
    name: '20260815_150000_add_log_settings'
  },
  {
    up: migration_20260815_160000_add_elections.up,
    down: migration_20260815_160000_add_elections.down,
    name: '20260815_160000_add_elections'
  },
  {
    up: migration_20260815_170000_add_signal_revelation_link.up,
    down: migration_20260815_170000_add_signal_revelation_link.down,
    name: '20260815_170000_add_signal_revelation_link'
  },
  {
    up: migration_20260815_180000_fix_elections_locked_rels.up,
    down: migration_20260815_180000_fix_elections_locked_rels.down,
    name: '20260815_180000_fix_elections_locked_rels'
  },
  {
    up: migration_20260815_190000_templates_examples_array.up,
    down: migration_20260815_190000_templates_examples_array.down,
    name: '20260815_190000_templates_examples_array'
  },
];
