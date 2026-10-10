# El botón 🔑 · enlace para crear contraseña nueva

Qué pasa cuando pulsas la llave en **Gestión de usuarios**, y cómo se
comprueba que sigue funcionando.

## Por qué no se usa el correo de Supabase

`supabase.auth.resetPasswordForEmail()` existe, pero no sirve aquí por
dos razones:

1. **El remitente.** El correo sale de "Supabase Auth", no de ti. Para
   quien lo recibe parece un servicio que no reconoce.
2. **El dispositivo.** Con ese método el enlace va atado al verificador
   PKCE que queda guardado en el navegador **que pidió el enlace**. Si lo
   pide tu panel y el alumno lo abre en su móvil, el verificador no está
   ahí y el enlace falla. Es el fallo que estuvimos persiguiendo.

Por eso el enlace se genera en el servidor, sin PKCE, y lo manda el Apps
Script desde la cuenta de Gmail de siempre. `resetPasswordForEmail()`
solo sigue en `/recuperar`, donde la persona pide **su propio** enlace
desde su propio navegador: ahí el verificador sí está donde debe.

## El recorrido

1. `Admin.jsx` → `enviarEnlaceRecuperacion()` llama a la Edge Function
   `crear-usuarios` con `accion: 'enlace-recuperacion'`.
2. La función comprueba que quien llama esté en `admins`, genera el
   enlace con `admin.auth.admin.generateLink({ type: 'recovery' })` y lo
   devuelve en `action_link`.
3. El panel manda el correo por Apps Script, con el enlace **dos veces**:
   como botón en el HTML y como URL suelta en el texto plano. Lo segundo
   es el seguro: si el Apps Script desplegado fuera una versión vieja que
   ignora `cuerpoHtml`, Gmail detecta la URL del texto y la vuelve enlace.
4. Quien lo recibe abre el enlace **en cualquier dispositivo**. Supabase
   verifica el token y redirige a `/recuperar` con la sesión en el
   fragmento (`#access_token=…&type=recovery`).
5. `Recuperar.jsx` encuentra esa sesión, pasa a "crea tu contraseña
   nueva" y guarda con `supabase.auth.updateUser({ password })`.

## Lo que hay que tener configurado en Supabase

Esto no está en el código y es lo primero que se rompe.
**Authentication → URL Configuration → Redirect URLs** debe incluir:

```
https://cursos-drcotonieto.neuronal-plus.workers.dev/recuperar
```

Si no está, Supabase **ignora** el destino del enlace y manda la sesión
al *Site URL*. La persona acaba dentro del aula sin ver nunca el
formulario. `App.jsx` tiene una red de seguridad que la lleva a
`/recuperar` si eso pasa, pero conviene que no pase.

## Hay DOS cosas que desplegar, y ninguna la sube Cloudflare

Esto fue lo que nos costó una tarde. El deploy de Cloudflare solo sube
`dist/`. Aparte van:

1. La **Edge Function** de Supabase (`crear-usuarios`), que genera el enlace.
2. El **Apps Script** (`Notificador.gs`), que manda el correo.

Si el Apps Script desplegado está atrasado, el enlace se genera bien y el
correo no sale. Para saber qué versión está viva, abre esta URL en una
pestaña (no envía nada, solo responde):

```
<APPS_SCRIPT_URL>?payload=%7B%22tipo%22%3A%22ping%22%7D
```

La respuesta **buena** trae cuatro datos:

```json
{"ok":true,"version":"2026-10-03.v4-fallback-remitente",
 "remitenteEnElScript":"…","cuentaQueEnvia":"…","mensaje":"Conexión OK…"}
```

Si solo contesta `{"ok":true,"mensaje":"Conexión OK…"}`, **la versión
desplegada es vieja**: le faltan `version`, `remitenteEnElScript` y
`cuentaQueEnvia`. Hay que pegar `apps-script/Notificador.gs` entero y
guardar (guardar ya actualiza el deployment; crear uno nuevo cambia la
URL y rompe `APPS_SCRIPT_URL`).

Lo que arreglan las versiones nuevas y falta en las viejas:

- El remitente venía como marcador de posición,
  `Dr. Ernesto Cotonieto <TU_CORREO@gmail.com>`. Gmail responde
  *"Argumento no válido"* y **el correo no sale**.
- No había reintento sin `from`. Ahora, si el remitente falla, el correo
  sale igualmente desde la cuenta del script.

## Cómo se despliega

El deploy de Cloudflare **no** publica la Edge Function: solo sube
`dist/`. La función vive en Supabase y se despliega aparte.

