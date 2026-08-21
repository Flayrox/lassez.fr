import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from './views/Dashboard.vue'
import Atelier from './views/Atelier.vue'
import Sources from './views/Sources.vue'
import Filtres from './views/Filtres.vue'
import Ecriture from './views/Ecriture.vue'
import Formats from './views/Formats.vue'
import Partage from './views/Partage.vue'
import Planning from './views/Planning.vue'
import Systeme from './views/Systeme.vue'
import Users from './views/Users.vue'
import Signaux from './views/Signaux.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Dashboard },
    { path: '/signaux', component: Signaux },
    { path: '/atelier', component: Atelier },
    { path: '/sources', component: Sources },
    { path: '/filtres', component: Filtres },
    { path: '/ecriture', component: Ecriture },
    { path: '/formats', component: Formats },
    { path: '/partage', component: Partage },
    { path: '/planning', component: Planning },
    { path: '/systeme', component: Systeme },
    { path: '/users', component: Users },
    // redirects anciens chemins
    { path: '/pipeline', redirect: '/atelier' },
    { path: '/ia', redirect: '/ecriture' },
    { path: '/diffusion', redirect: '/partage' },
    { path: '/schedule', redirect: '/planning' },
  ]
})
