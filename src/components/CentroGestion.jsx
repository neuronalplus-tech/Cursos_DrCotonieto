/* ============================================================
   CENTRO DE GESTIÓN
   ------------------------------------------------------------
   Antes, para cambiar un examen, un botón o un tema del foro había
   que entrar al curso, luego al módulo, y buscar el botón. Aquí
   está todo lo de cada curso en un solo sitio, en tarjetas que se
   abren, y cada perfil ve solo lo que puede editar.

   «VER COMO»
   Quien administra puede recorrer el Centro como lo vería Dirección,
   Coordinación o Docente (?como=docente en la dirección). Es una
   vista previa para comprobar permisos: lo que no le toca a ese
   perfil sale cerrado con candado y la razón. Los cambios que se
   hagan siguen siendo de quien administra.
   ============================================================ */
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { usePermisos, useMisPermisos } from '../lib/permisos'
import { useOrganizacion } from '../lib/organizacion'
import { esTallerIndividual, esContenedorTalleres } from '../lib/helpers'
import { PERFILES, ESTADOS, estadoCurso } from '../lib/estructura'
import {
  contextoReal, contextoSimulado, seccionesPermitidas, cargarRolesBD, cargarResumenCursos, SECCIONES_CURSO,
} from '../lib/gestion'
import { Breadcrumb } from './ui'
import MatrizPermisos from './MatrizPermisos'
import IndicadoresGestion from './IndicadoresGestion'

/**
 * Quién mira el Centro y qué puede. Lo usan la lista y la página de
 * cada curso, para que las dos decidan igual.
 */
export function useGestion(user) {
  const [params, setParams] = useSearchParams()
  const { organizacion, cargado: orgCargada } = useOrganizacion()
  const orgId = organizacion?.id ?? null
  const p = usePermisos(user)
  const rol = useMisPermisos(user, orgId)
  const [rolesBD, setRolesBD] = useState({ estado: 'cargando', roles: [] })

  const esPlataforma = p.esAdmin
  const esAdminOrg = p.esAdminDe(orgId)
  const puedeEntrar = esAdminOrg || p.esFacilitador || rol.tieneAlguno
  const cargado = p.cargado && orgCargada && (!orgId || rol.cargado || esAdminOrg)

  const recargarRoles = async () => setRolesBD(await cargarRolesBD(orgId))
  useEffect(() => {
    if (!orgCargada || !user) return
    let vivo = true
    cargarRolesBD(orgId).then((r) => { if (vivo) setRolesBD(r) })
    return () => { vivo = false }
  }, [orgId, orgCargada, user])

  // Solo quien administra puede «ver como»; para el resto se ignora.
  const como = esAdminOrg ? params.get('como') : null
  const perfilComo = PERFILES.find((x) => x.clave === como) || null
  const ctx = perfilComo
    ? contextoSimulado(perfilComo.clave, rolesBD.roles)
    : contextoReal({ esPlataforma, esAdminOrg, permisosRol: Object.keys(rol.indice), esFacilitador: p.esFacilitador })

  const verComo = (clave) => {
    const n = new URLSearchParams(params)
    if (clave) n.set('como', clave); else n.delete('como')
    setParams(n)
  }
  const sufijo = perfilComo ? `?como=${perfilComo.clave}` : ''

  return {
    cargado, puedeEntrar, esAdminOrg, esPlataforma, orgId, organizacion,
    rolesBD, recargarRoles, perfilComo, verComo, sufijo, ctx,
    secciones: seccionesPermitidas(ctx), params, setParams,
  }
}

