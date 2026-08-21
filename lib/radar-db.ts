import path from 'path';
export function getRadarDbPath(): string {
  return path.join(process.cwd(), 'data', 'radar.db');
}
export function getDataTmpDir(): string {
  return path.join(process.cwd(), 'data', 'tmp');
}
