import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || ''; // same-origin; Vite dev proxy forwards /api to the backend

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
  me: () => api.get('/auth/me'),
  updateMe: (data: any) => api.patch('/auth/me', data),
  getUsers: () => api.get('/auth/users'),
  updateUserRole: (id: string, data: { role: string; factoryUnits?: string[]; customerName?: string }) =>
    api.patch(`/auth/users/${id}/role`, data),
};

export const machinesApi = {
  getAll: (params?: { factoryUnit?: string }) => api.get('/machines', { params }),
  getById: (id: string) => api.get(`/machines/${id}`),
  getSpindles: (id: string) => api.get(`/machines/${id}/spindles`),
  getHistory: (id: string, hours = 24) => api.get(`/machines/${id}/history?hours=${hours}`),
  getFFT: (id: string) => api.get(`/machines/${id}/fft`),
  getWaveform: (id: string) => api.get(`/machines/${id}/waveform`),
  getRUL: (id: string) => api.get(`/machines/${id}/rul`)
};

export const alertsApi = {
  getAll: (params?: any) => api.get('/alerts', { params }),
  getById: (id: string) => api.get(`/alerts/${id}`),
  acknowledge: (id: string) => api.patch(`/alerts/${id}/acknowledge`),
  resolve: (id: string) => api.patch(`/alerts/${id}/resolve`),
  sendTestEmail: () => api.post('/alerts/test-email'),
  sendTestWhatsApp: () => api.post('/alerts/test-whatsapp')
};

export const analyticsApi = {
  getSummary: () => api.get('/analytics/summary'),
  getTrends: () => api.get('/analytics/trends'),
  getROI: () => api.get('/analytics/roi'),
  getHeatmap: () => api.get('/analytics/heatmap'),
  getMonthly: () => api.get('/analytics/monthly'),
  getBearingTrend: (range = '1y', machineId = '') =>
    api.get('/analytics/bearing-trend', { params: { range, ...(machineId ? { machineId } : {}) } })
};

export const maintenanceApi = {
  getAll: () => api.get('/maintenance'),
  create: (data: any) => api.post('/maintenance', data)
};

export const mlApi = {
  getAnalysis: () => api.get('/ml/analysis')
};

export const hardwareApi = {
  getStream: () => api.get('/hardware/stream'),
  submitManual: (payload: { rpm: number; temperature?: number | null; motorSpeed?: number }) =>
    api.post('/hardware/manual', payload),
  getRecentCaptures: (limit = 20) => api.get(`/sensor-readings?limit=${limit}`),
};

export const simulatorApi = {
  start: () => api.post('/simulator/start'),
  stop: () => api.post('/simulator/stop'),
  injectFault: (machineId: string, faultType: string) =>
    api.post('/simulator/inject-fault', { machineId, faultType })
};

export const factoryProfileApi = {
  get: () => api.get('/factory-profile'),
  update: (data: { unitName?: string; location?: string; shiftTimings?: string; description?: string }) =>
    api.put('/factory-profile', data),
};

export const factoryUnitsApi = {
  getAll: () => api.get('/factory-units'),
  getOne: (unitId: string) => api.get(`/factory-units/${unitId}`),
  create: (data: { unitId: string; name: string; location: string; description?: string }) =>
    api.post('/factory-units', data),
  update: (unitId: string, data: { name?: string; location?: string; description?: string; isActive?: boolean }) =>
    api.put(`/factory-units/${unitId}`, data),
  delete: (unitId: string) => api.delete(`/factory-units/${unitId}`),
  assignMachines: (unitId: string, machineIds: string[]) =>
    api.post(`/factory-units/${unitId}/machines`, { machineIds }),
};

export const operationsApi = {
  overview: () => api.get('/operations/overview'),
  getIncidents: (params?: { status?: string; category?: string; factoryUnit?: string }) => api.get('/operations/incidents', { params }),
  createIncident: (data: any) => api.post('/operations/incidents', data),
  updateIncident: (id: string, data: any) => api.patch(`/operations/incidents/${id}`, data),
  assignIncident: (id: string, data: { ownerUserId: string; ownerName: string; ownerTeam: string }) => api.post(`/operations/incidents/${id}/assign`, data),
  createAction: (id: string, data: any) => api.post(`/operations/incidents/${id}/actions`, data),
  getActivity: (id: string) => api.get(`/operations/incidents/${id}/activity`),
  addComment: (id: string, body: string, visibility: 'internal' | 'customer' = 'internal') => api.post(`/operations/incidents/${id}/comments`, { body, visibility }),
  addEvidence: (id: string, data: any) => api.post(`/operations/incidents/${id}/evidence`, data),
  escalate: (id: string, data?: { reason?: string; toRole?: string; toUserId?: string }) => api.post(`/operations/incidents/${id}/escalate`, data),
  resolve: (id: string, data: { rootCause: string; recoveryEvidence?: string }) => api.post(`/operations/incidents/${id}/resolve`, data),
  verifyRecovery: (id: string, data: { recovered: boolean; evidence?: string }) => api.post(`/operations/incidents/${id}/verify-recovery`, data),
  calculateImpact: (id: string, data: any) => api.post(`/operations/incidents/${id}/impact`, data),
  getBusinessImpact: () => api.get('/operations/business-impact'),
  getSlaBreaches: () => api.get('/operations/slas/breaches'),
};
