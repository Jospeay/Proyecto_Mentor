if (typeof URL.parse === 'undefined') {
  URL.parse = function (url, base) {
    try { return new URL(url, base); }
    catch { throw new TypeError(`Invalid URL: ${url}`); }
  };
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <React.StrictMode>
      <App />
    </React.StrictMode>
  </ErrorBoundary>,
);
