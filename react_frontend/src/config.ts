// Support both local development and production environments
export const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8000' : 'https://m5-forecasting-dopk.onrender.com');

export const ENDPOINTS = {
  auth: {
    login: `${API_BASE_URL}/auth/login`,
    createUser: `${API_BASE_URL}/auth/create-user`,
  },
  prediction: {
    predict: `${API_BASE_URL}/api/predict`,
    modelInfo: `${API_BASE_URL}/api/model/info`,
  },
  data: {
    historical: `${API_BASE_URL}/api/data/historical`,
    insights: `${API_BASE_URL}/api/data/insights`,
  },
} as const;