import React from 'react'
import ReactDOM from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap.min.css'
import './styles/responsive.css'
import ResourcePreloader from './components/ResourcePreloader'
import App from './App'

// Auto-reload once when a lazy-loaded chunk fails (stale build after deploy).
// The sessionStorage flag prevents infinite reload loops.
function handleChunkError() {
  const key = 'chunk-reload';
  if (!sessionStorage.getItem(key)) {
    sessionStorage.setItem(key, '1');
    window.location.reload();
  }
}
window.addEventListener('error', (e) => {
  if (e.message?.includes('Failed to fetch dynamically imported module')) {
    handleChunkError();
  }
}, true)
window.addEventListener('unhandledrejection', (e) => {
  if (e.reason?.message?.includes('Failed to fetch dynamically imported module')) {
    handleChunkError();
  }
})

// Clear the chunk-reload flag on successful app boot
sessionStorage.removeItem('chunk-reload');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ResourcePreloader>
      <App />
    </ResourcePreloader>
  </React.StrictMode>,
)
