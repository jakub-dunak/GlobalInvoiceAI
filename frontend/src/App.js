import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Amplify } from 'aws-amplify';
import '@aws-amplify/ui-react/styles.css';
import 'bootstrap/dist/css/bootstrap.min.css';

// Import AWS configuration (generated during deployment)
import awsconfig from './aws-exports';

import Dashboard from './components/Dashboard';
import InvoiceList from './components/InvoiceList';
import ControlPanel from './components/ControlPanel';
import Navigation from './components/Navigation';
import AuthWrapper from './components/AuthWrapper';

// Configure Amplify at module level (before component definition)
Amplify.configure(awsconfig);

function App() {
  return (
    <Router>
      <AuthWrapper>
        <div className="App">
          <Navigation />
          <div className="container-fluid mt-4">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/invoices" element={<InvoiceList />} />
              <Route path="/control" element={<ControlPanel />} />
            </Routes>
          </div>
        </div>
      </AuthWrapper>
    </Router>
  );
}

export default App;
