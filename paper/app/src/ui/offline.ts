/** Офлайн-кеш (sw.js пише збирання, див. tools/offline.ts). Лише в зібраному застосунку, не в розробці. */
export function registerOffline(): void {
  if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // без кешу гра працює так само, лише потребує мережі для перезавантаження
    });
  });
}
