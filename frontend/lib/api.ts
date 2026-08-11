import axios from 'axios';

const api = axios.create({
  // Always use the Next.js proxy path so CORS is avoided in all environments.
  // next.config.ts rewrites /api/* → NEXT_PUBLIC_API_URL/*
  baseURL: '/api',
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('rental_token') : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('rental_token');
      localStorage.removeItem('rental_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export default api;
