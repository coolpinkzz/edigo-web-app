import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { STORAGE_ACCESS_TOKEN } from '../constants'

/**
 * Renders child routes only when a JWT exists; otherwise redirects to `/login`.
 */
export function ProtectedRoute() {
  const location = useLocation()
  const token = localStorage.getItem(STORAGE_ACCESS_TOKEN)

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
