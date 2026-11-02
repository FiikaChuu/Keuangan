import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/noto-sans/latin-400.css';
import '@fontsource/noto-sans/latin-500.css';
import '@fontsource/noto-sans/latin-600.css';
import App from './App';
import './styles.css';
import './figma-dashboard.css';
import './mobile-ui.css';
import './native-ui.css';
import './typography.css';

try {
  const theme = localStorage.getItem('skysave.theme');
  document.documentElement.dataset.theme =
    theme && ['light', 'dark', 'system'].includes(theme) ? theme : 'light';
} catch {
  document.documentElement.dataset.theme = 'light';
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
if (import.meta.env.PROD && 'serviceWorker' in navigator)
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* The application also works without offline support. */
    });
  });
