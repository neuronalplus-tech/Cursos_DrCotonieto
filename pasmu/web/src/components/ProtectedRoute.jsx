import { Navigate, useLocation } from 'react-router-dom'
import { canAccessRoute } from '../lib/permissions'

export default function ProtectedRoute({ user, route, children }) {
  const location = useLocation()

  if (!user) {
    return <Navigate
      to="/login"
      replace
      state={{ from: `${location.pathname}${location.search}${location.hash}` }}
    />
  }

  if (!canAccessRoute(user, route)) {
    return <Navigate to="/sin-acceso" replace />
  }

  return children
}
