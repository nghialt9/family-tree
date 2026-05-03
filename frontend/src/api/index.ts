import axios from 'axios';

export const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const authApi = {
  checkPhone: (phone: string) => api.post('/auth/check-phone', { phone }),
  login: (phone: string, password?: string) => api.post('/auth/login', { phone, password }),
};

export const personsApi = {
  list: () => api.get('/persons'),
  get: (id: string) => api.get(`/persons/${id}`),
  getRelatives: (id: string) => api.get(`/persons/${id}/relatives`),
  create: (data: unknown) => api.post('/persons', data),
  update: (id: string, data: unknown) => api.put(`/persons/${id}`, data),
  delete: (id: string) => api.delete(`/persons/${id}`),
  getAccess: (id: string) => api.get(`/persons/${id}/access`),
  uploadAvatar: (id: string, file: File) => {
    const fd = new FormData();
    fd.append('avatar', file);
    return api.post(`/persons/${id}/avatar`, fd);
  },
};

export const relationshipsApi = {
  create: (data: unknown) => api.post('/relationships', data),
  delete: (id: string) => api.delete(`/relationships/${id}`),
};

export const treeApi = {
  get: () => api.get('/tree'),
};

export const statsApi = {
  ping: (newVisit: boolean) => api.post('/stats/ping', { newVisit }),
  get: () => api.get('/stats'),
};

export const auditApi = {
  list: (params: {
    action?: string;
    entityType?: string;
    search?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) => api.get('/audit', { params }),
};

export const mediaApi = {
  sign: (params: { resourceType: string; personId: string }) =>
    api.get('/media/sign', { params }),

  confirmUpload: (
    personId: string,
    data: {
      cloudinaryId: string;
      url: string;
      resourceType: string;
      format: string;
      bytes: number;
      caption?: string;
    }
  ) => api.post(`/persons/${personId}/media`, data),

  listByPerson: (personId: string) =>
    api.get(`/persons/${personId}/media`),

  updateStatus: (mediaId: string, status: 'APPROVED' | 'REJECTED') =>
    api.patch(`/media/${mediaId}/status`, { status }),

  delete: (mediaId: string) =>
    api.delete(`/media/${mediaId}`),

  adminQueue: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get('/media', { params }),
};
