import { Capacitor } from '@capacitor/core';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { JournalErrorBoundary } from './components/JournalErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <JournalErrorBoundary><App /></JournalErrorBoundary>
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD && !Capacitor.isNativePlatform()) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(console.error); });
}
