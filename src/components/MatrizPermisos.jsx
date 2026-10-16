/* ============================================================
   MATRIZ DE PERMISOS POR PERFIL
   ------------------------------------------------------------
   Filas: lo que se puede editar (estructura.js, ELEMENTOS).
   Columnas: los cuatro perfiles. Cada casilla dice si ese perfil
   puede, y quien administra la organización la cambia ahí mismo.

   UN PERMISO ABRE VARIOS ELEMENTOS
   La base no guarda «puede editar el foro», guarda el permiso
   `foro.moderar`. Algunos permisos abren varias filas a la vez
   (`cursos.editar`: módulos, materiales, botones, tareas…). Por eso
   al marcar una casilla se avisa de qué más se abre: marcar en
   silencio cinco filas sería una sorpresa.
   ============================================================ */
import { useMemo, useState } from 'react'
import { PERFILES, GRUPOS_ELEMENTOS, permite, mismoPermiso } from '../lib/estructura'
import { contextoSimulado, alternarPermisoRol, sembrarRolesBasicos } from '../lib/gestion'

const NOTA_PERMISO = {
  admin: 'Solo quien administra la organización',
  plataforma: 'Solo la administración global',
}

export default function MatrizPermisos({ orgId, rolesBD, onRecargar, puedeEditar, onVerComo }) {
  const [filtro, setFiltro] = useState('todos')
  const [busca, setBusca] = useState('')
  const [ocupado, setOcupado] = useState(null)
  const [msg, setMsg] = useState(null)

  const contextos = useMemo(() => Object.fromEntries(
    PERFILES.map((p) => [p.clave, contextoSimulado(p.clave, rolesBD.roles)]),
  ), [rolesBD])

  const rolDe = (perfil) => rolesBD.roles.find((r) =>
    r.nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() ===
    (perfil.rol || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase())

  const cambiar = async (perfil, elemento, dar) => {
    const rol = rolDe(perfil)
    if (!rol) return
    const otros = mismoPermiso(elemento.permiso).filter((e) => e.clave !== elemento.clave)
    const aviso = otros.length
      ? `\n\nEste mismo permiso (${elemento.permiso}) también ${dar ? 'abre' : 'cierra'}:\n· ${otros.map((e) => e.nombre).join('\n· ')}`
      : ''
    if (!window.confirm(`${dar ? 'Dar' : 'Quitar'} a «${rol.nombre}»: ${elemento.nombre}.${aviso}\n\n¿Continuar?`)) return
    setOcupado(`${perfil.clave}:${elemento.clave}`); setMsg(null)
    try {
      await alternarPermisoRol(rol.id, elemento.permiso, dar)
      await onRecargar()
      setMsg({ tipo: 'ok', texto: `Listo: «${rol.nombre}» ${dar ? 'ya puede' : 'ya no puede'}: ${elemento.nombre}.` })
    } catch (e) {
      setMsg({ tipo: 'error', texto: 'No se pudo cambiar: ' + e.message })
    } finally { setOcupado(null) }
  }

  const sembrar = async () => {
    setOcupado('sembrar'); setMsg(null)
    try { setMsg({ tipo: 'ok', texto: await sembrarRolesBasicos(orgId) }); await onRecargar() }
    catch (e) { setMsg({ tipo: 'error', texto: 'No se pudieron crear: ' + e.message }) }
    finally { setOcupado(null) }
  }

  const faltanRoles = rolesBD.estado === 'ok' && PERFILES.some((p) => p.rol && !rolDe(p))
  const q = busca.trim().toLowerCase()

  return (
    <div className="matriz">
      <p className="seccion-intro">
        Qué puede editar cada perfil. Marca o desmarca para cambiarlo; el Centro de gestión, el panel y
        las páginas lo respetan al instante. Usa «Ver como» para recorrer el Centro con los ojos de ese perfil.
      </p>

      {rolesBD.estado === 'sin-org' && (
        <p className="aviso-info">Estás en el sitio principal. Los roles se configuran <strong>por organización</strong>:
          aquí ves los permisos con los que nace cada rol. Entra al sitio de una organización para cambiarlos.</p>
      )}
      {rolesBD.estado === 'sin-tabla' && (
        <p className="aviso-error">Los roles todavía no están en la base: falta correr supabase/ROLES_5_PERMISOS.sql
          (y después ROLES_6 y ROLES_7). Mientras tanto ves los permisos con los que nacería cada rol.</p>
      )}
      {rolesBD.estado === 'error' && <p className="aviso-error">No se pudieron leer los roles: {rolesBD.mensaje}</p>}
      {faltanRoles && puedeEditar && (
        <div className="aviso-info">
          Esta organización no tiene todavía los roles Dirección, Coordinación y Docente.{' '}
          <button type="button" className="button secondary" onClick={sembrar} disabled={ocupado === 'sembrar'}>
            {ocupado === 'sembrar' ? 'Creando…' : 'Crear los tres roles básicos'}
          </button>
        </div>
      )}

      <div className="matriz-filtros">
        <input className="input" type="search" placeholder="Buscar un elemento…" value={busca}
          onChange={(e) => setBusca(e.target.value)} aria-label="Buscar un elemento" />
        <label>Mostrar{' '}
          <select className="input" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="todos">Todo</option>
            {PERFILES.map((p) => <option key={p.clave} value={p.clave}>Solo lo que puede {p.nombre}</option>)}
            {PERFILES.map((p) => <option key={`no-${p.clave}`} value={`no-${p.clave}`}>Lo que NO puede {p.nombre}</option>)}
          </select>
        </label>
      </div>

      {msg && <p className={msg.tipo === 'ok' ? 'aviso-ok' : 'aviso-error'} role="status">{msg.texto}</p>}

      <div className="matriz-scroll">
        <table className="matriz-tabla">
          <thead>
            <tr>
              <th scope="col">Elemento</th>
              {PERFILES.map((p) => (
                <th key={p.clave} scope="col">
                  <span aria-hidden="true">{p.icono}</span> {p.nombre}
                  <button type="button" className="button texto matriz-vercomo" onClick={() => onVerComo(p.clave)}>
                    Ver como
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GRUPOS_ELEMENTOS.map(([grupo, elementos]) => {
              const filas = elementos.filter((e) => {
                if (q && !e.nombre.toLowerCase().includes(q)) return false
                if (filtro === 'todos') return true
                const no = filtro.startsWith('no-')
                const ctx = contextos[no ? filtro.slice(3) : filtro]
                return no ? !permite(e, ctx) : permite(e, ctx)
              })
              if (!filas.length) return null
              return [
                <tr key={grupo} className="matriz-grupo"><th colSpan={PERFILES.length + 1} scope="rowgroup">{grupo}</th></tr>,
                ...filas.map((e) => (
                  <tr key={e.clave}>
                    <th scope="row">
                      {e.nombre}
                      <span className="matriz-permiso">{NOTA_PERMISO[e.permiso] || e.permiso}</span>
                    </th>
                    {PERFILES.map((p) => {
                      const si = permite(e, contextos[p.clave])
                      const rol = rolDe(p)
                      const editable = puedeEditar && rol && !NOTA_PERMISO[e.permiso]
                      const id = `${p.clave}:${e.clave}`
                      return (
                        <td key={p.clave} className={si ? 'si' : 'no'}>
                          {editable ? (
                            <input type="checkbox" checked={si} disabled={ocupado === id}
                              aria-label={`${p.nombre}: ${e.nombre}`}
                              onChange={(ev) => cambiar(p, e, ev.target.checked)} />
                          ) : (
                            <span aria-label={si ? 'Sí' : 'No'} title={!rol && p.rol ? 'Permisos con los que nace el rol' : undefined}>
                              {si ? '✓' : '—'}
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )),
              ]
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
