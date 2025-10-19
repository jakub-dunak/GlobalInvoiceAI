import axios from 'axios';

// API service for GlobalInvoiceAI
class ApiService {
  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || 'https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/dev';
  }

  // Get authentication headers
  async getAuthHeaders() {
    try {
      const session = await window.Auth?.currentSession?.();
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
      const formData = new FormData();
      formData.append('invoice', file);

      const response = await axios.post(`${this.baseURL}/invoices/upload`, formData, {
        headers: {
          ...headers,
          'Content-Type': 'multipart/form-data'
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
