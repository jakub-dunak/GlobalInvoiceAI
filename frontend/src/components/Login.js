import React from 'react';
import { Card, Button, Spinner, Alert } from 'react-bootstrap';
import { FaSignInAlt } from 'react-icons/fa';

const Login = ({ onLogin }) => {
  return (
    <div className="d-flex justify-content-center align-items-center min-vh-100 bg-light">
      <Card style={{ width: '400px' }}>
        <Card.Body className="text-center p-4">
          <div className="mb-4">
            <h2 className="text-primary">GlobalInvoiceAI</h2>
            <p className="text-muted">AI-Powered Invoice Management</p>
          </div>

          <div className="mb-4">
            <p className="lead">
              Sign in to access the GlobalInvoiceAI dashboard and manage your invoices with AI-powered validation and generation.
            </p>
          </div>

          <Alert variant="info">
            <strong>Features:</strong>
            <ul className="text-start mt-2 mb-0">
              <li>Multi-currency invoice processing</li>
              <li>Automated tax calculations (US, UK, India)</li>
              <li>Real-time currency conversion</li>
              <li>PDF invoice generation</li>
              <li>Comprehensive validation and error detection</li>
            </ul>
          </Alert>

          <div className="mb-4">
            <Button
              variant="primary"
              size="lg"
              className="w-100"
              onClick={onLogin}
            >
              <FaSignInAlt className="me-2" />
              Sign In with AWS Cognito
            </Button>
          </div>

          <div className="text-muted">
            <small>
              Secure authentication powered by AWS Cognito.
              Your data is encrypted and protected.
            </small>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
};

export default Login;
