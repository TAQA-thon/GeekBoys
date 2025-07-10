import axios from 'axios';

class ApiService {
  constructor() {
    this.apiClient = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include auth token
    this.apiClient.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor to handle auth errors
    this.apiClient.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('authToken');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Authentication methods
  async login(credentials) {
    try {
      const response = await this.apiClient.post('/api/token/', credentials);
      return response.data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async logout() {
    try {
      await this.apiClient.post('/api/logout/');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('authToken');
    }
  }

  // Anomaly methods
  async getAnomalies(getAll = false) {
    try {
      const params = getAll ? { get_all: true } : {};
      const response = await this.apiClient.get('/api/anomalies/', { params });
      return response.data.anomalies;
    } catch (error) {
      console.error('Error fetching anomalies:', error);
      throw error;
    }
  }

  async getAnomaly(id) {
    try {
      const response = await this.apiClient.get(`/api/anomalies/${id}/`);
      return response.data.anomaly;
    } catch (error) {
      console.error('Error fetching anomaly:', error);
      throw error;
    }
  }

  async approveAnomaly(id, approvalData) {
    try {
      const response = await this.apiClient.post(`/api/anomalies/${id}/approve/`, approvalData);
      return response.data;
    } catch (error) {
      console.error('Error approving anomaly:', error);
      throw error;
    }
  }

  async editAnomaly(id, editData) {
    try {
      const response = await this.apiClient.put(`/api/anomalies/${id}/edit/`, editData);
      return response.data;
    } catch (error) {
      console.error('Error editing anomaly:', error);
      throw error;
    }
  }

  // Statistics methods
  async getStatistics(getAll = false) {
    try {
      const params = getAll ? { get_all: true } : {};
      const response = await this.apiClient.get('/api/statistics/', { params });
      return response.data.statistics;
    } catch (error) {
      console.error('Error fetching statistics:', error);
      throw error;
    }
  }

  // Time slots methods
  async getTimeSlots() {
    try {
      const response = await this.apiClient.get('/api/time-slots/');
      return response.data.time_slots;
    } catch (error) {
      console.error('Error fetching time slots:', error);
      throw error;
    }
  }

  async updateTimeSlot(id, data) {
    try {
      const response = await this.apiClient.put(`/api/time-slots/${id}/`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating time slot:', error);
      throw error;
    }
  }

  // Queue methods
  async getQueue() {
    try {
      const response = await this.apiClient.get('/api/queue/');
      return response.data.queue;
    } catch (error) {
      console.error('Error fetching queue:', error);
      throw error;
    }
  }

  // Analytics methods
  async getAnalyticsData(period = '1year', start_date = null, end_date = null) {
    try {
      let url = `/api/anomalies/report/analytics/?period=${period}`;
      if (start_date && end_date) {
        url += `&start_date=${start_date}&end_date=${end_date}`;
      }
      const response = await this.apiClient.get(url);
      return response.data; // This endpoint returns data directly, not wrapped in analytics field
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      throw error;
    }
  }

  // Import methods
  async uploadAnomalies(file) {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await this.apiClient.post('/api/anomalies/import/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error uploading anomalies:', error);
      throw error;
    }
  }

  async importTimeSlots(file) {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await this.apiClient.post('/api/anomalies/mongodb/time-slots/import/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error importing time slots:', error);
      throw error;
    }
  }

  async getUnitCount() {
    try {
      const response = await this.apiClient.get('/api/anomalies/mongodb/units/count/');
      return response.data.unit_count;
    } catch (error) {
      console.error('Error fetching unit count:', error);
      throw error;
    }
  }

  async getAnomaliesBySystem(unitId) {
    try {
      const response = await this.apiClient.get(`/api/anomalies/system/${unitId}/?limit=1000`);
      return response.data.anomalies || [];
    } catch (error) {
      console.error(`Error fetching anomalies for unit ${unitId}:`, error);
      throw error;
    }
  }

  async getAnomalyCountBySystem(unitId) {
    try {
      const response = await this.apiClient.get(`/api/anomalies/system/${unitId}/count/`);
      return response.data.count || 0;
    } catch (error) {
      console.error(`Error fetching anomaly count for unit ${unitId}:`, error);
      throw error;
    }
  }
}

// Export a singleton instance
export const apiService = new ApiService(); 