import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: 'd:/Admin/Downloads/Archive 2/.env' });

async function inject() {
    console.log(`[INJECT] Fetching WP Token from ${process.env.WP_URL}...`);
    try {
        const tokenRes = await fetch(`${process.env.WP_URL}/wp-json/jwt-auth/v1/token`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'User-Agent': 'lassez-radar/1.0'
            },
            body: JSON.stringify({
                username: process.env.WP_USER,
                password: process.env.WP_PASSWORD
            })
        });
        
        if (!tokenRes.ok) throw new Error("Erreur de login: " + await tokenRes.text());
        const tokenData = await tokenRes.json();
        const token = tokenData.token;
        console.log('[INJECT] Token OK! Connecté à WordPress.');

        const articles = [
            { 
               title: "🚨 SCANDALE D'ETAT : Les documents classifiés de la place Beauvau", 
               content: "<p>Une nouvelle enquête choc démontre comment les fonds d'Etat ont été détournés vers des sociétés écrans pour financer des opérations extérieures non-déclarées au parlement. Nous avons remonté la piste financière de ces fonds douteux. </p><p>Le gouvernement a refusé de répondre à nos multiples sollicitations légales concernant ces lignes budgétaires fantômes trouvées dans le bilan consolidé.</p>"
            },
            { 
               title: "INTERVIEW : Dans les coulisses de la grève générale", 
               content: "<p>Les syndicats frappent fort et unanimes. Le pays sera bloqué dès la semaine prochaine suite aux annonces de l'exécutif. Nous avons passé 48 heures au cœur de l'organisation de ce blocus historique.</p>"
            },
            { 
               title: "EXCLUSIF : Le vrai visage des nouvelles forces de l'ordre", 
               content: "<p>Nous avons pu nous infiltrer au sein du nouveau bataillon de réponse rapide testé dans la région sud. Les consignes sont claires : tolérance zéro et utilisation de matériel de guerre en zone urbaine dense.</p>"
            },
            { 
               title: "URGENT - Remaniement : Qui se cache derrière les nouveaux venus ?", 
               content: "<p>Après le scandale des écoutes illégales de l'hiver dernier, le gouvernement vient d'annoncer une purge à sa tête. Enquête sur ces nouveaux profils issus majoritairement des lobbys industriels.</p>"
            },
            { 
               title: "TECH : Comment l'exécutif surveille nos téléphones sans aucun mandat", 
               content: "<p>Des failles matérielles dans plusieurs modèles grand public permettent aux autorités de transformer n'importe quel smartphone en micro ouvert. Explications techniques et contre-mesures à la portée de tous.</p>"
            }
        ];

        console.log(`[INJECT] Début de la publication des ${articles.length} articles...`);

        for (let i = 0; i < articles.length; i++) {
            const art = articles[i];
            console.log(`   -> Envoi: ${art.title}`);
            const postRes = await fetch(`${process.env.WP_URL}/wp-json/wp/v2/posts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'User-Agent': 'lassez-radar/1.0'
                },
                body: JSON.stringify({
                    title: art.title,
                    content: art.content,
                    status: 'publish', // Publie directement
                    categories: [] // 1 = Non classé généralement, tu pourras les recatégoriser
                })
            });
            const postData = await postRes.json();
            console.log(`   ✅ Article publié ! (ID: ${postData.id})`);
            
            // Attendre 2 secondes entre chaque post pour éviter les ratelimits
            await new Promise(r => setTimeout(r, 2000));
        }
        console.log('[INJECT] 🚀 Tous les articles de test ont été injectés avec succès !');
        
    } catch(e) {
        console.error("❌ ERREUR FATALE:", e.message);
    }
}

inject();
