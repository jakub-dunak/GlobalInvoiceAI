import React, { useEffect } from 'react';
import { Amplify, Auth } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

export default function TestAuth() {
  const [currentUser, setCurrentUser] = React.useState(null);
  const [error, setError] = React.useState(null);

  useEffect(() => {
    // Force reconfigure to pick up new environment variables
    Amplify.configure({
      Auth: {
        Cognito: {
          userPoolId: process.env.REACT_APP_USER_POOL_ID,
          userPoolClientId: process.env.REACT_APP_USER_POOL_CLIENT_ID,
          loginWith: {
            email: true,
          }
        }
      }
    });
    console.log('🔄 Force reconfigured Amplify with:', {
      userPoolId: process.env.REACT_APP_USER_POOL_ID,
      userPoolClientId: process.env.REACT_APP_USER_POOL_CLIENT_ID,
    });

    // Check if user is already authenticated
    Auth.currentAuthenticatedUser()
      .then(user => {
        console.log('✅ User already authenticated:', user);
        setCurrentUser(user);
      })
      .catch(err => {
        console.log('ℹ️ User not authenticated:', err.message);
        setError(null);
      });
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>🔍 Auth Test Page v2</h1>

      <div style={{ background: '#f8f9fa', padding: '15px', margin: '20px 0', border: '1px solid #ddd' }}>
        <h3>Environment Variables:</h3>
        <p>UserPoolId: <strong>{process.env.REACT_APP_USER_POOL_ID || '❌ NOT SET'}</strong></p>
        <p>ClientId: <strong>{process.env.REACT_APP_USER_POOL_CLIENT_ID || '❌ NOT SET'}</strong></p>
        <p>API URL: <strong>{process.env.REACT_APP_API_URL || '❌ NOT SET'}</strong></p>
        <p>Region: <strong>{process.env.REACT_APP_REGION || '❌ NOT SET'}</strong></p>
      </div>

      {currentUser && (
        <div style={{ background: '#d4edda', padding: '15px', margin: '20px 0', border: '1px solid #c3e6cb' }}>
          <h3>✅ Already Authenticated!</h3>
          <p>User: {currentUser.username}</p>
          <p>Email: {currentUser.attributes?.email}</p>
          <button onClick={() => Auth.signOut().then(() => setCurrentUser(null))}>
            Sign Out
          </button>
        </div>
      )}

      {!currentUser && (
        <div>
          <h3>🔐 Authentication Required</h3>
          <Authenticator
            loginMechanisms={['email']}
            signUpAttributes={['email']}
            onSignIn={(user) => {
              console.log('🎉 Sign in successful:', user);
              setCurrentUser(user);
              setError(null);
            }}
            onSignUp={(user) => {
              console.log('📝 Sign up successful:', user);
              setError('✅ Check your email for verification code!');
            }}
            onConfirmSignUp={(user) => {
              console.log('✅ Confirm sign up successful:', user);
              setCurrentUser(user);
              setError(null);
            }}
          />
        </div>
      )}

      {error && (
        <div style={{ background: '#f8d7da', padding: '15px', margin: '20px 0', border: '1px solid #f5c6cb', color: '#721c24' }}>
          <h4>⚠️ Message:</h4>
          <p>{error}</p>
        </div>
      )}

      <div style={{ marginTop: '30px', padding: '15px', background: '#fff3cd', border: '1px solid #ffeaa7' }}>
        <h4>🔧 Debug Actions:</h4>
        <button onClick={() => window.location.reload()}>
          🔄 Reload Page
        </button>
        <button onClick={() => {
          console.log('Current Amplify config:', Amplify.getConfig());
        }}>
          📋 Log Config
        </button>
        <button onClick={() => {
          Auth.currentSession()
            .then(session => console.log('Session:', session))
            .catch(err => console.log('No session:', err));
        }}>
          🔑 Check Session
        </button>
      </div>
    </div>
  );
}

