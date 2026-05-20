import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles/index.css'
import { getStoredTheme, applyTheme, getStoredDensity, applyDensity, getStoredAccent, applyAccent } from './hooks/useTheme'
// Apply all preferences immediately to avoid FOUC
applyTheme(getStoredTheme())
applyDensity(getStoredDensity())
applyAccent(getStoredAccent())

// GitHub Pages SPA redirect: restore path from ?p= param
;(function () {
  const search = window.location.search
  if (search.startsWith('?p=')) {
    const path = decodeURIComponent(search.slice(3))
    window.history.replaceState(null, '', '/app/' + path)
  }
})()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename="/app">
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