/** Franja «Ver como»: elegir perfil y saber que es una vista previa. */
export function BarraVerComo({ g }) {
  if (!g.esAdminOrg) return null
  return (
    <div className={`vercomo${g.perfilComo ? ' activa' : ''}`} role="region" aria-label="Ver como">
      <span className="vercomo-titulo">Ver como:</span>
      <div className="vercomo-opciones">
        <button type="button" className={`linea-pill${!g.perfilComo ? ' activa' : ''}`} onClick={() => g.verComo(null)}>
          Yo
        </button>
        {PERFILES.map((p) => (
          <button key={p.clave} type="button" className={`linea-pill${g.perfilComo?.clave === p.clave ? ' activa' : ''}`}
            onClick={() => g.verComo(p.clave)} title={p.descripcion}>
            <span aria-hidden="true">{p.icono}</span> {p.nombre}
          </button>
        ))}
      </div>
      {g.perfilComo && (
        <p className="vercomo-nota">
          Vista previa como <strong>{g.perfilComo.nombre}</strong>: {g.perfilComo.descripcion} Lo que no le toca sale
          con 🔒. Tus cambios se siguen guardando como tuyos.
        </p>
      )}
    </div>
  )
}

export function Insignia({ estado }) {
  const e = ESTADOS[estado]
  return e ? <span className={`badge ${e.tono}`}>{e.etiqueta}</span> : null
}

const tipoDe = (c) => (esContenedorTalleres(c) ? 'contenedor' : esTallerIndividual(c) ? 'taller' : 'curso')

