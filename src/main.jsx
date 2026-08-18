import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

/**
 * PUNTO DE ENTRADA PRINCIPAL DE REACT (Renderer Process)
 * 
 * Este archivo inicializa el árbol de componentes de React en el contenedor HTML #root.
 */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
