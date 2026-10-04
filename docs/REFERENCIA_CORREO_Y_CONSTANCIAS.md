# Referencia de diseño — Correo y Constancias

> **Propósito:** documentar cómo debe verse un correo y una constancia de la
> marca, para no volver a improvisar. Extraído del script
> **"CONSTANCIAS AUTOMÁTICAS · v11"** (Apps Script + Google Sheets + Slides) y del
> **Notificador.gs** del portal.
>
> **Cómo se usa:** cuando vayas a hacer un correo o una constancia nuevo, copia
> la estructura de aquí y cambia solo el contenido.

---

## 1. Paleta y tipografías

Definido en `CONFIG_GLOBAL` del script de constancias.

| Color | Hex | Uso |
|---|---|---|
| **crema** | `#FAFAF8` | Fondo general (correo y constancia) |
| **pizarra** | `#1B3A4B` | Texto principal, filetes, barras |
| **terracota** | `#C17A5E` | Acento: regla bajo el título, subtítulo |
| **gris** | `#8A9BAD` | Antetítulos, textos secundarios |
| grisClaro | `#D6DCE3` | Regla bajo el nombre en la constancia |
| borde | `#E7E7E2` | Separador de firma en el correo |

| Tipografía | Dónde |
|---|---|
| **Fraunces** (serif) | Nombres y títulos de la constancia. En correo se usa `Georgia, serif` (Gmail no carga fuentes externas). |
| **Inter** (sans) | Todo lo demás. En correo: `Helvetica, Arial, sans-serif`. |

> **Importante:** en correo **nunca** se usan fuentes de Google. Gmail las
> descarta. Serif → `Georgia`. Sans → `Helvetica, Arial`.

---

## 2. Anatomía del CORREO de constancia

De la función `construirHTMLCorreoConstancia(nombre, cfg)`. Estructura exacta:

```
┌─────────────────────────────────────────┐  fondo crema
│  ▬▬▬▬▬▬ 6px pizarra (filete superior)    │
│  ┌───────────────────────────────────┐  │
│  │ CONSTANCIA DE PARTICIPACIÓN        │  11px · gris · letter-spacing:3px
│  │ ▬▬ 44x2px terracota                │  regla de acento
│  │                                    │  │
│  │ Gracias por acompañarme, {Nombre}. │  Georgia 24px · pizarra
│  │                                    │  │
│  │ Aquí va tu constancia del taller   │  15px/1.75 · pizarra
│  │ «{título}», junto con los          │
│  │ materiales que revisamos.          │
│  │                                    │  │
│  │ Las herramientas funcionan con la  │  15px/1.75 · margin-top:16px
│  │ práctica, no con la perfección.     │
│  │                                    │  │
│  │ Estos talleres son mensuales y sin │  15px/1.75 · margin-top:16px
│  │ costo; el próximo se anuncia por   │
│  │ mis redes.                         │
│  │ ─────────────────────────────────  │  1px #E7E7E2 · margen 28/0/20/0
│  │ Dr. Ernesto Cotonieto Martínez     │  14px · pizarra
│  │ Psicología especializada...        │  12.5px · gris · margin-top:5px
│  │ @dr.cotonieto · fb.com/... · tel.  │  12.5px · gris · margin-top:10px
│  └───────────────────────────────────┘  │
│  ▬▬▬▬▬▬ 6px pizarra (filete inferior)    │
└─────────────────────────────────────────┘
```

Ancho de la tarjeta: **560px**, fondo `#FFFFFF`, centrada con `<table align="center">`.

### Separación de bloques (la que da el aire)

| Elemento | `margin-top` |
|---|---|
| Regla terracota | 18px |
| Saludo con el nombre | 22px |
| Primer párrafo | 18px |
| Párrafos siguientes | **16px** |
| Separador antes de la firma | 28px arriba / 20px abajo |
| Cargo del firmante | 5px |
| Contacto | 10px |
---

## 3. Anatomía de la CONSTANCIA (PDF, generado con Google Slides)

Proporciones expresadas como fracción de la altura de la diapositiva (`H`), para
que sirva a cualquier tamaño de página.

