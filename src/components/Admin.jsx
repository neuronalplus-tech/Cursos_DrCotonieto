import { Fragment, useEffect, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { rutaAcceso } from '../config'
import { enviarCorreo, obtenerEmailsInscritos, notificarInscritos } from '../lib/correo'
import { ModalPortal, Breadcrumb, BandaRedes, WhatsAppFlotante } from './ui'
import AdminExamenes from './AdminExamenes'
import AdminForo from './AdminForo'
import AdminCursos from './AdminCursos'
import AdminBitacora from './AdminBitacora'
import AdminOrganizaciones from './AdminOrganizaciones'
import AdminSuscripciones, { ResumenPlan } from './AdminSuscripciones'
import BancoPreguntas from './BancoPreguntas'
import TableroOrg from './TableroOrg'
import { parsePadron, cruzarGeneraciones, PLANTILLA_PADRON } from '../lib/padron'
import { usePermisos } from '../lib/permisos'
import { useOrganizacion } from '../lib/organizacion'
import TallerRecursos, { ModalEditarTaller } from './TallerRecursos'
import MensajesInbox, { MensajesPage } from './MensajesInbox'

/* ------------------------------------------------------------
   LAS SECCIONES DEL PANEL
   ------------------------------------------------------------
   [clave, etiqueta, soloPlataforma]. `soloPlataforma` deja fuera
   del panel de un cliente lo que es cosa del negocio: su bitácora,
   los demás clientes y lo que cada uno paga.

   Vivir en una tabla y no en veinte botones escritos a mano no es
   solo por brevedad: así no se puede añadir una pestaña y olvidar
   el `esAdminPlataforma`, que es como se filtra una fuga.
   ------------------------------------------------------------ */
const GRUPOS_PANEL = [
  ['Contenido', [
    ['cursos', '📚 Cursos'],
    ['banco', '🗂️ Banco de preguntas'],
    ['examenes', '📝 Exámenes'],
    ['foro', '💬 Foro'],
  ]],
  ['Personas', [
    ['inscripciones', '📋 Inscripciones'],
    ['usuarios', '👥 Gestión de usuarios'],
    ['facilitadores', '🛠️ Facilitadores'],
  ]],
  ['Seguimiento', [
    ['tablero', '📈 Tablero'],
    ['metricas', '📊 Métricas'],
  ]],
  ['Comunicación', [
    ['comunicados', '📧 Comunicados'],
    ['mensajes', '✉️ Mensajes'],
  ]],
  ['Plataforma', [
    ['organizaciones', '🏢 Organizaciones', true],
    ['suscripciones', '💳 Suscripciones', true],
    ['bitacora', '🧾 Bitácora', true],
  ]],
]

function Admin({ user }) {
  // Antes `esAdmin` llegaba como prop y arrancaba en false, asi que el
  // panel pintaba "No tienes permisos" durante el instante que tardaba
  // la consulta a `admins`. Se usa el hook, que ademas dice CUANDO ya
  // sabe la respuesta: hasta entonces no se decide nada.
  const { esAdmin: esAdminPlataforma, esAdminDe, cargado: permisosCargados }
    = usePermisos(user)
  const { organizacion, cargado: orgCargada } = useOrganizacion()

  // En el panel, "admin" significa administrar ESTE sitio: tú en el
  // tuyo, y el responsable de un cliente en el suyo. Lo que solo te
  // toca a ti cuelga de `esAdminPlataforma`.
  const esAdmin = esAdminDe(organizacion?.id)
  const [vista, setVista] = useState('inscripciones')

  const [filas, setFilas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState('todos')
  const [error, setError] = useState(null)

  const [formAbierto, setFormAbierto] = useState(false)
  const [nuevoEmail, setNuevoEmail] = useState('')
  const [nuevoPass, setNuevoPass] = useState('')
  const [cursosLista, setCursosLista] = useState([])
  const [cursosSeleccionados, setCursosSeleccionados] = useState([])
  const [rolNuevo, setRolNuevo] = useState('alumno')
  const [modoAcceso, setModoAcceso] = useState('clave')
  const [creando, setCreando] = useState(false)
  const [msg, setMsg] = useState('')

  const [usuarios, setUsuarios] = useState([])
  const [accesos, setAccesos] = useState({})
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [filtroCursoUsuario, setFiltroCursoUsuario] = useState('todos')
  const [seleccionados, setSeleccionados] = useState(new Set())
  const [expandidos, setExpandidos] = useState(new Set())
  // correo (minúsculas) -> Set de curso_id que facilita.
  // Se indexa por correo y no por usuario_id porque así está la tabla:
  // permite asignar a quien todavía no tiene cuenta.
  const [facilitaPorEmail, setFacilitaPorEmail] = useState({})
  const [enviandoEnlace, setEnviandoEnlace] = useState(null)
  const [categoriasLista, setCategoriasLista] = useState([])
  // correo -> Set de categoria_id. Va aparte del mapa por curso
  // porque son dos formas distintas de asignar, no una sola.
  const [facilitaCategoria, setFacilitaCategoria] = useState({})
  const [nuevoFacilEmail, setNuevoFacilEmail] = useState('')
  const [nuevoFacilCurso, setNuevoFacilCurso] = useState('')
  const [msgFacil, setMsgFacil] = useState('')
  const [toggling, setToggling] = useState({})
  const [cargandoGestion, setCargandoGestion] = useState(false)
  const [msgGestion, setMsgGestion] = useState('')
  const [bulkCursoId, setBulkCursoId] = useState('')
  const [bulkAccion, setBulkAccion] = useState('dar')
  const [bulkGeneracion, setBulkGeneracion] = useState('')
  const [generacionesCurso, setGeneracionesCurso] = useState([])
  const [bulkProcesando, setBulkProcesando] = useState(false)

  const [modalNotas, setModalNotas] = useState(null)
  const [guardandoNota, setGuardandoNota] = useState(false)

  const [confirmacion, setConfirmacion] = useState(null)

  const [masivoAbierto, setMasivoAbierto] = useState(false)
  const [emailsMasivos, setEmailsMasivos] = useState('')
  const [passMasivo, setPassMasivo] = useState('')
  const [cursosMasivos, setCursosMasivos] = useState([])
  const [rolMasivo, setRolMasivo] = useState('alumno')
  const [modoMasivo, setModoMasivo] = useState('clave')
  const [creandoMasivo, setCreandoMasivo] = useState(false)
  const [progresoMasivo, setProgresoMasivo] = useState({ actual: 0, total: 0 })
  const [resultadoMasivo, setResultadoMasivo] = useState(null)
  const [msgMasivo, setMsgMasivo] = useState('')

  const [comunicadoDestino, setComunicadoDestino] = useState('todos')
  const [comunicadoCursoId, setComunicadoCursoId] = useState('')
  const [comunicadoManual, setComunicadoManual] = useState('')
  const [comunicadoAsunto, setComunicadoAsunto] = useState('')
  const [comunicadoCuerpo, setComunicadoCuerpo] = useState('')
  const [comunicadoEnviando, setComunicadoEnviando] = useState(false)
  const [comunicadoMsg, setComunicadoMsg] = useState('')
  const [comunicadoResultado, setComunicadoResultado] = useState(null)
  const [comunicadoPreview, setComunicadoPreview] = useState(false)
  const [comunicadoEditorKey, setComunicadoEditorKey] = useState(0)
  const comunicadoEditorRef = useRef(null)
  const [editorHtmlAbierto, setEditorHtmlAbierto] = useState(false)
  const [editorHtmlTexto, setEditorHtmlTexto] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) { navigate(rutaAcceso('/admin')); return }
    async function load() {
      const { data: misCursos } = organizacion?.id
        ? await supabase.from('cursos').select('id').eq('organizacion_id', organizacion.id)
        : { data: null }
      const idsCurso = misCursos ? new Set(misCursos.map(c => c.id)) : null

      const { data, error } = await supabase.from('vista_admin_inscripciones')
        .select('*').order('inscrito_el', { ascending: false })
      if (error) setError(error.message)
      // La vista es de toda la plataforma: aquí se acota a lo de esta
      // organización, que es lo único que su administrador debe ver.
      else setFilas(idsCurso ? (data || []).filter(f => idsCurso.has(f.curso_id)) : (data || []))
      setCargando(false)
    }
    load()
  }, [user, navigate, organizacion])

  useEffect(() => {
    if (!esAdmin || !organizacion?.id) return
    supabase.from('cursos').select('id, titulo')
      .eq('activo', true).eq('organizacion_id', organizacion.id).order('orden')
      .then(({ data }) => setCursosLista(data || []))
  }, [esAdmin, organizacion])

  const cargarGestion = async () => {
    setCargandoGestion(true)
    try {
      const { data: usrs, error: errU } = await supabase.rpc('listar_usuarios_con_accesos')
      if (errU) throw errU
      setUsuarios(usrs || [])

      const { data: todosAccesos } = await supabase.from('acceso').select('usuario_id, curso_id')
      const accMap = {}
      ;(todosAccesos || []).forEach(a => {
        if (!accMap[a.usuario_id]) accMap[a.usuario_id] = new Set()
        accMap[a.usuario_id].add(a.curso_id)
      })
      setAccesos(accMap)
    } catch (e) {
      console.error('Error cargando gestión:', e)
      setMsgGestion('Error cargando usuarios: ' + e.message)
    } finally {
      setCargandoGestion(false)
    }
  }

  useEffect(() => {
    if (!esAdmin || vista !== 'usuarios') return
    if (usuarios.length === 0) cargarGestion()
  }, [esAdmin, vista, usuarios.length])

  // Las asignaciones de facilitador se cargan aparte de los accesos:
  // son otra tabla y otra llave (correo, no usuario_id).
  useEffect(() => {
    if (!esAdmin || (vista !== 'usuarios' && vista !== 'facilitadores')) return
    let vivo = true
    supabase.from('facilitadores').select('email, curso_id, categoria_id').then(({ data }) => {
      if (!vivo || !data) return
      const mapa = {}
      const porCat = {}
      for (const fila of data) {
        const k = String(fila.email || '').toLowerCase()
        if (fila.categoria_id != null) {
          if (!porCat[k]) porCat[k] = new Set()
          porCat[k].add(Number(fila.categoria_id))
        } else if (fila.curso_id != null) {
          if (!mapa[k]) mapa[k] = new Set()
          mapa[k].add(Number(fila.curso_id))
        }
      }
      setFacilitaPorEmail(mapa)
      setFacilitaCategoria(porCat)
    })
    supabase.from('categorias').select('id, nombre').order('orden').order('nombre')
      .then(({ data }) => { if (vivo) setCategoriasLista(data || []) })
    return () => { vivo = false }
  }, [esAdmin, vista, usuarios.length])

  const fecha = (d) => d ? new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
  const esActivo = (u) => {
    if (!u.ultimo_ingreso) return false
    const dias = (Date.now() - new Date(u.ultimo_ingreso).getTime()) / (1000 * 60 * 60 * 24)
    return dias <= 14
  }
  const diasSinEntrar = (u) => {
    if (!u.ultimo_ingreso) return null
    return Math.floor((Date.now() - new Date(u.ultimo_ingreso).getTime()) / (1000 * 60 * 60 * 24))
  }

  const toggleExpandido = (usuario_id) => {
    setExpandidos(prev => {
      const nuevo = new Set(prev)
      if (nuevo.has(usuario_id)) nuevo.delete(usuario_id)
      else nuevo.add(usuario_id)
      return nuevo
    })
  }

  const toggleCurso = (id) => {
    setCursosSeleccionados(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  /*
   * Asigna el rol de facilitador a una lista de correos.
   *
   * Va por separado de la creación de la cuenta a propósito:
   * `facilitadores` se indexa por CORREO, no por usuario_id, así que
   * funciona igual con alguien que ya tiene cuenta y con alguien que
   * todavía no ha entrado nunca. El día que esa persona se registre
   * con ese correo, el rol ya estará esperándola.
   *
   * El índice único (lower(email), curso_id) impide duplicados, así que
   * reasignar a alguien que ya estaba no da error ni crea basura.
   */
  /* Contraseña aleatoria para el alta por invitación.

     No se muestra ni se guarda: existe solo porque crear la cuenta
     exige una, y queda inservible en cuanto la persona elige la suya
     desde el enlace. Nadie, ni tú, llega a conocerla. */
  const claveDeUnSoloUso = () => {
    const b = new Uint8Array(18)
    crypto.getRandomValues(b)
    return 'Inv-' + btoa(String.fromCharCode(...b)).replace(/[^A-Za-z0-9]/g, '').slice(0, 20)
  }

  /* Supabase solo sabe invitar con la clave de servicio, que no puede
     vivir en el navegador. Esto consigue lo mismo con lo que ya hay:
     la cuenta se crea con una clave que nadie conoce y acto seguido se
     manda el enlace para que elija la suya. Para quien lo recibe es
     una invitación. */
  const invitar = async (emails) => {
    const fallos = []
    for (const correo of emails) {
      const { error } = await supabase.auth.resetPasswordForEmail(correo, {
        redirectTo: `${window.location.origin}/recuperar`,
      })
      if (error) fallos.push(`${correo}: ${error.message}`)
    }
    return fallos
  }

  const asignarFacilitadores = async (emails, cursoIds) => {
    const filas = []
    for (const email of emails) {
      for (const curso_id of cursoIds) {
        filas.push({ email: email.trim().toLowerCase(), curso_id })
      }
    }
    if (!filas.length) return { asignadas: 0, error: null }
    const { error } = await supabase
      .from('facilitadores')
      .upsert(filas, { onConflict: 'email,curso_id', ignoreDuplicates: true })
    return { asignadas: error ? 0 : filas.length, error }
  }

  const crearUsuario = async () => {
    setMsg('')
    // Solo facilitador no crea cuenta: es una asignación de rol por
    // correo, así que no pide contraseña.
    /* El correo se guarda como lo escribiste, pero al iniciar sesión
       se envía en minúsculas y sin espacios. Si aquí entra con una
       mayúscula o un espacio pegado, la cuenta queda creada con una
       dirección que nadie va a poder teclear igual. Se normaliza
       aquí, que es donde todavía se puede.

       La contraseña se recorta por el mismo motivo: un espacio al
       final, invisible y casi siempre heredado de un copiar y pegar,
       convierte el alta en una cuenta inaccesible. */
    const correoLimpio = nuevoEmail.trim().toLowerCase()
    const claveLimpia = nuevoPass.trim()
    const soloFacilitador = rolNuevo === 'facilitador'
    if (!correoLimpio) { setMsg('Error: el correo es obligatorio'); return }
    const porInvitacion = modoAcceso === 'invitacion'
    if (!soloFacilitador && !porInvitacion && !claveLimpia) { setMsg('Error: correo y contraseña son obligatorios'); return }
    if (!soloFacilitador && !porInvitacion && claveLimpia.length < 6) { setMsg('Error: la contraseña debe tener al menos 6 caracteres'); return }
    if (cursosSeleccionados.length === 0) { setMsg('Error: selecciona al menos un curso'); return }

    setCreando(true)

    if (soloFacilitador) {
      const { asignadas, error } = await asignarFacilitadores([nuevoEmail], cursosSeleccionados)
      setMsg(error
        ? 'Error al asignar: ' + error.message
        : `✅ ${nuevoEmail} queda como facilitador de ${asignadas} curso(s)`)
      if (!error) { setNuevoEmail(''); setCursosSeleccionados([]) }
      setCreando(false)
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { setMsg('Error: no hay sesión activa'); setCreando(false); return }

      // Una sola función para el alta individual y la masiva: la
      // individual es una lista de un elemento. Dos funciones casi
      // iguales fue justo lo que permitió que una se arreglara y la
      // otra se quedara atrás.
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crear-usuarios`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
        },
        body: JSON.stringify({
          emails: [correoLimpio],
          password: porInvitacion ? claveDeUnSoloUso() : claveLimpia,
          curso_ids: cursosSeleccionados
        })
      })

      const texto = await res.text()
      let json = {}
      try { json = JSON.parse(texto) } catch {}
      const errorReal = json.error || json.message || json.code || texto || 'sin detalles'

      if (!res.ok || json.error) {
        setMsg(`Error (HTTP ${res.status}): ${errorReal}`)
      } else {
        let extra = ''
        if (porInvitacion) {
          const fallos = await invitar([correoLimpio])
          extra += fallos.length
            ? ` (pero no se pudo enviar la invitación: ${fallos[0]})`
            : '. Le llegó un correo para que elija su contraseña'
        }
        if (rolNuevo === 'ambos') {
          const r = await asignarFacilitadores([correoLimpio], cursosSeleccionados)
          extra = r.error ? ` (pero falló el rol de facilitador: ${r.error.message})` : ' y queda como facilitador'
        }
        // Si no vuelve un id, la cuenta NO existe por mucho que la
        // respuesta sea 200. Decir "creado" sin comprobarlo es lo que
        // dejó el alta rota tres semanas sin que nadie se enterara.
        const r0 = json.resultados?.[0]
        if (!r0?.id) {
          setMsg('⚠️ El servidor contestó sin error pero la cuenta no aparece. ' +
            (r0?.mensaje || 'Revisa Authentication → Users en Supabase.'))
          setCreando(false)
          return
        }
        const yaEstaba = r0.status === 'existente' ? ' (ya tenía cuenta; se actualizó su contraseña)' : ''
        setMsg(`✅ ${r0.email} ${r0.status === 'existente' ? 'tiene acceso a' : 'creado y asignado a'} ` +
          `${cursosSeleccionados.length} curso(s)${yaEstaba}` + extra)
        setNuevoEmail('')
        setNuevoPass('')
        setCursosSeleccionados([])
        const { data } = await supabase.from('vista_admin_inscripciones')
          .select('*').order('inscrito_el', { ascending: false })
        setFilas(data || [])
        setUsuarios([])
      }
    } catch (e) {
      setMsg('Error inesperado: ' + (e.message || e.toString()))
    }
    setCreando(false)
  }

  const toggleCursoMasivo = (id) => {
    setCursosMasivos(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  /* El lector de correos sueltos se queda porque los comunicados lo
     usan con otro texto. Para el alta en lote se usa `padron`, que
     entiende la misma lista de siempre Y las columnas de un padrón
     institucional (nombre, generación, ruta). */
  const padron = parsePadron(emailsMasivos)

  const parsearEmails = (texto) => {
    return texto
      .split(/[,;\n\r\t ]+/)
      .map(e => e.trim().toLowerCase())
      .filter(e => e && e.includes('@') && e.includes('.'))
      .filter((e, i, arr) => arr.indexOf(e) === i)
  }

  const crearUsuariosMasivos = async () => {
    setMsgMasivo('')
    setResultadoMasivo(null)

    const emails = padron.filas.map(f => f.email)

    if (emails.length === 0) { setMsgMasivo('Error: pega al menos un correo válido'); return }
    if (emails.length > 200) { setMsgMasivo(`Error: máximo 200 correos por lote (pegaste ${emails.length})`); return }
    const soloFacilMasivo = rolMasivo === 'facilitador'
    const masivoPorInvitacion = modoMasivo === 'invitacion'
    // Mismo recorte que en el alta individual: un espacio final,
    // invisible, deja a todo el lote sin poder entrar.
    const claveLote = passMasivo.trim()
    if (!soloFacilMasivo && !masivoPorInvitacion && (!claveLote || claveLote.length < 6)) { setMsgMasivo('Error: la contraseña debe tener al menos 6 caracteres'); return }
    if (cursosMasivos.length === 0) { setMsgMasivo('Error: selecciona al menos un curso'); return }

    // Asignar el rol no crea cuentas, así que no necesita confirmación
    // de "esto no se puede deshacer": quitar a un facilitador es una
    // fila menos en la tabla.
    if (soloFacilMasivo) {
      setCreandoMasivo(true)
      const { asignadas, error } = await asignarFacilitadores(emails, cursosMasivos)
      setMsgMasivo(error
        ? 'Error al asignar: ' + error.message
        : `✅ ${emails.length} persona(s) quedan como facilitadoras · ${asignadas} asignación(es)`)
      if (!error) setEmailsMasivos('')
      setCreandoMasivo(false)
      return
    }


    const confirmado = await new Promise(resolve => {
      setConfirmacion({
        mensaje: `¿Crear ${emails.length} usuario(s) y asignarlos a ${cursosMasivos.length} curso(s)? Esta acción no se puede deshacer.`,
        onConfirm: () => { setConfirmacion(null); resolve(true) },
        onCancel: () => { setConfirmacion(null); resolve(false) }
      })
    })
    if (!confirmado) return

    setCreandoMasivo(true)
    setProgresoMasivo({ actual: 0, total: emails.length })

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crear-usuarios`
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) { setMsgMasivo('Error: no hay sesión activa'); setCreandoMasivo(false); return }

    const BATCH = 25
    const todosResultados = []
    let creados = 0, existentes = 0, errores = 0

    try {
      for (let i = 0; i < emails.length; i += BATCH) {
        const lote = emails.slice(i, i + BATCH)
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            emails: lote,
            password: masivoPorInvitacion ? claveDeUnSoloUso() : claveLote,
            curso_ids: cursosMasivos,
          }),
        })

        const json = await res.json()
        if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`)

        creados += json.creados || 0
        existentes += json.existentes || 0
        errores += json.errores || 0
        todosResultados.push(...(json.resultados || []))

        setProgresoMasivo({ actual: Math.min(i + BATCH, emails.length), total: emails.length })
      }

      if (masivoPorInvitacion) {
        // Van de uno en uno: el servicio de correo tiene un tope por
        // hora y conviene saber exactamente cuáles no salieron.
        const fallos = await invitar(emails)
        if (fallos.length) {
          setMsgMasivo(`Cuentas creadas, pero ${fallos.length} invitación(es) no salieron. ` +
            'El correo de Supabase tiene un tope por hora: vuelve a intentarlo luego con el botón 🔑.')
        }
      }

      if (rolMasivo === 'ambos') {
        const r = await asignarFacilitadores(emails, cursosMasivos)
        if (r.error) setMsgMasivo('Cuentas creadas, pero falló el rol de facilitador: ' + r.error.message)
      }

      /* --- Segundo paso: lo que el padrón traía además del correo ---

         Las cuentas las crea la función del servidor, que solo recibe
         correos. El nombre, la generación y la ruta se escriben aquí
         después, con la sesión del administrador y bajo RLS.

         Si algo de esto falla NO se deshace el alta: las cuentas ya
         existen y volver a crearlas no es posible. Se avisa y se sigue;
         un nombre que falta se corrige en dos clics, una cuenta a medio
         crear no. */
      // El aviso se acumula en vez de pintarse: el mensaje final de
      // "proceso terminado" se escribe después y lo borraría.
      let avisoPadron = ''
      const extras = padron.filas.filter(f => f.nombre || f.generacion || f.grupo)
      if (extras.length) {
        try {
          const { data: usrs } = await supabase.rpc('listar_usuarios_con_accesos')
          const idDe = {}
          for (const u of usrs || []) {
            if (u.email) idDe[u.email.toLowerCase()] = u.usuario_id
          }

          // Nombres: se escriben solo donde el padrón trae uno.
          const perfiles = extras
            .filter(f => f.nombre && idDe[f.email])
            .map(f => ({ id: idDe[f.email], nombre_completo: f.nombre }))
          if (perfiles.length) {
            const { error: eP } = await supabase.from('perfiles')
              .upsert(perfiles, { onConflict: 'id' })
            if (eP) throw new Error('nombres: ' + eP.message)
          }

          // Generación y ruta, por curso.
          const { data: gens } = await supabase.from('generaciones')
            .select('id, nombre, curso_id').in('curso_id', cursosMasivos)
          const sinCruzarTodas = new Set()
          for (const cursoId of cursosMasivos) {
            const delCurso = (gens || []).filter(g => g.curso_id === cursoId)
            const { asignadas, sinCruzar } = cruzarGeneraciones(extras, delCurso)
            for (const x of sinCruzar) sinCruzarTodas.add(x)
            for (const f of extras) {
              const uid = idDe[f.email]
              if (!uid) continue
              const cambios = {}
              if (asignadas[f.email] != null) cambios.generacion_id = asignadas[f.email]
              if (f.grupo) cambios.grupo = f.grupo
              if (!Object.keys(cambios).length) continue
              await supabase.from('acceso').update(cambios)
                .eq('usuario_id', uid).eq('curso_id', cursoId)
            }
          }
          if (sinCruzarTodas.size) {
            avisoPadron = ' · No encontré estas generaciones y las dejé sin asignar: ' +
              [...sinCruzarTodas].join(', ') + '. Créalas en el curso y vuelve a asignarlas.'
          }
        } catch (e2) {
          avisoPadron = ' · No pude guardar todos los datos del padrón: ' + e2.message +
            '. Revisa nombres y generaciones en Gestión de usuarios.'
        }
      }

      setResultadoMasivo({
        total: emails.length,
        creados,
        existentes,
        errores,
        detalles: todosResultados,
      })
      setMsgMasivo(`✓ Proceso terminado: ${creados} creados, ${existentes} ya existían, ` + `${errores} con error.${avisoPadron}`)

      const { data } = await supabase.from('vista_admin_inscripciones')
        .select('*').order('inscrito_el', { ascending: false })
      setFilas(data || [])
      setUsuarios([])
      setEmailsMasivos('')
      setCursosMasivos([])

    } catch (e) {
      console.error('Error masivo:', e)
      setMsgMasivo('Error en inscripción masiva: ' + e.message)
    } finally {
      setCreandoMasivo(false)
      setProgresoMasivo({ actual: 0, total: 0 })
    }
  }

  const calcularDestinatarios = () => {
    const hoy = Date.now()
    const dedup = new Map()

    const agregar = (f) => {
      const key = (f.email || '').trim().toLowerCase()
      if (!key || !key.includes('@')) return
      if (!dedup.has(key)) {
        dedup.set(key, { email: key, nombre_completo: f.nombre_completo || '' })
      }
    }

    if (comunicadoDestino === 'manual') {
      return parsearEmails(comunicadoManual).map(e => ({ email: e, nombre_completo: '' }))
    }

    if (comunicadoDestino === 'todos') {
      filas.forEach(agregar)
    } else if (comunicadoDestino === 'curso') {
      if (!comunicadoCursoId) return []
      const cursoNombre = cursosLista.find(c => c.id === parseInt(comunicadoCursoId))?.titulo
      filas.filter(f => f.curso === cursoNombre).forEach(agregar)
    } else if (comunicadoDestino === 'riesgo') {
      const hace15d = 15 * 24 * 60 * 60 * 1000
      filas.forEach(f => {
        if (!f.ultimo_ingreso) return
        if (hoy - new Date(f.ultimo_ingreso).getTime() > hace15d) agregar(f)
      })
    } else if (comunicadoDestino === 'activos') {
      const hace14d = 14 * 24 * 60 * 60 * 1000
      filas.forEach(f => {
        if (!f.ultimo_ingreso) return
        if (hoy - new Date(f.ultimo_ingreso).getTime() <= hace14d) agregar(f)
      })
    } else if (comunicadoDestino === 'completaron') {
      filas.forEach(f => {
        if (f.total_recursos > 0 && f.recursos_completados === f.total_recursos) agregar(f)
      })
    }

    return Array.from(dedup.values())
  }

  const ejecutarComando = (cmd, valor = null) => {
    document.execCommand(cmd, false, valor)
    comunicadoEditorRef.current?.focus()
    if (comunicadoEditorRef.current) {
      setComunicadoCuerpo(comunicadoEditorRef.current.innerHTML)
    }
  }

  const crearEnlace = () => {
    const url = prompt('URL del enlace (ej. https://...):')
    if (url) ejecutarComando('createLink', url)
  }

  const insertarTitulo = (tag) => {
    document.execCommand('formatBlock', false, tag)
    comunicadoEditorRef.current?.focus()
    if (comunicadoEditorRef.current) {
      setComunicadoCuerpo(comunicadoEditorRef.current.innerHTML)
    }
  }

  const limpiarFormato = () => {
    document.execCommand('removeFormat')
    document.execCommand('formatBlock', false, '<p>')
    comunicadoEditorRef.current?.focus()
    if (comunicadoEditorRef.current) {
      setComunicadoCuerpo(comunicadoEditorRef.current.innerHTML)
    }
  }

  const abrirEditorHtml = () => {
    const htmlActual = comunicadoEditorRef.current?.innerHTML || comunicadoCuerpo || ''
    setEditorHtmlTexto(htmlActual)
    setEditorHtmlAbierto(true)
  }

  const aplicarEditorHtml = () => {
    if (comunicadoEditorRef.current) {
      comunicadoEditorRef.current.innerHTML = editorHtmlTexto
    }
    setComunicadoCuerpo(editorHtmlTexto)
    setEditorHtmlAbierto(false)
  }

  const limpiarEditor = () => {
    setComunicadoAsunto('')
    setComunicadoCuerpo('')
    setComunicadoDestino('todos')
    setComunicadoCursoId('')
    setComunicadoManual('')
    setComunicadoMsg('')
    setComunicadoResultado(null)
    setComunicadoEditorKey(k => k + 1)
  }

  const enviarComunicado = async () => {
    setComunicadoMsg('')
    setComunicadoResultado(null)

    const destinatarios = calcularDestinatarios()

    if (!comunicadoAsunto.trim()) { setComunicadoMsg('Error: escribe un asunto'); return }

    const cuerpoLimpio = comunicadoCuerpo.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
    if (!cuerpoLimpio) { setComunicadoMsg('Error: escribe el cuerpo del mensaje'); return }
    if (destinatarios.length === 0) { setComunicadoMsg('Error: no hay destinatarios con ese criterio'); return }
    if (destinatarios.length > 500) { setComunicadoMsg(`Error: ${destinatarios.length} destinatarios excede el límite de 500 por envío. Divide en tandas.`); return }

    const confirmado = await new Promise(resolve => {
      setConfirmacion({
        mensaje: `¿Enviar este comunicado a ${destinatarios.length} alumno(s)? Se enviará un solo correo con todos en CCO.`,
        onConfirm: () => { setConfirmacion(null); resolve(true) },
        onCancel: () => { setConfirmacion(null); resolve(false) }
      })
    })
    if (!confirmado) return

    setComunicadoEnviando(true)

    try {
      const textoPlano = comunicadoCuerpo
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim()

      const payload = {
        tipo: 'comunicado-masivo',
        asunto: comunicadoAsunto.trim(),
        cuerpoTexto: textoPlano,
        cuerpoHtml: comunicadoCuerpo.trim(),
        alumnos: destinatarios,
      }

      const res = await enviarCorreo(payload)

      if (!res.ok) {
        setComunicadoMsg('⚠️ ' + (res.motivo || 'No se pudo enviar.'))
        return
      }

      setComunicadoResultado({
        enviados: destinatarios.length,
        asunto: comunicadoAsunto.trim(),
      })
      setComunicadoMsg(`✓ Comunicado enviado a ${destinatarios.length} alumno(s). Revisa "Enviados" en Gmail.`)
      setComunicadoAsunto('')
      setComunicadoCuerpo('')
      setComunicadoEditorKey(k => k + 1)
    } catch (e) {
      setComunicadoMsg('Error: ' + e.message)
    } finally {
      setComunicadoEnviando(false)
    }
  }

  /* Pone o quita el rol de facilitador de UN curso concreto. */
  /* Las contraseñas no se pueden consultar: Supabase guarda un hash
     bcrypt, que es irreversible. Lo que sí se puede es mandarle a la
     persona un enlace para que elija una nueva.

     Va con la clave pública, igual que si lo pidiera ella desde la
     pantalla de acceso. Asignarle una contraseña directamente exigiria
     la clave de servicio, que no puede vivir en el navegador. */
  const enviarEnlaceClave = async (email) => {
    if (!window.confirm(`¿Mandar a ${email} un enlace para crear una contraseña nueva?`)) return
    setEnviandoEnlace(email)
    setMsgGestion('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/recuperar`,
    })
    setEnviandoEnlace(null)
    setMsgGestion(error
      ? 'No se pudo enviar: ' + error.message
      : `✓ Enlace enviado a ${email}`)
  }

  const toggleFacilitador = async (email, curso_id, esFacil) => {
    const correo = String(email || '').toLowerCase()
    const key = `facil-${correo}-${curso_id}`
    setToggling(prev => ({ ...prev, [key]: true }))
    setMsgGestion('')
    try {
      if (esFacil) {
        const { error } = await supabase.from('facilitadores')
          .delete().eq('curso_id', curso_id).ilike('email', correo)
        if (error) throw error
      } else {
        const { error } = await supabase.from('facilitadores')
          .insert({ email: correo, curso_id })
        if (error) throw error
      }
      setFacilitaPorEmail(prev => {
        const nuevo = { ...prev }
        const set = new Set(nuevo[correo] || [])
        if (esFacil) set.delete(Number(curso_id))
        else set.add(Number(curso_id))
        nuevo[correo] = set
        return nuevo
      })
      setMsgGestion(esFacil ? '✓ Ya no facilita ese curso' : '✓ Asignado como facilitador')
    } catch (e) {
      setMsgGestion('Error: ' + (e.message || e))
    }
    setToggling(prev => ({ ...prev, [key]: false }))
  }

  /* Alta desde la pestaña de Facilitadores: correo + curso, sin más. */
  const anadirFacilitador = async () => {
    const correo = nuevoFacilEmail.trim().toLowerCase()
    if (!correo.includes('@')) { setMsgFacil('Escribe un correo válido'); return }
    if (!nuevoFacilCurso) { setMsgFacil('Elige un curso o una categoría'); return }

    // "cat:12" o "curso:36": el prefijo evita confundir un id de
    // categoría con uno de curso, que son secuencias distintas.
    const [tipo, idTexto] = nuevoFacilCurso.split(':')
    const id = Number(idTexto)
    const esCat = tipo === 'cat'

    const yaEsta = esCat
      ? facilitaCategoria[correo]?.has(id)
      : facilitaPorEmail[correo]?.has(id)
    if (yaEsta) { setMsgFacil('Esa persona ya lo tiene asignado'); return }

    setMsgFacil('')
    const { error } = await supabase.from('facilitadores').insert(
      esCat ? { email: correo, categoria_id: id } : { email: correo, curso_id: id })
    if (error) { setMsgFacil('Error al asignar: ' + error.message); return }

    if (esCat) {
      setFacilitaCategoria(prev => {
        const n = { ...prev }
        n[correo] = new Set(n[correo] || []).add(id)
        return n
      })
    } else {
      setFacilitaPorEmail(prev => {
        const n = { ...prev }
        n[correo] = new Set(n[correo] || []).add(id)
        return n
      })
    }
    setNuevoFacilEmail('')
    setMsgFacil('✓ Asignado')
  }

  /* Quitar una asignación de categoría. La de curso ya la maneja
     toggleFacilitador, que vive en Gestión de usuarios. */
  const quitarCategoria = async (correo, categoria_id) => {
    const { error } = await supabase.from('facilitadores')
      .delete().eq('categoria_id', categoria_id).ilike('email', correo)
    if (error) { setMsgFacil('No se pudo quitar: ' + error.message); return }
    setFacilitaCategoria(prev => {
      const n = { ...prev }
      const s = new Set(n[correo] || [])
      s.delete(Number(categoria_id))
      n[correo] = s
      return n
    })
    setMsgFacil('✓ Quitado')
  }

  const toggleAcceso = async (usuario_id, curso_id, tiene, email) => {
    if (tiene) {
      const ok = await new Promise(resolve => {
        setConfirmacion({
          mensaje: `¿Seguro que quieres quitar a ${email} del curso?`,
          onConfirm: () => { setConfirmacion(null); resolve(true) },
          onCancel: () => { setConfirmacion(null); resolve(false) }
        })
      })
      if (!ok) return
    }

    const key = `${usuario_id}-${curso_id}`
    setToggling(prev => ({ ...prev, [key]: true }))
    setMsgGestion('')
    try {
      if (tiene) {
        const { error } = await supabase
          .from('acceso')
          .delete()
          .eq('usuario_id', usuario_id)
          .eq('curso_id', curso_id)
        if (error) throw error
        setAccesos(prev => {
          const nuevo = { ...prev }
          nuevo[usuario_id] = new Set(nuevo[usuario_id] || [])
          nuevo[usuario_id].delete(curso_id)
          return nuevo
        })
        setMsgGestion('✓ Acceso revocado')
      } else {
        const { error } = await supabase
          .from('acceso')
          .insert({ usuario_id, curso_id, grupo: null })
        if (error) throw error
        setAccesos(prev => {
          const nuevo = { ...prev }
          nuevo[usuario_id] = new Set(nuevo[usuario_id] || [])
          nuevo[usuario_id].add(curso_id)
          return nuevo
        })
        setMsgGestion('✓ Acceso otorgado')
      }
      const { data } = await supabase.from('vista_admin_inscripciones')
        .select('*').order('inscrito_el', { ascending: false })
      setFilas(data || [])
      setUsuarios(prev => prev.map(u => {
        if (u.usuario_id !== usuario_id) return u
        const count = (accesos[usuario_id]?.size || 0)
        return { ...u, cursos_inscritos: tiene ? Math.max(0, count - 1) : count + 1 }
      }))
    } catch (e) {
      setMsgGestion('Error: ' + e.message)
    } finally {
      setToggling(prev => {
        const nuevo = { ...prev }
        delete nuevo[key]
        return nuevo
      })
    }
  }

  const toggleSeleccion = (usuario_id) => {
    setSeleccionados(prev => {
      const nuevo = new Set(prev)
      if (nuevo.has(usuario_id)) nuevo.delete(usuario_id)
      else nuevo.add(usuario_id)
      return nuevo
    })
  }

  const toggleTodos = (lista) => {
    const todosSeleccionados = lista.every(u => seleccionados.has(u.usuario_id))
    if (todosSeleccionados) {
      setSeleccionados(new Set())
    } else {
      setSeleccionados(new Set(lista.map(u => u.usuario_id)))
    }
  }

  // Las generaciones son de UN curso, así que la lista se rehace al
  // cambiar el curso de la barra. Sin esto se podría asignar a alguien
  // a la generación de otro curso.
  useEffect(() => {
    setBulkGeneracion('')
    if (!bulkCursoId) { setGeneracionesCurso([]); return }
    let vivo = true
    supabase.from('generaciones').select('id, nombre')
      .eq('curso_id', Number(bulkCursoId))
      .order('fecha_inicio', { ascending: false, nullsFirst: false })
      .then(({ data }) => { if (vivo) setGeneracionesCurso(data || []) })
    return () => { vivo = false }
  }, [bulkCursoId])

  const ejecutarBulk = async () => {
    if (!bulkCursoId) { setMsgGestion('Error: elige un curso'); return }
    const usuariosArr = [...seleccionados]
    if (usuariosArr.length === 0) { setMsgGestion('Error: no hay usuarios seleccionados'); return }

    if (bulkAccion === 'quitar') {
      const ok = await new Promise(resolve => {
        setConfirmacion({
          mensaje: `¿Quitar acceso al curso seleccionado a ${usuariosArr.length} usuario(s)?`,
          onConfirm: () => { setConfirmacion(null); resolve(true) },
          onCancel: () => { setConfirmacion(null); resolve(false) }
        })
      })
      if (!ok) return
    }

    setBulkProcesando(true)
    setMsgGestion('')

    try {
      const rpcName = bulkAccion === 'dar' ? 'bulk_grant_course_access' : 'bulk_remove_course_access'

      const { error } = await supabase.rpc(rpcName, {
        user_ids: usuariosArr,
        target_course_id: parseInt(bulkCursoId)
      })

      if (error) throw error

      // La función de alta masiva no conoce las generaciones, así que la
      // etiqueta se pone después sobre las filas recién creadas. Es una
      // sola consulta y evita tener que tocar esa función.
      if (bulkAccion === 'dar' && bulkGeneracion) {
        const { error: eGen } = await supabase.from('acceso')
          .update({ generacion_id: Number(bulkGeneracion) })
          .eq('curso_id', parseInt(bulkCursoId))
          .in('usuario_id', usuariosArr)
        if (eGen) {
          setMsgGestion('Acceso dado, pero no se pudo asignar la generación: ' + eGen.message)
          setBulkProcesando(false)
          return
        }
      }

      setMsgGestion(`✓ Acción completada para ${usuariosArr.length} usuario(s)`)
      setSeleccionados(new Set())

      const { data } = await supabase.from('vista_admin_inscripciones')
        .select('*').order('inscrito_el', { ascending: false })
      setFilas(data || [])

      await cargarGestion()

    } catch (e) {
      console.error('Error bulk:', e)
      setMsgGestion('Error en la acción masiva: ' + e.message)
    } finally {
      setBulkProcesando(false)
    }
  }

  const guardarNotas = async () => {
    if (!modalNotas) return
    setGuardandoNota(true)
    try {
      const { error } = await supabase
        .from('perfiles')
        .upsert({ id: modalNotas.usuario_id, notas_admin: modalNotas.texto }, { onConflict: 'id' })
      if (error) throw error
      setUsuarios(prev => prev.map(u =>
        u.usuario_id === modalNotas.usuario_id ? { ...u, notas_admin: modalNotas.texto } : u
      ))
      setModalNotas(null)
      setMsgGestion('✓ Notas guardadas')
    } catch (e) {
      setMsgGestion('Error al guardar nota: ' + e.message)
    } finally {
      setGuardandoNota(false)
    }
  }

  const calcularMetricas = () => {
    if (!filas || filas.length === 0) {
      return {
        alumnosUnicos: 0, totalInscripciones: 0, tasaFinalizacion: 0, activos30d: 0,
        inscripcionesPorMes: [], finalizacionPorCurso: [], alumnosPorCurso: [], alumnosEnRiesgo: [],
      }
    }

    const alumnosUnicos = new Set(filas.map(f => f.usuario_id)).size
    const totalInscripciones = filas.length

    let totalRecursos = 0, totalCompletados = 0
    filas.forEach(f => {
      totalRecursos += (f.total_recursos || 0)
      totalCompletados += (f.recursos_completados || 0)
    })
    const tasaFinalizacion = totalRecursos > 0 ? Math.round((totalCompletados / totalRecursos) * 100) : 0

    const hoy = Date.now()
    const hace30d = 30 * 24 * 60 * 60 * 1000
    const activosSet = new Set()
    filas.forEach(f => {
      if (f.ultimo_ingreso) {
        const dias = hoy - new Date(f.ultimo_ingreso).getTime()
        if (dias <= hace30d) activosSet.add(f.usuario_id)
      }
    })
    const activos30d = activosSet.size

    const meses = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      meses.push({
        anio: d.getFullYear(), mes: d.getMonth(),
        label: d.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }),
        count: 0,
      })
    }
    filas.forEach(f => {
      if (!f.inscrito_el) return
      const d = new Date(f.inscrito_el)
      const slot = meses.find(m => m.anio === d.getFullYear() && m.mes === d.getMonth())
      if (slot) slot.count++
    })

    const porCurso = {}
    filas.forEach(f => {
      const key = f.curso || 'Sin curso'
      if (!porCurso[key]) {
        porCurso[key] = { curso: key, inscritos: 0, sumaRecursos: 0, sumaCompletados: 0, alumnosSet: new Set() }
      }
      porCurso[key].inscritos++
      porCurso[key].sumaRecursos += (f.total_recursos || 0)
      porCurso[key].sumaCompletados += (f.recursos_completados || 0)
      porCurso[key].alumnosSet.add(f.usuario_id)
    })

    const finalizacionPorCurso = Object.values(porCurso)
      .map(c => ({
        curso: c.curso, inscritos: c.inscritos,
        tasa: c.sumaRecursos > 0 ? Math.round((c.sumaCompletados / c.sumaRecursos) * 100) : 0,
      }))
      .sort((a, b) => b.tasa - a.tasa)

    const alumnosPorCurso = Object.values(porCurso)
      .map(c => ({ curso: c.curso, alumnos: c.alumnosSet.size }))
      .sort((a, b) => b.alumnos - a.alumnos)

    const hace15d = 15 * 24 * 60 * 60 * 1000
    const riesgosMap = {}
    filas.forEach(f => {
      if (!f.ultimo_ingreso) return
      const dias = Math.floor((hoy - new Date(f.ultimo_ingreso).getTime()) / (1000 * 60 * 60 * 24))
      if (dias > 15) {
        if (!riesgosMap[f.usuario_id]) {
          riesgosMap[f.usuario_id] = {
            usuario_id: f.usuario_id, email: f.email, nombre_completo: f.nombre_completo,
            dias, cursos: [], ultimo_ingreso: f.ultimo_ingreso,
          }
        }
        riesgosMap[f.usuario_id].cursos.push(f.curso)
        if (new Date(f.ultimo_ingreso) > new Date(riesgosMap[f.usuario_id].ultimo_ingreso)) {
          riesgosMap[f.usuario_id].ultimo_ingreso = f.ultimo_ingreso
          riesgosMap[f.usuario_id].dias = dias
        }
      }
    })
    const alumnosEnRiesgo = Object.values(riesgosMap).sort((a, b) => b.dias - a.dias)

    return {
      alumnosUnicos, totalInscripciones, tasaFinalizacion, activos30d,
      inscripcionesPorMes: meses, finalizacionPorCurso, alumnosPorCurso, alumnosEnRiesgo,
    }
  }

  const metricas = calcularMetricas()
  const maxInscripcionesMes = Math.max(...metricas.inscripcionesPorMes.map(m => m.count), 1)
  const maxAlumnosCurso = Math.max(...metricas.alumnosPorCurso.map(c => c.alumnos), 1)

  const usuariosFiltrados = usuarios.filter(u => {
    const t = busqueda.toLowerCase()
    const matchBusqueda = !t || u.email.toLowerCase().includes(t) || (u.nombre_completo || '').toLowerCase().includes(t)

    let matchEstado = true
    if (filtroEstado === 'con-acceso') matchEstado = (u.cursos_inscritos || 0) > 0
    else if (filtroEstado === 'sin-acceso') matchEstado = (u.cursos_inscritos || 0) === 0
    else if (filtroEstado === 'activos') matchEstado = esActivo(u)
    else if (filtroEstado === 'inactivos') matchEstado = !esActivo(u) && u.ultimo_ingreso !== null

    let matchCurso = true
    if (filtroCursoUsuario !== 'todos') {
      matchCurso = accesos[u.usuario_id]?.has(parseInt(filtroCursoUsuario)) || false
    }

    return matchBusqueda && matchEstado && matchCurso
  })

  if (!user) return null
  if (!permisosCargados || !orgCargada) return <div className="loading">Cargando…</div>
  if (!esAdmin) return <div className="contenedor"><p className="aviso-error">No tienes permisos para ver esta sección.</p></div>
  if (cargando) return <div className="loading">Cargando panel...</div>
  if (error) return <div className="contenedor"><p className="aviso-error">Error: {error}</p></div>

  const cursosInscripciones = [...new Set(filas.map(f => f.curso))]
  const visibles = filtro === 'todos' ? filas : filas.filter(f => f.curso === filtro)
  const alumnosUnicos = new Set(filas.map(f => f.usuario_id)).size

  return (
    <section className="contenedor">
      <Breadcrumb items={[{ label: 'Inicio', to: '/' }, { label: 'Panel de administración' }]} />
      <h1>Panel de administración</h1>

      {/* Trece pestañas en una sola fila obligaban a desplazarse de lado
          hasta en computadora, y en un teléfono eran impracticables.
          Agrupadas por lo que se va a hacer, se encuentran antes: la
          pregunta real nunca es "¿cuál pestaña?", es "¿quiero tocar
          contenido, personas o dinero?". */}
      <nav className="admin-tabs" aria-label="Secciones del panel">
        {GRUPOS_PANEL.map(([grupo, pestañas]) => {
          const visibles = pestañas.filter(([, , soloPlataforma]) =>
            !soloPlataforma || esAdminPlataforma)
          if (!visibles.length) return null
          return (
            <div key={grupo} className="admin-grupo">
              <span className="admin-grupo-titulo">{grupo}</span>
              <div className="admin-grupo-botones">
                {visibles.map(([clave, etiqueta]) => (
                  <button key={clave} type="button"
                          className={`admin-tab ${vista === clave ? 'activa' : ''}`}
                          aria-current={vista === clave ? 'page' : undefined}
                          onClick={() => setVista(clave)}>{etiqueta}</button>
                ))}
              </div>
            </div>
          )
        })}
      </nav>

      {/* El cliente ve su plan y su consumo; tú no, porque tu aula está
          exenta y la franja no se pinta. Va fuera de las pestañas a
          propósito: si está a punto de quedarse sin alumnos disponibles,
          enterarse no debería depender de abrir la pestaña correcta. */}
      {!esAdminPlataforma && <ResumenPlan organizacionId={organizacion?.id} />}

      {vista === 'inscripciones' && (
        <>
          <div className="admin-bloque-nuevo">
            <button type="button" className="button primary" onClick={() => setFormAbierto(v => !v)}>
              {formAbierto ? '✕ Cerrar' : '➕ Crear nuevo usuario'}
            </button>

            {formAbierto && (
              <div className="nuevo-usuario-form">
                <h3>Nuevo usuario</h3>
                <label>Correo electrónico</label>
                <input type="email" value={nuevoEmail} onChange={e => setNuevoEmail(e.target.value)} placeholder="alumno@ejemplo.com" />
                <label>Rol en los cursos seleccionados</label>
                <div className="rol-opciones">
                  {[
                    ['alumno', '🎓 Alumno', 'Accede al contenido del curso.'],
                    ['facilitador', '🛠️ Facilitador', 'Gestiona el curso: foro, módulos, recursos y exámenes.'],
                    ['ambos', '🎓🛠️ Ambos', 'Gestiona el curso y además lo cursa como alumno.'],
                  ].map(([valor, etiqueta, ayuda]) => (
                    <label key={valor} className={`rol-opcion${rolNuevo === valor ? ' activa' : ''}`}>
                      <input type="radio" name="rol-alta-individual" value={valor}
                             checked={rolNuevo === valor}
                             onChange={() => setRolNuevo(valor)} />
                      <span className="rol-opcion-titulo">{etiqueta}</span>
                      <span className="nota">{ayuda}</span>
                    </label>
                  ))}
                </div>
                {/* Asignar solo el rol no crea cuenta, así que no pide contraseña. */}
                <label>Cómo entrará la primera vez</label>
                <div className="rol-opciones">
                  {[
                    ['clave', '🔑 Yo le asigno una contraseña', 'Se la compartes tú. Podrá cambiarla desde Mi perfil.'],
                    ['invitacion', '✉️ Que la elija él', 'Le llega un correo para crear su propia contraseña. Tú no manejas ninguna.'],
                  ].map(([v, etiqueta, ayuda]) => (
                    <label key={v} className={`rol-opcion${modoAcceso === v ? ' activa' : ''}`}>
                      <input type="radio" name="acceso-individual" value={v}
                             checked={modoAcceso === v}
                             onChange={() => setModoAcceso(v)} />
                      <span className="rol-opcion-titulo">{etiqueta}</span>
                      <span className="nota">{ayuda}</span>
                    </label>
                  ))}
                </div>
                {rolNuevo !== 'facilitador' && modoAcceso === 'clave' && (
                  <>
                    <label>Contraseña temporal</label>
                    <input type="text" value={nuevoPass} onChange={e => setNuevoPass(e.target.value)} placeholder="Mínimo 6 caracteres" />
                  </>
                )}
                <label>Cursos a los que tendrá acceso</label>
                <div className="cursos-checkboxes">
                  {cursosLista.map(c => (
                    <label key={c.id} className="curso-checkbox">
                      <input type="checkbox" checked={cursosSeleccionados.includes(c.id)} onChange={() => toggleCurso(c.id)} />
                      <span>{c.titulo}</span>
                    </label>
                  ))}
                </div>
                <button type="button" className="button whatsapp" onClick={crearUsuario} disabled={creando}>
                  {creando ? 'Creando...' : 'Crear usuario y asignar cursos'}
                </button>
                {msg && <p className={msg.startsWith('Error') ? 'aviso-error' : 'aviso-ok'}>{msg}</p>}
              </div>
            )}
          </div>

          <div className="admin-bloque-nuevo">
            <button type="button" className="button secondary" onClick={() => setMasivoAbierto(v => !v)}>
              {masivoAbierto ? '✕ Cerrar inscripción masiva' : '📥 Inscripción masiva (hasta 200 correos)'}
            </button>

            {masivoAbierto && (
              <div className="nuevo-usuario-form">
                <h3>Inscripción masiva de usuarios</h3>
                <p className="sutil" style={{ marginTop: 0, marginBottom: 14 }}>
                  Pega los correos separados por coma, punto y coma o salto de línea,
                  o pega el padrón completo desde Excel con sus columnas
                  (<strong>nombre, correo, generación, ruta</strong>).
                  Se crearán todos con la misma contraseña temporal y se asignarán a los cursos que elijas.
                </p>

                <label>Correos electrónicos</label>
                <textarea rows="6" className="modal-textarea" value={emailsMasivos} onChange={e => setEmailsMasivos(e.target.value)}
                  placeholder={"alumno1@correo.com, alumno2@correo.com\nalumno3@correo.com; alumno4@correo.com"}
                  style={{ width: '100%', fontFamily: 'monospace', fontSize: 13 }} />
                <div className="padron-pie">
                  <span className="nota">{padron.filas.length} correo(s) válido(s) detectado(s)</span>
                  <button type="button" className="button texto"
                          onClick={() => setEmailsMasivos(PLANTILLA_PADRON)}>
                    🧪 Ver el formato de padrón
                  </button>
                </div>

                {padron.errores.length > 0 && (
                  <div className="aviso-error" style={{ marginTop: 8 }}>
                    <strong>{padron.errores.length} fila(s) se van a saltar:</strong>
                    <ul>{padron.errores.slice(0, 8).map((e, i2) => <li key={i2}>{e}</li>)}</ul>
                  </div>
                )}

                {/* La vista previa solo aparece si hay columnas que
                    interpretar. Para una lista de correos sueltos sería
                    una tabla de una columna que no dice nada nuevo. */}
                {padron.conColumnas && (
                  <div className="padron-previa">
                    <p className="nota" style={{ marginTop: 0 }}>
                      Así lo entendí. Revísalo antes de crear las cuentas:
                    </p>
                    <div className="gestion-tabla-scroll">
                      <table className="gestion-tabla">
                        <thead><tr>
                          <th>Correo</th><th>Nombre</th><th>Generación</th><th>Ruta</th>
                        </tr></thead>
                        <tbody>
                          {padron.filas.slice(0, 12).map(f => (
                            <tr key={f.email}>
                              <td>{f.email}</td>
                              <td>{f.nombre || <span className="sutil">—</span>}</td>
                              <td>{f.generacion || <span className="sutil">—</span>}</td>
                              <td>{f.grupo || <span className="sutil">—</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {padron.filas.length > 12 && (
                      <p className="nota">…y {padron.filas.length - 12} más.</p>
                    )}
                    <p className="nota">
                      La <strong>generación</strong> se cruza por nombre con las que ya
                      existen en el curso; las que no cuadren se avisan y no se crean solas.
                      La <strong>ruta</strong> se guarda tal cual.
                    </p>
                  </div>
                )}

                <label>Rol en los cursos seleccionados</label>
                <div className="rol-opciones">
                  {[
                    ['alumno', '🎓 Alumno', 'Accede al contenido del curso.'],
                    ['facilitador', '🛠️ Facilitador', 'Gestiona el curso: foro, módulos, recursos y exámenes.'],
                    ['ambos', '🎓🛠️ Ambos', 'Gestiona el curso y además lo cursa como alumno.'],
                  ].map(([valor, etiqueta, ayuda]) => (
                    <label key={valor} className={`rol-opcion${rolMasivo === valor ? ' activa' : ''}`}>
                      <input type="radio" name="rol-alta-masiva" value={valor}
                             checked={rolMasivo === valor}
                             onChange={() => setRolMasivo(valor)} />
                      <span className="rol-opcion-titulo">{etiqueta}</span>
                      <span className="nota">{ayuda}</span>
                    </label>
                  ))}
                </div>
                <label>Cómo entrará la primera vez</label>
                <div className="rol-opciones">
                  {[
                    ['clave', '🔑 Yo le asigno una contraseña', 'Se la compartes tú. Podrá cambiarla desde Mi perfil.'],
                    ['invitacion', '✉️ Que la elija él', 'Le llega un correo para crear su propia contraseña. Tú no manejas ninguna.'],
                  ].map(([v, etiqueta, ayuda]) => (
                    <label key={v} className={`rol-opcion${modoMasivo === v ? ' activa' : ''}`}>
                      <input type="radio" name="acceso-masivo" value={v}
                             checked={modoMasivo === v}
                             onChange={() => setModoMasivo(v)} />
                      <span className="rol-opcion-titulo">{etiqueta}</span>
                      <span className="nota">{ayuda}</span>
                    </label>
                  ))}
                </div>
                {rolMasivo !== 'facilitador' && modoMasivo === 'clave' && (
                  <>
                    <label>Contraseña temporal (misma para todos)</label>
                    <input type="text" value={passMasivo} onChange={e => setPassMasivo(e.target.value)} placeholder="Ej. Curso2026!" />
                    <p className="nota" style={{ marginTop: 6 }}>⚠️ Todos los usuarios nuevos compartirán esta contraseña. Avísales que la cambien después.</p>
                  </>
                )}

                <label>Cursos a los que tendrán acceso</label>
                <div className="cursos-checkboxes">
                  {cursosLista.map(c => (
                    <label key={c.id} className="curso-checkbox">
                      <input type="checkbox" checked={cursosMasivos.includes(c.id)} onChange={() => toggleCursoMasivo(c.id)} />
                      <span>{c.titulo}</span>
                    </label>
                  ))}
                </div>

                <button type="button" className="button whatsapp" onClick={crearUsuariosMasivos} disabled={creandoMasivo}>
                  {creandoMasivo ? `Procesando... ${progresoMasivo.actual} / ${progresoMasivo.total}` : `Crear ${padron.filas.length} usuario(s)`}
                </button>

                {msgMasivo && <p className={msgMasivo.startsWith('Error') ? 'aviso-error' : 'aviso-ok'} style={{ marginTop: 12 }}>{msgMasivo}</p>}

                {resultadoMasivo && (
                  <div style={{ marginTop: 18 }}>
                    <div className="kpi-fila" style={{ marginTop: 8 }}>
                      <div className="kpi"><span className="kpi-num">{resultadoMasivo.creados}</span><span className="kpi-lbl">Creados</span></div>
                      <div className="kpi"><span className="kpi-num">{resultadoMasivo.existentes}</span><span className="kpi-lbl">Ya existían</span></div>
                      <div className="kpi"><span className="kpi-num">{resultadoMasivo.errores}</span><span className="kpi-lbl">Con error</span></div>
                    </div>
                    {resultadoMasivo.errores > 0 && (
                      <details style={{ marginTop: 12 }}>
                        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Ver detalle de errores ({resultadoMasivo.errores})</summary>
                        <ul style={{ fontSize: 13, marginTop: 8 }}>
                          {resultadoMasivo.detalles.filter(r => r.status !== 'creado').map((r, i) => (
                            <li key={i}><strong>{r.email}</strong> — {r.status}: {r.mensaje}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="kpi-fila">
            <div className="kpi"><span className="kpi-num">{alumnosUnicos}</span><span className="kpi-lbl">Alumnos</span></div>
            <div className="kpi"><span className="kpi-num">{filas.length}</span><span className="kpi-lbl">Inscripciones</span></div>
            <div className="kpi"><span className="kpi-num">{cursosInscripciones.length}</span><span className="kpi-lbl">Cursos con alumnos</span></div>
          </div>
          <div className="filtros">
            <button className={`filtro ${filtro === 'todos' ? 'activo' : ''}`} onClick={() => setFiltro('todos')}>Todos</button>
            {cursosInscripciones.map(c => (
              <button key={c} className={`filtro ${filtro === c ? 'activo' : ''}`} onClick={() => setFiltro(c)}>{c}</button>
            ))}
          </div>
          <div className="tabla-scroll">
            <table className="tabla-admin">
              <thead><tr><th>Alumno</th><th>Curso</th><th>Progreso</th><th>Inscrito</th><th>Último ingreso</th></tr></thead>
              <tbody>
                {visibles.map((f, i) => {
                  const pct = f.total_recursos > 0 ? Math.round((f.recursos_completados / f.total_recursos) * 100) : 0
                  return (
                    <tr key={i}>
                      <td>
                        <strong>{f.nombre_completo || '(sin nombre)'}</strong>
                        <span className="celda-sub">{f.email}</span>
                        {f.profesion && <span className="celda-sub">{f.profesion}</span>}
                      </td>
                      <td>{f.curso}</td>
                      <td>
                        <div className="mini-barra"><div className="mini-lleno" style={{ width: `${pct}%` }} /></div>
                        <span className="celda-sub">{f.recursos_completados}/{f.total_recursos} · {pct}%</span>
                      </td>
                      <td>{fecha(f.inscrito_el)}</td>
                      <td>{fecha(f.ultimo_ingreso)}</td>
                    </tr>
                  )
                })}
                {visibles.length === 0 && <tr><td colSpan="5" className="sutil">Sin inscripciones todavía.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {vista === 'usuarios' && (
        <>
          <p className="seccion-intro">
            Administra el acceso de cada usuario a los cursos. La contraseña del usuario nunca se modifica.
            Haz clic en un usuario para ver y editar sus cursos.
          </p>

          <div className="gestion-filtros">
            <input type="text" className="gestion-busqueda" placeholder="🔍 Buscar por correo o nombre..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            <select className="gestion-select" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
              <option value="todos">Todos los estados</option>
              <option value="con-acceso">Con acceso a cursos</option>
              <option value="sin-acceso">Sin acceso a cursos</option>
              <option value="activos">Activos (últimos 14 días)</option>
              <option value="inactivos">Inactivos</option>
            </select>
            <select className="gestion-select" value={filtroCursoUsuario} onChange={e => setFiltroCursoUsuario(e.target.value)}>
              <option value="todos">Todos los cursos</option>
              {cursosLista.map(c => <option key={c.id} value={c.id}>{c.titulo}</option>)}
            </select>
          </div>

          {msgGestion && <p className={msgGestion.startsWith('Error') ? 'aviso-error' : 'aviso-ok'} style={{ marginTop: 8 }}>{msgGestion}</p>}

          {seleccionados.size > 0 && (
            <div className="bulk-bar">
              <span className="bulk-count">{seleccionados.size} seleccionado(s)</span>
              <select className="gestion-select" value={bulkAccion} onChange={e => setBulkAccion(e.target.value)}>
                <option value="dar">Dar acceso a</option>
                <option value="quitar">Quitar acceso de</option>
              </select>
              <select className="gestion-select" value={bulkCursoId} onChange={e => setBulkCursoId(e.target.value)}>
                <option value="">— Elige un curso —</option>
                {cursosLista.map(c => <option key={c.id} value={c.id}>{c.titulo}</option>)}
              </select>
              {bulkAccion === 'dar' && generacionesCurso.length > 0 && (
                <select className="gestion-select" value={bulkGeneracion}
                        onChange={e => setBulkGeneracion(e.target.value)}>
                  <option value="">— Sin generación —</option>
                  {generacionesCurso.map(g => (
                    <option key={g.id} value={g.id}>{g.nombre}</option>
                  ))}
                </select>
              )}
              <button type="button" className="button primary" onClick={ejecutarBulk} disabled={bulkProcesando || !bulkCursoId}>
                {bulkProcesando ? 'Procesando...' : 'Aplicar a seleccionados'}
              </button>
              <button type="button" className="button texto" onClick={() => setSeleccionados(new Set())}>Cancelar</button>
            </div>
          )}

          {cargandoGestion ? (
            <div className="loading">Cargando usuarios...</div>
          ) : usuarios.length === 0 ? (
            <p className="sutil">No hay usuarios registrados todavía.</p>
          ) : (
            <>
              {usuariosFiltrados.length > 0 && (
                <div className="gestion-toolbar">
                  <button type="button" className="button texto" onClick={() => toggleTodos(usuariosFiltrados)}>
                    {usuariosFiltrados.every(u => seleccionados.has(u.usuario_id)) ? '☐ Deseleccionar todos' : '☑ Seleccionar todos los visibles'}
                  </button>
                  <span className="sutil">{usuariosFiltrados.length} usuario(s) mostrado(s)</span>
                </div>
              )}

              {/* Tabla densa en vez de una tarjeta por persona: con 20+
                  usuarios las tarjetas obligaban a desplazarse sin aportar
                  nada. Aquí cada fila cabe de un vistazo y los cursos se
                  despliegan solo cuando hacen falta. */}
              {usuariosFiltrados.length === 0 ? (
                <p className="sutil">No se encontraron usuarios con ese criterio.</p>
              ) : (
                <div className="gestion-tabla-scroll">
                <table className="gestion-tabla">
                  <thead>
                    <tr>
                      <th className="col-check"></th>
                      <th>Persona</th>
                      <th>Cursos</th>
                      <th>Rol</th>
                      <th>Último ingreso</th>
                      <th className="col-acciones"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuariosFiltrados.map(u => {
                      const cursosDelUsuario = u.cursos_inscritos || 0
                      const seleccionado = seleccionados.has(u.usuario_id)
                      const expandido = expandidos.has(u.usuario_id)
                      const inactivo = u.ultimo_ingreso && !esActivo(u)
                      const dias = diasSinEntrar(u)
                      const correoU = String(u.email || '').toLowerCase()
                      const nFacilita = facilitaPorEmail[correoU]?.size || 0
                      return (
                        <Fragment key={u.usuario_id}>
                        <tr className={`gestion-fila ${seleccionado ? 'seleccionada' : ''} ${expandido ? 'expandida' : ''}`}>
                          <td className="col-check">
                            <input type="checkbox" checked={seleccionado} onChange={() => toggleSeleccion(u.usuario_id)} />
                          </td>
                          <td>
                            <strong>{u.nombre_completo || '(sin nombre)'}</strong>
                            <span className="celda-sub">{u.email}</span>
                            {u.profesion && <span className="celda-sub">{u.profesion}</span>}
                            {u.notas_admin && <span className="gestion-nota-preview">{u.notas_admin}</span>}
                          </td>
                          <td>
                            {cursosDelUsuario > 0
                              ? <span className="badge ok">{cursosDelUsuario}</span>
                              : <span className="sutil">—</span>}
                          </td>
                          <td className="col-rol">
                            {nFacilita > 0 && <span className="badge rol-facil">Facilita {nFacilita}</span>}
                            {cursosDelUsuario > 0 && <span className="badge rol-alumno">Alumno</span>}
                            {nFacilita === 0 && cursosDelUsuario === 0 && <span className="sutil">—</span>}
                          </td>
                          <td>
                            <span className="celda-sub">{fecha(u.ultimo_ingreso)}</span>
                            {inactivo && <span className="badge inactivo">Inactivo {dias}d</span>}
                          </td>
                          <td className="col-acciones">
                            <button type="button" className="button texto" title="Nota interna"
                              onClick={() => setModalNotas({ usuario_id: u.usuario_id, email: u.email, texto: u.notas_admin || '' })}>
                              {u.notas_admin ? 'Nota ✏️' : 'Nota'}
                            </button>
                            <button type="button" className="button texto"
                              title="Enviarle un enlace para crear una contraseña nueva"
                              disabled={enviandoEnlace === u.email}
                              onClick={() => enviarEnlaceClave(u.email)}>
                              {enviandoEnlace === u.email ? '…' : '🔑'}
                            </button>
                            <button type="button" className="gestion-expandir-btn" onClick={() => toggleExpandido(u.usuario_id)}>
                              {expandido ? '▲ Cursos' : '▼ Cursos'}
                            </button>
                          </td>
                        </tr>

                        {expandido && (
                          <tr className="gestion-fila-cursos">
                            <td colSpan={6}>
                              <div className="gestion-cursos">
                                {cursosLista.map(c => {
                                  const tiene = accesos[u.usuario_id]?.has(c.id) || false
                                  const ocupado = toggling[`${u.usuario_id}-${c.id}`]
                                  const facilita = facilitaPorEmail[correoU]?.has(c.id) || false
                                  const ocupadoFacil = toggling[`facil-${correoU}-${c.id}`]
                                  return (
                                    <div key={c.id} className={`gestion-curso-fila ${tiene ? 'con-acceso' : ''}`}>
                                      <span className="gestion-curso-titulo">{c.titulo}</span>
                                      <button type="button" className={`gestion-toggle ${tiene ? 'quitar' : 'dar'}`}
                                        onClick={() => toggleAcceso(u.usuario_id, c.id, tiene, u.email)} disabled={ocupado}>
                                        {ocupado ? '...' : tiene ? '✓ Con acceso · Quitar' : '+ Dar acceso'}
                                      </button>
                                      <button type="button"
                                        className={`gestion-toggle facilitador ${facilita ? 'quitar' : 'dar'}`}
                                        onClick={() => toggleFacilitador(u.email, c.id, facilita)}
                                        disabled={ocupadoFacil}
                                        title="Gestiona el foro, los módulos, los recursos y los exámenes de este curso">
                                        {ocupadoFacil ? '...' : facilita ? '🛠️ Facilitador · Quitar' : '+ Facilitador'}
                                      </button>
                                    </div>
                                  )
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
                </div>
              )}
            </>
          )}
        </>
      )}

      {vista === 'cursos' && <AdminCursos />}
      {vista === 'tablero' && <TableroOrg />}
      {vista === 'banco' && <BancoPreguntas />}
      {vista === 'bitacora' && <AdminBitacora />}
      {vista === 'organizaciones' && esAdminPlataforma && <AdminOrganizaciones />}
      {vista === 'suscripciones' && esAdminPlataforma && <AdminSuscripciones />}

      {vista === 'facilitadores' && (
        <>
          <p className="seccion-intro">
            Un facilitador gestiona los cursos que le asignes: abre y modera el foro,
            crea módulos, sube recursos y edita exámenes. Fuera de esos cursos es un
            alumno más. Asignar el rol no crea la cuenta: si esa persona todavía no
            tiene, el rol la estará esperando cuando se registre con ese correo.
          </p>

          <div className="facil-alta">
            <input type="email" className="input" value={nuevoFacilEmail}
                   onChange={e => setNuevoFacilEmail(e.target.value)}
                   placeholder="correo@ejemplo.com" />
            <select className="input" value={nuevoFacilCurso}
                    onChange={e => setNuevoFacilCurso(e.target.value)}>
              <option value="">Elige un curso o una categoría…</option>
              {/* Las categorías van primero: asignar una cubre también
                  los cursos que entren después en esa línea. */}
              <optgroup label="Categorías completas">
                {categoriasLista.map(k => (
                  <option key={`c${k.id}`} value={`cat:${k.id}`}>{k.nombre}</option>
                ))}
              </optgroup>
              <optgroup label="Un curso suelto">
                {cursosLista.map(c => (
                  <option key={c.id} value={`curso:${c.id}`}>{c.titulo}</option>
                ))}
              </optgroup>
            </select>
            <button type="button" className="button primary" onClick={anadirFacilitador}>
              Asignar
            </button>
          </div>
          {msgFacil && <p className={msgFacil.startsWith('✓') ? 'aviso-ok' : 'aviso-error'}>{msgFacil}</p>}
          {msgGestion && <p className="aviso-ok">{msgGestion}</p>}

          {/* Las asignaciones por categoría van primero y aparte: cubren
              varios cursos a la vez, asi que mezclarlas con las sueltas
              haria pensar que alguien gestiona menos de lo que gestiona. */}
          {categoriasLista.some(k => Object.values(facilitaCategoria).some(s => s.has(k.id))) && (
            <div className="facil-cursos" style={{ marginTop: 16 }}>
              {categoriasLista.map(k => {
                const equipo = Object.entries(facilitaCategoria)
                  .filter(([, cats]) => cats.has(k.id))
                  .map(([correo]) => correo).sort()
                if (!equipo.length) return null
                return (
                  <div key={`cat${k.id}`} className="facil-curso con-equipo">
                    <div className="facil-curso-cab">
                      <strong>📂 {k.nombre}</strong>
                      <span className="sutil">toda la categoría · {equipo.length} facilitador(es)</span>
                    </div>
                    <ul className="facil-lista">
                      {equipo.map(correo => (
                        <li key={correo}>
                          <span>{correo}</span>
                          <button type="button" className="button texto peligro"
                                  onClick={() => quitarCategoria(correo, k.id)}>Quitar</button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          )}

          {/* La vista se lee por CURSO, no por persona: la pregunta real es
              "¿quién lleva este curso?", no "¿qué lleva esta persona?". */}
          <div className="facil-cursos">
            {cursosLista.map(c => {
              const equipo = Object.entries(facilitaPorEmail)
                .filter(([, cursos]) => cursos.has(c.id))
                .map(([correo]) => correo)
                .sort()
              return (
                <div key={c.id} className={`facil-curso ${equipo.length ? 'con-equipo' : ''}`}>
                  <div className="facil-curso-cab">
                    <strong>{c.titulo}</strong>
                    <span className="sutil">
                      {equipo.length === 0 ? 'Sin facilitadores' : `${equipo.length} facilitador(es)`}
                    </span>
                  </div>
                  {equipo.length > 0 && (
                    <ul className="facil-lista">
                      {equipo.map(correo => (
                        <li key={correo}>
                          <span>{correo}</span>
                          <button type="button" className="button texto peligro"
                            disabled={toggling[`facil-${correo}-${c.id}`]}
                            onClick={() => toggleFacilitador(correo, c.id, true)}>
                            {toggling[`facil-${correo}-${c.id}`] ? '...' : 'Quitar'}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {vista === 'metricas' && (
        <>
          <p className="seccion-intro">
            Vista general del comportamiento de la plataforma. Los datos se calculan al vuelo desde las inscripciones actuales.
          </p>

          <div className="kpi-fila">
            <div className="kpi"><span className="kpi-num">{metricas.alumnosUnicos}</span><span className="kpi-lbl">Alumnos únicos</span></div>
            <div className="kpi"><span className="kpi-num">{metricas.totalInscripciones}</span><span className="kpi-lbl">Inscripciones</span></div>
            <div className="kpi"><span className="kpi-num">{metricas.tasaFinalizacion}%</span><span className="kpi-lbl">Finalización global</span></div>
            <div className="kpi"><span className="kpi-num">{metricas.activos30d}</span><span className="kpi-lbl">Activos últimos 30 días</span></div>
          </div>

          <section className="metricas-bloque">
            <h3 className="metricas-titulo">📅 Inscripciones por mes (últimos 12)</h3>
            <div className="grafico-barras-vertical">
              {metricas.inscripcionesPorMes.map((m, i) => (
                <div key={i} className="barra-v-col">
                  <div className="barra-v-valor">{m.count > 0 ? m.count : ''}</div>
                  <div className="barra-v-relleno" style={{
                    height: `${maxInscripcionesMes > 0 ? (m.count / maxInscripcionesMes) * 100 : 0}%`,
                    minHeight: m.count > 0 ? '4px' : '0',
                  }} title={`${m.count} inscripción(es)`} />
                  <div className="barra-v-label">{m.label}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="metricas-bloque">
            <h3 className="metricas-titulo">🎯 Tasa de finalización por curso</h3>
            {metricas.finalizacionPorCurso.length === 0
              ? <p className="sutil">Sin datos todavía.</p>
              : <div className="grafico-barras-horizontal">
                  {metricas.finalizacionPorCurso.map((c, i) => (
                    <div key={i} className="barra-h-fila">
                      <div className="barra-h-label" title={c.curso}>{c.curso}</div>
                      <div className="barra-h-track"><div className="barra-h-relleno" style={{ width: `${c.tasa}%` }} /></div>
                      <div className="barra-h-valor">{c.tasa}%</div>
                    </div>
                  ))}
                </div>}
          </section>

          <section className="metricas-bloque">
            <h3 className="metricas-titulo">👥 Alumnos por curso</h3>
            {metricas.alumnosPorCurso.length === 0
              ? <p className="sutil">Sin datos todavía.</p>
              : <div className="grafico-barras-horizontal">
                  {metricas.alumnosPorCurso.map((c, i) => (
                    <div key={i} className="barra-h-fila">
                      <div className="barra-h-label" title={c.curso}>{c.curso}</div>
                      <div className="barra-h-track"><div className="barra-h-relleno azul" style={{ width: `${(c.alumnos / maxAlumnosCurso) * 100}%` }} /></div>
                      <div className="barra-h-valor">{c.alumnos}</div>
                    </div>
                  ))}
                </div>}
          </section>

          <section className="metricas-bloque">
            <h3 className="metricas-titulo">⚠️ Alumnos en riesgo ({metricas.alumnosEnRiesgo.length})</h3>
            <p className="nota" style={{ marginTop: 0, marginBottom: 12 }}>
              Inscritos que no ingresan desde hace más de 15 días. Buen momento para un correo de reactivación.
            </p>
            {metricas.alumnosEnRiesgo.length === 0
              ? <p className="aviso-ok">🎉 Ningún alumno en riesgo. Todos activos.</p>
              : <div className="tabla-scroll">
                  <table className="tabla-admin">
                    <thead>
                      <tr><th>Alumno</th><th>Días sin entrar</th><th>Cursos</th><th>Último ingreso</th></tr>
                    </thead>
                    <tbody>
                      {metricas.alumnosEnRiesgo.map((a, i) => (
                        <tr key={i}>
                          <td><strong>{a.nombre_completo || '(sin nombre)'}</strong><span className="celda-sub">{a.email}</span></td>
                          <td><span className="badge" style={{ background: '#FBEDEA', color: '#9B2C20' }}>{a.dias} días</span></td>
                          <td><span className="celda-sub" style={{ fontSize: 12 }}>{a.cursos.join(' · ')}</span></td>
                          <td>{fecha(a.ultimo_ingreso)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>}
          </section>
        </>
      )}

      {vista === 'comunicados' && (
        <>
          <p className="seccion-intro">
            Envía un correo personalizado a un grupo de alumnos. Se manda un solo correo con todos
            los destinatarios en CCO — nadie ve los correos de los demás.
          </p>

          <div className="admin-bloque-nuevo">
            <div className="nuevo-usuario-form">
              <h3>📧 Nuevo comunicado</h3>

              <label>¿A quién le va a llegar?</label>
              <select className="gestion-select" value={comunicadoDestino}
                onChange={e => { setComunicadoDestino(e.target.value); setComunicadoMsg(''); setComunicadoResultado(null) }}
                style={{ width: '100%', marginBottom: 12 }}>
                <option value="todos">Todos los alumnos con acceso</option>
                <option value="curso">Solo los alumnos de un curso específico</option>
                <option value="riesgo">Alumnos en riesgo (sin entrar hace +15 días)</option>
                <option value="activos">Alumnos activos (últimos 14 días)</option>
                <option value="completaron">Alumnos que completaron un curso</option>
                <option value="manual">Correos manuales (pegar lista)</option>
              </select>

              {comunicadoDestino === 'curso' && (
                <>
                  <label>Curso</label>
                  <select className="gestion-select" value={comunicadoCursoId} onChange={e => setComunicadoCursoId(e.target.value)} style={{ width: '100%' }}>
                    <option value="">— Elige un curso —</option>
                    {cursosLista.map(c => <option key={c.id} value={c.id}>{c.titulo}</option>)}
                  </select>
                </>
              )}

              {comunicadoDestino === 'manual' && (
                <>
                  <label>Correos (separados por coma, punto y coma o salto de línea)</label>
                  <textarea rows="4" className="modal-textarea" value={comunicadoManual} onChange={e => setComunicadoManual(e.target.value)}
                    placeholder="alumno1@correo.com, alumno2@correo.com..." style={{ fontFamily: 'monospace', fontSize: 13 }} />
                </>
              )}

              <p className="nota" style={{ marginTop: 10, marginBottom: 16 }}>
                📬 <strong>{calcularDestinatarios().length}</strong> destinatario(s) único(s) recibirán este correo.
              </p>

              <label>Asunto</label>
              <input type="text" value={comunicadoAsunto} onChange={e => setComunicadoAsunto(e.target.value)}
                placeholder="Ej. Nuevo taller en vivo el 15 de octubre" />

              <label>Cuerpo del mensaje</label>

              <div className="editor-toolbar">
                <button type="button" className="editor-btn" title="Negrita" onMouseDown={e => e.preventDefault()} onClick={() => ejecutarComando('bold')}><strong>B</strong></button>
                <button type="button" className="editor-btn" title="Cursiva" onMouseDown={e => e.preventDefault()} onClick={() => ejecutarComando('italic')}><em>I</em></button>
                <button type="button" className="editor-btn" title="Subrayado" onMouseDown={e => e.preventDefault()} onClick={() => ejecutarComando('underline')}><u>U</u></button>
                <span className="editor-sep" />
                <button type="button" className="editor-btn" title="Título" onMouseDown={e => e.preventDefault()} onClick={() => insertarTitulo('<h2>')}>H1</button>
                <button type="button" className="editor-btn" title="Subtítulo" onMouseDown={e => e.preventDefault()} onClick={() => insertarTitulo('<h3>')}>H2</button>
                <button type="button" className="editor-btn" title="Párrafo" onMouseDown={e => e.preventDefault()} onClick={() => insertarTitulo('<p>')}>¶</button>
                <span className="editor-sep" />
                <button type="button" className="editor-btn" title="Lista" onMouseDown={e => e.preventDefault()} onClick={() => ejecutarComando('insertUnorderedList')}>• Lista</button>
                <button type="button" className="editor-btn" title="Lista numerada" onMouseDown={e => e.preventDefault()} onClick={() => ejecutarComando('insertOrderedList')}>1. Lista</button>
                <span className="editor-sep" />
                <button type="button" className="editor-btn" title="Enlace" onMouseDown={e => e.preventDefault()} onClick={crearEnlace}>🔗 Enlace</button>
                <span className="editor-sep" />
                <button type="button" className="editor-btn" title="Izquierda" onMouseDown={e => e.preventDefault()} onClick={() => ejecutarComando('justifyLeft')}>⬅</button>
                <button type="button" className="editor-btn" title="Centrar" onMouseDown={e => e.preventDefault()} onClick={() => ejecutarComando('justifyCenter')}>↔</button>
                <button type="button" className="editor-btn" title="Derecha" onMouseDown={e => e.preventDefault()} onClick={() => ejecutarComando('justifyRight')}>➡</button>
                <span className="editor-sep" />
                <button type="button" className="editor-btn editor-btn-html" title="Editar HTML" onMouseDown={e => e.preventDefault()} onClick={abrirEditorHtml}>&lt;/&gt; HTML</button>
                <span className="editor-sep" />
                <button type="button" className="editor-btn editor-btn-peligro" title="Quitar formato" onMouseDown={e => e.preventDefault()} onClick={limpiarFormato}>✕ Formato</button>
              </div>

              <div key={comunicadoEditorKey} ref={comunicadoEditorRef} className="comunicado-editor" contentEditable
                suppressContentEditableWarning
                onInput={e => setComunicadoCuerpo(e.currentTarget.innerHTML)}
                onBlur={e => setComunicadoCuerpo(e.currentTarget.innerHTML)}
                dangerouslySetInnerHTML={{
                  __html: comunicadoEditorKey === 0
                    ? '<p>Hola,</p><p>Te escribo para contarte que...</p><p>Saludos.</p>'
                    : '<p><br></p>'
                }} />

              <p className="nota" style={{ marginTop: 6 }}>
                Se agregará automáticamente tu firma con logo, credencial y enlaces al final del correo.
              </p>

              <div style={{ marginTop: 14 }}>
                <button type="button" className="button texto" onClick={() => setComunicadoPreview(v => !v)}>
                  {comunicadoPreview ? '▲ Ocultar vista previa' : '▼ Ver vista previa'}
                </button>
              </div>

              {comunicadoPreview && (
                <div className="comunicado-preview">
                  <div className="comunicado-preview-header">
                    <p style={{ margin: 0, fontSize: 12, color: '#7A8891' }}>Para: neuronal.plus@gmail.com</p>
                    <p style={{ margin: 0, fontSize: 12, color: '#7A8891' }}>Asunto: <strong style={{ color: '#1B3A4B' }}>{comunicadoAsunto || '(sin asunto)'}</strong></p>
                  </div>
                  <div className="comunicado-preview-body"
                    dangerouslySetInnerHTML={{
                      __html: comunicadoCuerpo || '<p style="color:#7A8891;font-style:italic;">(El cuerpo del mensaje aparecerá aquí)</p>'
                    }} />
                </div>
              )}

              <div style={{ marginTop: 18, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <button type="button" className="button whatsapp" onClick={enviarComunicado}
                  disabled={comunicadoEnviando || calcularDestinatarios().length === 0 || !comunicadoAsunto.trim()}>
                  {comunicadoEnviando ? 'Enviando...' : `Enviar a ${calcularDestinatarios().length} alumno(s)`}
                </button>
                <button type="button" className="button texto" onClick={limpiarEditor}>Limpiar</button>
              </div>

              {comunicadoMsg && <p className={comunicadoMsg.startsWith('Error') ? 'aviso-error' : 'aviso-ok'} style={{ marginTop: 12 }}>{comunicadoMsg}</p>}

              {comunicadoResultado && (
                <div className="kpi-fila" style={{ marginTop: 18 }}>
                  <div className="kpi"><span className="kpi-num">{comunicadoResultado.enviados}</span><span className="kpi-lbl">Enviados</span></div>
                </div>
              )}
            </div>
          </div>

          <section className="metricas-bloque">
            <h3 className="metricas-titulo">💡 Sugerencias de uso</h3>
            <ul style={{ fontSize: 14, lineHeight: 1.8, paddingLeft: 20, margin: 0, color: '#33414A' }}>
              <li><strong>Reactivar:</strong> "Alumnos en riesgo" → asunto "Te extrañamos, ¿todo bien?" → invítalos a retomar donde se quedaron.</li>
              <li><strong>Anunciar nuevo curso:</strong> "Alumnos que completaron un curso" → son tus mejores candidatos al siguiente.</li>
              <li><strong>Avisar de sesión en vivo:</strong> "Solo los alumnos de un curso específico" → para avisos puntuales del taller.</li>
              <li><strong>Agradecer:</strong> "Alumnos que completaron un curso" → correo breve de cierre con tu firma.</li>
            </ul>
          </section>
        </>
      )}

      {vista === 'mensajes' && (
        <MensajesInbox user={user} esAdmin={esAdmin} />
      )}

      {vista === 'examenes' && (
        <AdminExamenes />
      )}

      {vista === 'foro' && (
        <AdminForo user={user} />
      )}

      {editorHtmlAbierto && (
        <ModalPortal>
        <div className="modal-overlay" onClick={() => setEditorHtmlAbierto(false)}>
          <div className="modal-box modal-html" onClick={e => e.stopPropagation()}>
            <h3>Código HTML del mensaje</h3>
            <p className="sutil" style={{ marginBottom: 14 }}>Pega o edita el HTML directamente. Al aplicar, se actualizará el editor.</p>
            <textarea className="modal-textarea modal-textarea-html" value={editorHtmlTexto}
              onChange={e => setEditorHtmlTexto(e.target.value)} spellCheck={false} autoFocus />
            <div className="modal-botones">
              <button type="button" className="button secondary" onClick={() => setEditorHtmlAbierto(false)}>Cancelar</button>
              <button type="button" className="button primary" onClick={aplicarEditorHtml}>Aplicar HTML</button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {modalNotas && (
        <ModalPortal>
        <div className="modal-overlay" onClick={() => !guardandoNota && setModalNotas(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>Notas privadas</h3>
            <p className="sutil" style={{ marginBottom: 16 }}>
              Solo tú puedes ver estas notas sobre <strong>{modalNotas.email}</strong>.
            </p>
            <textarea rows="5" className="modal-textarea" value={modalNotas.texto}
              onChange={e => setModalNotas({ ...modalNotas, texto: e.target.value })}
              placeholder="Ej: pagó en efectivo, pidió factura, beca parcial..." autoFocus />
            <div className="modal-botones">
              <button type="button" className="button secondary" onClick={() => setModalNotas(null)} disabled={guardandoNota}>Cancelar</button>
              <button type="button" className="button primary" onClick={guardarNotas} disabled={guardandoNota}>
                {guardandoNota ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {confirmacion && (
        <ModalPortal>
        <div className="modal-overlay">
          <div className="modal-box modal-confirm">
            <h3>⚠️ Confirmar acción</h3>
            <p>{confirmacion.mensaje}</p>
            <div className="modal-botones">
              <button type="button" className="button secondary" onClick={confirmacion.onCancel}>Cancelar</button>
              <button type="button" className="button primary" onClick={confirmacion.onConfirm}
                style={{ background: '#9B2C20', borderColor: '#9B2C20' }}>Sí, continuar</button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      <BandaRedes />
    </section>
  )
}

export default Admin
