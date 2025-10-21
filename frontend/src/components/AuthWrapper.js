import React, { useState } from 'react';
import {
  Authenticator,
  useAuthenticator,
  View,
  Heading,
  Text,
  ThemeProvider
} from '@aws-amplify/ui-react';

// Check if we have valid Cognito configuration for authentication
let hasValidCognitoConfig = false;

try {
  const awsExports = require('../aws-exports').default;
  hasValidCognitoConfig = awsExports.aws_user_pools_id && awsExports.aws_user_pools_web_client_id;
} catch (error) {
  // Fallback to environment variables for local development
  hasValidCognitoConfig = process.env.REACT_APP_USER_POOL_ID && process.env.REACT_APP_USER_POOL_CLIENT_ID;
}

// Custom theme for Amplify Authenticator
const authTheme = {
  name: 'secureAuditTheme',
  tokens: {
    colors: {
      background: {
        primary: { value: '#fafafa' },
        secondary: { value: '#ffffff' },
      },
      font: {
        primary: { value: '#171717' },
        secondary: { value: '#525252' },
        tertiary: { value: '#737373' },
      },
      brand: {
        primary: {
          10: { value: '#f0f9ff' },
          20: { value: '#e0f2fe' },
          40: { value: '#bae6fd' },
          60: { value: '#7dd3fc' },
          80: { value: '#38bdf8' },
          90: { value: '#0ea5e9' },
          100: { value: '#0284c7' },
        },
      },
    },
    components: {
      button: {
        primary: {
          backgroundColor: { value: '{colors.brand.primary.90}' },
          _hover: {
            backgroundColor: { value: '{colors.brand.primary.100}' },
          },
        },
      },
      fieldcontrol: {
        _focus: {
          borderColor: { value: '{colors.brand.primary.90}' },
          boxShadow: { value: '0 0 0 1px {colors.brand.primary.90}' },
        },
      },
    },
  },
};

// interface AuthWrapperProps {
//   children: React.ReactNode;
// }

// Custom sign-in form component
const CustomSignIn = () => {
  return (
    <View className="space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <Heading level={1} className="text-2xl font-bold text-neutral-900">
          Welcome to GlobalInvoiceAI
        </Heading>
        <Text className="text-neutral-600">
          Sign in to access your invoice processing dashboard
        </Text>
      </div>
    </View>
  );
};

// Custom sign-up form component
const CustomSignUp = () => {
  return (
    <View className="space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        </div>
        <Heading level={1} className="text-2xl font-bold text-neutral-900">
          Create Your Account
        </Heading>
        <Text className="text-neutral-600">
          Get started with GlobalInvoiceAI
        </Text>
      </div>
    </View>
  );
};

// Loading component
const AuthLoading = () => (
  <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
    <div className="text-center space-y-4">
      <div className="loading-spinner w-12 h-12 mx-auto"></div>
      <div>
        <h3 className="text-lg font-semibold text-neutral-900 mb-2">
          Authenticating...
        </h3>
        <p className="text-neutral-600 text-sm">
          Please wait while we verify your credentials
        </p>
      </div>
    </div>
  </div>
);

// Component that handles authentication when Cognito is configured
const AuthenticatedWrapper = ({ children }) => {
  return (
    <ThemeProvider theme={authTheme}>
      <Authenticator
        components={{
          SignIn: {
            Header: CustomSignIn,
          },
          SignUp: {
            Header: CustomSignUp,
          },
        }}
        signUpAttributes={['email', 'name']}
        loginMechanisms={['email']}
        socialProviders={[]}
        variation="default"
      >
        <AuthenticatorContent>{children}</AuthenticatorContent>
      </Authenticator>
    </ThemeProvider>
  );
};

// Inner component that uses useAuthenticator hook
const AuthenticatorContent = ({ children }) => {
  const { authStatus } = useAuthenticator((context) => [context.authStatus]);

  // Show loading while checking authentication status
  if (authStatus === 'configuring') {
    return <AuthLoading />;
  }

  // If authenticated, render the protected content
  if (authStatus === 'authenticated') {
    return <>{children}</>;
  }

  // Default fallback - this shouldn't be reached since Authenticator handles unauthenticated state
  return <AuthLoading />;
};

// Development mode component (when Cognito is not configured)
const DevelopmentModeBanner = () => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-sm font-medium text-yellow-800">
              Development Mode Active
            </p>
            <p className="text-sm text-yellow-700">
              Authentication is disabled. Deploy to production for full security features.
            </p>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-yellow-700 hover:text-yellow-900"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

// Main wrapper component
const AuthWrapper = ({ children }) => {
  // Skip authentication entirely in local development if Cognito is not configured
  if (!hasValidCognitoConfig) {
    return (
      <>
        <DevelopmentModeBanner />
        {children}
      </>
    );
  }

  // Use authenticated wrapper when Cognito is configured
  return <AuthenticatedWrapper>{children}</AuthenticatedWrapper>;
};

export default AuthWrapper;
