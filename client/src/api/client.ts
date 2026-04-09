import axios from 'axios'
import { env, STORAGE_ACCESS_TOKEN } from '../constants'

/**
 * Shared Axios instance: base URL + auth header from localStorage.
 * Auth APIs use phone + password; JWT includes a `phone` claim.
 */
export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(STORAGE_ACCESS_TOKEN)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
