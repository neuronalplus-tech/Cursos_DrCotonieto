/* ============================================================
   PORTADA DE CURSO — sistema minimalista COHERENTE
   ------------------------------------------------------------
   Un solo lenguaje para todas: un campo de color de marca con
   líneas de contorno fluidas (calma, lectura topográfica) y un
   nodo de acento — el motivo neuronal de la marca. Minimalista,
   como gustaba antes, pero AHORA coherente: todas hablan el mismo
   idioma y solo cambian de color y de fase, de forma determinista
   a partir del título, así cada curso tiene siempre su portada y el
   catálogo se lee como una colección.
   ============================================================ */

// Paletas de portada, dentro de la marca: fondo, color de línea (como
// terna RGB para modular la opacidad) y color de acento (el nodo).
const VARIANTES = [
  { bg: '#1B3A4B', linea: '255,255,255', acento: '#C17A5E' }, // profundo
  { bg: '#B76F53', linea: '255,255,255', acento: '#FAFAF8' }, // terracota
  { bg: '#F2EEE9', linea: '27,58,75',    acento: '#C17A5E' }, // claro
  { bg: '#122A38', linea: '224,168,140', acento: '#C17A5E' }, // nocturno
]

function hash(txt) {
  let h = 0
  for (let i = 0; i < txt.length; i++) h = (h * 31 + txt.charCodeAt(i)) >>> 0
  return h
}

export default function PortadaCurso({ motivo, uid, titulo }) {
  const semilla = String(titulo || uid || '')
  const hh = hash(semilla)
  // Color estable por curso. Los talleres gratuitos (motivo 'arcos') van
  // siempre a la terracota: así "gratuito" se reconoce de un vistazo.
  let v = VARIANTES[hh % VARIANTES.length]
  if (motivo === 'arcos') v = VARIANTES[1]

  // Fase vertical determinista: cada portada distinta, todas coherentes.
  const base = 86 + (hh % 44)           // 86..129
  const paso = 19
  const nodoX = 220 + (hh % 60)         // 220..279
  const acY = base - 30

  return (
    <svg className="portada-svg" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="400" height="200" fill={v.bg} />
      <g fill="none" strokeLinecap="round">
        {[0, 1, 2, 3, 4].map((i) => {
          const y = base + i * paso
          const op = 0.08 + i * 0.06
          return (
            <path key={i}
              d={`M-20 ${y} C 80 ${y - 24}, 150 ${y + 20}, 230 ${y - 6} S 360 ${y - 28}, 420 ${y - 6}`}
              stroke={`rgba(${v.linea},${op})`} strokeWidth="1.6" />
          )
        })}
      </g>
      {/* Línea de acento + nodo neuronal (el detalle de marca, coherente). */}
      <path d={`M-20 ${acY} C 80 ${acY - 26}, 150 ${acY + 18}, ${nodoX} ${acY - 2} S 360 ${acY - 30}, 420 ${acY - 6}`}
            fill="none" stroke={v.acento} strokeWidth="2.4" strokeLinecap="round" />
      <circle cx={nodoX} cy={acY - 2} r="5" fill={v.acento} />
      <circle cx={nodoX} cy={acY - 2} r="12" fill="none" stroke={v.acento} strokeOpacity=".38" strokeWidth="1.4" />
    </svg>
  )
}

export function motivoDe(curso) {
  if (curso.caratula) return curso.caratula
  if (curso.gratuito) return 'arcos'
  if (/supervis/i.test(curso.titulo || '')) return 'red'
  return 'ondas'
}
