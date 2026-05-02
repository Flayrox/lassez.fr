import payload from "payload";
import type { SanitizedConfig } from "payload";

function lexP(text: string): any {
    return { root: { type:"root",version:1,format:"",indent:0,direction:"ltr", children:[{ type:"paragraph",version:1,format:"",indent:0,direction:"ltr", children:[{type:"text",version:1,text,detail:0,format:0,mode:"normal",style:""}]}] } };
}
async function cat(name: string, slug: string, order = 0) {
    const ex=await payload.find({collection:"categories",where:{slug:{equals:slug}},limit:1});
    if(ex.docs.length) return ex.docs[0];
    return payload.create({collection:"categories",overrideAccess:true,data:{name,slug,sortOrder:order,enabled:true}});
}
async function tag(name: string, slug: string) {
    const ex=await payload.find({collection:"tags",where:{slug:{equals:slug}},limit:1});
    if(ex.docs.length) return ex.docs[0];
    return payload.create({collection:"tags",overrideAccess:true,data:{name,slug}});
}
async function post(d: any) {
    const ex=await payload.find({collection:"posts",where:{slug:{equals:d.slug}},limit:1,overrideAccess:true});
    if(ex.docs.length){payload.logger.info("EXISTS "+d.slug);return;}
    await payload.create({collection:"posts",overrideAccess:true,data:{title:d.title,slug:d.slug,excerpt:d.excerpt,content:lexP(d.content),categories:[d.cat],tags:d.tags||[],status:"published",publishedAt:new Date().toISOString()}});
    payload.logger.info("CREATED "+d.slug);
}
async function rev(d: any) {
    const ex=await payload.find({collection:"revelations",where:{titre:{equals:d.titre}},limit:1,overrideAccess:true});
    if(ex.docs.length){payload.logger.info("EXISTS REV "+d.titre.substring(0,30));return;}
    await payload.create({collection:"revelations",overrideAccess:true,data:{titre:d.titre,contenu_rapide:lexP(d.contenu),niveau_alerte:d.alerte,status:"published"}});
    payload.logger.info("CREATED REV "+d.titre.substring(0,30));
}
export const script = async (config: any) => {
    await payload.init({config});
    await cat("Revelations","revelations",99);
    const pol=await cat("Politique","politique",2);
    const eco=await cat("Economie","economie",3);
    const soc=await cat("Societe","societe",4);
    const intl=await cat("International","international",5);
    const env=await cat("Environnement","environnement",6);
    const tFR=await tag("France","france");
    const tUS=await tag("USA","usa");
    const tPal=await tag("Palestine","palestine");
    const tUkr=await tag("Ukraine","ukraine");
    const tCli=await tag("Climat","climat");
    const tFisc=await tag("Fiscalite","fiscalite");
    const tLob=await tag("Lobbies","lobbies");
    const tCor=await tag("Corruption","corruption");
    const tMac=await tag("Macron","macron");
    await post({slug:"lobbies-pharma",cat:pol.id,tags:[tFR.id,tLob.id,tCor.id],title:"Comment les lobbies pharmaceutiques financent les campagnes",excerpt:"Une enquete de six mois sur les flux entre industrie pharma et partis politiques.",content:"Depuis 2019, les laboratoires ont verse 47 millions via des fondations ecrans. Notre enquete retrace ces flux avec des documents internes inedits."});
    await post({slug:"dossier-macron-mckinsey",cat:pol.id,tags:[tFR.id,tMac.id,tCor.id],title:"Le dossier Macron-McKinsey : le rapport que personne ne devait lire",excerpt:"Les 438 pages du rapport confidentiel commande par Elysee a McKinsey.",content:"En mars 2022, le Senat a auditionne McKinsey. Les documents revelent un systeme de commandes publiques gonflees de 340% par rapport aux tarifs de marche."});
    await post({slug:"reforme-retraites-chiffres",cat:pol.id,tags:[tFR.id,tMac.id],title:"Reforme des retraites : les vrais chiffres",excerpt:"Notre analyse montre un ecart de 23 milliards avec les donnees publiees.",content:"Le Conseil d'orientation des retraites publie plusieurs scenarios. En croisant les modeles non publies, le scenario central est le moins probable statistiquement."});
    await post({slug:"paradis-fiscaux-multinationales",cat:eco.id,tags:[tFR.id,tFisc.id,tLob.id],title:"Paradis fiscaux : les 12 multinationales francaises qui ne paient rien",excerpt:"Grace aux Panama Papers et aux registres offshore, voici la liste complete.",content:"12 des 40 plus grandes entreprises francaises ont un taux d'imposition reel inferieur a 2% sur leurs benefices mondiaux."});
    await post({slug:"blackrock-dette-francaise",cat:eco.id,tags:[tFisc.id,tUS.id],title:"Comment BlackRock achete la dette francaise",excerpt:"Le fonds americain detient 8,3% des obligations francaises.",content:"Depuis 2021, les fonds BlackRock ont absorbe une part croissante des emissions de dette francaise. Nous documentons trois cas concrets d'influence sur les politiques."});
    await post({slug:"cnews-temoignages",cat:soc.id,tags:[tFR.id,tLob.id],title:"Dans les coulisses de CNews : temoignages d anciens journalistes",excerpt:"Dix anciens employes temoignent des pratiques imposees depuis le rachat par Bollore.",content:"Entre 2017 et 2024, plus de cent journalistes ont quitte CNews. Ils decrivent un systeme de validation editoriale centralise autour de Bollore."});
    await post({slug:"hopital-public-statistiques",cat:soc.id,tags:[tFR.id],title:"L etat reel de l hopital public : les statistiques cachees",excerpt:"Apres six mois dans 14 etablissements, voici ce que le ministere ne dit pas.",content:"Le taux d'occupation des lits est mesure differemment par etablissement. Standardises, les donnees sont 34% plus defavorables que celles publiees par la DREES."});
    await post({slug:"gaza-cartographie-frappes",cat:intl.id,tags:[tPal.id],title:"Gaza : la cartographie des frappes que vous n avez pas vues",excerpt:"Analyse satellite de 18 mois pour documenter les destructions.",content:"En utilisant des images Planet Labs a 50cm de resolution, nous avons modelise l'evolution des destructions de Gaza. Le taux atteint 78% dans le nord."});
    await post({slug:"ukraine-armes-marche-noir",cat:intl.id,tags:[tUkr.id,tFR.id],title:"Ukraine : comment les armes francaises finissent sur le marche noir",excerpt:"Des livraisons tracees jusqu aux reseaux criminels via des intermediaires moldaves.",content:"Depuis 2022, l'Europe a livre 85 milliards de materiel militaire. Notre enquete trace des armes estampillees aide militaire vers des marches de vente illicite."});
    await post({slug:"chlordecone-etat",cat:env.id,tags:[tFR.id,tCor.id],title:"Chlordecone : les documents prouvent la complicite de l Etat",excerpt:"Des archives montrent que l'Etat savait des 1975 et a continue jusqu'en 1993.",content:"Les archives obtenues apres 4 ans de procedures montrent que le ministere etait au courant des effets cancerigenes du chlordecone des 1975."});
    await post({slug:"methane-industrie-gaziere",cat:env.id,tags:[tCli.id,tLob.id],title:"Methane : le mensonge des chiffres de l industrie gaziere",excerpt:"Des mesures satellite ESA revelent des emissions 2,8x superieures aux declarations.",content:"Le satellite Sentinel-5P mesure le methane atmospherique depuis 2019. En croisant avec les installations declarees, l'ecart median est de 183%."});
    await rev({alerte:"Confidentiel",titre:"EXCLUSIF -- Document interne LVMH : plan d evasion fiscale 2025-2030",contenu:"Nous avons obtenu un memo strategique classe de Bernard Arnault. Il detaille l'utilisation de trois entites neerlandaises pour transferer 4,2 milliards de royalties hors de France."});
    await rev({alerte:"Public",titre:"FUITE -- Sondage interne PS sur la fusion avec LFI",contenu:"Le sondage commande en interne montre que 61% des membres PS soutiennent une fusion d'ici 2027. Les resultats ont ete enterres par la direction nationale."});
    await rev({alerte:"Confidentiel",titre:"REVELATION -- 14 journalistes sous surveillance de l Elysee depuis 2022",contenu:"Un document de la DGSI revele que 14 journalistes ont fait l'objet de demandes acces metadonnees telephoniques entre juillet 2022 et mars 2024."});
    await rev({alerte:"Confidentiel",titre:"INTERNATIONAL -- Macron-Netanyahu : le compte-rendu non censure",contenu:"Grace a une source au Quai d'Orsay, nous avons obtenu l'appel du 3 novembre 2024. La France a accepte de retarder sa reconnaissance d'un Etat palestinien."});
    await rev({alerte:"Public",titre:"FLASH -- Reforme APL : le decret signe mais non publie",contenu:"Un decret modifiant les APL pour etudiants a ete signe le 7 avril. Non publie au JO. La publication est volontairement retardee pour eviter une mobilisation."});
    await rev({alerte:"Confidentiel",titre:"UKRAINE -- Missiles livres malgre l embargo officieux",contenu:"Malgre les declarations officielles, des missiles longue portee ont ete livres via un pays tiers. Les numeros de serie de fabrication francaise le prouvent."});
    await rev({alerte:"Public",titre:"ECONOMIE -- La Banque de France savait pour Credit Suisse trois mois avant",contenu:"Des emails internes BCE-Banque de France montrent que les regulateurs savaient pour la fragilite Credit Suisse et ont choisi de ne pas alerter le public."});
    payload.logger.info("Seed termine.");
    process.exit(0);
};
try {
    const mod=await import("../payload.config");
    const config=await Promise.resolve(mod.default);
    await script(config);
} catch(e) { console.error("Seed failed:",e); process.exit(1); }