**Desde el dashboard:** Supabase → Edge Functions → `crear-usuarios` →
pegar el contenido completo de `supabase/functions/crear-usuarios/index.ts`
→ Deploy.

**Desde la CLI** (necesita sesión: `npx supabase login`):

```sh
npx supabase functions deploy crear-usuarios --project-ref ohhdnaewtjfqszxemrju
```

No hay que configurar claves: `SUPABASE_URL` y
`SUPABASE_SERVICE_ROLE_KEY` ya existen dentro de las funciones.

## Cómo se comprueba

1. **Que la versión desplegada es la nueva.** En el panel, pulsa 🔑 sobre
   una cuenta de prueba. Si contesta **"La contraseña debe tener al menos
   6 caracteres"**, la versión desplegada es la vieja: no reconoce
   `accion` y trata la petición como un alta de usuario sin contraseña.
   Ese mensaje es la señal exacta de que el deploy no llegó.
2. **El remitente.** Abre el correo. En "De" debe aparecer
   `neuronal.plus@gmail.com` (o el alias del Apps Script), **nunca**
   "Supabase Auth". Si aparece Supabase Auth, el panel se saltó la Edge
   Function.
3. **Las dos formas del enlace.** El correo debe traer el botón *Crear
   contraseña* y, abajo, la URL completa como texto.
4. **Otro dispositivo.** Abre el enlace en el móvil, no en el navegador
   del panel. Debe cargar `/recuperar` mostrando "Crea tu contraseña
   nueva". Si muestra "Recuperar el acceso" con el campo de correo, la
   sesión de recuperación no se creó: revisa los Redirect URLs.
5. **Guardar.** Escribe la contraseña dos veces y guarda. Debe decir
   "Listo" y llevar a la portada. Cierra sesión y entra con ella.
6. **Que el botón siempre vuelva.** Pase lo que pase, la llave debe
   dejar de ser `…` y volver a ser 🔑, con un mensaje encima de la tabla.
   Si se queda en `…`, hay una promesa que no resuelve: es exactamente el
   fallo que tuvimos, y está descrito abajo.
7. **Que el enlace caducado no cambie la cuenta equivocada.** Vuelve a
   abrir el mismo enlace (ya usado) desde el navegador donde estás
   dentro del panel. Debe decir que el enlace venció — **no** debe
   ofrecerte cambiar la contraseña, porque la que cambiarías sería la
   tuya.

## Quién puede pedir el enlace de quién

El `action_link` se devuelve al navegador que lo pide, así que vale tanto
como la contraseña de esa cuenta. Por eso la función se niega a generar
el enlace de una cuenta que también está en `admins`, salvo que quien lo
pida sea esa misma persona o un administrador de la plataforma (fila en
`admins` sin `organizacion_id`). Sin eso, el responsable de cualquier
cliente podría pedir el enlace de tu cuenta y quedarse con el panel.

**Límite conocido:** entre alumnos no hay separación por organización.
Un administrador de un cliente puede pedir el enlace de un alumno de
otro cliente si conoce su correo. Para cerrarlo haría falta cruzar
`acceso → cursos.organizacion_id`, y eso dejaría fuera a las cuentas
recién creadas que todavía no tienen cursos.

## El fallo del botón atascado en «…» (resuelto)

Merece quedar escrito porque no se ve en el código de un vistazo y
costó caro: durante un tiempo el botón 🔑 se quedaba en `…` para
siempre y no decía nada, ni bien ni mal.

El envío de correo usa JSONP: se inyecta un `<script>` y el Apps Script
contesta llamando a `window.__appsCorreoRespuesta(reqid, datos)`. Ese
manejador global **borraba** la petición de `pendientes` antes de
invocar su callback. Y `finalizar` —el único sitio que llama a
`resolve()`— usa esa misma entrada como señal de "esto sigue vivo":

```js
const finalizar = (resultado) => {
  const fn = pendientes[reqid]
  if (!fn) return          // ya no está: se va sin resolver
  ...
  resolve(resultado)
}
```

Resultado: cuando el script contestaba **bien**, la promesa no se
resolvía nunca. Y como el timeout de 20 s también pasa por `finalizar`,
tampoco la rescataba. La promesa quedaba colgada para siempre, y con
ella el botón.

Lo retorcido es que los caminos de *error* sí funcionaban (`onerror` y
el error de sintaxis de un deployment viejo no pasan por
`__appsCorreoRespuesta`). Solo colgaba cuando todo iba bien.

Ahora el manejador global no borra nada; borra `finalizar`, y solo él.
Además el botón se restaura en un `finally` y la llamada a la Edge
Function tiene corte a los 20 s, para que ningún camino nuevo pueda
volver a dejar la interfaz esperando.
