import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'
import { Web3ContextProvider } from './providers/Web3ContextProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Web3ContextProvider>
        <App />
      </Web3ContextProvider>
    </BrowserRouter>
  </StrictMode>,
)
