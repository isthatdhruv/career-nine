import React from 'react'
import ReactDOM from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap.min.css'
import './styles/responsive.css'
import ResourcePreloader from './components/ResourcePreloader'
import App from './App'

/*
  The window-level chunk-error auto-reload that used to live here is gone.

  It could never fire on this deployment: it matched only Chrome's
  "Failed to fetch dynamically imported module", whereas a stale chunk here
  surfaces as "Failed to load module script" (the static host answers unknown
  /assets/*.js with index.html — see .do/app.yaml `catchall_document`). It also
  cleared its own anti-loop sessionStorage flag at module scope on every boot,
  so the guard was dead code.

  It is not replaced, because nothing left wants it: the assessment routes are
  static imports now (App.tsx), so the only remaining dynamic imports — the game
  bundles, firebase, webgazer — all load MID-ASSESSMENT, where a reload would
  discard in-memory answers. Those fail softly instead (GameRenderer), and
  AppErrorBoundary offers a user-initiated refresh for anything else.
*/

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ResourcePreloader>
      <App />
    </ResourcePreloader>
  </React.StrictMode>,
)
