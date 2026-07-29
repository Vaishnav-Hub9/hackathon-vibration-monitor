import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authApi = {
  login: (data: any) => api.post('/auth/login', data),
  register: (data: any) => api.post('/auth/register', data),
  me: () => api.get('/auth/me')
};

export const machinesApi = {
  getAll: () => api.get('/machines'),
  getById: (id: string) => api.get(`/machines/${id}`),
  getSpindles: (id: string) => api.get(`/machines/${id}/spindles`),
  getHistory: (id: string, hours = 24) => api.get(`/machines/${id}/history?hours=${hours}`),
  getFFT: (id: string) => api.get(`/machines/${id}/fft`),
  getRUL: (id: string) => api.get(`/machines/${id}/rul`)
};

export const alertsApi = {
  getAll: (params?: any) => api.get('/alerts', { params }),
  getById: (id: string) => api.get(`/alerts/${id}`),
  acknowledge: (id: string) => api.patch(`/alerts/${id}/acknowledge`),
  resolve: (id: string) => api.patch(`/alerts/${id}/resolve`)
};

export const analyticsApi = {
  getSummary: () => api.get('/analytics/summary'),
  getTrends: () => api.get('/analytics/trends'),
  getROI: () => api.get('/analytics/roi'),
  getHeatmap: () => api.get('/analytics/heatmap')
};

export const maintenanceApi = {
  getAll: () => api.get('/maintenance'),
  create: (data: any) => api.post('/maintenance', data)
};
