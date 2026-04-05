import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WP_URL = (process.env.WP_URL || '').replace(/\/$/, '');
const WP_USER = process.env.WP_USER;
const WP_PASSWORD = process.env.WP_PASSWORD;

async function testWordPressConnection() {
    console.log(`🚀 Test de connexion WordPress (JWT) : ${WP_URL}`);
    console.log(`👤 Utilisateur : ${WP_USER}`);

    try {
        // 1. Obtenir le Token JWT
        console.log("🔑 Tentative d'obtention du token JWT via /wp-json/jwt-auth/v1/token...");
        const tokenResponse = await axios.post(`${WP_URL}/wp-json/jwt-auth/v1/token`, {
            username: WP_USER,
            password: WP_PASSWORD
        });

        const token = tokenResponse.data.token;
        console.log("✅ Token obtenu avec succès !");

        const authHeaders = { 'Authorization': `Bearer ${token}` };

        // 2. Vérifier les catégories pour trouver "Révélations"
        console.log("🔍 Recherche de la catégorie 'Révélations'...");
        const catResponse = await axios.get(`${WP_URL}/wp-json/wp/v2/categories`, {
            headers: authHeaders
        });

        const categories = catResponse.data;
        const revCat = categories.find(c => c.name.toLowerCase().includes('révélations') || c.slug.includes('revelations'));

        if (revCat) {
            console.log(`✅ Catégorie trouvée : "${revCat.name}" (ID: ${revCat.id})`);
        } else {
            console.log("⚠️ Catégorie 'Révélations' non trouvée. Voici la liste :");
            categories.forEach(c => console.log(` - ${c.name} (ID: ${c.id})`));
        }

        // 3. Test de création d'un post (Brouillon)
        console.log("\n📝 Test de création d'un article de test (Brouillon)...");
        const postData = {
            title: "Test Radar Intelligence v3",
            content: "Ceci est un test de publication via JWT avec Gemini 3 Pro. Intelligence radicale activée.",
            status: 'draft',
            categories: revCat ? [revCat.id] : []
        };

        const postResponse = await axios.post(`${WP_URL}/wp-json/wp/v2/posts`, postData, {
            headers: authHeaders
        });

        console.log(`✅ Article de test créé ! ID: ${postResponse.data.id}`);
        console.log(`🔗 Lien d'édition : ${WP_URL}/wp-admin/post.php?post=${postResponse.data.id}&action=edit`);

    } catch (error) {
        console.error("❌ Erreur de connexion :");
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error("Data:", JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
    }
}

testWordPressConnection();
