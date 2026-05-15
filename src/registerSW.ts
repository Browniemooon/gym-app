import { registerSW } from 'virtual:pwa-register';

if ('serviceWorker' in navigator) {
  registerSW({
    onNeedRefresh() {
      if (confirm('New content available. Reload?')) {
        window.location.reload();
      }
    },
    onOfflineReady() {
      console.log('App ready for offline use');
    },
  });
}
