/* ============================================================
   GENERAR UN DOCUMENTO DE UN GRUPO
   ------------------------------------------------------------
   Toma una plantilla de la institución, la rellena con los datos
   reales del grupo y la deja lista para guardar como PDF.

   POR QUÉ SE IMPRIME Y NO SE ARMA UN PDF CON UNA LIBRERÍA
   La otra vía habitual —html2canvas— convierte la página en una
   IMAGEN y la mete en el PDF. Para un acta eso es peor de lo que
   parece:

     · el texto deja de poder copiarse y de poder buscarse, y un
       acta es justamente un documento que alguien va a querer
       verificar;
     · los saltos de página los decide el recorte de la imagen, así
       que una tabla de cuarenta alumnos se parte por la mitad de un
       renglón;
     · pesa diez veces más.

   Imprimir desde el navegador da texto de verdad, saltos de página
   correctos y «Guardar como PDF» en el mismo diálogo. Y si la
   institución quiere el acta en papel para firmarla —que es lo que
   dijo— ya está en la impresora.

   LA CALIFICACIÓN SALE DE src/lib/calificacion.js
   La misma que ve el alumno y la que ve el facilitador. Calcularla
   aquí otra vez daría un tercer número, y este va en un acta.
   ============================================================ */

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useOrganizacion } from '../lib/organizacion'
import { calcular, calcularModulo, tienePonderacion } from '../lib/calificacion'
import {
  rellenar, conLetra, fechaConLetra,
} from '../lib/plantillas'
import { MODALIDADES } from '../lib/asistencia'

const ETIQUETA_MODALIDAD = Object.fromEntries(MODALIDADES)

/* Un documento por alumno o uno por grupo. No es una preferencia:
   una constancia es de una persona y un acta es de un grupo, y
   ofrecer las dos opciones para ambos solo invita a equivocarse. */
const POR_ALUMNO = new Set(['constancia', 'boleta', 'informe'])

