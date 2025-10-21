import React from 'react';
import { Navbar, Nav, Container } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';
import { FaSignOutAlt, FaUser } from 'react-icons/fa';

const Navigation = ({ user = null, onSignOut = () => {} }) => {
  const location = useLocation();

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
            <Navbar.Text className="me-3">
              <FaUser className="me-1" />
              {user?.attributes?.email || 'User'}
            </Navbar.Text>
            <Nav.Link onClick={onSignOut}>
              <FaSignOutAlt className="me-1" />
              Sign Out
            </Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default Navigation;
