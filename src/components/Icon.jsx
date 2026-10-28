/* ============================================================
   ÍCONOS (SVG de trazo)
   ------------------------------------------------------------
   Un solo set de íconos de línea (estilo Lucide) para la interfaz,
   en vez de emoji. El emoji se ve distinto en cada sistema (Windows,
   Mac, Android), no hereda el color de la marca y pesa como texto;
   un SVG de trazo se ve igual en todos lados, toma el color con
   `currentColor` y da el aire sobrio e institucional que buscamos
   (la lógica de PASMU) sin perder nuestra paleta.

   Uso:  <Icon name="mail" />            (hereda tamaño del texto: 1em)
         <Icon name="menu" size={24} />  (tamaño fijo en px)

   Se van agregando nombres aquí conforme se migran pantallas; el
   emoji de las zonas públicas y de juego (p. ej. el Kahoot) se queda
   a propósito, porque ahí suma calidez.
   ============================================================ */

// Cada ícono es el contenido interno de un <svg> de 24×24 con trazo.
// Trazos, no rellenos: así el grosor es parejo y el color es uno solo.
const PATHS = {
  menu: <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>,
  mail: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></>,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  'chevron-right': <path d="m9 6 6 6-6 6" />,
  x: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
  lock: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  unlock: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>,
  copy: <><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  'external-link': <><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></>,
}

export default function Icon({ name, size, className = '', title, ...rest }) {
  const contenido = PATHS[name]
  if (!contenido) return null
  const dims = size ? { width: size, height: size } : { width: '1em', height: '1em' }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icono ${className}`.trim()}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title || undefined}
      focusable="false"
      {...dims}
      {...rest}
    >
      {title && <title>{title}</title>}
      {contenido}
    </svg>
  )
}
