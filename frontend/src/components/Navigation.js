import React from 'react';
import { Navbar, Nav, Container } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';
import { FaSignOutAlt, FaUser } from 'react-icons/fa';
import { useAuthenticator } from '@aws-amplify/ui-react';

// Check if we have valid Cognito configuration
let hasValidCognitoConfig = false;

try {
  const awsExports = require('../aws-exports').default;
  hasValidCognitoConfig = awsExports.aws_user_pools_id && awsExports.aws_user_pools_web_client_id;
} catch (error) {
  // Fallback to environment variables for local development
  hasValidCognitoConfig = process.env.REACT_APP_USER_POOL_ID && process.env.REACT_APP_USER_POOL_CLIENT_ID;
}

// Development navigation component (only rendered when Cognito is not configured)
const DevelopmentNavigation = () => {
  return (
    <Navbar.Text className="me-3">
      <FaUser className="me-1" />
      Development Mode
    </Navbar.Text>
  );
};

// Authenticated navigation wrapper component (handles authentication state)
const AuthenticatedNavigationWrapper = () => {
  const { authStatus } = useAuthenticator((context) => [context.authStatus]);

  if (authStatus === 'authenticated') {
    return <AuthenticatedNavigationContent />;
  }

  return null;
};

// Authenticated navigation content (only rendered when user is authenticated)
const AuthenticatedNavigationContent = () => {
  const { user, signOut } = useAuthenticator((context) => [context.user, context.signOut]);

  return (
    <>
      <Navbar.Text className="me-3">
        <FaUser className="me-1" />
        {user?.signInDetails?.loginId || user?.attributes?.email || 'User'}
      </Navbar.Text>
      <Nav.Link onClick={signOut}>
        <FaSignOutAlt className="me-1" />
        Sign Out
      </Nav.Link>
    </>
  );
};

// Main navigation component
const Navigation = () => {
  const location = useLocation();

  // Determine what to show in the navigation
  const renderNavigationContent = () => {
    if (!hasValidCognitoConfig) {
      // Development mode - no Cognito configured
      return <DevelopmentNavigation />;
    }

    // When Cognito is configured, use the authenticated navigation wrapper
    // This component will only render when user is authenticated
    return <AuthenticatedNavigationWrapper />;
  };

  return (
    <Navbar bg="dark" variant="dark" expand="lg">
      <Container>
        <Navbar.Brand as={Link} to="/">
          <strong>GlobalInvoiceAI</strong>
        </Navbar.Brand>

        <Navbar.Toggle aria-controls="basic-navbar-nav" />

        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link
              as={Link}
              to="/"
              active={location.pathname === '/'}
            >
              Dashboard
            </Nav.Link>
            <Nav.Link
              as={Link}
              to="/invoices"
              active={location.pathname === '/invoices'}
            >
              Invoices
            </Nav.Link>
            <Nav.Link
              as={Link}
              to="/control"
              active={location.pathname === '/control'}
            >
              Control Panel
            </Nav.Link>
          </Nav>

          <Nav className="ms-auto">
            {renderNavigationContent()}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default Navigation;
