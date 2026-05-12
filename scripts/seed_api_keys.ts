import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load variables from .env file
dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Démarrage de l'injection des clés API depuis le .env vers la DB...");

  // Préparation des données d'update
  const updateData: any = {};

  if (process.env.DISCORD_WEBHOOK_URL) updateData.discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
  
  if (process.env.TWITTER_API_KEY) updateData.xApiKey = process.env.TWITTER_API_KEY;
  if (process.env.TWITTER_API_SECRET) updateData.xApiSecret = process.env.TWITTER_API_SECRET;
  if (process.env.TWITTER_ACCESS_TOKEN) updateData.xAccessToken = process.env.TWITTER_ACCESS_TOKEN;
  if (process.env.TWITTER_ACCESS_SECRET) updateData.xAccessSecret = process.env.TWITTER_ACCESS_SECRET;
  
  if (process.env.MASTODON_INSTANCE_URL) updateData.mastodonInstanceUrl = process.env.MASTODON_INSTANCE_URL;
  if (process.env.MASTODON_ACCESS_TOKEN) updateData.mastodonAccessToken = process.env.MASTODON_ACCESS_TOKEN;
  
  if (process.env.BLUESKY_IDENTIFIER) updateData.blueskyIdentifier = process.env.BLUESKY_IDENTIFIER;
  if (process.env.BLUESKY_APP_PASSWORD) updateData.blueskyAppPassword = process.env.BLUESKY_APP_PASSWORD;
  
  if (process.env.PAYLOAD_SERVER_URL) updateData.payloadServerUrl = process.env.PAYLOAD_SERVER_URL;
  if (process.env.PAYLOAD_BOT_EMAIL) updateData.payloadBotEmail = process.env.PAYLOAD_BOT_EMAIL;
  if (process.env.PAYLOAD_BOT_PASSWORD) updateData.payloadBotPassword = process.env.PAYLOAD_BOT_PASSWORD;

  if (Object.keys(updateData).length === 0) {
    console.log("⚠️ Aucune clé trouvée dans le .env pour l'injection.");
    return;
  }

  // Update in DB (id 1 is guaranteed by previous mechanisms)
  try {
    const res = await prisma.globalSettings.upsert({
      where: { id: 1 },
      update: updateData,
      create: { id: 1, ...updateData }
    });
    console.log("✅ Injection terminée avec succès !");
    console.log(`Clés injectées : ${Object.keys(updateData).join(', ')}`);
  } catch (err) {
    console.error("❌ Erreur lors de l'injection :", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();