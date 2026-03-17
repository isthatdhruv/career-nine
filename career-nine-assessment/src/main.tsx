import React from 'react'
import ReactDOM from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap.min.css'
import './styles/responsive.css'
import ResourcePreloader from './components/ResourcePreloader'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ResourcePreloader>
      <App />
    </ResourcePreloader>
  </React.StrictMode>,
)
