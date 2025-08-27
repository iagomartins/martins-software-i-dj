import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom' // Use HashRouter for Electron
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter> {/* This is crucial for Electron */}
      <App />
    </HashRouter>
  </React.StrictMode>,
)
