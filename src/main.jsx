import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Dashboard from './dashboard.jsx'
import { SpeedInsights } from '@vercel/speed-insights/react'
  

createRoot(document.getElementById('root')).render(
 <StrictMode>
    <Dashboard />
    <SpeedInsights />
  </StrictMode>
)
