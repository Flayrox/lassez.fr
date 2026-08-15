import dotenv from 'dotenv';
import path from 'path';

/**
 * Charge l'environnement du daemon : le .env racine puis radar_lassez/.env
 * (ce dernier prime). Permet au daemon lancé par PM2 (sans shell enrichi)
 * de retrouver ses secrets et ses identifiants Payload.
 */
dotenv.config({ path: path.join(process.cwd(), '.env') });
dotenv.config({ path: path.join(process.cwd(), 'radar_lassez', '.env'), override: true });
