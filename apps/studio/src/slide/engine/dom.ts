// Détection des cibles de frappe — partagée par le viewport (pan Espace)
// et les raccourcis : on ne doit jamais voler une frappe (surtout Espace,
// dont le preventDefault avale le caractère).
export function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null
  if (!el || typeof (el as HTMLElement).closest !== 'function') return false
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  ) {
    return true
  }
  if ((el as HTMLElement).isContentEditable) return true
  if (el.closest?.('.tiptap')) return true
  return false
}
