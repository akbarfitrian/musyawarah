export function focusComposer() {
  const el = document.getElementById('composer-textarea')
  el?.focus()
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
