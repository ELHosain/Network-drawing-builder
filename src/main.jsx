import React from 'react';
import ReactDOM from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import Root from './Root.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import './index.css';

// Vercel Web Analytics -- the React component, not the Next.js one the setup
// screen shows by default, since this is a Vite SPA. It is cookieless and
// collects no personal data, and it only reports anything on the deployed
// vercel.app site; in local dev it is inert, so it costs nothing here.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
    <Analytics />
  </React.StrictMode>,
);