export default function CentroGestion({ user }) {
  const g = useGestion(user)
  // Indicadores primero: al entrar, lo global; los cursos, a un clic.
  const ver = g.params.get('ver')
  const pestana = ver === 'permisos' && g.esAdminOrg ? 'permisos' : ver === 'cursos' ? 'cursos' : 'indicadores'
  const [cursos, setCursos] = useState([])
  const [resumen, setResumen] = useState({})
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [busca, setBusca] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [filtroTipo, setFiltroTipo] = useState('todos')

  useEffect(() => {
    if (!g.cargado || !g.puedeEntrar) return
    let vivo = true
    ;(async () => {
      setCargando(true)
      // Sin filtrar por `activo`: aquí también se gestionan los archivados.
      // Las políticas dejan ver solo los cursos que le tocan a cada quien.
      let q = supabase.from('cursos').select('*').order('orden').order('titulo')
      if (g.orgId) q = q.eq('organizacion_id', g.orgId)
      const { data, error: e } = await q
      if (!vivo) return
      if (e) { setError(e.message); setCargando(false); return }
      const lista = (data || []).filter((c) => !esContenedorTalleres(c))
      setCursos(lista)
      setCargando(false)
      const r = await cargarResumenCursos(lista)
      if (vivo) setResumen(r)
    })()
    return () => { vivo = false }
  }, [g.cargado, g.puedeEntrar, g.orgId])

  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return cursos.filter((c) =>
      (!q || (c.titulo || '').toLowerCase().includes(q) || (c.linea || '').toLowerCase().includes(q)) &&
      (filtroEstado === 'todos' || estadoCurso(c) === filtroEstado) &&
      (filtroTipo === 'todos' || tipoDe(c) === filtroTipo))
  }, [cursos, busca, filtroEstado, filtroTipo])

  if (!user) return <div className="contenedor"><p className="aviso-error">Inicia sesión para entrar al Centro de gestión.</p></div>
  if (!g.cargado) return <div className="loading">Cargando…</div>
  if (!g.puedeEntrar) {
    return (
      <div className="contenedor">
        <p className="aviso-error">Tu cuenta no tiene cursos que gestionar. Si debería tenerlos, pide a quien administra que te asigne un rol o un curso.</p>
      </div>
    )
  }

  const cambiarPestana = (p) => {
    const n = new URLSearchParams(g.params)
    if (p === 'indicadores') n.delete('ver'); else n.set('ver', p)
    g.setParams(n)
  }
  const n = SECCIONES_CURSO.filter((s) => g.secciones.has(s.clave)).length

  return (
    <section className="contenedor gestion">
      <Breadcrumb items={[{ label: 'Inicio', to: '/' }, { label: 'Centro de gestión' }]} />
      <div className="gestion-cabecera">
        <div>
          <h1>Centro de gestión</h1>
          <p className="seccion-intro">
            Todo lo de cada curso en un solo lugar: información, módulos y materiales, botones, exámenes, tareas,
            foro y grupos. {g.perfilComo ? `${g.perfilComo.nombre} puede` : 'Puedes'} editar {n} de {SECCIONES_CURSO.length} secciones.
          </p>
        </div>
        {g.esAdminOrg && <Link className="button secondary" to="/admin">Panel clásico</Link>}
      </div>

      <BarraVerComo g={g} />

      <nav className="gestion-pestanas" aria-label="Vistas del Centro">
        {[['indicadores', '📈 Indicadores'], ['cursos', '📚 Cursos'], ...(g.esAdminOrg ? [['permisos', '🔑 Permisos por perfil']] : [])]
          .map(([clave, texto]) => (
            <button key={clave} type="button" className={`admin-tab${pestana === clave ? ' activa' : ''}`}
              aria-current={pestana === clave ? 'page' : undefined} onClick={() => cambiarPestana(clave)}>{texto}</button>
          ))}
      </nav>

      {pestana === 'indicadores' ? (
        <IndicadoresGestion g={g} />
      ) : pestana === 'permisos' ? (
        <MatrizPermisos orgId={g.orgId} rolesBD={g.rolesBD} onRecargar={g.recargarRoles}
          puedeEditar={g.esAdminOrg && !g.perfilComo}
          onVerComo={(clave) => { const p = new URLSearchParams(); p.set('como', clave); g.setParams(p) }} />
      ) : (
        <>
          <div className="gestion-filtros">
            <input className="input" type="search" placeholder="Buscar curso o línea…" value={busca}
              onChange={(e) => setBusca(e.target.value)} aria-label="Buscar curso" />
            <select className="input" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} aria-label="Estado">
              <option value="todos">Todos los estados</option>
              {['publicado', 'proximamente', 'archivado'].map((k) => <option key={k} value={k}>{ESTADOS[k].etiqueta}</option>)}
            </select>
            <select className="input" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} aria-label="Tipo">
              <option value="todos">Cursos y talleres</option>
              <option value="curso">Solo cursos</option>
              <option value="taller">Solo talleres</option>
            </select>
          </div>

          {cargando && <div className="loading">Cargando cursos…</div>}
          {error && <p className="aviso-error">No se pudieron cargar los cursos: {error}</p>}
          {!cargando && !error && visibles.length === 0 && (
            <p className="sutil">{cursos.length ? 'Ningún curso coincide con el filtro.' : 'Todavía no hay cursos.'}</p>
          )}

          <div className="gestion-grid">
            {visibles.map((c) => {
              const r = resumen[c.id]
              const taller = tipoDe(c) === 'taller'
              return (
                <article key={c.id} className="gestion-tarjeta">
                  <header>
                    <span className="gestion-tipo">{taller ? '🎟️ Taller' : '📘 Curso'}{c.linea ? ` · ${c.linea}` : ''}</span>
                    <Insignia estado={estadoCurso(c)} />
                  </header>
                  <h2>{c.titulo}</h2>
                  {r ? (
                    <ul className="gestion-cifras" aria-label="Contenido">
                      {!taller && <li><strong>{r.modulos}</strong> módulos</li>}
                      {!taller && <li><strong>{r.materiales}</strong> materiales</li>}
                      <li><strong>{r.examenes}</strong> exámenes</li>
                      <li><strong>{r.tareas}</strong> tareas</li>
                      <li><strong>{r.temas}</strong> temas de foro</li>
                    </ul>
                  ) : <p className="sutil">Contando…</p>}
                  <div className="gestion-acciones">
                    <Link className="button primary" to={`/gestion/curso/${c.id}${g.sufijo}`}>Gestionar →</Link>
                    <Link className="button secondary" to={`/curso/${c.id}`}>Ver página</Link>
                  </div>
                </article>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}
