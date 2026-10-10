/* ============================================================
   RECUPERAR CONTRASEÑA
   ------------------------------------------------------------
   Una sola pantalla para las dos mitades del proceso:

   1. Sin sesión → pide el correo y manda el enlace.
   2. Con sesión de recuperación (se llega desde ese enlace) →
      pide la contraseña nueva.

   Van juntas porque son el mismo trámite visto desde dos
   momentos, y separarlas obligaría a explicar al usuario en cuál
   de las dos está.

   SOBRE EL AVISO QUE SE DA AL PEDIR EL ENLACE
   Siempre dice lo mismo, exista o no esa cuenta. Si dijera "ese
   correo no está registrado", cualquiera podría averiguar quién
   es alumno tuyo probando correos.
   ============================================================ */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LOGO_CLARO, wa } from '../config'
import CampoContrasena from './CampoContrasena'

export default function Recuperar() {
  const navigate = useNavigate()
  const [modo, setModo] = useState('pedir')   // 'pedir' | 'cambiar'
  const [email, setEmail] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetida, setRepetida] = useState('')
  const [cargando, setCargando] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    let vivo = true
    const activarCambio = (session) => {
      if (!vivo || !session) return false
      setModo('cambiar')
      setMsg(null)
      return true
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((evento, session) => {
      if (evento === 'PASSWORD_RECOVERY') {
        if (!activarCambio(session)) {
          setMsg({ tipo: 'error', texto: 'El enlace no abrió una sesión válida. Solicita uno nuevo y vuelve a abrirlo.' })
        }
      }
    })

    const revisarEnlace = async () => {
      const url = new URL(window.location.href)

      /* El fallo del enlace se mira ANTES que la sesión, y es importante
         el orden. Si el enlace venció y en ese navegador ya había alguien
         dentro —el docente que lo abre para comprobarlo, por ejemplo—, al
         preguntar primero por la sesión la pantalla pasaba a "crea tu
         contraseña" usando la sesión equivocada: creías estar cambiando la
         del alumno y cambiabas la tuya. */
      const params = new URLSearchParams(url.hash.replace(/^#/, ''))
      const detalle = params.get('error_description') || url.searchParams.get('error_description')
      if (detalle) {
        if (vivo) setMsg({ tipo: 'error', texto: 'El enlace no es válido o ya venció. Solicita uno nuevo para crear tu contraseña.' })
        return
      }

      const { data } = await supabase.auth.getSession()
      if (!vivo) return
      if (activarCambio(data?.session)) return

      // Con PKCE el cliente suele intercambiar este código al inicializarse.
      // Si la inicialización aún no lo procesó, hacemos un intento explícito.
      const code = url.searchParams.get('code')
      if (code) {
        const { data: canje, error } = await supabase.auth.exchangeCodeForSession(code)
        if (activarCambio(canje?.session)) return
        if (error && vivo) setMsg({ tipo: 'error', texto: 'No se pudo validar el enlace. Puede haber vencido o haberse abierto fuera del navegador donde se pidió. Solicita uno nuevo.' })
      }
    }
    revisarEnlace()
    return () => { vivo = false; subscription.unsubscribe() }
  }, [])

  const pedirEnlace = async (e) => {
    e.preventDefault()
    setCargando(true)
    setMsg(null)
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/recuperar` },
    )
    setCargando(false)
    // El mensaje es el mismo haya o no cuenta: ver la nota de arriba.
    setMsg({
      tipo: error ? 'error' : 'ok',
      texto: error
        ? 'No se pudo enviar: ' + error.message
        : 'Si ese correo tiene cuenta, en un momento llegará un enlace para crear una contraseña nueva. Revisa también la carpeta de no deseados.',
    })
  }

  const cambiar = async (e) => {
    e.preventDefault()
    if (nueva.length < 6) {
      return setMsg({ tipo: 'error', texto: 'La contraseña necesita al menos 6 caracteres.' })
    }
    if (nueva !== repetida) {
      return setMsg({ tipo: 'error', texto: 'Las dos contraseñas no coinciden.' })
    }
    setCargando(true)
    const { data: sesion } = await supabase.auth.getSession()
    if (!sesion?.session) {
      setCargando(false)
      setModo('pedir')
      return setMsg({ tipo: 'error', texto: 'El enlace ya no tiene una sesión válida. Solicita uno nuevo para cambiar tu contraseña.' })
    }
    const { error } = await supabase.auth.updateUser({ password: nueva })
    setCargando(false)
    if (error) return setMsg({ tipo: 'error', texto: 'No se pudo cambiar: ' + error.message })
    setMsg({ tipo: 'ok', texto: 'Listo. Ya puedes entrar con tu contraseña nueva.' })
    setTimeout(() => navigate('/'), 1800)
  }

  return (
    <main className="login-main">
      <section className="login-card">
        <img src={LOGO_CLARO} alt="Dr. Ernesto Cotonieto" className="login-logo" />
        <p className="eyebrow">Aula virtual</p>

        {modo === 'pedir' ? (
          <>
            <h1>Recuperar el acceso</h1>
            <p className="sutil">
              Escribe el correo con el que entras y te mando un enlace para crear
              una contraseña nueva.
            </p>
            <form onSubmit={pedirEnlace}>
              <label htmlFor="correo-rec">Correo electrónico</label>
              <input id="correo-rec" type="email" autoComplete="email" required
                     value={email} onChange={(e) => setEmail(e.target.value)} />
              <button type="submit" disabled={cargando} className="button primary ancho">
                {cargando ? 'Enviando…' : 'Enviarme el enlace'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1>Crea tu contraseña nueva</h1>
            <p className="sutil">
              Elige una que recuerdes. Puedes pulsar el ojo para ver lo que escribes.
            </p>
            <form onSubmit={cambiar}>
              <CampoContrasena
                etiqueta="Contraseña nueva"
                valor={nueva}
                onChange={setNueva}
                autoComplete="new-password"
                autoFocus
                ayuda="Mínimo 6 caracteres."
              />
              <CampoContrasena
                etiqueta="Repítela"
                valor={repetida}
                onChange={setRepetida}
                autoComplete="new-password"
              />
              <button type="submit" disabled={cargando} className="button primary ancho">
                {cargando ? 'Guardando…' : 'Guardar contraseña'}
              </button>
            </form>
          </>
        )}

        {msg && (
          <p className={msg.tipo === 'ok' ? 'aviso-ok' : 'aviso-error'}>{msg.texto}</p>
        )}

        <div className="login-pie">
          <button className="enlace-texto" onClick={() => navigate('/acceso')}>
            ← Volver a iniciar sesión
          </button>
          <a className="enlace-texto" target="_blank" rel="noopener noreferrer"
             href={wa('Hola, no puedo recuperar mi contraseña del aula virtual. ¿Me ayudas?')}>
            ¿Sigues sin poder entrar?
          </a>
        </div>
      </section>
    </main>
  )
}
