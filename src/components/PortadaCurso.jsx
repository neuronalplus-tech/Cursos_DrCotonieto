/* ============================================================
   PORTADA DE CURSO — sistema editorial COHERENTE
   ------------------------------------------------------------
   Antes había 7 motivos distintos (red, arcos, círculos, malla,
   prisma, espiral, escudo, ondas): bonitos sueltos, pero SIN
   coherencia entre sí — parecían de plataformas distintas.

   Ahora es UN solo lenguaje para todas: un campo de color de marca
   con la INICIAL del curso en Fraunces, grande y translúcida (como
   la portada de una revista o un libro), más un filo y un punto de
   acento. Lo único que cambia entre portadas es el color, elegido de
   forma determinista a partir del título, así cada curso tiene SIEMPRE
   el mismo color y el conjunto se lee como una colección.
   ============================================================ */

// Paletas de portada, todas dentro de la marca. Cada una: fondo, color
// de la inicial (muy translúcida, es textura), filo editorial y punto.
const VARIANTES = [
  { bg: '#1B3A4B', letra: 'rgba(255,255,255,.09)', filo: 'rgba(255,255,255,.22)', punto: '#C17A5E' }, // profundo
  { bg: '#B76F53', letra: 'rgba(255,255,255,.14)', filo: 'rgba(255,255,255,.30)', punto: '#FAFAF8' }, // terracota
  { bg: '#F2EEE9', letra: 'rgba(27,58,75,.08)',    filo: 'rgba(27,58,75,.18)',    punto: '#C17A5E' }, // claro
  { bg: '#122A38', letra: 'rgba(224,168,140,.13)', filo: 'rgba(255,255,255,.16)', punto: '#C17A5E' }, // nocturno
  { bg: '#EEF2F4', letra: 'rgba(27,58,75,.08)',    filo: 'rgba(27,58,75,.18)',    punto: '#1B3A4B' }, // bruma
]

function hash(txt) {
  let h = 0
  for (let i = 0; i < txt.length; i++) h = (h * 31 + txt.charCodeAt(i)) >>> 0
  return h
}

export default function PortadaCurso({ motivo, uid, titulo }) {
  const semilla = String(titulo || uid || '')
  // Un color estable por curso. Los talleres gratuitos (motivo 'arcos')
  // van siempre a la terracota: así "gratuito" se reconoce de un vistazo.
  let v = VARIANTES[hash(semilla) % VARIANTES.length]
  if (motivo === 'arcos') v = VARIANTES[1]

  const m = semilla.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/)
  const inicial = (m ? m[0] : '•').toUpperCase()

  return (
    <svg className="portada-svg" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="400" height="200" fill={v.bg} />
      {/* Inicial del curso: el elemento gráfico, Fraunces, sangrando abajo. */}
      <text x="22" y="196" fontFamily="'Fraunces', Georgia, serif" fontWeight="600"
            fontSize="212" fill={v.letra} style={{ letterSpacing: '-4px' }}>{inicial}</text>
      {/* Filo editorial arriba + punto de acento: el detalle coherente. */}
      <line x1="28" y1="32" x2="86" y2="32" stroke={v.filo} strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="372" cy="30" r="4.5" fill={v.punto} />
    </svg>
  )
}

export function motivoDe(curso) {
  if (curso.caratula) return curso.caratula
  if (curso.gratuito) return 'arcos'
  if (/supervis/i.test(curso.titulo || '')) return 'red'
  return 'ondas'
}
