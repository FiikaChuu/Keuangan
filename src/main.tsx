import React from 'react';
import ReactDOM from 'react-dom/client';
import './fonts.css';
import App from './App';
import './app.css';

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
