// API service for communicating with Django backend
import config from '../config/api';

class ApiService {
  constructor() {
    this.baseURL = config.API_BASE_URL;
    this.token = null;
  }

  // Set authentication token
  setToken(token) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('authToken', token);
    }
  }

  // Get authentication token
  getToken() {
    if (!this.token && typeof window !== 'undefined') {
      this.token = localStorage.getItem('authToken');
    }
    return this.token;
  }

  // Clear authentication token
  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('authToken');
    }
  }

  // Generic request method
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const token = this.getToken();

    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        if (response.status === 401) {
          this.clearToken();
          throw new Error('Authentication required');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Authentication
  async login(credentials) {
    const response = await this.request('/users/auth/login/', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    
    if (response.access) {
      this.setToken(response.access);
    }
    
    return response;
  }

  async logout() {
    try {
      await this.request('/auth/logout/', {
        method: 'POST',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearToken();
    }
  }

  // Anomaly Management
  async getAnomalies(params = {}) {
    // Add filter for unapproved anomalies
    const filterParams = { ...params, approved: false };
    const queryString = new URLSearchParams(filterParams).toString();
    const endpoint = `/anomalies/mongodb/${queryString ? `?${queryString}` : ''}`;
    return await this.request(endpoint);
  }

  async getAnomalyById(anomalyId) {
    return await this.request(`/anomalies/mongodb/${anomalyId}/`);
  }

  // This method has been moved below with a more consistent implementation

  async editAnomaly(anomalyId, updateData) {
    return await this.request(`/anomalies/mongodb/${anomalyId}/edit/`, {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    });
  }

  async updateAnomalyStatus(anomalyId, status, rex = null) {
    const updateData = { status };
    if (rex) {
      updateData.rex = rex;
    }
    return await this.request(`/anomalies/mongodb/${anomalyId}/status/`, {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    });
  }

  async approveAnomaly(anomalyId) {
    // Send an explicit payload with approved: true as some backend implementations might expect this
    return await this.request(`/anomalies/mongodb/${anomalyId}/approve/`, {
      method: 'PATCH',
      body: JSON.stringify({ approved: true })
    });
  }

  async editAnomaly(anomalyId, updateData) {
    return await this.request(`/anomalies/mongodb/${anomalyId}/edit/`, {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    });
  }

  async getAnomalyStatistics() {
    return await this.request('/anomalies/mongodb/statistics/');
  }

  async getUnapprovedAnomalyStatistics() {
    // Get all anomalies for the "All Anomalies" card
    const allAnomaliesResponse = await this.request('/anomalies/mongodb/?get_all=true');
    const allAnomalies = allAnomaliesResponse.anomalies || [];
    const totalAllAnomalies = allAnomalies.length;
    
    // Get unapproved anomalies for other statistics
    const unapprovedAnomalies = await this.getAnomalies({ get_all: 'true' });
    const totalUnapproved = unapprovedAnomalies.anomalies?.length || 0;
    
    // Calculate critical issues (Critical + High severity) from unapproved anomalies
    const criticalIssues = unapprovedAnomalies.anomalies?.filter(a => {
      const severity = a.criticality;
      return severity === 4 || severity === 3; // Critical or High
    }).length || 0;
    
    // Calculate unit outages from unapproved anomalies
    const unitOutages = unapprovedAnomalies.anomalies?.filter(a => a.unit_outage).length || 0;
    
    return {
      total_anomalies: totalAllAnomalies, // All anomalies (approved + unapproved)
      critical_anomalies: criticalIssues,
      high_anomalies: criticalIssues, // For now, combining with critical
      medium_anomalies: 0,
      low_anomalies: 0,
      approved_anomalies: 0,
      scheduled_anomalies: 0,
      unit_count: 0,
      unit_outages: unitOutages
    };
  }

  async getAnomalyCount() {
    return await this.request('/anomalies/mongodb/count/');
  }

  async getUnitCount() {
    return await this.request('/anomalies/mongodb/units/count/');
  }

  // Time Slots Management
  async getTimeSlots() {
    return await this.request('/anomalies/mongodb/time-slots/');
  }

  async createTimeSlot(slotData) {
    // Make sure we're using the exact field names expected by backend
    const formattedData = {
      ...slotData,
      start_date: slotData.start_date,
      end_date: slotData.end_date,
      title: slotData.title || 'Time Slot',
      description: slotData.description || '',
      type: slotData.type || 'default'
    };

    return await this.request('/anomalies/mongodb/time-slots/create/', {
      method: 'POST',
      body: JSON.stringify(formattedData),
    });
  }

  async updateTimeSlot(slotId, updateData) {
    return await this.request(`/anomalies/mongodb/time-slots/${slotId}/`, {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    });
  }

  async deleteTimeSlot(slotId) {
    return await this.request(`/anomalies/mongodb/time-slots/${slotId}/delete/`, {
      method: 'DELETE',
    });
  }

  async importTimeSlots(file) {
    const formData = new FormData();
    formData.append('file', file);

    const url = `${this.baseURL}/anomalies/mongodb/time-slots/import/`;
    const token = this.getToken();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  // Approved Queue Management
  async getApprovedQueue() {
    return await this.request('/anomalies/mongodb/approved-queue/');
  }

  async checkScheduleQueue() {
    return await this.request('/anomalies/mongodb/approved-queue/check/', {
      method: 'POST',
    });
  }

  async removeFromQueue(anomalyId) {
    return await this.request(`/anomalies/mongodb/approved-queue/${anomalyId}/`, {
      method: 'DELETE',
    });
  }

  async getAnomaliesPaginated(page = 1, limit = 10, filters = {}) {
    const start = (page - 1) * limit;
    const end = start + limit;
    const params = {
      start: start,
      end: end,
      ...filters
    };
    const queryParams = new URLSearchParams(params).toString();
    return await this.request(`/anomalies/mongodb/?${queryParams}`);
  }
  
  async getAnomalyCount(filters = {}) {
    const queryParams = new URLSearchParams(filters).toString();
    return await this.request(`/anomalies/mongodb/count/?${queryParams}`);
  }
  
  async getAllAnomalies(filters = {}) {
    // Request all anomalies with get_all parameter set
    const params = {
      get_all: true,
      ...filters
    };
    const queryParams = new URLSearchParams(params).toString();
    return await this.request(`/anomalies/mongodb/?${queryParams}`);
  }

  async getUnitCount() {
    return await this.request('/anomalies/mongodb/units/count/');
  }

  // Time Slots Management
  async getTimeSlots() {
    return await this.request('/anomalies/mongodb/time-slots/');
  }

  // System-specific anomalies
  async getAnomaliesBySystem(unitId, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/anomalies/mongodb/system/${unitId}/${queryString ? `?${queryString}` : ''}`;
    return await this.request(endpoint);
  }

  async getAnomaliesBySystemForStats(unitId) {
    // Get all anomalies for a system for statistics purposes
    return await this.getAnomaliesBySystem(unitId, { get_all: 'true' });
  }

  async getAnomalyCountBySystem(unitId) {
    return await this.request(`/anomalies/mongodb/system/${unitId}/count/`);
  }

  // File Upload
  async uploadAnomalies(file) {
    const formData = new FormData();
    formData.append('file', file);

    const url = `${this.baseURL}/anomalies/import/`;
    const token = this.getToken();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  // Generic GET method
  async get(endpoint) {
    return await this.request(endpoint, { method: 'GET' });
  }

  // User Management (Admin)
  async getUsers() {
    return await this.request('/users/list/');
  }

  async addUser(userData) {
    const data = {
      email: userData.email,
      first_name: userData.first_name,
      last_name: userData.last_name,
      password: userData.password,
      password_confirm: userData.password_confirm
    };
    return await this.request('/users/auth/register/manager/', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async deleteUser(userId) {
    return await this.request(`/users/${userId}/`, {
      method: 'DELETE',
    });
  }

  async updateUser(userId, updateData) {
    return await this.request(`/users/${userId}/`, {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    });
  }
}

// Create and export a singleton instance
const apiService = new ApiService();
export default apiService; 