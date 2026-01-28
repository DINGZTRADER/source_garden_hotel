import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Firebase configuration - set in public/index.html or via environment
if (typeof window.__firebase_config === 'undefined') {
  console.error("FATAL: Firebase config not found. Please configure window.__firebase_config in public/index.html");
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);