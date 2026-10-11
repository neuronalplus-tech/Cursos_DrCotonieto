/* ============================================================
   SANITIZADO DEL FORO
   ------------------------------------------------------------
   Lista blanca: solo pasan las etiquetas útiles para escribir. Todo
   lo demás (script, iframe, onerror...) se descarta.

   Un foro es el sitio donde más fácil se cuela un <script>, porque
   cualquiera con cuenta puede escribir. Por eso se limpia en los
   DOS sentidos: al guardar y al pintar.

   Se hace con el DOM en vez de sanitize-html (~20 kB) para no engordar
   el bundle, y porque así se puede auditar leyendo estas funciones.
   ============================================================ */

const ETIQUETAS = {
  p: [], br: [], div: [], span: [], strong: [], b: [], em: [], i: [],
  u: [], s: [], ul: [], ol: [], li: [], a: ['href', 'target', 'rel'],
  h1: [], h2: [], h3: [], h4: [], blockquote: [], pre: [], code: [], hr: [],
}

/* Plantillas y comunicados necesitan tablas e imágenes para actas y
   correos con formato. Misma regla que el foro (nada de script,
   iframe, eventos ni javascript:), pero con la lista ampliada para
   no romper documentos oficiales. */
const ETIQUETAS_DOC = {
  ...ETIQUETAS,
  table: [], thead: [], tbody: [], tfoot: [], tr: [],
  th: ['colspan', 'rowspan'], td: ['colspan', 'rowspan'],
  img: ['src', 'alt', 'width', 'height'],
}

// Un enlace con javascript: es un XSS esperando a ocurrir.
const URL_SEGURA = /^(https?:|mailto:|tel:)/i

/* Solo imágenes de la web o del propio sitio. `data:` se bloquea a
   propósito: un base64 gigante en una plantilla congela la vista
   previa y puede colar SVG con script. */
const IMG_SEGURA = /^(https?:\/\/|\/)[^\s"']*$/i

export function sanear(html) {
  return sanearCon(html, ETIQUETAS)
}

/* Saneado para plantillas y comunicados: igual que el foro pero con
   tablas e imágenes permitidas (las actas las necesitan). Se usa al
   guardar, al previsualizar y al imprimir: las tres pintan HTML con
   dangerouslySetInnerHTML o document.write. */
export function sanearDocumento(html) {
  return sanearCon(html, ETIQUETAS_DOC)
}

function sanearCon(html, permitidas) {
  if (!html) return ''
  // createElement/parseFromString no ejecuta scripts ni carga recursos:
  // es un parseo puro, seguro sobre texto que no es de fiar.
  const doc = new DOMParser().parseFromString(String(html), 'text/html')

  const limpiar = (nodo) => {
    // Recorrido en una sola pasada: cada hijo se visita una vez.
    // (Antes, al desenvolver una etiqueta no permitida se volvía a
    // escanear el nodo desde cero con `limpiar(nodo); return`, lo que
    // con HTML pegado de Word/Docs —cientos de <font>, <o:p>,
    // <table>...— se volvía cuadrático y congelaba la vista del hilo.)
    for (const hijo of [...nodo.childNodes]) {
      if (hijo.nodeType === 3) continue
      if (hijo.nodeType !== 1) { hijo.remove(); continue }

      const et = hijo.tagName.toLowerCase()
      if (!Object.hasOwn(permitidas, et)) {
        // Etiqueta no permitida: primero se limpia por dentro (por si
        // trae atributos o anidados raros) y luego se desenvuelve,
        // conservando su texto/contenido pero soltando la etiqueta.
        limpiar(hijo)
        while (hijo.firstChild) nodo.insertBefore(hijo.firstChild, hijo)
        hijo.remove()
        continue
      }
      for (const attr of [...hijo.attributes]) {
        if (!permitidas[et].includes(attr.name.toLowerCase())) {
          hijo.removeAttribute(attr.name)
        }
      }
      if (et === 'a') {
        const href = hijo.getAttribute('href') || ''
        if (!URL_SEGURA.test(href.trim())) {
          hijo.removeAttribute('href')
        } else {
          // target="_blank" sin rel abre la pestaña nueva con acceso a
          // window.opener. Por eso el rel se fuerza siempre.
          hijo.setAttribute('target', '_blank')
          hijo.setAttribute('rel', 'noopener noreferrer')
        }
      }
      if (et === 'img') {
        const src = hijo.getAttribute('src') || ''
        if (!IMG_SEGURA.test(src.trim())) {
          // Sin src válido no hay imagen: se suelta la etiqueta pero se
          // conserva el alt como texto para no perder el contenido.
          const alt = hijo.getAttribute('alt') || ''
          hijo.replaceWith(doc.createTextNode(alt))
          continue
        }
        hijo.setAttribute('loading', 'lazy')
        hijo.removeAttribute('srcset')
      }
      limpiar(hijo)
    }
  }

  limpiar(doc.body)
  return doc.body.innerHTML
}

/** HTML a texto plano: para los resúmenes y las notificaciones. */
export function aTextoPlano(html) {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(sanear(html), 'text/html')
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim()
}

/** Recorta para las tarjetas de la lista de hilos. */
export function resumen(html, n = 160) {
  const t = aTextoPlano(html)
  return t.length > n ? t.slice(0, n).trimEnd() + '…' : t
}

/** Si el texto va sin formato: para poder mostrar "escrito con formato". */
export function esTextoPlano(html) {
  return !html || !/[<>]/.test(String(html))
}