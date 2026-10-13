/* ============================================================
   ENCUESTAS NPS + MARCA BLANCA (F5-3)
   ------------------------------------------------------------
   NPS: una pregunta (0-10) al terminar el curso. 9-10 promotor,
   7-8 pasivo, 0-6 detractor. NPS = %promotores − %detractores.
   Con pocas respuestas (<10) el número miente: se enseña la
   cuenta cruda y se avisa que faltan datos.

   MARCA BLANCA: `organizaciones.css_extra` se aplica tras los
   tokens. Aquí se sanea igual que los comunicados: sin url(),
   import, javascript: ni paréntesis raros. Un CSS del cliente
   no debe poder exfiltrar nada ni romper el diseño base.
   ============================================================ */

/** Clasifica un puntaje 0-10 en promotor/pasivo/detractor. */
export function grupoNps(puntaje) {
  // Cuidado: Number(null) es 0 y Number('') también, y ambos
  // parecerían detractores sin que nadie haya respondido nada.
  if (puntaje === null || puntaje === undefined || puntaje === '') return null
  const n = Number(puntaje)
  if (!Number.isFinite(n)) return null
  if (n >= 9) return 'promotor'
  if (n >= 7) return 'pasivo'
  return 'detractor'
}

/** NPS de una lista de puntajes. Null si no hay suficientes datos. */
export function calcularNps(puntajes) {
  const lista = (puntajes || [])
    .filter((p) => p !== null && p !== undefined && p !== '')
    .map(Number).filter(Number.isFinite)
  if (lista.length < 10) return null
  let prom = 0
  let det = 0
  for (const p of lista) {
    if (p >= 9) prom++
    else if (p <= 6) det++
  }
  return Math.round((prom / lista.length - det / lista.length) * 100)
}

/** Resumen para el tablero: NPS (o null) + conteos por grupo. */
export function resumirNps(respuestas) {
  const r = { total: 0, promotores: 0, pasivos: 0, detractores: 0, nps: null }
  for (const x of respuestas || []) {
    const g = grupoNps(x?.puntaje)
    if (!g) continue
    r.total++
    if (g === 'promotor') r.promotores++
    else if (g === 'pasivo') r.pasivos++
    else r.detractores++
  }
  r.nps = calcularNps((respuestas || []).map((x) => x?.puntaje))
  return r
}

/* Un CSS con url(), @import o javascript: es una exfiltración o
   un XSS esperando a ocurrir, aunque venga del admin del cliente. */
const CSS_PELIGROSO = /url\s*\(|@import|javascript\s*:|vbscript\s*:|expression\s*\(|-moz-binding|behaviou?r\s*:/i

/** Deja solo CSS declarativo simple; descarta lo peligroso. */
export function sanearCss(css) {
  if (!css) return ''
  const limpio = String(css).split('}').map((bloque) => {
    const partes = bloque.split('{')
    if (partes.length < 2) return ''
    const selector = partes[0].trim()
    // Solo selectores simples (clases, ids, etiquetas): sin `..`,
    // sin `>` que escape, sin `*`, sin `@import`, sin `[attr]`,
    // sin comillas ni `;` (que meterían otra instrucción).
    if (!selector || /[@>*:;[\]{}'"`]/.test(selector)) return ''
    const decls = partes.slice(1).join('{').split(';')
      .map((d) => d.trim()).filter(Boolean)
      .filter((d) => !CSS_PELIGROSO.test(d))
      .filter((d) => /^[a-z-]+\s*:\s*[^;{}]+$/i.test(d))
    if (!decls.length) return ''
    return `${selector} { ${decls.join('; ')} }`
  }).filter(Boolean)
  return limpio.join('\n')
}
