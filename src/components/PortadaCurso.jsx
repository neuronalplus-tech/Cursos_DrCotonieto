/* ============================================================
   PORTADA DE CURSO — sistema temático COHERENTE
   ------------------------------------------------------------
   Un solo lenguaje para todas (línea fina + nodo de acento, en la
   paleta de marca), pero el MOTIVO es alusivo al contenido según la
   línea del curso: duelo, neurodivergencia, educación, peritaje,
   ética, supervisión, terapias contextuales, bienestar… Así cada
   portada "habla" de su tema (como las imágenes de Coursera) sin
   romper la coherencia visual ni depender de fotos de stock.
   El color es estable por curso (determinista por título).
   ============================================================ */

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

// Elige el tema por palabras clave de la línea/título del curso.
function temaDe(txt) {
  const s = txt.toLowerCase()
  if (/duelo|pérdida|perdida|despedida/.test(s)) return 'duelo'
  if (/neurodiverg|autis|tdah|espectro/.test(s)) return 'ramas'
  if (/educa|docen|escolar|pedagog|aprendizaje|contempor/.test(s)) return 'libro'
  if (/perita|forense|legal|jurídic|juridic|dictamen/.test(s)) return 'balanza'
  if (/riesgo|document|ética|etica|segur|norma|calidad/.test(s)) return 'escudo'
  if (/supervis|práctica|practica|clínic|clinic|acompañ|acompan/.test(s)) return 'red'
  if (/formulaci|contextual|terapia|act|funcional/.test(s)) return 'circulos'
  if (/ciclo|vital|bienestar|vejez|adultez|salud/.test(s)) return 'anillos'
  return 'ondas'
}

export default function PortadaCurso({ motivo, uid, titulo, linea }) {
  const semilla = String(titulo || uid || '')
  const hh = hash(semilla)
  let v = VARIANTES[hh % VARIANTES.length]
  if (motivo === 'arcos') v = VARIANTES[1]

  const tema = temaDe(`${linea || ''} ${titulo || ''}`)
  const L = (o) => `rgba(${v.linea},${o})`
  const a = v.acento
  const sw = 1.9

  const motivos = {
    // Duelo: tallo con hoja que cae y nodo abajo (soltar).
    duelo: (
      <>
        <path d="M200 46 C 200 86 200 108 200 124" stroke={L(0.5)} strokeWidth={sw} fill="none" />
        <path d="M200 70 C 170 64 158 92 200 98 C 242 92 230 64 200 70 Z" stroke={L(0.5)} strokeWidth={sw} fill="none" />
        <circle cx="200" cy="150" r="5.5" fill={a} />
        <circle cx="200" cy="150" r="13" fill="none" stroke={a} strokeOpacity=".4" strokeWidth="1.4" />
      </>
    ),
    // Neurodivergencia: nodos ramificados.
    ramas: (
      <>
        <g stroke={L(0.45)} strokeWidth={sw} fill="none" strokeLinecap="round">
          <path d="M140 150 L 200 100 L 260 150 M200 100 L 200 54 M200 100 L 150 70 M200 100 L 250 70" />
        </g>
        {[[200, 54], [150, 70], [250, 70], [140, 150], [260, 150]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i === 0 ? 5 : 3.6} fill={L(0.75)} />
        ))}
        <circle cx="200" cy="100" r="6" fill={a} />
      </>
    ),
    // Educación: libro abierto.
    libro: (
      <>
        <path d="M200 66 C 176 54 142 54 120 62 V 140 C 142 132 176 132 200 144 Z" stroke={L(0.5)} strokeWidth={sw} fill="none" />
        <path d="M200 66 C 224 54 258 54 280 62 V 140 C 258 132 224 132 200 144 Z" stroke={L(0.5)} strokeWidth={sw} fill="none" />
        <line x1="200" y1="66" x2="200" y2="144" stroke={L(0.5)} strokeWidth={sw} />
        <circle cx="200" cy="54" r="5" fill={a} />
      </>
    ),
    // Peritaje: balanza.
    balanza: (
      <>
        <g stroke={L(0.5)} strokeWidth={sw} fill="none" strokeLinecap="round">
          <path d="M200 56 V 150 M152 150 H 248 M130 80 H 270 M130 80 L 116 110 M130 80 L 144 110 M270 80 L 256 110 M270 80 L 284 110" />
          <path d="M112 110 a 18 12 0 0 0 36 0 M252 110 a 18 12 0 0 0 36 0" />
        </g>
        <circle cx="200" cy="56" r="5.5" fill={a} />
      </>
    ),
    // Riesgo/ética/norma: escudo con check.
    escudo: (
      <>
        <path d="M200 50 L 250 68 V 112 C 250 142 226 158 200 168 C 174 158 150 142 150 112 V 68 Z" stroke={L(0.5)} strokeWidth={sw} fill="none" />
        <path d="M180 108 l 14 14 l 28 -30" stroke={a} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    // Supervisión/clínica: red (hub con nodos).
    red: (
      <>
        <g stroke={L(0.4)} strokeWidth="1.5" fill="none">
          <path d="M200 100 L 128 64 M200 100 L 276 68 M200 100 L 150 148 M200 100 L 262 146 M200 100 L 196 48" />
        </g>
        {[[128, 64], [276, 68], [150, 148], [262, 146], [196, 48]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3.8" fill={L(0.7)} />
        ))}
        <circle cx="200" cy="100" r="7" fill={a} />
        <circle cx="200" cy="100" r="15" fill="none" stroke={a} strokeOpacity=".35" strokeWidth="1.4" />
      </>
    ),
    // Formulación/contextual: círculos que se intersecan (lo contextual).
    circulos: (
      <>
        <g stroke={L(0.5)} strokeWidth={sw} fill="none">
          <circle cx="172" cy="100" r="46" />
          <circle cx="228" cy="100" r="46" />
        </g>
        <circle cx="200" cy="100" r="5.5" fill={a} />
      </>
    ),
    // Ciclo vital/bienestar: anillos de crecimiento.
    anillos: (
      <>
        <g stroke={L(0.0)} fill="none">
          {[22, 40, 58, 76].map((r, i) => (
            <circle key={i} cx="200" cy="100" r={r} stroke={L(0.5 - i * 0.1)} strokeWidth={sw} />
          ))}
        </g>
        <circle cx="200" cy="100" r="6" fill={a} />
      </>
    ),
    // Default: líneas de contorno (ondas).
    ondas: (
      <>
        <g fill="none" strokeLinecap="round">
          {[0, 1, 2, 3, 4].map((i) => {
            const y = 96 + i * 19
            return <path key={i} d={`M-20 ${y} C 80 ${y - 24}, 150 ${y + 20}, 230 ${y - 6} S 360 ${y - 28}, 420 ${y - 6}`}
              stroke={L(0.08 + i * 0.06)} strokeWidth="1.6" />
          })}
        </g>
        <path d="M-20 72 C 80 46, 150 90, 236 66 S 360 42, 420 66" fill="none" stroke={a} strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="236" cy="66" r="5" fill={a} />
        <circle cx="236" cy="66" r="12" fill="none" stroke={a} strokeOpacity=".38" strokeWidth="1.4" />
      </>
    ),
  }

  return (
    <svg className="portada-svg" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="400" height="200" fill={v.bg} />
      {motivos[tema] || motivos.ondas}
    </svg>
  )
}

export function motivoDe(curso) {
  if (curso.caratula) return curso.caratula
  if (curso.gratuito) return 'arcos'
  if (/supervis/i.test(curso.titulo || '')) return 'red'
  return 'ondas'
}
