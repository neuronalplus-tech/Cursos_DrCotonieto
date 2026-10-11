import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LOGO_CLARO } from '../config'
import CampoContrasena from './CampoContrasena'

/* ============================================================
   ALTA PÚBLICA (auto-inscripción)
   ------------------------------------------------------------
   Antes las cuentas solo las creaba el admin desde el panel. Esta
   pantalla es la puerta para quien llega de un taller gratuito y
   quiere su constancia: se registra solo, con el nombre EXACTO con
   el que quiere que se emita su constancia, y así no hay que
   perseguir después cómo cambiar el nombre de perfil.

   Se pide el correo dos veces y la contraseña dos veces: en el
   registro por correo el error más caro es un correo mal tecleado
   (la cuenta queda creada para un dueño inexistente y la persona
   no recibe nada). Con la repetición, el tecleo se cruza.

   QUÉ PASA DESPUÉS DEL ENVÍO
   El proyecto tiene «Confirm email» activado, así que la cuenta
   nace pero NO deja entrar hasta abrir el correo de confirmación.
   Por eso aquí se muestra «revisa tu correo» en vez de entrar
   directo. El disparador `manejar_alta_publica` (ALTA_PUBLICA.sql)
   ya creó el perfil con el nombre y la tanda en el momento del
   signUp, así que al confirmar el correo la persona entra lista.
   ============================================================ */

function mensajeDeError(error) {
  const bruto = String(error?.message || '')
  const m = bruto.toLowerCase()

  if (m.includes('already registered') || m.includes('already been registered')) {
    return 'Ese correo ya tiene cuenta. Ve a «Ya tengo cuenta» para entrar, o usa «Olvidé mi contraseña».'
  }
  if (m.includes('password should be at least')) {
    return 'La contraseña necesita al menos 6 caracteres.'
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.'
  }
  if (m.includes('failed to fetch') || m.includes('network')) {
    return 'No se pudo conectar. Revisa tu conexión y vuelve a intentarlo.'
  }
  if (m.includes('signups not allowed')) {
    return 'El registro está cerrado en este momento. Avísame para revisarlo.'
  }
  return 'No se pudo crear la cuenta: ' + (bruto || 'error desconocido')
}

function Registro() {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [email2, setEmail2] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirma, setConfirma] = useState('')
  const navigate = useNavigate()
  const location = useLocation()

  const crudo = new URLSearchParams(location.search).get('redirigir')
  const destino = crudo && crudo.startsWith('/') && !crudo.startsWith('//') ? crudo : '/'

  // Quien ya tiene sesión no debió llegar aquí: no hay nada que registrar.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) navigate(destino, { replace: true })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const nombreLimpio = nombre.trim()
    const correo = email.trim().toLowerCase()
    const correoRepetido = email2.trim().toLowerCase()

    if (nombreLimpio.length < 3) { setError('Escribe tu nombre completo, tal como quieres que salga en tu constancia.'); return }
    if (correo !== correoRepetido) { setError('Los dos correos no coinciden. Revísalos, por favor.'); return }
    if (password !== password2) { setError('Las dos contraseñas no coinciden.'); return }
    if (password.length < 6) { setError('La contraseña necesita al menos 6 caracteres.'); return }

    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email: correo,
      password,
      options: {
        // La metadata la lee el disparador manejar_alta_publica para
        // crear el perfil con el nombre y asignar la tanda (grupos de 50).
        data: { nombre_completo: nombreLimpio, origen: 'autoinscripcion' },
        // Al confirmar el correo, Supabase regresa a la misma página de
        // origen con la sesión ya puesta: la persona entra directo al
        // taller desde el que se registró.
        emailRedirectTo: `${window.location.origin}${destino}`,
      },
    })
    setLoading(false)

    if (error) { setError(mensajeDeError(error)); return }

    if (data?.session) {
      // Confirmación desactivada en el proyecto: se entra de inmediato.
      localStorage.setItem('login_time', String(Date.now()))
      navigate(destino, { replace: true })
      return
    }
    setConfirma(correo)
  }

  const rutaVolver = destino !== '/' ? `/acceso?redirigir=${encodeURIComponent(destino)}` : '/acceso'

  return (
    <main className="portal centered">
      <section className="card login-card">
        <img src={LOGO_CLARO} alt="" className="logo-login" />
        <p className="eyebrow">Aula virtual</p>
        <h1>Crear mi cuenta</h1>

        {confirma ? (
          <>
            <p className="sutil">
              Casi listo. Te envié un correo de confirmación a <strong>{confirma}</strong>.
              Abre ese enlace para activar tu cuenta: al entrar, quedarás directamente en el
              taller desde el que te registraste.
            </p>
            <p className="nota">
              Con tu misma cuenta y contraseña entrarás también a las grabaciones y constancias
              de futuros talleres. Si el correo no llega, revisa la carpeta de correo no
              deseado y después escríbeme.
            </p>
            <div className="login-pie">
              <button className="enlace-texto" onClick={() => navigate(destino)}>← Volver al taller</button>
              <button className="enlace-texto" onClick={() => navigate(rutaVolver)}>Ya confirmé mi correo: ir a entrar</button>
            </div>
          </>
        ) : (
          <>
            <p className="sutil">
              Regístrate para descargar tu constancia del taller y participar en el foro.
              Usa el nombre EXACTO con el que quieres que se emita tu constancia.
            </p>
            <form onSubmit={handleSubmit}>
              <label htmlFor="nombre">Nombre completo (para tu constancia)</label>
              <input id="nombre" type="text" autoComplete="name" value={nombre}
                     onChange={(e) => setNombre(e.target.value)} required />

              <label htmlFor="email">Correo electrónico</label>
              <input id="email" type="email" autoComplete="email" value={email}
                     onChange={(e) => setEmail(e.target.value)} required />

              <label htmlFor="email2">Repite tu correo</label>
              <input id="email2" type="email" autoComplete="email" value={email2}
                     onChange={(e) => setEmail2(e.target.value)} required />

              <CampoContrasena valor={password} onChange={setPassword}
                               autoComplete="new-password" />
              <CampoContrasena etiqueta="Repite tu contraseña" valor={password2}
                               onChange={setPassword2} autoComplete="new-password" />

              <button type="submit" disabled={loading} className="button primary ancho">
                {loading ? 'Creando tu cuenta...' : 'Crear mi cuenta'}
              </button>
            </form>
            {error && <p className="aviso-error">{error}</p>}
            <div className="login-pie">
              <button className="enlace-texto" onClick={() => navigate('/')}>← Volver al inicio</button>
              <button className="enlace-texto" onClick={() => navigate(rutaVolver)}>
                Ya tengo cuenta: iniciar sesión
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  )
}

export default Registro
