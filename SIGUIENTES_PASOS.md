# Siguientes pasos

Instrucciones para quien continúe el trabajo en este repositorio.
Escrito el 2026-10-08.

---

## 1. Lo primero: orientarse

Antes de escribir una línea, lee en este orden:

| Archivo | Qué te dice |
|---|---|
| `supabase/ESTRUCTURA.md` | Tablas, columnas y **tipos** reales. Generado leyendo la base. |
| `supabase/ESTADO.sql` | Qué scripts están aplicados y en qué orden van. |
| `supabase/CONFIGURACION.md` | Buckets, autenticación y funciones del servidor. |
| `src/lib/` | La lógica pura. Mira los encabezados: explican *por qué*, no *qué*. |

**No supongas la forma de la base.** Este proyecto ha tenido tres
errores en producción por declarar un tipo que no coincidía con el
real (`cursos.id` es `integer`, no `bigint`; casi todo lo añadido
después usa `bigint`). `ESTRUCTURA.md` existe exactamente para eso.

### Comandos

```bash
npm run lint      # ESLint. Cero errores es obligatorio; los 4 avisos son conocidos.
npm run check     # Imports rotos + columnas inexistentes.
npm run build     # Tiene que terminar limpio.
node supabase/test-<nombre>.mjs     # Las pruebas, una por módulo.
```

Las pruebas no están en un `npm test`; se corren una a una. Hoy son
nueve archivos y **348 pruebas**. Si tocas `src/lib/`, corre la suya.

---

## 2. Cómo se trabaja aquí

Estas no son preferencias de estilo: son decisiones que ya costaron
errores y conviene no repetir.

**Todo en español.** Nombres de variables, funciones, archivos,
comentarios, mensajes de la interfaz y commits. El dueño del proyecto
es psicólogo, no programador, y tiene que poder leer su propio código.

**Los comentarios explican por qué, nunca qué.** Compara:

```js
// MAL: el qué ya se ve en el código
// Recorre las preguntas y las suma

// BIEN: el porqué no se ve en ninguna parte
// Se promedia DENTRO de cada hilo primero: quien escribió diez
// veces en el mismo hilo no debe pesar diez veces más.
```

**La lógica pura va a `src/lib/` y se prueba.** Los componentes
cargan datos y pintan; no calculan. Si una regla de negocio aparece
en dos pantallas, va a `lib/` o acabarán discrepando — pasó con la
calificación del curso y hubo que unificarla.

**Nada se cierra desde la pantalla.** La aplicación habla con
Supabase desde el navegador. Esconder un botón no impide nada: lo que
protege son las políticas RLS y los disparadores. Si una regla
importa, va en la base **además** de en la interfaz.

**El SQL va a `supabase/NOMBRE.sql`**, con encabezado que explique
qué resuelve, comprobación al final y resultado esperado. Idempotente
siempre. Y registrado en `ESTADO.sql`.

**Nunca borres para recrear.** Un `drop constraint` sobre una clave
primaria referenciada tumba el script entero; pasó. Usa
`if not exists` o un bloque `do` que compruebe.

### Dos trampas del entorno

1. **CRLF.** Los archivos usan `\r\n`. Las búsquedas de varias líneas
   con `\n` fallan. Edita por líneas o usa herramientas que lo
   manejen.
2. **El repositorio está dentro de OneDrive.** La sincronización ha
   restaurado versiones viejas a mitad de sesión. **Revisa el diff
   antes de cada commit**; un `git add -A` a ciegas ya revirtió un
   arreglo sin que nadie lo notara hasta días después.

---

## 3. Los tres trabajos pendientes

En el orden recomendado.

### A. PWA — instalable en el teléfono

**Por qué.** Los alumnos viven en el celular. Una PWA se instala
desde el navegador, abre desde el icono sin barra de direcciones y
carga al instante en visitas repetidas. Es lo que más nota el alumno
por lo que menos cuesta, y no necesita ninguna cuenta externa.

**Qué hacer.**

1. `public/manifest.webmanifest` con nombre, nombre corto, colores
   (los de `:root` en `src/App.css`: `--primary` es `#1B3A4B`), modo
   `standalone` e iconos de 192 y 512 px. Hay un logo en `src/config.js`
   (`LOGO_CLARO`) del que partir.
2. Enlazarlo desde `index.html`, con `theme-color`.
3. Un *service worker* **conservador**: cachea el armazón de la
   aplicación y los recursos estáticos. Estrategia *network-first*
   para todo lo que vaya a Supabase.
4. Un aviso discreto de "actualización disponible" cuando haya
   versión nueva.

**Cuidado con esto, que es lo que puede salir mal:**

- **Nunca caches respuestas de Supabase.** Son datos de alumnos:
  calificaciones, mensajes, entregas. Una respuesta cacheada puede
  mostrarle a alguien el contenido de otra sesión en el mismo
  dispositivo, y además enseñaría notas viejas como si fueran
  actuales. Cachea solo `/assets/`, el HTML del armazón y las fuentes.
- **Un service worker mal puesto sirve una versión vieja para
  siempre.** Incluye desde el primer día una forma de forzar la
  actualización (`skipWaiting` + recarga avisada), y comprueba que
  tras un despliegue nuevo el usuario recibe el cambio.
- Despliega en Cloudflare Workers con GitHub Actions. Confirma que
  el service worker se sirve desde la raíz, o su alcance se limita al
  subdirectorio.

**Cómo saber que quedó.** En Chrome, DevTools → Application →
Manifest sin errores; aparece "Instalar"; en modo avión la aplicación
abre y dice que no hay conexión en vez de dar error del navegador;
tras un despliegue, el aviso de actualización aparece.

---

### B. Aleatorización de exámenes por alumno

