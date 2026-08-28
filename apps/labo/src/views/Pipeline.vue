<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h1 class="text-lg font-semibold text-text-1">Le pipeline, étape par étape</h1>
        <p class="text-xs text-text-3 mt-0.5">Ce que fait chaque nœud du robot, ce qui entre, ce qui sort, et comment le régler — en français simple</p>
      </div>
      <LButton :disabled="system.scanning" @click="runScan">
        {{ system.scanning ? 'Scan en cours…' : '▶ Lancer un scan' }}
      </LButton>
    </div>

    <!-- Bandeau budget / niveau gratuit -->
    <LCard title="🎟️ Niveau gratuit — la répartition des modèles" :description="`Tes 3 nœuds IA tournent sur ${modelNames} — rien de plus cher n'est utilisé`">
      <div class="grid sm:grid-cols-3 gap-3">
        <div class="rounded border border-border/60 bg-bg/40 px-3 py-2.5">
          <p class="text-[10px] uppercase tracking-wider text-text-3 mb-1">🧠 Tri</p>
          <p class="text-sm font-medium text-text-1">{{ store.ecriture.modeleRapide }}</p>
          <p class="text-[10px] text-text-3 mt-1">Flash Lite — note 0–100, catégorie, rejet</p>
        </div>
        <div class="rounded border border-border/60 bg-bg/40 px-3 py-2.5">
          <p class="text-[10px] uppercase tracking-wider text-text-3 mb-1">✍️ Rédaction</p>
          <p class="text-sm font-medium text-text-1">{{ store.ecriture.modeleRedaction }}</p>
          <p class="text-[10px] text-text-3 mt-1">Flash — le brouillon complet, recherche web</p>
        </div>
        <div class="rounded border border-border/60 bg-bg/40 px-3 py-2.5">
          <p class="text-[10px] uppercase tracking-wider text-text-3 mb-1">⚖️ Vérification</p>
          <p class="text-sm font-medium text-text-1">{{ store.ecriture.modeleVerification }}</p>
          <p class="text-[10px] text-text-3 mt-1">Flash Lite — vérif des faits en ligne</p>
        </div>
      </div>
      <div class="mt-3 space-y-1.5 text-[11px] text-text-2">
        <p class="flex items-start gap-2"><span class="shrink-0">🔍</span><span><b>Recherche web {{ store.ecriture.webSearchEnabled ? 'activée' : 'désactivée' }}</b> — chaque sujet consomme 1 recherche Google par nœud IA (tri + rédaction + vérif = 3 par sujet). Le niveau gratuit inclut <b>5 000 recherches/mois</b>, au-delà c'est facturé (14 $ / 1 000).</span></p>
        <p class="flex items-start gap-2"><span class="shrink-0">⏱️</span><span>Le daemon limite à <b>12 requêtes Gemini/min</b> au total (quota gratuit respecté) et reprend proprement en cas de limite atteinte.</span></p>
      </div>
    </LCard>

    <!-- La chaîne visuelle -->
    <LCard :padding="false" title="La chaîne d'un coup d'œil" description="7 nœuds — 6 dans le cycle principal, la diffusion tourne en continu à part">
      <div class="flex flex-wrap items-center gap-1.5 px-4 py-3">
        <template v-for="(n, i) in chain" :key="n.id">
          <a :href="'#noeud-' + n.id"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] transition-colors no-underline"
            :class="nodeEnabled(n.id)
              ? lastStepStatus(n.id) === 'error' ? 'border-danger/50 bg-danger/10 text-danger' : 'border-accent/40 bg-accent-muted text-accent'
              : 'border-border text-text-3'">
            <span class="w-1.5 h-1.5 rounded-full" :class="nodeEnabled(n.id) ? (lastStepStatus(n.id) === 'error' ? 'bg-danger' : 'bg-accent') : 'bg-border'"></span>{{ n.id }} · {{ n.label }}
          </a>
          <span v-if="i < chain.length - 2" class="text-text-3 text-[11px]">→</span>
          <span v-else-if="i === chain.length - 2" class="text-text-3 text-[11px]">…</span>
        </template>
      </div>
    </LCard>

    <!-- Cartes détaillées -->
    <div class="space-y-4">
      <div v-for="n in chain" :id="'noeud-' + n.id" :key="n.id"
        class="bg-surface border rounded-card overflow-hidden scroll-mt-20"
        :class="nodeEnabled(n.id) ? (lastStepStatus(n.id) === 'error' ? 'border-danger/40' : 'border-border') : 'border-border'">
        <!-- En-tête -->
        <div class="flex items-center gap-3 px-4 py-3 border-b border-border/60">
          <span class="w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0"
            :class="nodeEnabled(n.id) ? 'bg-accent text-accent-fg' : 'bg-surface-hover text-text-3'">{{ n.icon }}</span>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <p class="text-sm font-semibold text-text-1">{{ n.id }}. {{ n.label }}</p>
              <LBadge :variant="nodeEnabled(n.id) ? 'accent' : 'neutral'">{{ nodeEnabled(n.id) ? 'En marche' : 'En pause' }}</LBadge>
              <LBadge v-if="lastStepStatus(n.id) === 'ok'" variant="info">✓ dernier passage ok</LBadge>
              <LBadge v-else-if="lastStepStatus(n.id) === 'error'" variant="danger">✕ erreur au dernier passage</LBadge>
              <LBadge v-else-if="nodeEnabled(n.id)" variant="warning">en attente de passage</LBadge>
            </div>
            <p class="text-[11px] text-text-3 mt-0.5">{{ n.role }}</p>
          </div>
          <router-link :to="n.settingsTo" class="text-[11px] text-accent hover:underline shrink-0">Régler →</router-link>
        </div>

        <div class="px-4 py-4 space-y-4">
          <!-- Ce qu'il fait -->
          <div>
            <p class="text-[10px] uppercase tracking-wider text-text-3 mb-1.5">Ce qu'il fait</p>
            <p class="text-xs text-text-2 leading-relaxed">{{ n.what }}</p>
          </div>

          <!-- Entrées / sorties -->
          <div class="grid sm:grid-cols-2 gap-3">
            <div class="rounded border border-border/50 bg-bg/40 px-3 py-2.5">
              <p class="text-[10px] uppercase tracking-wider text-text-3 mb-1">Ce qui entre</p>
              <p class="text-xs text-text-2">{{ n.input }}</p>
              <p v-if="n.inputCount != null" class="text-[11px] mt-1.5 font-mono text-text-1">
                {{ n.inputCount.label }} : <b>{{ n.inputCount.value }}</b>
              </p>
            </div>
            <div class="rounded border border-border/50 bg-bg/40 px-3 py-2.5">
              <p class="text-[10px] uppercase tracking-wider text-text-3 mb-1">Ce qui sort</p>
              <p class="text-xs text-text-2">{{ n.output }}</p>
              <p v-if="n.outputCount" class="text-[11px] mt-1.5 font-mono text-text-1">
                {{ n.outputCount.label }} : <b>{{ n.outputCount.value }}</b>
              </p>
            </div>
          </div>

          <!-- Réglages -->
          <div>
            <p class="text-[10px] uppercase tracking-wider text-text-3 mb-1.5">Les réglages qui l'affectent</p>
            <div class="flex flex-wrap gap-1.5">
              <span v-for="s in n.settings" :key="s" class="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-border/60 bg-bg/50 text-[11px] text-text-2">{{ s }}</span>
            </div>
          </div>

          <!-- Modèle IA -->
          <div class="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded border border-border/50 bg-bg/40 px-3 py-2.5 text-[11px]">
            <span class="text-text-2">🤖 Modèle : <b class="text-text-1">{{ n.model }}</b></span>
            <span class="text-text-2">🌡️ Température : <b class="text-text-1">{{ n.temp }}</b></span>
            <span class="text-text-2">🔍 Recherche web : <b class="text-text-1" :class="store.ecriture.webSearchEnabled ? 'text-accent' : 'text-text-3'">{{ store.ecriture.webSearchEnabled ? 'oui' : 'non' }}</b></span>
            <span v-if="n.note" class="text-text-3">{{ n.note }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Note finale -->
    <LCard title="💡 À retenir">
      <ul class="space-y-1.5 text-xs text-text-2 list-disc list-inside">
        <li><b>Le cycle principal</b> (collecte → image) tourne toutes les {{ store.planning.intervalleMinutes }} min ; <b>la diffusion</b> toutes les 2 min, en continu.</li>
        <li><b>Sans clé Gemini</b>, les nœuds Tri / Rédaction / Vérification sont ignorés proprement (les sujets restent en attente) — la clé se règle dans <router-link to="/systeme" class="text-accent hover:underline">Système → Clé API Gemini</router-link>.</li>
        <li><b>Sans ton feu vert</b> (page Signaux), un sujet validé reste en attente — sauf en <b>Mode Fantôme</b> (l'IA valide et publie seule, à activer dans Atelier → Vérification ou Diffusion).</li>
        <li>Le détail de chaque passage (durée, erreurs) est dans la <router-link to="/" class="text-accent hover:underline">Vue d'ensemble → Suivi</router-link>.</li>
      </ul>
    </LCard>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useConfigStore } from '../stores/config'
import { useSystemStore } from '../stores/system'
import LCard from '../components/ui/LCard.vue'
import LBadge from '../components/ui/LBadge.vue'
import LButton from '../components/ui/LButton.vue'

const store = useConfigStore()
const system = useSystemStore()

onMounted(() => {
  system.fetchHealth()
  system.fetchCycles()
  const t = setInterval(() => { system.fetchHealth(); system.fetchCycles() }, 30_000)
  onUnmounted(() => clearInterval(t))
})

function runScan() {
  system.triggerScan()
  setTimeout(() => { system.fetchHealth(); system.fetchCycles() }, 6000)
}

// ── Live : nœud actif + statut du dernier cycle ──
function nodeEnabled(type: string): boolean {
  return store.atelier.find(n => n.type === type)?.enabled ?? true
}
function lastStepStatus(type: string): string | null {
  const last = system.cycles.find(c => c.source === 'pipeline')
  if (!last) return null
  const st = last.steps.find(s => s.type === type)
  return st?.status ?? null
}

const counts = computed(() => system.counts)
const modelNames = computed(() => {
  const seen = new Set([store.ecriture.modeleRapide, store.ecriture.modeleRedaction, store.ecriture.modeleVerification])
  return [...seen].filter(Boolean).join(' et ')
})

// Canaux d'ingestion actifs
const channelsOn = computed(() => {
  const c: string[] = ['RSS']
  if (store.sources.xEnabled) c.push('X')
  if (store.sources.telegramEnabled) c.push('Telegram')
  if (store.sources.googleNewsEnabled) c.push('Google News')
  if (store.sources.rssBridgeEnabled) c.push('RSS-Bridge')
  return c.join(' + ')
})
const platformsOn = computed(() => {
  const p: string[] = []
  if (store.partage.qoe) p.push('qoe.fi')
  if (store.partage.discord) p.push('Discord')
  if (store.partage.x) p.push('X')
  if (store.partage.bluesky) p.push('Bluesky')
  if (store.partage.mastodon) p.push('Mastodon')
  return p.length ? p.join(', ') : 'aucune'
})

// ── Les 7 nœuds, décrits en français simple ──
const chain = computed(() => [
  {
    id: 1, type: 'ingestion', icon: '📡', label: 'Collecte',
    role: 'Aspirer les nouveaux articles de toutes tes sources',
    what: 'Le robot parcourt tes sources en parallèle : flux RSS directs, mots-clés Google News (converti en flux officiel), comptes X et chaînes Telegram via RSS-Bridge. Il ne garde que les articles de la fenêtre (les dernières heures) et ignore ceux déjà vus (mémoire seen_urls). Chaque source est surveillée : échecs répétés → quarantaine automatique.',
    input: 'Tes sources actives : RSS, X, Telegram, Google News, RSS-Bridge.',
    output: 'Des articles bruts en mémoire : titre, lien, extrait, date, source, biais, fiabilité — et bientôt le contenu complet.',
    settingsTo: '/sources',
    settings: [
      `Fenêtre de collecte : ${store.sources.lookbackHours} h`,
      `Max par passage : ${store.sources.maxArticlesPerScan}`,
      `En parallèle : ${store.sources.concurrency}`,
      `Canaux : ${channelsOn.value}`,
    ],
    model: '— (pas d’IA ici)',
    temp: '—',
    note: 'Régler dans Sources (©).',
    inputCount: null,
    outputCount: null,
  },
  {
    id: 2, type: 'dedup', icon: '🗑️', label: 'Anti-doublons',
    role: 'Regrouper ce qui parle de la même chose',
    what: 'Les articles qui racontent la même info sont rassemblés en un seul « sujet » (comparaison des titres, seuil de ressemblance). Le robot élimine aussi ce qui a déjà été traité dans la fenêtre anti-doublons. Résultat : un sujet = une info, pas dix versions du même titre.',
    input: 'Les articles bruts aspirés à l’instant.',
    output: 'Des sujets uniques, rangés dans la file « ingérés » (statut INGESTED).',
    settingsTo: '/atelier',
    settings: [
      `Ressemblance max : ${store.filtres.seuilRessemblance}%`,
      `Fenêtre anti-doublons : ${store.filtres.fenetreDoublonsHeures} h`,
    ],
    model: '— (pas d’IA ici)',
    temp: '—',
    note: 'Régler dans Atelier → Anti-doublons.',
    inputCount: null,
    outputCount: { label: 'En file pour le tri (INGESTED)', value: String(counts.value.INGESTED ?? 0) },
  },
  {
    id: 3, type: 'research', icon: '🧠', label: 'Tri',
    role: 'L’IA décide si le sujet mérite d’être traité',
    what: 'Chaque sujet est lu par l’IA, qui cherche sur le web (vérif des faits, passif des protagonistes), note le sujet de 0 à 100, choisit la catégorie parmi tes formats actifs et la zone (France / international). La règle anti-désinformation s’applique ici : si une source orientée attaque un sujet, l’IA est hyper critique et peut marquer le sujet « à recouper ». En dessous de la note minimum → rejeté.',
    input: 'Les sujets ingérés (max 10 par passage).',
    output: 'Sujets approuvés (statut RESEARCHED, avec catégorie + géo) ou rejetés (REJECTED).',
    settingsTo: '/ecriture',
    settings: [
      `Modèle : ${store.ecriture.modeleRapide}`,
      `En parallèle : ${store.ecriture.tachesEnMemeTempsRapide}`,
      `Note minimum : ${store.ecriture.scoreMini}/100`,
      `Recherche web : ${store.ecriture.webSearchEnabled ? 'oui' : 'non'}`,
    ],
    model: store.ecriture.modeleRapide,
    temp: '0.1 (strict)',
    note: 'Les consignes de tri se règlent dans Écriture.',
    inputCount: { label: 'En attente (INGESTED)', value: String(counts.value.INGESTED ?? 0) },
    outputCount: { label: 'Prêts à rédiger (RESEARCHED)', value: String(counts.value.RESEARCHED ?? 0) },
  },
  {
    id: 4, type: 'editor', icon: '✍️', label: 'Rédaction',
    role: 'L’IA écrit le post, à la manière de L’Assez',
    what: 'L’IA rédige le brouillon complet à partir de la matière première (extraits de tous les articles du sujet + contenu complet des 2 meilleures sources + biais/fiabilité de chaque source). Elle cherche sur le web (mission GOOGLE SEARCH du DNA) pour vérifier les faits et sortir les casseroles des protagonistes. Le format choisi au tri (FLASH, ALERTE…) impose sa structure (exemples fournis) ; le style applique l’identité « Le Mécanicien », la règle de vocabulaire et la méthode des 3 tirs pour les images.',
    input: 'Les sujets triés (max 10 par passage).',
    output: 'Des brouillons complets (statut DRAFTED) : titre, corps, tags, requêtes d’images, couleur.',
    settingsTo: '/ecriture',
    settings: [
      `Modèle : ${store.ecriture.modeleRedaction}`,
      `En parallèle : ${store.ecriture.tachesEnMemeTempsRedaction}`,
      `Recherche web : ${store.ecriture.webSearchEnabled ? 'oui' : 'non'}`,
      `Format → modèle : ${store.ecriture.modeleParFormat.FLASH} (tous les formats)`,
    ],
    model: store.ecriture.modeleRedaction,
    temp: '0.9 (créatif)',
    note: 'La ligne éditoriale (identité, vocabulaire, images) se règle dans Écriture.',
    inputCount: { label: 'En attente (RESEARCHED)', value: String(counts.value.RESEARCHED ?? 0) },
    outputCount: { label: 'À vérifier (DRAFTED)', value: String(counts.value.DRAFTED ?? 0) },
  },
  {
    id: 5, type: 'validator', icon: '⚖️', label: 'Vérification',
    role: 'Relire, vérifier en ligne, corriger ou rejeter',
    what: 'L’IA relit le brouillon, vérifie les faits en ligne (recherche web), corrige ce qui doit l’être (les corrections sont fusionnées dans le texte) et rend son verdict. Un brouillon validé passe à l’étape suivante ; un brouillon douteux est rejeté avec la raison. En Mode Fantôme, la validation humaine est sautée et le sujet passe directement en attente de publication.',
    input: 'Les brouillons (max 10 par passage).',
    output: 'Brouillons validés (statut VALIDATED) ou rejetés (REJECTED / REJECTED_ERROR).',
    settingsTo: '/ecriture',
    settings: [
      `Modèle : ${store.ecriture.modeleVerification}`,
      `Recherche web : ${store.ecriture.webSearchEnabled ? 'oui' : 'non'}`,
      `Mode Fantôme : ${store.partage.autoApprove ? 'oui (l’IA valide seule)' : 'non (tu valides dans Signaux)'}`,
    ],
    model: store.ecriture.modeleVerification,
    temp: '0.1 (strict)',
    note: 'Mode Fantôme réglable dans Atelier → Vérification ou Diffusion.',
    inputCount: { label: 'À vérifier (DRAFTED)', value: String(counts.value.DRAFTED ?? 0) },
    outputCount: { label: 'À illustrer (VALIDATED)', value: String(counts.value.VALIDATED ?? 0) },
  },
  {
    id: 6, type: 'media', icon: '📸', label: 'Image',
    role: 'Trouver l’image qui va avec le post',
    what: 'Le robot cherche des images à partir des requêtes du brouillon (la méthode des 3 tirs : requête ultra précise, ou 2-3 requêtes de contexte/symbole). Les réseaux sociaux sont bannis, et chaque source peut interdire l’usage de ses images (option « images de la source »). Le visuel est ensuite habillé selon tes réglages (overlay, cadres).',
    input: 'Les brouillons validés.',
    output: 'Des sujets prêts à publier (statut PENDING) : brouillon + image.',
    settingsTo: '/atelier',
    settings: [
      `Overlay sombre : ${store.media.overlayEnabled ? 'oui' : 'non'} (${store.media.overlayOpacity}%)`,
      `Cadre 16:9 : ${store.media.boxScale169}%`,
      `Cadre 1:1 : ${store.media.boxScale11}%`,
    ],
    model: '— (recherche d’images, pas de génération)',
    temp: '—',
    note: 'Régler dans Atelier → Image.',
    inputCount: { label: 'À illustrer (VALIDATED)', value: String(counts.value.VALIDATED ?? 0) },
    outputCount: { label: 'En attente de publication (PENDING)', value: String(counts.value.PENDING ?? 0) },
  },
  {
    id: 7, type: 'publisher', icon: '📤', label: 'Diffusion',
    role: 'Envoyer sur tes plateformes (en continu, toutes les 2 min)',
    what: 'Hors cycle principal : la boucle de diffusion tourne toutes les 2 minutes. Elle prend les sujets en attente — en Mode Fantôme ils partent seuls ; sinon tu dois cliquer « Approuvé » dans la page Signaux. Pour chaque sujet, une mission est créée par plateforme activée (qoe.fi, Discord, X, Bluesky, Mastodon), filtrée par la matrice format → plateformes, puis envoyée après un délai min/max pour étaler les publications.',
    input: 'Les sujets en attente (PENDING), approuvés par toi (ou d’office en Mode Fantôme).',
    output: 'Des publications envoyées (statut QUEUED → PUBLISHED) sur tes plateformes.',
    settingsTo: '/diffusion',
    settings: [
      `Plateformes : ${platformsOn.value || 'aucune'}`,
      `Délai : ${store.partage.delaiMini}–${store.partage.delaiMaxi} min`,
      `Auto-publication : ${store.partage.auto ? 'oui' : 'non'}`,
      `Mode Fantôme : ${store.partage.autoApprove ? 'oui' : 'non'}`,
    ],
    model: '— (pas d’IA ici)',
    temp: '—',
    note: 'Régler dans Diffusion (plateformes, délais, matrice).',
    inputCount: { label: 'En attente (PENDING)', value: String(counts.value.PENDING ?? 0) },
    outputCount: { label: 'Publiés (PUBLISHED)', value: String(counts.value.PUBLISHED ?? 0) },
  },
])
</script>
