/* ============================================================
   VERIFICAR CONSTANCIA · folio público
   ------------------------------------------------------------
   Pantalla SIN sesión: un empleador o un colegio escribe el
   folio impreso en el PDF y comprueba que la constancia es
   auténtica. Usa la función pública `verificar_constancia`,
   que solo devuelve lo mínimo (nombre, curso, fecha).
   ============================================================ */

import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Breadcrumb, BandaRedes } from './ui'

export function normalizarFolio(s) {
  return (s || '').toString().trim().toUpperCase().replace(/[^A-Z0-9-]/g, '')
}

export default function VerificarConstancia() {
  const { folio: folioRuta } = useParams()
  const [folio, setFolio] = useState(folioRuta || '')
  const [estado, setEstado] = useState('inicio')
  const [dato, setDato] = useState(null)

  async function buscarPor(f) {
    const limpio = normalizarFolio(f)
    if (!limpio) return
    setFolio(limpio)
    setEstado('buscando')
    setDato(null)
    const { data, error } = await supabase.rpc('verificar_constancia', { p_folio: limpio })
    if (error) { setEstado('error'); return }
    const fila = Array.isArray(data) ? data[0] : data
    if (!fila) { setEstado('no'); return }
    setDato(fila)
    setEstado('si')
  }

  // Llegar con /verificar/<FOLIO> (el enlace impreso en el PDF)
  // verifica solo, sin pedir nada.
  useEffect(() => {
    if (normalizarFolio(folioRuta)) buscarPor(folioRuta)
  }, [folioRuta])

  async function buscar(e) {
    if (e) e.preventDefault()
    await buscarPor(folio)
  }

  return (
    <section className="contenedor estrecho">
      <Breadcrumb items={[{ label: 'Inicio', to: '/' }, { label: 'Verificar constancia' }]} />
      <h1>Verificar constancia</h1>
      <p className="sutil">
        Escribe el folio impreso al pie de la constancia y comprueba su autenticidad.
      </p>
      <form onSubmit={buscar} className="formulario-datos">
        <label htmlFor="folio-ver">Folio</label>
        <input
          id="folio-ver"
          type="text"
          value={folio}
          onChange={(e) => setFolio(e.target.value.toUpperCase())}
          placeholder="DUE-2026-A1B2C3"
          autoComplete="off"
        />
        <button className="button primary" disabled={estado === 'buscando'}>
          {estado === 'buscando' ? 'Verificando…' : 'Verificar'}
        </button>
      </form>
      <div className="bloque-cerrado" aria-live="polite">
        {estado === 'inicio' && <p className="sutil">El resultado aparece aquí.</p>}
        {estado === 'buscando' && <p className="sutil">Buscando el folio…</p>}
        {estado === 'error' && <p className="aviso-error">No se pudo verificar. Intenta de nuevo.</p>}
        {estado === 'no' && <p className="aviso-error">Ese folio no existe en nuestros registros.</p>}
        {estado === 'si' && dato && (
          <>
            <p className="aviso-ok">✔ Constancia auténtica.</p>
            <dl className="verificar-datos">
              <div><dt>Folio</dt><dd>{dato.folio}</dd></div>
              <div><dt>Otorgada a</dt><dd>{dato.nombre_completo}</dd></div>
              {dato.profesion && <div><dt>Profesión</dt><dd>{dato.profesion}</dd></div>}
              <div><dt>Curso</dt><dd>{dato.curso_titulo}</dd></div>
              <div><dt>Fecha de emisión</dt><dd>{new Date(dato.fecha_emision).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}</dd></div>
            </dl>
          </>
        )}
      </div>
      <p><Link className="enlace-texto" to="/">← Volver al inicio</Link></p>
      <BandaRedes />
    </section>
  )
}
