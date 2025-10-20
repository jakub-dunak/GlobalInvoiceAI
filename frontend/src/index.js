import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import TestAuth from './TestAuth';

// Use TestAuth to debug authentication
const USE_TEST_PAGE = process.env.REACT_APP_TEST_AUTH === 'true';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {USE_TEST_PAGE ? <TestAuth /> : <App />}
  </React.StrictMode>
);
