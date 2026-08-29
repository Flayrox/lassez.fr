import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import './style.css'

const app = createApp(App)

// Filet de sécurité global : une erreur non gérée (ex : fetch, event handler)
// ne doit jamais faire disparaître toute l'interface.
app.config.errorHandler = (err, _instance, info) => {
  console.error('[studio] erreur globale:', err, info)
}

app.use(createPinia()).use(router).mount('#app')
