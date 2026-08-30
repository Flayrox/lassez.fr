import { createRouter, createWebHistory } from 'vue-router'
import EmploiDuTemps from './views/EmploiDuTemps.vue' // Calendrier — accueil du produit Signaux
import Signaux from './views/Signaux.vue'
import Sources from './views/Sources.vue'
import Atelier from './views/Atelier.vue' // page « Pipeline » du produit Signaux
import Ecriture from './views/Ecriture.vue'
import Diffusion from './views/Diffusion.vue'
import Elections from './views/Elections.vue'
import Slide from './views/Slide.vue'
import Systeme from './views/Systeme.vue' // page « Système » du produit Paramètres

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    // ── Produit Signaux ──
    { path: '/', component: EmploiDuTemps },
    { path: '/signaux', component: Signaux },
    { path: '/sources', component: Sources },
    { path: '/pipeline', component: Atelier },
    { path: '/ecriture', component: Ecriture },
    { path: '/diffusion', component: Diffusion },
    // ── Autres produits ──
    { path: '/elections', component: Elections },
    { path: '/slide', component: Slide },
    { path: '/settings', component: Systeme },
    // ── Anciens chemins ──
    { path: '/emploi-du-temps', redirect: '/' },
    { path: '/atelier', redirect: '/pipeline' },
    { path: '/filtres', redirect: '/pipeline' },
    { path: '/ia', redirect: '/ecriture' },
    { path: '/formats', redirect: '/ecriture' },
    { path: '/partage', redirect: '/diffusion' },
    { path: '/planning', redirect: '/' },
    { path: '/schedule', redirect: '/' },
    { path: '/hub', redirect: '/' },
    { path: '/systeme', redirect: '/settings' },
    { path: '/users', redirect: '/settings' },
  ],
})
