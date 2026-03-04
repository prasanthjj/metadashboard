import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SpeedInsights } from '@vercel/speed-insights/react'
import Dashboard from './dashboard.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Dashboard />
    <SpeedInsights />
  </StrictMode>
)