export default function GenerarDocumento({ generacion, cursoId, onCerrar }) {
  const { organizacion } = useOrganizacion()
  const [plantillas, setPlantillas] = useState([])
  const [elegida, setElegida] = useState('')
  const [curso, setCurso] = useState(null)
  const [sede, setSede] = useState(null)
  const [filas, setFilas] = useState([])
  const [modulosPorAlumno, setModulosPorAlumno] = useState({})
  const [alumnoElegido, setAlumnoElegido] = useState('')
  const [cargando, setCargando] = useState(true)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    if (!organizacion?.id || !generacion?.id) { setCargando(false); return }
    let vivo = true
    ;(async () => {
      setCargando(true)
      try {
        const [{ data: pls }, { data: c }, { data: datos }] = await Promise.all([
          supabase.from('plantillas_documento').select('*')
            .eq('organizacion_id', organizacion.id).eq('activa', true).order('nombre'),
          supabase.from('cursos').select('id, titulo, ponderacion').eq('id', cursoId).maybeSingle(),
          supabase.rpc('datos_de_grupo', { p_generacion: generacion.id }),
        ])

        const { data: sd } = generacion.sede_id
          ? await supabase.from('sedes').select('nombre, ciudad').eq('id', generacion.sede_id).maybeSingle()
          : { data: null }

        // --- Lo que se califica en este curso ---
        const { data: mods } = await supabase
          .from('modulos').select('id, titulo').eq('curso_id', cursoId).order('orden')
        const idsMod = (mods || []).map(m => m.id)
        const { data: recursos } = idsMod.length
          ? await supabase.from('recursos').select('id').in('modulo_id', idsMod)
          : { data: [] }
        const idsRecursos = (recursos || []).map(r => r.id)
        const { data: progreso } = idsRecursos.length
          ? await supabase.from('progreso_usuario').select('usuario_id, recurso_id')
              .in('recurso_id', idsRecursos).eq('completado', true)
          : { data: [] }
        const progresoPorAlumno = {}
        for (const p of progreso || []) {
          if (!progresoPorAlumno[p.usuario_id]) progresoPorAlumno[p.usuario_id] = new Set()
          progresoPorAlumno[p.usuario_id].add(p.recurso_id)
        }

        const exCurso = await supabase.from('examenes')
          .select('id, titulo, curso_id, modulo_id, activo').eq('curso_id', cursoId)
        const exMod = idsMod.length
          ? await supabase.from('examenes').select('id, titulo, curso_id, modulo_id, activo').in('modulo_id', idsMod)
          : { data: [] }
        const examenes = [...new Map([...(exCurso.data || []), ...(exMod.data || [])]
          .map(e => [e.id, e])).values()]

        const tCurso = await supabase.from('tareas')
          .select('id, titulo, puntos_max, curso_id, modulo_id').eq('curso_id', cursoId).eq('activo', true)
        const tMod = idsMod.length
          ? await supabase.from('tareas').select('id, titulo, puntos_max, curso_id, modulo_id').in('modulo_id', idsMod).eq('activo', true)
          : { data: [] }
        const tareas = [...(tCurso.data || []), ...(tMod.data || [])]

        const { data: intentos } = examenes.length
          ? await supabase.from('intentos_examen')
              .select('usuario_id, examen_id, calificacion').in('examen_id', examenes.map(e => e.id))
          : { data: [] }
        const { data: entregas } = tareas.length
          ? await supabase.from('entregas')
              .select('usuario_id, tarea_id, calificacion, calificado_en').in('tarea_id', tareas.map(t => t.id))
          : { data: [] }

        const { data: hilos } = await supabase.from('foro_hilos')
          .select('id, titulo, puntos_max').eq('curso_id', cursoId).eq('califica', true)
        const { data: aport } = (hilos || []).length
          ? await supabase.from('foro_respuestas')
              .select('hilo_id, autor_id, calificacion')
              .in('hilo_id', hilos.map(h => h.id)).eq('borrada', false)
              .not('calificacion', 'is', null)
          : { data: [] }

        if (!vivo) return

        // --- Una fila por alumno, con su nota por el MISMO camino ---
        const porModulo = {}
        const conNota = (datos || []).map(d => {
          const mejor = {}
          for (const it of intentos || []) {
            if (it.usuario_id !== d.usuario_id) continue
            const p = mejor[it.examen_id]
            if (!p || (it.calificacion ?? 0) > (p.calificacion ?? 0)) mejor[it.examen_id] = it
          }
          const entrada = {
            examenes: examenes
              .map(e => ({
                id: e.id, titulo: e.titulo, moduloId: e.modulo_id,
                valor: mejor[e.id]?.calificacion ?? null, maximo: 100,
                incluida: e.activo !== false,
              })),
            tareas: tareas
              .map(t => ({ t, en: (entregas || []).find(e => e.tarea_id === t.id && e.usuario_id === d.usuario_id) }))
              .map(x => ({
                id: x.t.id, titulo: x.t.titulo, moduloId: x.t.modulo_id,
                valor: x.en?.calificado_en ? x.en.calificacion : null,
                maximo: x.t.puntos_max || 100,
              })),
            foro: (hilos || []).map(h => {
              const notas = (aport || [])
                .filter(a => a.hilo_id === h.id && a.autor_id === d.usuario_id)
                .map(a => Number(a.calificacion))
              return {
                id: h.id, titulo: h.titulo,
                valor: notas.length ? notas.reduce((s, n) => s + n, 0) / notas.length : null,
                maximo: h.puntos_max || 10,
              }
            }),
            avance: {
              hechos: progresoPorAlumno[d.usuario_id]?.size || 0,
              total: idsRecursos.length,
            },
          }
          const nota = calcular(entrada, c?.ponderacion)
          const calificacionFinal = nota ? nota.acumulado : null

          // Y el desglose por módulo, para las actas que lo piden.
          porModulo[d.usuario_id] = (mods || []).map(m => {
            const exM = examenes.filter(e => e.modulo_id === m.id)
              .map(e => ({
                id: e.id, titulo: e.titulo, moduloId: e.modulo_id,
                valor: mejor[e.id]?.calificacion ?? null, maximo: 100,
                incluida: e.activo !== false,
              }))
            const taM = tareas.filter(t => t.modulo_id === m.id)
              .map(t => ({ t, en: (entregas || []).find(e => e.tarea_id === t.id && e.usuario_id === d.usuario_id) }))
              .map(x => ({
                id: x.t.id, titulo: x.t.titulo, moduloId: x.t.modulo_id,
                valor: x.en?.calificado_en ? x.en.calificacion : null,
                maximo: x.t.puntos_max || 100,
              }))
            const n = calcularModulo({ examenes: exM, tareas: taM, foro: [] }, c?.ponderacion, m.id)
            return { titulo: m.titulo, calificacion: n ? n.acumulado : null }
          })

          return {
            ...d,
            nombre: d.nombre,
            calificacion: calificacionFinal,
            letra: calificacionFinal != null ? conLetra(calificacionFinal) : '',
            tipoCalculo: tienePonderacion(c?.ponderacion) ? 'Ponderada' : 'Promedio simple',
            asistencia: d.asistencia_pct,
          }
        })

        setPlantillas(pls || [])
        setCurso(c || null)
        setSede(sd || null)
        setFilas(conNota)
        setModulosPorAlumno(porModulo)
        setCargando(false)
      } catch (e) {
        if (vivo) { setMsg({ tipo: 'error', texto: e.message || String(e) }); setCargando(false) }
      }
    })()
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizacion?.id, generacion?.id, cursoId])

  const plantilla = plantillas.find(p => String(p.id) === String(elegida)) || null
  const esPorAlumno = plantilla ? POR_ALUMNO.has(plantilla.tipo) : false

  const datosComunes = useMemo(() => ({
    institucion: {
      nombre: organizacion?.nombre || '',
      contacto: organizacion?.contacto_email || '',
    },
    curso: { titulo: curso?.titulo || '' },
    grupo: {
      nombre: generacion?.nombre || '',
      modalidad: ETIQUETA_MODALIDAD[generacion?.modalidad] || '',
      inicio: generacion?.fecha_inicio ? fechaConLetra(generacion.fecha_inicio) : '',
      fin: generacion?.fecha_fin ? fechaConLetra(generacion.fecha_fin) : '',
    },
    sede: { nombre: sede?.nombre || '' },
    docente: { nombre: plantilla?.firma_nombre || '' },
    fecha: { hoy: fechaConLetra(), lugar: sede?.ciudad || '' },
    asistencia: { sesiones: filas[0]?.sesiones ?? 0 },
    alumnos: filas.map(f => ({
      nombre: f.nombre,
      calificacion: f.calificacion ?? '',
      letra: f.letra,
      asistencia: f.asistencia ?? '',
      faltas: f.faltas ?? 0,
    })),
  }), [organizacion, curso, generacion, sede, filas, plantilla])

  const documentos = useMemo(() => {
    if (!plantilla) return []
    if (!esPorAlumno) {
      return [{ clave: 'grupo', html: rellenar(plantilla.contenido, datosComunes, { escaparHtml: false }) }]
    }
    const elegidos = alumnoElegido
      ? filas.filter(f => f.usuario_id === alumnoElegido)
      : filas
    return elegidos.map(f => ({
      clave: f.usuario_id,
      nombre: f.nombre,
      html: rellenar(plantilla.contenido, {
        ...datosComunes,
        alumno: { nombre: f.nombre, profesion: f.profesion || '' },
        calificacion: {
          final: f.calificacion ?? '',
          letra: f.letra,
          tipo: f.tipoCalculo,
        },
        asistencia: {
          porcentaje: f.asistencia ?? '',
          sesiones: f.sesiones ?? 0,
          faltas: f.faltas ?? 0,
        },
        modulos: (modulosPorAlumno[f.usuario_id] || [])
          .map(m => ({ titulo: m.titulo, calificacion: m.calificacion ?? '' })),
      }, { escaparHtml: false }),
    }))
  }, [plantilla, esPorAlumno, datosComunes, filas, alumnoElegido, modulosPorAlumno])

  const imprimir = () => {
    const v = window.open('', '_blank')
    if (!v) {
      return setMsg({
        tipo: 'error',
        texto: 'El navegador bloqueó la ventana. Permite las ventanas emergentes de este sitio.',
      })
    }
    const hojas = documentos.map(d => `
      <section class="hoja">
        ${plantilla.membrete_url ? `<img class="membrete" src="${plantilla.membrete_url}" alt="">` : ''}
        ${d.html}
        ${plantilla.firma_url ? `
          <img class="firma" src="${plantilla.firma_url}" alt=""
               style="left:${plantilla.firma_x}%;top:${plantilla.firma_y}%;width:${plantilla.firma_ancho}%">` : ''}
        ${plantilla.firma_nombre ? `
          <div class="firma-pie" style="top:calc(${plantilla.firma_y}% + 28px)">
            <strong>${plantilla.firma_nombre}</strong>
            ${plantilla.firma_cargo ? `<span>${plantilla.firma_cargo}</span>` : ''}
          </div>` : ''}
      </section>`).join('')

    v.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>${plantilla.nombre}</title>
<style>
  /* El tamaño lo decide la plantilla, no el navegador: sin esto, el
     mismo documento sale en carta o en A4 según la impresora. */
  @page { size: letter ${plantilla.orientacion === 'horizontal' ? 'landscape' : 'portrait'};
          margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Georgia, 'Times New Roman', serif;
         font-size: 12pt; line-height: 1.5; color: #111; }
  /* Una hoja por documento, y cada una empieza en página nueva. */
  .hoja { position: relative; min-height: 100vh; padding-bottom: 40mm;
          page-break-after: always; break-after: page; }
  .hoja:last-child { page-break-after: auto; break-after: auto; }
  h1 { font-size: 17pt; text-align: center; margin: 0 0 14pt; letter-spacing: .04em; }
  h2 { font-size: 14pt; text-align: center; margin: 12pt 0; }
  p { margin: 0 0 9pt; text-align: justify; }
  table { width: 100%; border-collapse: collapse; margin: 10pt 0; }
  th, td { border: 1px solid #555; padding: 4pt 6pt; font-size: 10pt; text-align: left; }
  /* Que una fila no se parta entre dos páginas. */
  tr { page-break-inside: avoid; break-inside: avoid; }
  thead { display: table-header-group; }
  .membrete { display: block; width: 100%; margin-bottom: 14pt; }
  .firma { position: absolute; transform: translate(-50%, -50%); }
  .firma-pie { position: absolute; left: 50%; transform: translateX(-50%);
               text-align: center; font-size: 10pt; }
  .firma-pie span { display: block; color: #444; }
</style></head><body>${hojas}</body></html>`)
    v.document.close()
    // Se espera a que carguen membrete y firma: imprimir antes deja
    // el documento sin ellos y no se nota hasta ver el PDF.
    v.onload = () => { v.focus(); v.print() }
    setTimeout(() => { try { v.focus(); v.print() } catch { /* ya se imprimió */ } }, 800)
  }

  if (cargando) return <p className="nota">Cargando…</p>

  return (
    <div className="generar-doc">
      <div className="pase-cab">
        <h4>Generar documento · {generacion?.nombre}</h4>
        {onCerrar && (
          <button type="button" className="button texto" onClick={onCerrar}>Cerrar</button>
        )}
      </div>

      {msg && <p className={msg.tipo === 'ok' ? 'aviso-ok' : 'aviso-error'}>{msg.texto}</p>}

      {!plantillas.length ? (
        <p className="nota">
          Esta institución todavía no tiene plantillas activas. Se crean en
          Panel → <strong>Plantillas</strong>.
        </p>
      ) : (
        <>
          <div className="org-editor-fila">
            <div>
              <label>Plantilla</label>
              <select className="input" value={elegida}
                      onChange={e => { setElegida(e.target.value); setAlumnoElegido('') }}>
                <option value="">Elige…</option>
                {plantillas.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
            {esPorAlumno && (
              <div>
                <label>Alumno</label>
                <select className="input" value={alumnoElegido}
                        onChange={e => setAlumnoElegido(e.target.value)}>
                  <option value="">Todos ({filas.length})</option>
                  {filas.map(f => (
                    <option key={f.usuario_id} value={f.usuario_id}>{f.nombre}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {plantilla && (
            <>
              <p className="nota">
                {esPorAlumno
                  ? `Se generará ${documentos.length} documento(s), uno por alumno, cada uno en su hoja.`
                  : 'Un solo documento con todo el grupo.'}
                {' '}Se abre el diálogo de impresión: ahí eliges
                <strong> Guardar como PDF</strong> o imprimes para firmar.
              </p>

              <button type="button" className="button primary"
                      onClick={imprimir} disabled={!documentos.length}>
                🖨️ Generar y descargar
              </button>

              <h4 className="susc-sub">Vista previa</h4>
              <p className="nota" style={{ marginTop: 0 }}>
                Datos <strong>reales</strong> de este grupo. Revísalos antes de
                firmar nada.
              </p>
              <div className={`plantilla-previa ${plantilla.orientacion}`}>
                {plantilla.membrete_url && (
                  <img src={plantilla.membrete_url} alt="" className="previa-membrete" />
                )}
                <div dangerouslySetInnerHTML={{ __html: documentos[0]?.html || '' }} />
                {plantilla.firma_url && (
                  <img src={plantilla.firma_url} alt="" className="previa-firma"
                       style={{
                         left: `${plantilla.firma_x}%`,
                         top: `${plantilla.firma_y}%`,
                         width: `${plantilla.firma_ancho}%`,
                       }} />
                )}
              </div>
              {documentos.length > 1 && (
                <p className="nota">
                  Se muestra el primero de {documentos.length}.
                </p>
              )}

              {curso && !tienePonderacion(curso.ponderacion) && (
                <p className="nota pond-aviso">
                  Este curso no tiene ponderación configurada, así que la
                  calificación es el promedio simple de todo lo evaluado. Si el
                  acta debe salir ponderada, configúralo antes en el curso.
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
