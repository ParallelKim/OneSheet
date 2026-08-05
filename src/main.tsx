import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'pretendard/dist/web/static/pretendard-dynamic-subset.css'
import App from './App.tsx'
import { initFirebaseAnalytics } from './firebase'

void initFirebaseAnalytics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
