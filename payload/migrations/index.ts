import * as migration_20260418_145544 from './20260418_145544';
import * as migration_20260418_183829 from './20260418_183829';
import * as migration_20260419_131500 from './20260419_131500';

export const migrations = [
  {
    up: migration_20260418_145544.up,
    down: migration_20260418_145544.down,
    name: '20260418_145544',
  },
  {
    up: migration_20260418_183829.up,
    down: migration_20260418_183829.down,
    name: '20260418_183829'
  },
  {
    up: migration_20260419_131500.up,
    down: migration_20260419_131500.down,
    name: '20260419_131500'
  },
];
