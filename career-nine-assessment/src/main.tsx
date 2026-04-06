import React from 'react'
import ReactDOM from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap.min.css'
import './styles/responsive.css'
import ResourcePreloader from './components/ResourcePreloader'
import App from './App'

// Auto-reload when a lazy-loaded chunk fails (stale build after deploy)
window.addEventListener('error', (e) => {
  if (e.message?.includes('Failed to fetch dynamically imported module')) {
    window.location.reload()
  }
}, true)
window.addEventListener('unhandledrejection', (e) => {
  if (e.reason?.message?.includes('Failed to fetch dynamically imported module')) {
    window.location.reload()
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ResourcePreloader>
      <App />
    </ResourcePreloader>
  </React.StrictMode>,
)
