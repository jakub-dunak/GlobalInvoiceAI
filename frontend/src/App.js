import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Amplify, Auth } from 'aws-amplify';
import { withAuthenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import 'bootstrap/dist/css/bootstrap.min.css';

import Dashboard from './components/Dashboard';
import InvoiceList from './components/InvoiceList';
import ControlPanel from './components/ControlPanel';
import Navigation from './components/Navigation';
import { apiService } from './utils/api';

// Configure Amplify at module level (before component definition)
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.REACT_APP_USER_POOL_ID,
      userPoolClientId: process.env.REACT_APP_USER_POOL_CLIENT_ID,
      loginWith: {
        email: true,
      }
    }
  },
  API: {
    endpoints: [
      {
        name: 'GlobalInvoiceAI',
        endpoint: process.env.REACT_APP_API_URL,
        region: process.env.REACT_APP_REGION || 'us-west-2',
      },
    ],
  },
});

function App({ signOut, user }) {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    if (user) {
      setCurrentUser(user);
    }
  }, [user]);

  const handleSignOut = async () => {
    try {
      await Auth.signOut();
      signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

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

export default withAuthenticator(App, {
  loginMechanisms: ['email'],
});
