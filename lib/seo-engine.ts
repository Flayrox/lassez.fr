import { Metadata } from 'next';

/**
 * Formate le slug d'une commune au format [code-insee]-[nom-ville]
 * Normalise en minuscule, supprime les accents et remplace les caractères spéciaux par des tirets.
 * 
 * @param codeInsee - Le code INSEE de la commune (ex: "75056")
 * @param nomVille - Le nom de la ville (ex: "Paris")
 * @returns Le slug formaté (ex: "75056-paris")
 */
export function formatCommuneSlug(codeInsee: string, nomVille: string): string {
  const normalizedNom = nomVille
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // Remplace tout ce qui n'est pas alphanumérique par un tirets
    .replace(/^-+|-+$/g, ''); // Supprime les tirets en début et fin

  return `${codeInsee}-${normalizedNom}`;
}

/**
 * Génère un résumé sémantique varié pour les résultats d'une commune.
 * Utilise des branches conditionnelles et du choix aléatoire pour éviter le contenu dupliqué.
 * 
 * @param villeName - Nom de la commune
 * @param deptName - Nom du département
 * @param results - Liste des résultats (candidats, listes, pourcentages)
 * @returns Un texte naturel décrivant les résultats
 */
export function generateSemanticSummary(villeName: string, deptName: string, results: any): string {
  if (!results || !Array.isArray(results) || results.length === 0) {
    return `Les résultats officiels des élections municipales 2026 pour la commune de ${villeName} (${deptName}) ne sont pas encore consolidés. Retrouvez prochainement le détail des votes et l'analyse de la rédaction.`;
  }

  // Tri des résultats par pourcentage décroissant
  const sortedResults = [...results].sort((a, b) => (b.pourcentage || 0) - (a.pourcentage || 0));
  const winner = sortedResults[0];
  const runnerUp = sortedResults[1];

  const templates: (() => string)[] = [
    () => `À ${villeName} (${deptName}), les résultats des élections municipales placent la liste de ${winner.candidat} en tête du scrutin avec ${winner.pourcentage}% des voix.`,
    () => `Les électeurs de ${villeName} en ${deptName} ont rendu leur verdict : ${winner.candidat} arrive en première position des municipales 2026, récoltant ${winner.pourcentage}% des suffrages.`,
    () => `Municipales 2026 à ${villeName} : ${winner.candidat} l'emporte dans cette commune du département ${deptName} avec un score de ${winner.pourcentage}%.`,
  ];

  // Ajout de variantes si on a un second candidat pour comparer
  if (runnerUp && runnerUp.pourcentage > 0) {
    templates.push(
      () => `Scrutin marqué par un duel à ${villeName} (${deptName}) où ${winner.candidat} (${winner.pourcentage}%) devance ${runnerUp.candidat} (${runnerUp.pourcentage}%) lors de ces municipales 2026.`,
      () => `Dans le département ${deptName}, la commune de ${villeName} voit la victoire de ${winner.candidat} avec ${winner.pourcentage}% des voix, face à la liste menée par ${runnerUp.candidat}.`,
      () => `Victoire de ${winner.candidat} à ${villeName}. Avec ${winner.pourcentage}% des suffrages exprimés, la liste devance celle de ${runnerUp.candidat} dans cette ville de ${deptName}.`
    );
  }

  // Sélection aléatoire pour varier le contenu SEO
  const randomIndex = Math.floor(Math.random() * templates.length);
  return templates[randomIndex]();
}

/**
 * Génère l'objet Metadata de Next.js pour une page de commune.
 * Garantit des titres et descriptions uniques pour le SEO.
 * 
 * @param ville - Objet contenant les informations de la commune (nom, codeInsee, departement)
 * @returns Objet Metadata pour Next.js
 */
export function generateSeoMetadata(ville: any): Metadata {
  const { nom, codeInsee, departement } = ville;
  
  const title = `Résultats Municipales 2026 à ${nom} (${codeInsee}) - L'Assez`;
  const description = `Consultez les résultats complets des élections municipales 2026 à ${nom} (${departement}). Scores des candidats, taux d'abstention et analyse politique locale par L'Assez.`;

  const slug = formatCommuneSlug(codeInsee, nom);
  const url = `https://lassez.fr/commune/${slug}`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      type: 'article',
      siteName: "L'Assez",
      locale: 'fr_FR',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      site: '@lasse_media',
    },
  };
}
