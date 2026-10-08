# Configuración de Supabase

Lo que **no** vive en la base de datos y por tanto no sale en
`ESQUEMA_BASE.sql` ni en `ESQUEMA_SEGURIDAD.sql`: almacenamiento,
autenticación y funciones del servidor. Si hubiera que levantar el
proyecto de nuevo, esto es lo que habría que reconstruir a mano.

Anotado el 2026-10-08. **No contiene ninguna clave.**

---

## Almacenamiento (Storage)

| Bucket | Acceso | Políticas | Qué guarda |
|---|---|---|---|
| `entregas` | privado | 4 | Lo que suben los alumnos en las tareas |
| `chat_adjuntos` | **público** | 3 | Adjuntos de los mensajes internos |
| `talleres` | público | 0 | Material de los talleres gratuitos |
| `avatares` | público | 4 | Fotos de perfil |
| `curso_duelo` | privado | 1 | Material del curso de duelo |

Límite de tamaño: 50 MB por archivo en todos. Tipos permitidos: cualquiera.

### Qué significa «público»

Un bucket público sirve sus archivos a **cualquiera que tenga la
dirección**, sin sesión y sin pasar por ninguna política. Es lo
correcto para avatares y material de talleres gratuitos: están
pensados para verse.

**`chat_adjuntos` siendo público merece una decisión**, no un
descuido. Ahí van los archivos que se adjuntan en los mensajes
privados entre tú y tus alumnos. Las direcciones son difíciles de
adivinar, pero quedan guardadas en la base y en el historial del
navegador, y una que se filtre abre el archivo a quien sea. Para
material clínico o personal, eso no es lo que se espera de un
«mensaje privado».

Cambiarlo a privado exige que la aplicación pida direcciones firmadas
—como ya hace con `entregas`—; no es solo mover el interruptor.

---

## Autenticación

| Opción | Estado | Comentario |
|---|---|---|
| Allow new users to sign up | **activado** | Cualquiera puede crearse una cuenta |
| Allow manual linking | desactivado | |
| Allow anonymous sign-ins | desactivado | |
| **Confirm email** | **activado** | Clave: ver abajo |
| Proveedor Email | habilitado | |

### Confirm email

Con esto activado, una cuenta recién creada **no puede iniciar sesión
hasta confirmar su correo**. Por eso la función del servidor crea
siempre con `email_confirm: true`: tú ya sabes de quién es ese correo,
y sin esa marca la persona recibiría «credenciales incorrectas» aunque
su contraseña fuera perfecta.

Si algún día se quita ese `email_confirm` del código, el alta volverá a
romperse de la misma forma y por la misma razón.

### Allow new users to sign up

Está activado, y conviene que sea a propósito. Tu aula es por
invitación: la pantalla de acceso dice «ingresa con el usuario y
contraseña que te compartí». Con el registro abierto, cualquiera puede
crearse una cuenta.

No podrá ver ningún curso —eso lo decide la tabla `acceso`, no el tener
cuenta—, pero sí aparecerá en tu lista de usuarios y consumirá el
espacio de cuentas. Si no lo necesitas para nada, apagarlo quita una
puerta que no usas.

---

## Funciones del servidor (Edge Functions)

| Función | Estado |
|---|---|
| `crear-usuarios` | **en uso** · código en `supabase/functions/crear-usuarios/` |
| `crear-usuario` | obsoleta · la reemplazó `crear-usuarios` |
| `crear-usuarios-bulk` | obsoleta · la reemplazó `crear-usuarios` |
| `bright-handler` | plantilla de ejemplo de Supabase, nunca se usó |

Las tres obsoletas se pueden borrar. `bright-handler` es el «Hello
World» que Supabase crea de muestra; las otras dos dejaron de
llamarse desde que la aplicación apunta a `crear-usuarios`.

Conviene borrarlas en vez de dejarlas: siguen desplegadas y
accesibles, y la de alta masiva antigua todavía crea cuentas si
alguien da con su dirección.

---

## Respaldos de la base

**El plan gratuito de Supabase no incluye ninguno.** Confirmado en
Database → Backups: *«Free Plan does not include project backups»*.

Esto es lo más delicado de todo este archivo. Ahora mismo la única
copia de los datos de tus alumnos —nombres, correos, progreso,
calificaciones, entregas— es la base en vivo. Un borrado accidental no
tiene vuelta atrás.

Dos salidas:

1. **Plan Pro** (~25 USD/mes): respaldos diarios con 7 días de
   historial y restauración a un punto en el tiempo. Es lo que
   corresponde en cuanto tengas un cliente pagando: ofrecerle alojar
   su aula sin respaldos es prometer algo que no puedes sostener.

2. **Exportar a mano**, con disciplina: Panel → Organizaciones →
   ⬇️ Datos, una vez al mes, guardando el paquete **fuera de
   OneDrive** (una carpeta sincronizada no es un respaldo: si se borra
   algo, se borra en los dos sitios). Es gratis y cubre lo esencial,
   pero depende de que te acuerdes.

---

## Qué habría que hacer para levantar el proyecto de cero

1. Proyecto nuevo de Supabase.
2. `ESQUEMA_BASE.sql` → tablas, claves, índices.
3. `ESQUEMA_SEGURIDAD.sql` → funciones, políticas, disparadores.
4. Crear los buckets de la tabla de arriba con su mismo acceso.
5. Auth: dejar **Confirm email** como está aquí.
6. Desplegar `crear-usuarios` desde `supabase/functions/`.
7. Variables del despliegue en GitHub → Settings → Secrets:
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
   `CLOUDFLARE_API_TOKEN`. (Los valores no están aquí a propósito.)
8. Restaurar los datos desde el paquete de exportación más reciente.
