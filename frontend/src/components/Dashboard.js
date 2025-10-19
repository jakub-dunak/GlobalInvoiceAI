import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Spinner, Alert } from 'react-bootstrap';
import { FaFileInvoice, FaClock, FaExclamationTriangle, FaCheckCircle } from 'react-icons/fa';
import { Line, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { apiService } from '../utils/api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement);

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsData, metricsData, logsData] = await Promise.all([
        apiService.getInvoiceStats(),
        apiService.getMetrics(),
        apiService.getProcessingLogs({ limit: 10 })
      ]);

      setStats(statsData);
      setMetrics(metricsData);
      setLogs(logsData.logs || []);
      setError(null);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
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

  if (error) {
    return (
      <Alert variant="danger">
        <Alert.Heading>Error Loading Dashboard</Alert.Heading>
        <p>{error}</p>
      </Alert>
    );
  }

  // Chart data for processing time
  const processingTimeData = {
    labels: metrics?.processingTime?.map(m => new Date(m.timestamp).toLocaleTimeString()) || [],
    datasets: [
      {
        label: 'Processing Time (seconds)',
        data: metrics?.processingTime?.map(m => m.value) || [],
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.1,
      },
    ],
  };

  // Chart data for invoice status distribution
  const statusData = {
    labels: ['Valid', 'Processing', 'Error'],
    datasets: [
      {
        data: [
          stats?.validInvoices || 0,
          stats?.processingInvoices || 0,
          stats?.errorInvoices || 0,
        ],
        backgroundColor: [
          'rgba(75, 192, 192, 0.8)',
          'rgba(255, 206, 86, 0.8)',
          'rgba(255, 99, 132, 0.8)',
        ],
        borderColor: [
          'rgba(75, 192, 192, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(255, 99, 132, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
    },
  };

  return (
    <div>
      <h1 className="mb-4">GlobalInvoiceAI Dashboard</h1>

      {/* Stats Cards */}
      <Row className="mb-4">
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <FaFileInvoice size={40} className="text-primary mb-2" />
              <Card.Title className="h4">{stats?.totalInvoices || 0}</Card.Title>
              <Card.Text>Total Invoices</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <FaCheckCircle size={40} className="text-success mb-2" />
              <Card.Title className="h4">{stats?.processedToday || 0}</Card.Title>
              <Card.Text>Processed Today</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <FaClock size={40} className="text-warning mb-2" />
              <Card.Title className="h4">{stats?.averageProcessingTime || 0}s</Card.Title>
              <Card.Text>Avg Processing Time</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <FaExclamationTriangle size={40} className="text-danger mb-2" />
              <Card.Title className="h4">{stats?.errorRate || 0}%</Card.Title>
              <Card.Text>Error Rate</Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Charts */}
      <Row className="mb-4">
        <Col md={8}>
          <Card>
            <Card.Header>
              <h5>Processing Time Trend</h5>
            </Card.Header>
            <Card.Body>
              <div style={{ height: '300px' }}>
                <Line data={processingTimeData} options={chartOptions} />
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card>
            <Card.Header>
              <h5>Invoice Status Distribution</h5>
            </Card.Header>
            <Card.Body>
              <div style={{ height: '300px' }}>
                <Doughnut data={statusData} options={chartOptions} />
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Recent Processing Logs */}
      <Card>
        <Card.Header>
          <h5>Recent Processing Logs</h5>
        </Card.Header>
        <Card.Body>
          {logs.length === 0 ? (
            <p className="text-muted">No recent logs available</p>
          ) : (
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {logs.map((log, index) => (
                <div key={index} className="mb-2 p-2 border-bottom">
                  <small className="text-muted">
                    {new Date(log.timestamp).toLocaleString()}
                  </small>
                  <div className={`fw-bold ${log.level === 'ERROR' ? 'text-danger' : 'text-info'}`}>
                    [{log.level}] {log.message}
                  </div>
                  {log.invoiceId && (
                    <small className="text-muted">Invoice: {log.invoiceId}</small>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default Dashboard;
