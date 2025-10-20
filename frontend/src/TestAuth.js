import React from 'react';
import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

// Simple test configuration
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.REACT_APP_USER_POOL_ID || 'test',
      userPoolClientId: process.env.REACT_APP_USER_POOL_CLIENT_ID || 'test',
      loginWith: {
        email: true,
      }
    }
  }
});

export default function TestAuth() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Auth Test Page</h1>
      <p>UserPoolId: {process.env.REACT_APP_USER_POOL_ID || 'NOT SET'}</p>
      <p>ClientId: {process.env.REACT_APP_USER_POOL_CLIENT_ID || 'NOT SET'}</p>
      
      <Authenticator loginMechanisms={['email']}>
        {({ signOut, user }) => (
          <div>
            <h2>✅ Authenticated!</h2>
            <p>User: {user?.username}</p>
            <p>Email: {user?.attributes?.email}</p>
            <button onClick={signOut}>Sign Out</button>
          </div>
        )}
      </Authenticator>
    </div>
  );
}

