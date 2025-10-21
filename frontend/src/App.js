import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Amplify, Auth } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import 'bootstrap/dist/css/bootstrap.min.css';

import Dashboard from './components/Dashboard';
import InvoiceList from './components/InvoiceList';
import ControlPanel from './components/ControlPanel';
import Navigation from './components/Navigation';

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

function App() {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    // Check for authenticated user on app load
    const checkUser = async () => {
      try {
        const user = await Auth.currentAuthenticatedUser();
        setCurrentUser(user);
      } catch (error) {
        // User not authenticated, will be handled by Authenticator
        setCurrentUser(null);
      }
    };

    checkUser();
  }, []);

  const handleSignOut = async () => {
    try {
      await Auth.signOut();
      setCurrentUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <Authenticator loginMechanisms={['email']}>
      {({ signOut, user }) => {
        // Update current user state when authentication state changes
        if (user && !currentUser) {
          setCurrentUser(user);
        } else if (!user && currentUser) {
          setCurrentUser(null);
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
                </Routes>
              </div>
            </div>
          </Router>
        );
      }}
    </Authenticator>
  );
}

export default App;
