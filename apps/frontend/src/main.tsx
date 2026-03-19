import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'plyr/dist/plyr.css'
import './index.css'
import App from './App.tsx'

import { LanguageProvider } from './contexts/LanguageContext'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <LanguageProvider>
            <App />
        </LanguageProvider>
    </StrictMode>,
)
