import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Amplify } from 'aws-amplify';
import { Auth } from 'aws-amplify';
import { withAuthenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import 'bootstrap/dist/css/bootstrap.min.css';

import Dashboard from './components/Dashboard';
import InvoiceList from './components/InvoiceList';
import ControlPanel from './components/ControlPanel';
import Login from './components/Login';
import Navigation from './components/Navigation';
import { apiService } from './utils/api';

function App({ signOut, user }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const user = await Auth.currentAuthenticatedUser();
      setCurrentUser(user);
      setIsAuthenticated(true);
    } catch {
      setIsAuthenticated(false);
      setCurrentUser(null);
    }
  };

  const handleSignOut = async () => {
    try {
      await Auth.signOut();
      setIsAuthenticated(false);
      setCurrentUser(null);
      signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Configure Amplify
  Amplify.configure({
    Auth: {
      region: process.env.REACT_APP_REGION || 'us-east-1',
      userPoolId: process.env.REACT_APP_USER_POOL_ID,
      userPoolWebClientId: process.env.REACT_APP_USER_POOL_CLIENT_ID,
    },
    API: {
      endpoints: [
        {
          name: 'GlobalInvoiceAI',
          endpoint: process.env.REACT_APP_API_URL || 'https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/dev',
          region: process.env.REACT_APP_REGION || 'us-east-1',
        },
      ],
    },
  });

  if (!isAuthenticated) {
    return <Login onLogin={checkAuthState} />;
  }

  return (
    <Router>
      <div className="App">
        <Navigation user={currentUser} onSignOut={handleSignOut} />
        <div className="container-fluid mt-4">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/invoices" element={<InvoiceList />} />
            <Route path="/control" element={<ControlPanel />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default withAuthenticator(App);
