import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Badge, Spinner, Alert, Modal, Form, Row, Col } from 'react-bootstrap';
import { FaDownload, FaEye, FaFilter, FaUpload } from 'react-icons/fa';
import { apiService } from '../utils/api';

const InvoiceList = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadInvoices();
  }, [filter]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const params = { limit: 100 };
      if (filter !== 'all') {
        params.status = filter;
      }

      const response = await apiService.getInvoices(params);
      setInvoices(response.invoices || []);
      setError(null);
    } catch (err) {
      console.error('Error loading invoices:', err);
      setError('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleViewInvoice = async (invoiceId) => {
    try {
      const invoice = await apiService.getInvoice(invoiceId);
      setSelectedInvoice(invoice);
      setShowDetailsModal(true);
    } catch (err) {
      console.error('Error loading invoice details:', err);
      setError('Failed to load invoice details');
    }
  };

  const handleDownloadPDF = async (invoiceId) => {
    try {
      const pdfBlob = await apiService.getInvoicePDF(invoiceId);

      // Create download link
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${invoiceId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading PDF:', err);
      setError('Failed to download PDF');
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;

    try {
      setUploading(true);
      await apiService.uploadInvoice(selectedFile);
      setShowUploadModal(false);
      setSelectedFile(null);
      loadInvoices(); // Refresh the list
    } catch (err) {
      console.error('Error uploading invoice:', err);
      setError('Failed to upload invoice');
    } finally {
      setUploading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'VALIDATED': { variant: 'success', text: 'Validated' },
      'PROCESSING': { variant: 'warning', text: 'Processing' },
      'ERROR': { variant: 'danger', text: 'Error' },
      'PENDING': { variant: 'secondary', text: 'Pending' }
    };

    const config = statusConfig[status] || { variant: 'secondary', text: status };
    return <Badge bg={config.variant}>{config.text}</Badge>;
  };

  const formatCurrency = (amount, currency) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(amount);
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
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Invoice Management</h1>
        <div>
          <Button
            variant="outline-primary"
            className="me-2"
            onClick={() => setShowUploadModal(true)}
          >
            <FaUpload className="me-2" />
            Upload Invoice
          </Button>
          <Button
            variant="outline-secondary"
            onClick={() => loadInvoices()}
          >
            <FaFilter className="me-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <Card.Body>
          <div className="d-flex gap-2">
            <Button
              variant={filter === 'all' ? 'primary' : 'outline-primary'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              All
            </Button>
            <Button
              variant={filter === 'VALIDATED' ? 'primary' : 'outline-primary'}
              size="sm"
              onClick={() => setFilter('VALIDATED')}
            >
              Validated
            </Button>
            <Button
              variant={filter === 'PROCESSING' ? 'primary' : 'outline-primary'}
              size="sm"
              onClick={() => setFilter('PROCESSING')}
            >
              Processing
            </Button>
            <Button
              variant={filter === 'ERROR' ? 'primary' : 'outline-primary'}
              size="sm"
              onClick={() => setFilter('ERROR')}
            >
              Errors
            </Button>
          </div>
        </Card.Body>
      </Card>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Invoice Table */}
      <Card>
        <Card.Body>
          {invoices.length === 0 ? (
            <p className="text-muted text-center py-4">No invoices found</p>
          ) : (
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              <Table striped hover>
                <thead className="table-dark sticky-top">
                  <tr>
                    <th>Invoice ID</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Currency</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.InvoiceId}>
                      <td className="fw-bold">{invoice.InvoiceId.substring(0, 8)}...</td>
                      <td>{invoice.InvoiceData?.customer_name || 'N/A'}</td>
                      <td>{formatCurrency(invoice.InvoiceData?.total_amount, invoice.InvoiceData?.currency)}</td>
                      <td>{invoice.InvoiceData?.currency || 'USD'}</td>
                      <td>{getStatusBadge(invoice.Status)}</td>
                      <td>{new Date(invoice.CreatedAt).toLocaleDateString()}</td>
                      <td>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          className="me-2"
                          onClick={() => handleViewInvoice(invoice.InvoiceId)}
                        >
                          <FaEye />
                        </Button>
                        {invoice.Status === 'VALIDATED' && invoice.PDFLocation && (
                          <Button
                            variant="outline-success"
                            size="sm"
                            onClick={() => handleDownloadPDF(invoice.InvoiceId)}
                          >
                            <FaDownload />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Invoice Details Modal */}
      <Modal show={showDetailsModal} onHide={() => setShowDetailsModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Invoice Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedInvoice && (
            <div>
              <Row>
                <Col md={6}>
                  <h6>Invoice Information</h6>
                  <p><strong>Invoice ID:</strong> {selectedInvoice.InvoiceId}</p>
                  <p><strong>Status:</strong> {getStatusBadge(selectedInvoice.Status)}</p>
                  <p><strong>Created:</strong> {new Date(selectedInvoice.CreatedAt).toLocaleString()}</p>
                  {selectedInvoice.UpdatedAt && (
                    <p><strong>Updated:</strong> {new Date(selectedInvoice.UpdatedAt).toLocaleString()}</p>
                  )}
                </Col>
                <Col md={6}>
                  <h6>Invoice Data</h6>
                  <p><strong>Customer:</strong> {selectedInvoice.InvoiceData?.customer_name}</p>
                  <p><strong>Amount:</strong> {formatCurrency(selectedInvoice.InvoiceData?.total_amount, selectedInvoice.InvoiceData?.currency)}</p>
                  <p><strong>Currency:</strong> {selectedInvoice.InvoiceData?.currency}</p>
                  <p><strong>Country:</strong> {selectedInvoice.InvoiceData?.country}</p>
                </Col>
              </Row>

              {selectedInvoice.ValidationResult && (
                <>
                  <hr />
                  <h6>Validation Results</h6>
                  {selectedInvoice.ValidationResult.errors && selectedInvoice.ValidationResult.errors.length > 0 && (
                    <div className="mb-3">
                      <h6 className="text-danger">Errors:</h6>
                      <ul>
                        {selectedInvoice.ValidationResult.errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedInvoice.ValidationResult.warnings && selectedInvoice.ValidationResult.warnings.length > 0 && (
                    <div className="mb-3">
                      <h6 className="text-warning">Warnings:</h6>
                      <ul>
                        {selectedInvoice.ValidationResult.warnings.map((warning, index) => (
                          <li key={index}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedInvoice.ValidationResult.discrepancies && selectedInvoice.ValidationResult.discrepancies.length > 0 && (
                    <div className="mb-3">
                      <h6 className="text-info">Discrepancies:</h6>
                      <ul>
                        {selectedInvoice.ValidationResult.discrepancies.map((discrepancy, index) => (
                          <li key={index}>
                            {discrepancy.field}: Expected {discrepancy.expected}, Got {discrepancy.actual}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetailsModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Upload Modal */}
      <Modal show={showUploadModal} onHide={() => setShowUploadModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Upload Invoice</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Select Invoice File (JSON or CSV)</Form.Label>
              <Form.Control
                type="file"
                accept=".json,.csv"
                onChange={(e) => setSelectedFile(e.target.files[0])}
              />
              <Form.Text className="text-muted">
                Supported formats: JSON or CSV files containing invoice data.
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowUploadModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleFileUpload}
            disabled={!selectedFile || uploading}
          >
            {uploading ? (
              <>
                <Spinner as="span" animation="border" size="sm" className="me-2" />
                Uploading...
              </>
            ) : (
              'Upload'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default InvoiceList;
