import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LOGO_CLARO, wa } from '../config'
import { WhatsAppFlotante } from './ui'
import CampoContrasena from './CampoContrasena'

/* ------------------------------------------------------------
   POR QUÉ NO BASTA CON "CORREO O CONTRASEÑA INCORRECTOS"
   ------------------------------------------------------------
   Ese texto se enseñaba ante CUALQUIER fallo, así que una cuenta
   sin confirmar, un correo deshabilitado y una contraseña mal
   escrita se veían exactamente igual. Quien administra no podía
   distinguirlos, y quien entra se quedaba intentando lo mismo una
   y otra vez.

   Se traduce la causa real, no se inventa. Lo que no se reconozca
   se enseña tal cual: un mensaje en inglés es feo, pero es
   infinitamente más útil que uno bonito y equivocado.

   SOBRE LOS ESPACIOS
   La contraseña NO se recorta: hay quien la tiene con un espacio a
   propósito y recortarla en silencio le cerraría la puerta. Lo que
   se hace es avisar, que es lo que resuelve el caso real: el
   espacio que se cuela al copiar y pegar.
   ------------------------------------------------------------ */
function mensajeDeError(error, password) {
  const bruto = String(error?.message || '')
  const m = bruto.toLowerCase()

  if (m.includes('email not confirmed') || m.includes('not confirmed')) {
    return 'Esta cuenta existe pero todavía no está confirmada. ' +
      'Escríbele a quien te dio el acceso para que la active, o usa "Olvidé mi contraseña".'
  }
  if (m.includes('invalid login credentials') || m.includes('invalid credentials')) {
    const sobra = password !== password.trim()
    return 'Correo o contraseña incorrectos.' +
      (sobra
        ? ' Ojo: tu contraseña empieza o termina con un espacio; si lo copiaste y pegaste, bórralo.'
        : ' Revisa que no haya espacios de más y que las mayúsculas sean las mismas.')
  }
  if (m.includes('email logins are disabled') || m.includes('signups not allowed')) {
    return 'El acceso con correo está desactivado en este momento. Avísame para revisarlo.'
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.'
  }
  if (m.includes('failed to fetch') || m.includes('network')) {
    return 'No se pudo conectar. Revisa tu conexión y vuelve a intentarlo.'
  }
  // Sin traducción conocida: se enseña el original para poder reportarlo.
  return 'No se pudo entrar: ' + (bruto || 'error desconocido')
}

function Login({ message }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const location = useLocation()

  const crudo = new URLSearchParams(location.search).get('redirigir')
  const destino = crudo && crudo.startsWith('/') && !crudo.startsWith('//') ? crudo : '/'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    if (error) { setError(mensajeDeError(error, password)); setLoading(false) }
    else { localStorage.setItem('login_time', String(Date.now())); navigate(destino, { replace: true }) }
  }

  return (
    <main className="portal centered">
      <section className="card login-card">
        <img src={LOGO_CLARO} alt="" className="logo-login" />
        <p className="eyebrow">Aula virtual</p>
        <h1>Iniciar sesión</h1>
        <p className="sutil">
          {destino !== '/'
            ? 'Ingresa tus datos y te llevo directo al curso que abriste.'
            : 'Ingresa con el usuario y contraseña que te compartí. Los talleres gratuitos no requieren cuenta.'}
        </p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="email">Correo electrónico</label>
          <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <CampoContrasena valor={password} onChange={setPassword} />
          <button type="submit" disabled={loading} className="button primary ancho">
            {loading ? 'Verificando...' : 'Entrar al aula'}
          </button>
        </form>
        {(error || message) && <p className="aviso-error">{error || message}</p>}
        <div className="login-pie">
          <button className="enlace-texto" onClick={() => navigate('/')}>← Volver al inicio</button>
          <button className="enlace-texto" onClick={() => navigate('/recuperar')}>
            Olvidé mi contraseña
          </button>
          <a className="enlace-texto" href={wa('Hola, no puedo entrar al aula virtual. ¿Me ayudas con mi acceso?')}
             target="_blank" rel="noopener noreferrer">¿Problemas para entrar?</a>
        </div>
      </section>
    </main>
  )
}

export default Login
