import { useEffect, useRef, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import Casos from './components/Casos'
import Agenda from './components/Agenda'
import Expediente from './components/Expediente'
import Reportes from './components/Reportes'
import Seguridad from './components/Seguridad'
import Admin from './components/Admin'
import Altas from './components/Altas'
import BancoRecursos from './components/BancoRecursos'
import PaseSesion from './components/PaseSesion'
import SinAcceso from './components/SinAcceso'
import ProtectedRoute from './components/ProtectedRoute'
import { loadPasmuUser, signIn, signOut } from './services/authService'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import SolicitudRevision from './components/SolicitudRevision'
import Recuperar from './components/Recuperar'
import Perfil from './components/Perfil'
import ChatInterno from './components/ChatInterno'
import ExportarCaso from './components/ExportarCaso'
import MiEspacio from './components/MiEspacio'

const supabaseConfigured = isSupabaseConfigured()

export default function App() {
  const location = useLocation()
  const authEventVersion = useRef(0)
  const [auth, setAuth] = useState({
    status: supabaseConfigured ? 'loading' : 'local',
    session: null,
    user: null,
    error: null
  })

  useEffect(() => {
    if (!supabase) return undefined

    let active = true
    const applySession = (session) => {
      setAuth((current) => {
        const currentUserId = current.session?.user?.id
        const nextUserId = session?.user?.id
        if (currentUserId && currentUserId === nextUserId) {
          return { ...current, session, error: null }
        }

        return {
          status: session ? 'loading-profile' : 'signed-out',
          session,
          user: null,
          error: null
        }
      })
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      authEventVersion.current += 1
      applySession(session)
    })

    const initialEventVersion = authEventVersion.current
    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!active || authEventVersion.current !== initialEventVersion) return
        if (error) throw error
        applySession(data.session)
      })
      .catch((error) => {
        if (active && authEventVersion.current === initialEventVersion) {
          setAuth({ status: 'error', session: null, user: null, error: error.message })
        }
      })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const authUser = auth.session?.user
    if (!authUser || auth.status !== 'loading-profile') return undefined
    const authUserId = authUser.id

    let active = true
    loadPasmuUser(authUser)
      .then((user) => {
        if (active) {
          setAuth((current) => current.session?.user.id === authUserId
            ? { ...current, status: 'authenticated', user, error: null }
            : current)
        }
      })
      .catch((error) => {
        if (active) {
          setAuth((current) => current.session?.user.id === authUserId
            ? { ...current, status: 'error', user: null, error: error.message }
            : current)
        }
      })

    return () => {
      active = false
    }
  }, [auth.session?.user?.id, auth.status])

  const loginLocal = (nextUser) => {
    setAuth({ status: 'authenticated', session: null, user: nextUser, error: null })
  }
  const selectContext = (membershipId) => {
    setAuth((current) => {
      const activeUser = current.user
      const selectedContext = activeUser?.contexts?.find(
        (context) => String(context.membershipId) === String(membershipId)
      )
      if (!activeUser || !selectedContext) return current

      return {
        ...current,
        user: { ...activeUser, ...selectedContext, contexts: activeUser.contexts }
      }
    })
  }
  const requestedPath = location.state?.from
  const postLoginPath = typeof requestedPath === 'string'
    && requestedPath.startsWith('/')
    && !requestedPath.startsWith('//')
    ? requestedPath
    : '/dashboard'

  const logout = async () => {
    if (supabaseConfigured) {
      try {
        await signOut()
      } catch (error) {
        setAuth((current) => ({ ...current, error: error.message }))
      }
      return
    }

    setAuth({ status: 'local', session: null, user: null, error: null })
  }

  if (auth.status === 'loading' || auth.status === 'loading-profile') {
    return <main className="auth-loading" role="status">Cargando sesión PASMU…</main>
  }

  const user = auth.user
  return (
    <Routes>
      <Route
        path="/login"
        element={user
          ? <Navigate to={postLoginPath} replace />
          : <Login
              onLogin={supabaseConfigured ? signIn : loginLocal}
              authError={auth.error}
              hasSession={Boolean(auth.session)}
              onLogout={logout}
            />}
      />
      <Route element={
        <Layout
          user={user}
          authError={auth.error}
          onLogout={logout}
          onContextChange={selectContext}
        />
      }>
        <Route path="/dashboard" element={<ProtectedRoute user={user} route="dashboard"><Dashboard user={user} /></ProtectedRoute>} />
        <Route path="/casos" element={<ProtectedRoute user={user} route="casos"><Casos user={user} /></ProtectedRoute>} />
        <Route path="/agenda" element={<ProtectedRoute user={user} route="agenda"><Agenda user={user} /></ProtectedRoute>} />
        <Route path="/expediente" element={<ProtectedRoute user={user} route="expediente"><Expediente user={user} /></ProtectedRoute>} />
        <Route path="/expediente/exportar" element={<ProtectedRoute user={user} route="exportar"><ExportarCaso user={user} /></ProtectedRoute>} />
        <Route path="/expediente/revisiones" element={<ProtectedRoute user={user} route="revisiones"><SolicitudRevision user={user} /></ProtectedRoute>} />
        <Route path="/reportes" element={<ProtectedRoute user={user} route="reportes"><Reportes user={user} /></ProtectedRoute>} />
        <Route path="/seguridad" element={<ProtectedRoute user={user} route="seguridad"><Seguridad user={user} /></ProtectedRoute>} />
        <Route path="/altas" element={<ProtectedRoute user={user} route="admin"><Altas user={user} /></ProtectedRoute>} />
        <Route path="/banco" element={<ProtectedRoute user={user} route="expediente"><BancoRecursos user={user} /></ProtectedRoute>} />
        <Route path="/pase" element={<ProtectedRoute user={user} route="agenda"><PaseSesion user={user} /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute user={user} route="admin"><Admin user={user} /></ProtectedRoute>} />
        <Route path="/perfil" element={<ProtectedRoute user={user} route="perfil"><Perfil user={user} /></ProtectedRoute>} />
        <Route path="/mi-espacio" element={<ProtectedRoute user={user} route="mi-espacio"><MiEspacio user={user} /></ProtectedRoute>} />
        <Route path="/conversacion" element={<ProtectedRoute user={user} route="chat"><ChatInterno user={user} /></ProtectedRoute>} />
        <Route path="/recuperar" element={<Recuperar />} />
        <Route path="/sin-acceso" element={<SinAcceso />} />
        <Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
        <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
      </Route>
    </Routes>
  )
}
