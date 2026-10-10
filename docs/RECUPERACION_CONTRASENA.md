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
2. **El remitente.** Abre el correo. En "De" debe aparecer tu cuenta de
   Gmail (o el alias configurado en el Apps Script), **nunca** "Supabase
   Auth". Si aparece Supabase Auth, el panel se saltó la Edge Function.
3. **Las dos formas del enlace.** El correo debe traer el botón *Crear
   contraseña* y, abajo, la URL completa como texto.
4. **Otro dispositivo.** Abre el enlace en el móvil, no en el navegador
   del panel. Debe cargar `/recuperar` mostrando "Crea tu contraseña
   nueva". Si muestra "Recuperar el acceso" con el campo de correo, la
   sesión de recuperación no se creó: revisa los Redirect URLs.
5. **Guardar.** Escribe la contraseña dos veces y guarda. Debe decir
   "Listo" y llevar a la portada. Cierra sesión y entra con ella.
6. **Que el enlace caducado no cambie la cuenta equivocada.** Vuelve a
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
