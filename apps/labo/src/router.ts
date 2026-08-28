import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from './views/Dashboard.vue'
import Atelier from './views/Atelier.vue'
import Sources from './views/Sources.vue'
import Ecriture from './views/Ecriture.vue'
import Diffusion from './views/Diffusion.vue'
import Systeme from './views/Systeme.vue'
import Signaux from './views/Signaux.vue'
import Pipeline from './views/Pipeline.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Dashboard },
    { path: '/signaux', component: Signaux },
    { path: '/atelier', component: Atelier },
    { path: '/sources', component: Sources },
    { path: '/ecriture', component: Ecriture },
    { path: '/pipeline', component: Pipeline },
    { path: '/diffusion', component: Diffusion },
    { path: '/systeme', component: Systeme },
    // redirects anciens chemins (Filtres/Formats/Partage/Planning/Users fusionnés)
    { path: '/filtres', redirect: '/atelier' },
    { path: '/ia', redirect: '/ecriture' },
    { path: '/formats', redirect: '/ecriture' },
    { path: '/partage', redirect: '/diffusion' },
    { path: '/planning', redirect: '/diffusion' },
    { path: '/schedule', redirect: '/diffusion' },
    { path: '/diffusion', redirect: '/diffusion' },
    { path: '/users', redirect: '/systeme' },
  ],
})