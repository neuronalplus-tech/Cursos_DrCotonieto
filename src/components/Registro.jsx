import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LOGO_CLARO, REGISTRO_DEFECTO } from '../config'
import { useOrganizacion } from '../lib/organizacion'
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
  // Textos y campos editables por el admin. Arrancan en los valores por
  // defecto del código (REGISTRO_DEFECTO) y se sobrescriben con lo que
  // haya guardado en config_registro. Así la pantalla nunca sale vacía,
  // ni siquiera mientras carga o si la organización no configuró nada.
  const [cfg, setCfg] = useState(REGISTRO_DEFECTO)
  const navigate = useNavigate()
  const location = useLocation()
  const { organizacion } = useOrganizacion()

  const crudo = new URLSearchParams(location.search).get('redirigir')
  const destino = crudo && crudo.startsWith('/') && !crudo.startsWith('//') ? crudo : '/'

  // El enlace que se reparte del taller es /registro?redirigir=/curso/12.
  // De ahí sale de qué taller viene la persona, y es lo único que lo
  // dice: un curso gratuito se abre sin fila en `acceso`, así que sin
  // esto el autoinscrito queda registrado "sin curso" y en el panel no
  // hay forma de saber a qué taller llegó. Se manda en la metadata y el
  // disparador crea la inscripción (solo si ese curso es gratuito).
  const cursoDelEnlace = (destino.match(/^\/curso\/(\d+)(?:\/|$)/) || [])[1] || null

  // Quien ya tiene sesión no debió llegar aquí: no hay nada que registrar.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) navigate(destino, { replace: true })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Traer los textos y campos que el admin configuró para ESTA org y
  // mezclarlos encima de los defaults. Solo pisan los que tengan valor;
  // los null del default de la base los dejamos caer al default del
  // código. Si la consulta falla, seguimos con REGISTRO_DEFECTO.
  useEffect(() => {
    if (!organizacion?.id) return
    let vivo = true
    ;(async () => {
      const { data, error } = await supabase
        .from('config_registro').select('*')
        .eq('organizacion_id', organizacion.id).maybeSingle()
      if (vivo && !error && data) {
        const mezclado = { ...REGISTRO_DEFECTO }
        for (const k of Object.keys(REGISTRO_DEFECTO)) {
          if (data[k] !== null && data[k] !== undefined) mezclado[k] = data[k]
        }
        setCfg(mezclado)
      }
    })()
    return () => { vivo = false }
  }, [organizacion?.id])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const nombreLimpio = nombre.trim()
    const correo = email.trim().toLowerCase()
    const correoRepetido = email2.trim().toLowerCase()

    // Cada campo "repetido" solo se valida si el admin lo dejó prendido:
    // si apagó el "repite tu correo", no hay segundo correo que cruzar.
    if (cfg.pedir_nombre && nombreLimpio.length < 3) { setError('Escribe tu nombre completo, tal como quieres que salga en tu constancia.'); return }
    if (cfg.pedir_repeticion_email && correo !== correoRepetido) { setError('Los dos correos no coinciden. Revísalos, por favor.'); return }
    if (cfg.pedir_repeticion_contrasena && password !== password2) { setError('Las dos contraseñas no coinciden.'); return }
    if (password.length < 6) { setError('La contraseña necesita al menos 6 caracteres.'); return }

    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email: correo,
      password,
      options: {
        // La metadata la lee el disparador manejar_alta_publica para
        // crear el perfil con el nombre y asignar la tanda (grupos de 50).
        // Si el admin apagó el campo de nombre, se manda el correo como
        // respaldo para que la constancia no salga en blanco.
        data: {
          nombre_completo: nombreLimpio || correo,
          origen: 'autoinscripcion',
          ...(cursoDelEnlace ? { curso_id: cursoDelEnlace } : {}),
        },
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
        <h1>{cfg.titulo}</h1>

        {confirma ? (
          <>
            <p className="sutil">
              {cfg.confirmacion_intro} <strong>{confirma}</strong>. {cfg.confirmacion_cierre}
            </p>
            <p className="nota">{cfg.confirmacion_nota}</p>
            <div className="login-pie">
              <button className="enlace-texto" onClick={() => navigate(destino)}>← Volver al taller</button>
              <button className="enlace-texto" onClick={() => navigate(rutaVolver)}>Ya confirmé mi correo: ir a entrar</button>
            </div>
          </>
        ) : (
          <>
            <p className="sutil">{cfg.descripcion}</p>
            <form onSubmit={handleSubmit}>
              {cfg.pedir_nombre && (
                <>
                  <label htmlFor="nombre">{cfg.etiqueta_nombre}</label>
                  <input id="nombre" type="text" autoComplete="name" value={nombre}
                         onChange={(e) => setNombre(e.target.value)} required />
                </>
              )}

              <label htmlFor="email">{cfg.etiqueta_email}</label>
              <input id="email" type="email" autoComplete="email" value={email}
                     onChange={(e) => setEmail(e.target.value)} required />

              {cfg.pedir_repeticion_email && (
                <>
                  <label htmlFor="email2">{cfg.etiqueta_email2}</label>
                  <input id="email2" type="email" autoComplete="email" value={email2}
                         onChange={(e) => setEmail2(e.target.value)} required />
                </>
              )}

              <CampoContrasena etiqueta={cfg.etiqueta_contrasena} valor={password}
                               onChange={setPassword} autoComplete="new-password" />
              {cfg.pedir_repeticion_contrasena && (
                <CampoContrasena etiqueta={cfg.etiqueta_contrasena2} valor={password2}
                                 onChange={setPassword2} autoComplete="new-password" />
              )}

              <button type="submit" disabled={loading} className="button primary ancho">
                {loading ? cfg.texto_cargando : cfg.texto_boton}
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
