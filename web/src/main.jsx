import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { app } from './firebase.js'

// Vérification : doit afficher "vigilis-2026"
console.log('Firebase projectId :', app.options.projectId)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