**Por qué.** Hoy `SelectorBanco` (en `src/components/BancoPreguntas.jsx`)
sortea N preguntas **al armar** el examen: todos los alumnos ven las
mismas. Que a cada uno le toquen preguntas distintas reduce la copia,
que es la queja habitual de un examen en línea.

**La decisión de diseño que hay que tomar primero.** Hoy el examen
guarda sus preguntas en `examenes.preguntas` (jsonb) y el intento
guarda `intentos_examen.respuestas`, indexadas **por el id de la
pregunta**. Si cada alumno recibe un juego distinto, hay que guardar
*qué juego le tocó*, o al revisar el intento no se sabrá a qué
preguntas respondió.

Propuesta: añadir `intentos_examen.preguntas jsonb` con el juego
servido a ese intento, y que la revisión lea de ahí y no del examen.
Los intentos antiguos no la tendrán: cae de vuelta a
`examenes.preguntas`, que es lo correcto porque entonces el juego era
único.

**Qué hacer.**

1. SQL: `examenes.aleatorio_n int` (cuántas servir; nulo = todas) y
   `examenes.mezclar_opciones boolean`. Más
   `intentos_examen.preguntas jsonb`.
2. El sorteo **no puede ocurrir en el navegador**: ahí el alumno ve
   el banco entero antes de que se elija. Hace falta una función
   `security definer` que reciba el examen, sortee y devuelva solo
   las preguntas servidas **sin el campo que marca la correcta**.
3. Al entregar, calificar **en la base** contra el juego guardado.
   Hoy `calificar()` corre en el navegador (`src/lib/examenes.js`),
   lo que significa que la calificación la calcula el cliente. Con
   aleatorización eso deja de ser defendible.
4. La revisión del intento lee `intentos_examen.preguntas`.

**Lo más fácil de hacer mal:** mandar al navegador las preguntas con
su respuesta correcta marcada. Hoy pasa — `examenes.preguntas` viaja
entera —, y con aleatorización se vuelve indefendible. Si abordas
esto, arréglalo de paso: es el mismo trabajo.

Reutiliza `tomarAlAzar` de `src/lib/banco.js`: ya está probada y usa
Fisher-Yates. No uses `sort(() => Math.random() - 0.5)`, que reparte
sesgado.

---

### C. Estadística de preguntas

**Por qué.** Es lo que distingue una pregunta **mala** de una
**difícil**. Si el 90% falla una pregunta, o el tema no se enseñó o
la pregunta está mal escrita; ahora mismo no hay forma de saberlo.

**Qué hacer.**

1. Una función `security definer` que, dado un examen, devuelva por
   pregunta: cuántos la respondieron, cuántos acertaron, y el
   porcentaje. Sale de `intentos_examen.respuestas` cruzado con las
   preguntas; la lógica de corrección ya está en `esCorrecta()` de
   `src/lib/examenes.js`, **replícala en SQL con cuidado o calcula en
   el servidor reutilizándola**. Que las dos versiones discrepen
   sería el mismo error que ya costó unificar la calificación.
2. Una pestaña o sección en el editor de examen con la tabla,
   ordenada por porcentaje de acierto ascendente.
3. Marcar en rojo las que bajan del 30% de acierto y en gris las que
   pasan del 95%: unas hay que revisarlas, las otras no discriminan.

**Dato útil además del porcentaje:** cuántas personas eligieron cada
opción incorrecta. Un distractor que no elige nadie sobra, y uno que
elige más gente que la respuesta correcta suele significar que la
pregunta está mal redactada.

**Ojo:** solo tiene sentido con suficientes intentos. Por debajo de
unos 10, no enseñes porcentajes — enseña la cuenta cruda y di que
faltan datos. Un 100% de error sobre un intento no significa nada y
llevaría a reescribir una pregunta que estaba bien.

---

## 4. Lo que está pendiente y no es programación

Para que no se intente resolver desde el código:

- **SMTP.** Es el cuello de botella de más valor pendiente: la
  cobranza no avisa de vencimientos, el facilitador no se entera de
  entregas sin calificar, y al alumno no le llega nada cuando lo
  califican. Necesita que el dueño abra cuenta en Resend o Brevo.
- **Respaldos.** El plan gratuito de Supabase **no tiene ninguno**.
  La única copia de los datos es la base en vivo. Hay exportación
  manual (Panel → Organizaciones → ⬇️ Datos); el Pro (~25 USD/mes)
  es lo correcto en cuanto haya un cliente pagando.
- **Dominio propio.** Falta comprarlo y definir `VITE_DOMINIO_BASE`.
  Sin eso los subdominios por organización no resuelven.
- **Registro abierto.** *Allow new users to sign up* está activado y
  el aula es por invitación. Decisión del dueño.

---

## 5. Antes de dar algo por terminado

- [ ] `npm run lint` — cero errores
- [ ] `npm run check` — cero dependencias rotas, cero columnas inexistentes
- [ ] `npm run build` — limpio
- [ ] Las pruebas de los módulos que tocaste
- [ ] **Si cambiaste la base**: regenerar `ESTRUCTURA.md`, y revisar
      si `ESQUEMA_BASE.sql` y `ESQUEMA_SEGURIDAD.sql` quedaron viejos
- [ ] `git diff` revisado línea a línea antes del commit (OneDrive)
- [ ] Decirle al dueño **qué SQL tiene que correr y en qué orden**, y
      qué debe comprobar él en pantalla

Y una costumbre que conviene mantener: **di lo que no hiciste**. Si
algo quedó a medias, o si el SQL no se pudo probar, dilo con esas
palabras. Este proyecto tuvo el alta de usuarios rota tres semanas
porque algo contestaba «listo» sin comprobarlo.
