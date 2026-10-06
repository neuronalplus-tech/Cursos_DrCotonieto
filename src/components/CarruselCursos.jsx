import { useEffect, useState, useRef } from 'react'
import PortadaCurso from './PortadaCurso'
import { LINEA_COPY } from '../config'

/* `copia` llega de la tabla `categorias`. LINEA_COPY se queda como
   repliegue: si la tabla aun no existe (o la consulta falla), el
   carrusel sigue mostrando sus textos en vez de quedarse mudo. */
export default function CarruselCursos({ lineas, cursos, onSelect, copia = {} }) {
  const slides = lineas.map((l) => {
    const info = copia[l] || LINEA_COPY[l]
    const enLinea = cursos.filter((c) => c.linea === l)
    const n = enLinea.length
    return {
      linea: l,
      texto: info?.texto || `${n} ${n === 1 ? 'curso disponible' : 'cursos disponibles'} en esta línea.`,
      motivo: info?.motivo || enLinea[0]?.caratula || 'espiral'
    }
  })

  const [indice, setIndice] = useState(0)
  const [offsetX, setOffsetX] = useState(0)
  const [arrastrando, setArrastrando] = useState(false)
  const inicioRef = useRef(0)
  const pausadoRef = useRef(false)

  useEffect(() => {
    if (slides.length < 2) return
    const id = setInterval(() => {
      if (!pausadoRef.current) setIndice((i) => (i + 1) % slides.length)
    }, 5500)
    return () => clearInterval(id)
  }, [slides.length])

  useEffect(() => { if (indice >= slides.length) setIndice(0) }, [slides.length, indice])

  if (slides.length === 0) return null

  const irA = (i) => setIndice(((i % slides.length) + slides.length) % slides.length)
  const onDown = (e) => { setArrastrando(true); pausadoRef.current = true; inicioRef.current = e.clientX }
  const onMove = (e) => { if (arrastrando) setOffsetX(e.clientX - inicioRef.current) }
  const terminarArrastre = (dx) => {
    setArrastrando(false); setOffsetX(0); pausadoRef.current = false
    if (dx > 50) irA(indice - 1); else if (dx < -50) irA(indice + 1)
  }
  const onUp = (e) => terminarArrastre(e.clientX - inicioRef.current)
  const onLeaveTrack = () => { if (arrastrando) terminarArrastre(0) }

  return (
    <div className="carrusel"
      onMouseEnter={() => { pausadoRef.current = true }}
      onMouseLeave={() => { if (!arrastrando) pausadoRef.current = false }}>
      <div className={`carrusel-track${arrastrando ? ' arrastando' : ''}`}
        style={{ transform: `translateX(calc(${-indice * 100}% + ${offsetX}px))` }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
        onPointerLeave={onLeaveTrack} onPointerCancel={onLeaveTrack}>
        {slides.map((s, i) => (
          <div className="carrusel-slide" key={s.linea}>
            <div className="carrusel-fondo"><PortadaCurso motivo={s.motivo} uid={`car${i}`} /></div>
            <div className="carrusel-velo" />
            <div className="carrusel-texto">
              <h3>{s.linea}</h3>
              <p>{s.texto}</p>
              <button type="button" className="button whatsapp" onClick={() => onSelect(s.linea)}>Ver cursos</button>
            </div>
          </div>
        ))}
      </div>
      {slides.length > 1 && (
        <>
          <button type="button" className="carrusel-flecha izq" aria-label="Línea anterior" onClick={() => irA(indice - 1)}>‹</button>
          <button type="button" className="carrusel-flecha der" aria-label="Línea siguiente" onClick={() => irA(indice + 1)}>›</button>
          <div className="carrusel-puntos">
            {slides.map((s, i) => (
              <button type="button" key={s.linea}
                className={`punto${i === indice ? ' activo' : ''}`}
                aria-label={`Ir a ${s.linea}`}
                onClick={() => irA(i)} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

