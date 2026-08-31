import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { CartProvider } from './contexts/CartContext'
import { ChatProvider } from './contexts/ChatContext'
import { SettingsProvider } from './contexts/SettingsContext'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <AuthProvider>
        <SettingsProvider>
          <CartProvider>
            <ChatProvider>
              <App />
            </ChatProvider>
          </CartProvider>
        </SettingsProvider>
      </AuthProvider>
    </HashRouter>
  </StrictMode>,
)
