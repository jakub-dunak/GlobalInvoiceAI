import axios from 'axios';
import { Auth } from 'aws-amplify';

// API service for GlobalInvoiceAI
class ApiService {
  constructor() {
    let baseURL = 'https://your-api-gateway-url.execute-api.us-west-2.amazonaws.com/dev'; // Default placeholder

    try {
      // Try to import aws-exports if it exists (after deployment)
      const awsconfig = require('../aws-exports').default;
      if (awsconfig?.aws_appsync_graphqlEndpoint) {
        baseURL = awsconfig.aws_appsync_graphqlEndpoint.replace('/graphql', '');
      }
    } catch (error) {
      // aws-exports.js doesn't exist yet (before deployment)
      console.warn('aws-exports.js not found, using placeholder API URL. Update with deployment values.');
      baseURL = process.env.REACT_APP_API_URL || baseURL;
    }

    this.baseURL = baseURL;
  }

  // Get authentication headers
  async getAuthHeaders() {
    try {
      const session = await Auth.currentSession();
      if (session?.accessToken?.jwtToken) {
        return {
          'Authorization': `Bearer ${session.accessToken.jwtToken}`,
          'Content-Type': 'application/json'
        };
      }
    } catch (error) {
      console.error('Error getting auth headers:', error);
    }
    return { 'Content-Type': 'application/json' };
  }

  // Get invoice statistics for dashboard
  async getInvoiceStats() {
    try {
      const headers = await this.getAuthHeaders();
      const response = await axios.get(`${this.baseURL}/invoices/stats`, { headers });
      return response.data;
    } catch (error) {
      console.error('Error fetching invoice stats:', error);
      return {
        totalInvoices: 0,
        processedToday: 0,
        errorRate: 0,
        averageProcessingTime: 0
      };
    }
  }

  // Get list of invoices
  async getInvoices(params = {}) {
    try {
      const headers = await this.getAuthHeaders();
      const queryParams = new URLSearchParams();

      if (params.status) queryParams.append('status', params.status);
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.offset) queryParams.append('offset', params.offset);

      const response = await axios.get(`${this.baseURL}/invoices?${queryParams}`, { headers });
      return response.data;
    } catch (error) {
      console.error('Error fetching invoices:', error);
      return { invoices: [], total: 0 };
    }
  }

  // Get specific invoice details
  async getInvoice(invoiceId) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await axios.get(`${this.baseURL}/invoices/${invoiceId}`, { headers });
      return response.data;
    } catch (error) {
      console.error('Error fetching invoice:', error);
      throw error;
    }
  }

  // Get invoice PDF
  async getInvoicePDF(invoiceId) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await axios.get(`${this.baseURL}/invoices/${invoiceId}/pdf`, {
        headers,
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching invoice PDF:', error);
      throw error;
    }
  }

  // Get processing logs
  async getProcessingLogs(params = {}) {
    try {
      const headers = await this.getAuthHeaders();
      const queryParams = new URLSearchParams();

      if (params.invoiceId) queryParams.append('invoiceId', params.invoiceId);
      if (params.level) queryParams.append('level', params.level);
      if (params.limit) queryParams.append('limit', params.limit);

      const response = await axios.get(`${this.baseURL}/logs?${queryParams}`, { headers });
      return response.data;
    } catch (error) {
      console.error('Error fetching processing logs:', error);
      return { logs: [] };
    }
  }

  // Get system configuration
  async getConfiguration() {
    try {
      const headers = await this.getAuthHeaders();
      const response = await axios.get(`${this.baseURL}/config`, { headers });
      return response.data;
    } catch (error) {
      console.error('Error fetching configuration:', error);
      return {};
    }
  }

  // Update system configuration
  async updateConfiguration(config) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await axios.put(`${this.baseURL}/config`, config, { headers });
      return response.data;
    } catch (error) {
      console.error('Error updating configuration:', error);
      throw error;
    }
  }

  // Get CloudWatch metrics
  async getMetrics() {
    try {
      const headers = await this.getAuthHeaders();
      const response = await axios.get(`${this.baseURL}/metrics`, { headers });
      return response.data;
    } catch (error) {
      console.error('Error fetching metrics:', error);
      return {
        processingTime: [],
        errorRate: [],
        invoiceCount: []
      };
    }
  }

  // Manual invoice upload (for testing)
  async uploadInvoice(file) {
    try {
      const headers = await this.getAuthHeaders();
      
      // Read file content
      const fileContent = await file.text();
      let invoiceData;
      
      // Parse based on file type
      if (file.name.endsWith('.json')) {
        invoiceData = JSON.parse(fileContent);
      } else if (file.name.endsWith('.csv')) {
        // Basic CSV parsing (first row as headers)
        const lines = fileContent.split('\n');
        const headers = lines[0].split(',');
        const values = lines[1].split(',');
        invoiceData = {};
        headers.forEach((header, index) => {
          invoiceData[header.trim()] = values[index]?.trim();
        });
      } else {
        throw new Error('Unsupported file type. Please upload JSON or CSV');
      }

      // Send invoice data as JSON
      const response = await axios.post(`${this.baseURL}/invoices/upload`, invoiceData, {
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error uploading invoice:', error);
      throw error;
    }
  }
}

export const apiService = new ApiService();
