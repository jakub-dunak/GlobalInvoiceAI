import React, { useState, useEffect, useCallback } from 'react';
import { Card, Form, Button, Alert, Spinner, Row, Col } from 'react-bootstrap';
import { FaCog, FaSave, FaUndo } from 'react-icons/fa';
import { apiService } from '../utils/api';

const ControlPanel = () => {
  const [config, setConfig] = useState({
    autoApprovalThreshold: 10000,
    enabledCountries: ['US', 'UK', 'IN'],
    maxProcessingTime: 300,
    enablePDFGeneration: true,
    enableEmailNotifications: false,
    emailRecipients: '',
    retryFailedInvoices: true,
    maxRetries: 3
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const loadConfiguration = useCallback(async () => {
    try {
      setLoading(true);
      const configData = await apiService.getConfiguration();
      if (Object.keys(configData).length > 0) {
        setConfig({ ...config, ...configData });
      }
    } catch (err) {
      console.error('Error loading configuration:', err);
      setError('Failed to load configuration');
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    loadConfiguration();
  }, [loadConfiguration]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      await apiService.updateConfiguration(config);
      setMessage('Configuration saved successfully!');
    } catch (err) {
      console.error('Error saving configuration:', err);
      setError('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    loadConfiguration();
    setMessage(null);
    setError(null);
  };

  const handleInputChange = (field, value) => {
    let processedValue = value;

    // Validate and process numeric inputs
    if (['autoApprovalThreshold', 'maxProcessingTime', 'maxRetries'].includes(field)) {
      const numValue = parseInt(value);
      if (isNaN(numValue) || numValue < 0) {
        // Keep the previous value if invalid
        return;
      }
      processedValue = numValue;
    }

    setConfig(prev => ({
      ...prev,
      [field]: processedValue
    }));
  };

  const handleCountryToggle = (country) => {
    setConfig(prev => ({
      ...prev,
      enabledCountries: prev.enabledCountries.includes(country)
        ? prev.enabledCountries.filter(c => c !== country)
        : [...prev.enabledCountries, country]
    }));
  };

  if (loading) {
    return (
      <div className="text-center p-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-4">
        <FaCog className="me-2" />
        Control Panel
      </h1>

      {message && (
        <Alert variant="success" dismissible onClose={() => setMessage(null)}>
          {message}
        </Alert>
      )}

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Row>
        <Col md={8}>
          <Card className="mb-4">
            <Card.Header>
              <h5>Processing Settings</h5>
            </Card.Header>
            <Card.Body>
              <Form>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Auto-Approval Threshold ($)</Form.Label>
                      <Form.Control
                        type="number"
                        value={config.autoApprovalThreshold}
                        onChange={(e) => handleInputChange('autoApprovalThreshold', parseInt(e.target.value))}
                        min="0"
                        max="1000000"
                      />
                      <Form.Text className="text-muted">
                        Invoices below this amount will be auto-approved
                      </Form.Text>
                    </Form.Group>
                  </Col>

                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Max Processing Time (seconds)</Form.Label>
                      <Form.Control
                        type="number"
                        value={config.maxProcessingTime}
                        onChange={(e) => handleInputChange('maxProcessingTime', parseInt(e.target.value))}
                        min="60"
                        max="900"
                      />
                      <Form.Text className="text-muted">
                        Maximum time allowed for invoice processing
                      </Form.Text>
                    </Form.Group>
                  </Col>
                </Row>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Max Retries for Failed Invoices</Form.Label>
                      <Form.Control
                        type="number"
                        value={config.maxRetries}
                        onChange={(e) => handleInputChange('maxRetries', parseInt(e.target.value))}
                        min="0"
                        max="10"
                      />
                      <Form.Text className="text-muted">
                        Number of retry attempts for failed invoices
                      </Form.Text>
                    </Form.Group>
                  </Col>

                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Check
                        type="switch"
                        id="retry-failed"
                        label="Retry Failed Invoices"
                        checked={config.retryFailedInvoices}
                        onChange={(e) => handleInputChange('retryFailedInvoices', e.target.checked)}
                      />
                      <Form.Text className="text-muted">
                        Automatically retry processing failed invoices
                      </Form.Text>
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-3">
                  <Form.Check
                    type="switch"
                    id="pdf-generation"
                    label="Enable PDF Generation"
                    checked={config.enablePDFGeneration}
                    onChange={(e) => handleInputChange('enablePDFGeneration', e.target.checked)}
                  />
                  <Form.Text className="text-muted">
                    Automatically generate PDF invoices for validated invoices
                  </Form.Text>
                </Form.Group>
              </Form>
            </Card.Body>
          </Card>

          <Card className="mb-4">
            <Card.Header>
              <h5>Tax Regions</h5>
            </Card.Header>
            <Card.Body>
              <Form>
                <Form.Label>Select Enabled Countries for Tax Processing:</Form.Label>
                <div className="mb-3">
                  {['US', 'UK', 'IN', 'CA', 'AU', 'DE', 'FR'].map(country => (
                    <Form.Check
                      key={country}
                      inline
                      type="checkbox"
                      id={`country-${country}`}
                      label={country}
                      checked={config.enabledCountries.includes(country)}
                      onChange={() => handleCountryToggle(country)}
                    />
                  ))}
                </div>
                <Form.Text className="text-muted">
                  Only selected countries will have tax calculations performed
                </Form.Text>
              </Form>
            </Card.Body>
          </Card>

          <Card className="mb-4">
            <Card.Header>
              <h5>Notification Settings</h5>
            </Card.Header>
            <Card.Body>
              <Form>
                <Form.Group className="mb-3">
                  <Form.Check
                    type="switch"
                    id="email-notifications"
                    label="Enable Email Notifications"
                    checked={config.enableEmailNotifications}
                    onChange={(e) => handleInputChange('enableEmailNotifications', e.target.checked)}
                  />
                </Form.Group>

                {config.enableEmailNotifications && (
                  <Form.Group className="mb-3">
                    <Form.Label>Email Recipients (comma-separated)</Form.Label>
                    <Form.Control
                      type="email"
                      value={config.emailRecipients}
                      onChange={(e) => handleInputChange('emailRecipients', e.target.value)}
                      placeholder="admin@example.com, manager@example.com"
                    />
                    <Form.Text className="text-muted">
                      Email addresses to notify on processing failures or high-value invoices
                    </Form.Text>
                  </Form.Group>
                )}
              </Form>
            </Card.Body>
          </Card>
        </Col>

        <Col md={4}>
          <Card className="sticky-top" style={{ top: '20px' }}>
            <Card.Header>
              <h5>Actions</h5>
            </Card.Header>
            <Card.Body>
              <div className="d-grid gap-2">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Spinner as="span" animation="border" size="sm" className="me-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <FaSave className="me-2" />
                      Save Configuration
                    </>
                  )}
                </Button>

                <Button
                  variant="outline-secondary"
                  onClick={handleReset}
                >
                  <FaUndo className="me-2" />
                  Reset Changes
                </Button>
              </div>

              <hr />

              <div className="text-muted">
                <small>
                  <strong>Current Configuration:</strong>
                  <br />
                  Auto-approval: ${config.autoApprovalThreshold.toLocaleString()}
                  <br />
                  Countries: {config.enabledCountries.join(', ')}
                  <br />
                  PDF Generation: {config.enablePDFGeneration ? 'Enabled' : 'Disabled'}
                </small>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ControlPanel;
