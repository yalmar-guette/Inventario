import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

import GlobalErrorBoundary from './components/GlobalErrorBoundary'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </GlobalErrorBoundary>
  </React.StrictMode>,
)
