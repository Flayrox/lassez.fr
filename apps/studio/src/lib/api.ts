// Bascule de pipeline : le studio parle à UN pipeline à la fois, mais chaque
// instance a son port (registre daemon/config/pipelines.yaml). Le pipeline
// primaire (:4406) reste accessible en relatif (/api → proxy vite/nginx) ;
// les autres instances sont jointes en absolu (http://localhost:<port>).
let base = ''

export function setApiBase(b: string) {
  base = (b ?? '').replace(/\/+$/, '')
}

export function getApiBase() {
  return base
}

// api(path, init) — fetch relatif ou absolu selon le pipeline actif.
export function api(path: string, init?: RequestInit): Promise<Response> {
  return fetch(base + path, init)
}

// pipelineApiBase — URL de base (sans /api) pour rejoindre une instance du
// registre : relatif pour le primaire (:4406), absolu sinon.
export function pipelineApiBase(port: number): string {
  if (!port || port === 4406) return ''
  return `http://localhost:${port}`
}