| # | Elemento | Posición | Estilo |
|---|---|---|---|
| 1 | Filete superior | `0, 0` | pizarra · 5·k de alto |
| 2 | **Logo** | centrado · `0.040·H` | ancho 30·k |
| 3 | **Antetítulo** | `0.128·H` | Inter 11·k · pizarra · centrado · **negrita** |
| | *texto:* `C O N S T A N C I A   D E   P A R T I C I P A C I Ó N` (con espacios entre letras) | | |
| 4 | Regla terracota | `0.178·H` | 40·k × 1.5 · centrada |
| 5 | "Se otorga a" | `0.202·H` | Inter 11·k |
| 6 | **`{{NOMBRE}}`** | `0.242·H` | Fraunces 30·k · centrado |
| 7 | Regla grisClaro | `0.351·H` | 0.28·W de ancho |
| 8 | "por su participación en el taller" | `0.370·H` | Inter 11·k |
| 9 | **«{título}»** | `0.410·H` | Fraunces 19·k |
| 10 | `{subtítulo}` *(opcional)* | `0.479·H` | Inter 11·k · **terracota** · negrita |
| 11 | `{horas} · {fecha} · {modalidad}` | `0.523·H` | Inter 10·k |
| 12 | **Firma (imagen)** | `0.805·H − alto·0.83` | ancho 0.19·W |
| 13 | Línea de firma | `0.805·H` | 0.34·W × 1.2 · pizarra |
| 14 | `{firmanteNombre}` | `0.845·H` | Inter 11·k · **negrita** |
| 15 | `{firmanteCargo}` | `0.885·H` | Inter 9.5·k |
| 16 | **Barra de pie** | `H − 25·k` | pizarra · 25·k de alto |
| 16a | `Folio {{FOLIO}}` | izquierda | Inter 8·k · gris |
| 16b | `@dr.cotonieto` | centro | Inter 9.5·k · **crema** · negrita |
| 16c | `{telefonoPie}` | derecha | Inter 8·k · gris |

`k = H / 405` (la altura de referencia del diseño).

### Ajuste automático del nombre

Si el nombre es largo se reduce para que **siempre quepa en una línea**:

```js
comodos = 24
tamano = n <= comodos ? 30*k : Math.max(15*k, 30*k * comodos / n)
```

### Normalización de nombres

Minúsculas, luego mayúscula en cada palabra **excepto** las partículas, que
quedan en minúscula:

---

## 4. Configuración por taller

Bloque `TALLERES` del script. Un objeto por taller:

```js
duelo: {
  nombre:             "Habitar el duelo",
  hoja:               "Taller duelo",            // pestaña de la hoja
  titulo:             "Habitar el duelo",        // va entre comillas «»
  subtitulo:          "",                        // opcional, va en terracota
  fecha:              "22 de julio de 2026",
  horas:              "1 hora",
  modalidad:          "Modalidad en línea",
  prefijoFolio:       "TC-2026-07",              // el folio es PREFIJO-001
  asuntoCorreo:       "Tu constancia · Habitar el duelo",
  firmanteNombre:     "Dr. Ernesto Cotonieto Martínez",
  firmanteCargo:      "Psicología especializada basada en evidencia",
  telefonoPie:        "56 3784 1931",
  contactoCorreo:     "@dr.cotonieto · fb.com/dr.cotonieto · 56 3784 1931",
  logoFileId:         "1ULYKT20E3DFTylo5mi_Yd8RkquYeiGI2",
  firmaFileId:        "1WwC1nljxUO4qEgDwlAffGebNn4skVcMU",
  carpetaMateriales:  null,                      // ID de Drive o null
  plantillaBaseId:    "",                        // reutilizar una existente
}
```

**El patrón de asunto:** `"Tu constancia · {nombre del taller}"`.

**El patrón del folio:** `prefijoFolio + "-" + ("00" + n).slice(-3)` → `TC-2026-07-001`.

---

## 5. Patrones reutilizables

### Encabezado con antetítulo

```html
<div style="font-size:11px;letter-spacing:2.5px;color:#8A9BAD;margin:0 0 14px 0">
  COMUNICADO
</div>
<div style="font-family:Georgia,serif;font-size:26px;line-height:1.3;color:#1B3A4B;margin:0 0 18px 0">
  Título del comunicado
</div>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0">
  <tr><td style="width:44px;height:2px;line-height:2px;background:#C17A5E;font-size:0">&nbsp;</td></tr>
</table>
```

### Botón (en tabla, obligatorio)

```html
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 4px 0">
  <tr>
    <td style="background:#1B3A4B;border-radius:6px;padding:13px 24px">
      <a href="https://..." style="color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:600">
        Ir a la plataforma
      </a>
    </td>
  </tr>
</table>
```

