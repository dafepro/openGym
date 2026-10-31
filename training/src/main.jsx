import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles/index.css'
import './styles/player.css'
import './styles/workout-refinements.css'

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)
