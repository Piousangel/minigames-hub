export function isTypingTarget(t: EventTarget | null): boolean {
  return t instanceof HTMLElement && t.closest('input, textarea, select, [contenteditable]') !== null
}