> El botón es una **tabla con una celda de fondo y un `<a>` dentro**, no un
> `<div>` con fondo. Gmail recorta el fondo si el elemento es `inline-block`.

### Firma al pie de un correo
---

## 6. Reglas de compatibilidad de correo (no negociables)

| Regla | Por qué |
|---|---|
| **Estilos SIEMPRE en línea** | Gmail **borra** los bloques `<style>` y **ignora** las clases CSS. |
| **Nada de `flex` ni `grid`** | No se renderizan. Para filas, usa `<table>`. |
| **Fondos en `<td>`**, no en `<div>` | Gmail recorta el fondo si no hay celda de tabla. |
| **Fuentes del sistema** | `Georgia, serif` y `Helvetica, Arial, sans-serif`. Nada de Inter/Fraunces en correo. |
| **Ancho fijo 560px** | Funciona en móvil y escritorio. |
| **Separadores con `height` pequeño + `font-size:0`** | Evita que la línea herede la altura del texto. |
| **Celdas de 1px con `font-size:0` y `&nbsp;`** | Impide que una tabla finísima se infle. |
| **Escapar `&`, `<`, `>`, `"`** | Obligatorio si el contenido lo edita el usuario: si no, es inyección de HTML. |

---

## 7. Dónde vive cada cosa

| Pieza | Ubicación | Tecnología |
|---|---|---|
| Constancias (PDF) | Script "CONSTANCIAS AUTOMÁTICAS v11" | Apps Script + Slides → PDF |
| Datos de alumnos | Hoja de cálculo, una pestaña por taller | Google Sheets |
| Plantilla reusable | `PLANTILLA_ID_{taller}` en PropertiesService | Se reutiliza entre envíos |
| Correos del portal | `apps-script/Notificador.gs` | Apps Script (web app) |
| Plantilla manual de correo | `docs/PLANTILLA_CORREO_MANUAL.html` | Se pega en el panel |
| Interfaz del portal | `src/App.jsx` | React + Vite → Cloudflare Pages |

### Atajos del script de constancias

Menú **⚙ Constancias** dentro de la hoja:

- **📤 Generar pendientes** — procesa la pestaña y marca `Enviada {fecha}`.
- **📨 Enviarme una de PRUEBA** — se manda una a tu propia cuenta.
- **🔄 Rehacer todas las plantillas** — borra las plantillas cacheadas.

Las plantillas se cachean por taller junto a su versión de diseño
(`PLANTILLA_ID_*` y `PLANTILLA_VERSION_*`). Si sube `DISENO_VERSION`, se
reconstruyen solas la próxima vez.

---

## 8. El logo y la firma son imágenes de Drive

```
logoFileId   = 1ULYKT20E3DFTylo5mi_Yd8RkquYeiGI2
firmaFileId  = 1WwC1nljxUO4qEgDwlAffGebNn4skVcMU
```

Se insertan con `insertImage(DriveApp.getFileById(id).getBlob())` y se posicionan
por fracción de página. Si cambias el logo, actualiza **estos dos IDs**, no el
código.

En **correo** la firma va como texto; la imagen solo se usa en el PDF, porque
Gmail bloquea imágenes por defecto en varios clientes.

```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 0 0">
  <tr><td style="height:1px;line-height:1px;background:#E7E7E2;font-size:0">&nbsp;</td></tr>
</table>
<div style="font-size:14px;color:#1B3A4B;margin:22px 0 0 0">Dr. Ernesto Cotonieto</div>
<div style="font-size:12.5px;color:#8A9BAD;margin:5px 0 0 0">Psicología especializada basada en evidencia</div>
<div style="font-size:12.5px;color:#8A9BAD;margin:10px 0 0 0">@dr.cotonieto · fb.com/dr.cotonieto · 56 3784 1931</div>
```

### Enlace incrustado con texto propio

```html
<a href="https://ejemplo.com/curso" style="color:#1B3A4B;text-decoration:none;border-bottom:1px solid #C17A5E">
  Ir al módulo
</a>
```

### Barra de pie tipo constancia

```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr><td style="height:25px;line-height:25px;background:#1B3A4B;font-size:0">&nbsp;</td></tr>
</table>
```
`de · del · la · las · los · y · da · van · von`

`"MARÍA DE LOS SANTOS"` → `"María de los Santos"`

Para el saludo del correo se usa solo el **primer nombre**:
`"maría de los santos"` → `"María"`.