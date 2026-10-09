# Estructura de la base de datos

Generado el 2026-10-09 leyendo el catálogo de Postgres.

## Por qué existe este archivo

El esquema base de esta plataforma —`cursos`, `acceso`, `perfiles`,
`modulos`, `recursos`— se creó a mano hace tiempo y **no está en ningún
script del repositorio**: los scripts de `supabase/` solo lo han ido
ampliando. Sin este archivo, la única copia de la forma de la base vive
dentro de Supabase.

Además sirve para lo inmediato: escribir una función que declara un tipo
distinto del que tiene la columna hace que falle entera, con un mensaje
que no dice cuál columna es. Aquí se comprueba antes.

No contiene **ningún dato**: solo nombres, tipos y restricciones.

## Trampas que ya han costado un error

- **`cursos.id`, `modulos.id`, `recursos.id`, `acceso.id` y
  `progreso_usuario.id` son `integer`**, no `bigint`. Casi todo lo
  añadido después (`tareas`, `generaciones`, `foro_hilos`…) usa `bigint`.
  Una función que declare `curso_id bigint` y devuelva `cursos.id` falla
  con *structure of query does not match function result type*.
- **`tareas.curso_id` es `bigint` pero apunta a `cursos.id`, que es
  `integer`.** Las comparaciones funcionan por conversión implícita; las
  declaraciones de tipo de retorno, no.
- **Booleanos que admiten nulo**: `modulos.activo`, `modulos.disponible`,
  `cursos.activo`, `examenes.activo`, `progreso_usuario.completado`.
  Tienen valor por omisión, pero una fila antigua puede traer nulo, así
  que conviene `coalesce(col, true)` en vez de `col = true`.

## Tablas


### `acceso`

Protección de filas: **activada** · políticas: 4

| Columna | Tipo | Obligatoria | Por omisión |
|---|---|---|---|
| `id` | `integer` | sí | `nextval('acceso_id_seq'::regclass)` |
| `usuario_id` | `uuid` | sí | — |
| `curso_id` | `integer` | sí | — |
| `created_at` | `timestamp with time zone` | — | `now()` |
| `grupo` | `text` | — | — |
| `generacion_id` | `bigint` | — | — |

### `admins`

Protección de filas: **activada** · políticas: 1

| Columna | Tipo | Obligatoria | Por omisión |
|---|---|---|---|
| `email` | `text` | sí | — |
| `created_at` | `timestamp with time zone` | — | `now()` |
| `organizacion_id` | `bigint` | — | — |

### `asistencia`

Protección de filas: **activada** · políticas: 2

| Columna | Tipo | Obligatoria | Por omisión |
|---|---|---|---|
| `id` | `bigint` | sí | `nextval('asistencia_id_seq'::regclass)` |
| `sesion_id` | `bigint` | sí | — |
| `usuario_id` | `uuid` | sí | — |
| `estado` | `text` | sí | `'presente'::text` |
| `justificada` | `boolean` | sí | `false` |
| `motivo` | `text` | — | — |
| `nota` | `text` | — | — |
| `registrado_por` | `text` | — | — |
| `registrado_en` | `timestamp with time zone` | sí | `now()` |

### `auditoria`

Protección de filas: **activada** · políticas: 1

| Columna | Tipo | Obligatoria | Por omisión |
|---|---|---|---|
| `id` | `bigint` | sí | `nextval('auditoria_id_seq'::regclass)` |
| `tabla` | `text` | sí | — |
| `registro_id` | `text` | — | — |
| `operacion` | `text` | sí | — |
| `autor_id` | `uuid` | — | — |
| `autor_email` | `text` | — | — |
| `antes` | `jsonb` | — | — |
| `despues` | `jsonb` | — | — |
| `cambios` | `text[]` | — | — |
| `creado_en` | `timestamp with time zone` | sí | `now()` |

### `banco_preguntas`

Protección de filas: **activada** · políticas: 4

| Columna | Tipo | Obligatoria | Por omisión |
|---|---|---|---|
| `id` | `bigint` | sí | `nextval('banco_preguntas_id_seq'::regclass)` |
| `organizacion_id` | `bigint` | sí | — |
| `tema` | `text` | — | — |
| `tipo` | `text` | sí | — |
| `pregunta` | `text` | sí | — |
| `contenido` | `jsonb` | sí | `'{}'::jsonb` |
| `dificultad` | `integer` | — | — |
| `creado_por` | `text` | — | — |
| `creado_en` | `timestamp with time zone` | sí | `now()` |
| `actualizado_en` | `timestamp with time zone` | sí | `now()` |
| `activa` | `boolean` | sí | `true` |

### `categorias`

Protección de filas: **activada** · políticas: 4

| Columna | Tipo | Obligatoria | Por omisión |
|---|---|---|---|
| `id` | `bigint` | sí | `nextval('categorias_id_seq'::regclass)` |
| `nombre` | `text` | sí | — |
| `descripcion` | `text` | — | — |
| `motivo` | `text` | — | — |
| `orden` | `integer` | sí | `100` |
| `activa` | `boolean` | sí | `true` |
| `creado_en` | `timestamp with time zone` | sí | `now()` |
| `organizacion_id` | `bigint` | — | — |

### `constancias`

Protección de filas: **activada** · políticas: 2

| Columna | Tipo | Obligatoria | Por omisión |
|---|---|---|---|
| `id` | `bigint` | sí | `nextval('constancias_id_seq'::regclass)` |
| `usuario_id` | `uuid` | sí | — |
| `curso_id` | `bigint` | sí | — |
| `folio` | `text` | sí | — |
| `nombre_completo` | `text` | sí | — |
| `profesion` | `text` | — | — |
| `fecha_emision` | `timestamp with time zone` | sí | `now()` |

### `cursos`

Protección de filas: **activada** · políticas: 3

| Columna | Tipo | Obligatoria | Por omisión |
|---|---|---|---|
| `id` | `integer` | sí | `nextval('cursos_id_seq'::regclass)` |
| `titulo` | `text` | sí | — |
| `descripcion` | `text` | — | — |
| `imagen_portada` | `text` | — | — |
| `orden` | `integer` | — | `0` |
| `activo` | `boolean` | — | `true` |
| `created_at` | `timestamp with time zone` | — | `now()` |
| `gratuito` | `boolean` | — | `false` |
| `info_curso` | `text` | — | — |
| `proximamente` | `boolean` | — | `false` |
| `caratula` | `text` | — | — |
| `linea` | `text` | — | — |
| `link_sesion_vivo` | `text` | — | — |
| `link_grabacion` | `text` | — | — |
| `fecha_sesion` | `text` | — | — |
| `constancia` | `boolean` | — | `true` |
| `fecha_inicio` | `timestamp with time zone` | — | — |
| `fecha_fin` | `timestamp with time zone` | — | — |
| `link_materiales` | `text` | — | — |
| `sesion_vivo_activo` | `boolean` | sí | `true` |
| `sesion_vivo_texto` | `text` | — | — |
| `grabacion_activo` | `boolean` | sí | `true` |
| `grabacion_texto` | `text` | — | — |
| `rutas_botones` | `jsonb` | sí | `'{}'::jsonb` |
| `botones_extra` | `jsonb` | — | `'[]'::jsonb` |
| `link_registro` | `text` | — | — |
| `registro_texto` | `text` | — | — |
| `registro_activo` | `boolean` | — | `true` |
| `grabacion_activa` | `boolean` | — | `false` |
| `materiales_texto` | `text` | — | — |
| `materiales_activo` | `boolean` | — | `false` |
| `proxima_sesion` | `text` | — | — |
| `categoria_id` | `bigint` | — | — |
| `organizacion_id` | `bigint` | — | — |
| `ponderacion` | `jsonb` | — | — |

### `entregas`

Protección de filas: **activada** · políticas: 4

| Columna | Tipo | Obligatoria | Por omisión |
|---|---|---|---|
| `id` | `bigint` | sí | `nextval('entregas_id_seq'::regclass)` |
| `tarea_id` | `bigint` | sí | — |
| `usuario_id` | `uuid` | sí | — |
| `archivo_path` | `text` | — | — |
| `archivo_nombre` | `text` | — | — |
| `comentario` | `text` | — | — |
| `entregado_en` | `timestamp with time zone` | sí | `now()` |
| `calificacion` | `numeric` | — | — |
| `retroalimentacion` | `text` | — | — |
| `rubrica_detalle` | `jsonb` | — | — |
| `calificado_por` | `uuid` | — | — |
| `calificado_en` | `timestamp with time zone` | — | — |

### `examenes`

Protección de filas: **activada** · políticas: 5

| Columna | Tipo | Obligatoria | Por omisión |
|---|---|---|---|
| `id` | `bigint` | sí | — |
| `modulo_id` | `bigint` | — | — |
| `titulo` | `text` | sí | — |
| `descripcion` | `text` | — | — |
| `umbral_aprobacion` | `integer` | — | `70` |
| `preguntas` | `jsonb` | sí | `'[]'::jsonb` |
| `activo` | `boolean` | — | `true` |
| `created_at` | `timestamp with time zone` | — | `now()` |
| `curso_id` | `bigint` | — | — |
| `max_intentos` | `integer` | sí | `3` |
| `fecha_limite` | `timestamp with time zone` | — | — |
| `cierra_al_vencer` | `boolean` | sí | `true` |
| `aleatorio_n` | `integer` | — | — |
| `mezclar_opciones` | `boolean` | sí | `false` |

### `facilitadores`

Protección de filas: **activada** · políticas: 4

| Columna | Tipo | Obligatoria | Por omisión |
|---|---|---|---|
| `id` | `bigint` | sí | `nextval('facilitadores_id_seq'::regclass)` |
| `email` | `text` | sí | — |
| `curso_id` | `bigint` | — | — |
| `creado_en` | `timestamp with time zone` | sí | `now()` |
| `categoria_id` | `bigint` | — | — |

### `foro_hilos`

Protección de filas: **activada** · políticas: 4

| Columna | Tipo | Obligatoria | Por omisión |
|---|---|---|---|
| `id` | `bigint` | sí | `nextval('foro_hilos_id_seq'::regclass)` |
| `curso_id` | `bigint` | sí | — |
| `autor_id` | `uuid` | sí | — |
| `autor_nombre` | `text` | sí | — |
| `autor_email` | `text` | sí | — |
| `titulo` | `text` | sí | — |
| `cuerpo` | `text` | sí | `''::text` |
| `fijado` | `boolean` | sí | `false` |
| `cerrado` | `boolean` | sí | `false` |
| `creado_en` | `timestamp with time zone` | sí | `now()` |
| `actualizado_en` | `timestamp with time zone` | sí | `now()` |
| `califica` | `boolean` | sí | `false` |
| `puntos_max` | `numeric` | sí | `10` |
| `fecha_limite` | `timestamp with time zone` | — | — |
| `cierra_al_vencer` | `boolean` | sí | `true` |

### `foro_respuestas`

Protección de filas: **activada** · políticas: 4

| Columna | Tipo | Obligatoria | Por omisión |
|---|---|---|---|
| `id` | `bigint` | sí | `nextval('foro_respuestas_id_seq'::regclass)` |
| `hilo_id` | `bigint` | sí | — |
| `autor_id` | `uuid` | sí | — |
| `autor_nombre` | `text` | sí | — |
| `autor_email` | `text` | sí | — |
| `cuerpo` | `text` | sí | — |
| `editado` | `boolean` | sí | `false` |
| `borrada` | `boolean` | sí | `false` |
| `creado_en` | `timestamp with time zone` | sí | `now()` |
| `calificacion` | `numeric` | — | — |
| `calificado_por` | `uuid` | — | — |
| `calificado_en` | `timestamp with time zone` | — | — |
| `responde_a` | `bigint` | — | — |

### `generaciones`

Protección de filas: **activada** · políticas: 4

| Columna | Tipo | Obligatoria | Por omisión |
|---|---|---|---|
| `id` | `bigint` | sí | `nextval('generaciones_id_seq'::regclass)` |
| `curso_id` | `bigint` | sí | — |
| `nombre` | `text` | sí | — |
| `fecha_inicio` | `date` | — | — |
| `fecha_fin` | `date` | — | — |
| `cupo` | `integer` | — | — |
| `activa` | `boolean` | sí | `true` |
| `creado_en` | `timestamp with time zone` | sí | `now()` |
| `sede_id` | `bigint` | — | — |
| `modalidad` | `text` | sí | `'linea'::text` |

### `intentos_examen`

Protección de filas: **activada** · políticas: 3

| Columna | Tipo | Obligatoria | Por omisión |
|---|---|---|---|
| `id` | `bigint` | sí | — |
| `usuario_id` | `uuid` | — | — |
| `examen_id` | `bigint` | — | — |
| `respuestas` | `jsonb` | sí | — |
| `calificacion` | `integer` | sí | — |
| `aprobado` | `boolean` | sí | — |
| `fecha` | `timestamp with time zone` | — | `now()` |
| `preguntas` | `jsonb` | — | — |
| `pendiente` | `boolean` | sí | `false` |

### `leads_talleres`

Protección de filas: **activada** · políticas: 2

| Columna | Tipo | Obligatoria | Por omisión |
|---|---|---|---|
| `id` | `bigint` | sí | — |
| `curso_id` | `integer` | — | — |
| `email` | `text` | sí | — |
| `creado_en` | `timestamp with time zone` | sí | `now()` |

### `mensajes`

Protección de filas: **activada** · políticas: 3

| Columna | Tipo | Obligatoria | Por omisión |
|---|---|---|---|
| `id` | `bigint` | sí | `nextval('mensajes_id_seq'::regclass)` |
| `de_id` | `uuid` | sí | — |
| `para_id` | `uuid` | sí | — |
| `contenido` | `text` | sí | — |
| `leido` | `boolean` | — | `false` |
| `created_at` | `timestamp with time zone` | — | `now()` |
| `adjunto_url` | `text` | — | — |
| `adjunto_nombre` | `text` | — | — |
| `adjunto_tipo` | `text` | — | — |

### `modulos`

Protección de filas: **activada** · políticas: 6

| Columna | Tipo | Obligatoria | Por omisión |
|---|---|---|---|
| `id` | `integer` | sí | `nextval('modulos_id_seq'::regclass)` |
| `curso_id` | `integer` | — | — |
| `titulo` | `text` | sí | — |
| `descripcion` | `text` | — | — |
| `orden` | `integer` | — | `0` |
| `activo` | `boolean` | — | `true` |
| `created_at` | `timestamp with time zone` | — | `now()` |
| `grupo` | `text` | — | — |
| `disponible` | `boolean` | — | `true` |
| `botones_extra` | `jsonb` | sí | `'[]'::jsonb` |

### `organizaciones`

Protección de filas: **activada** · políticas: 4

| Columna | Tipo | Obligatoria | Por omisión |
|---|---|---|---|
| `id` | `bigint` | sí | `nextval('organizaciones_id_seq'::regclass)` |
| `slug` | `text` | sí | — |
| `nombre` | `text` | sí | — |
| `dominio` | `text` | — | — |
| `logo_url` | `text` | — | — |
| `color_primario` | `text` | — | — |
| `color_acento` | `text` | — | — |
| `contacto_email` | `text` | — | — |
| `activa` | `boolean` | sí | `true` |
| `creado_en` | `timestamp with time zone` | sí | `now()` |
| `plan_id` | `bigint` | — | — |
| `estado_suscripcion` | `text` | sí | `'prueba'::text` |
| `periodo` | `text` | sí | `'mensual'::text` |
| `precio_acordado` | `numeric(10,2)` | — | — |
| `vence_en` | `date` | — | — |
| `max_alumnos` | `integer` | — | — |
| `max_cursos` | `integer` | — | — |
| `max_facilitadores` | `integer` | — | — |
| `exenta_de_limites` | `boolean` | sí | `false` |
| `notas_comerciales` | `text` | — | — |

### `pagos_suscripcion`

Protección de filas: **activada** · políticas: 2

| Columna | Tipo | Obligatoria | Por omisión |
|---|---|---|---|
| `id` | `bigint` | sí | `nextval('pagos_suscripcion_id_seq'::regclass)` |
| `organizacion_id` | `bigint` | sí | — |
| `monto` | `numeric(10,2)` | sí | — |
| `moneda` | `text` | sí | `'MXN'::text` |
| `pagado_en` | `date` | sí | `CURRENT_DATE` |
| `periodo_desde` | `date` | — | — |
| `periodo_hasta` | `date` | — | — |
| `metodo` | `text` | — | — |
| `referencia` | `text` | — | — |
| `nota` | `text` | — | — |
| `registrado_por` | `text` | — | — |
| `creado_en` | `timestamp with time zone` | sí | `now()` |

### `perfiles`

Protección de filas: **activada** · políticas: 5

| Columna | Tipo | Obligatoria | Por omisión |
|---|---|---|---|
| `id` | `uuid` | sí | — |
| `nombre_completo` | `text` | — | — |
| `profesion` | `text` | — | — |
| `updated_at` | `timestamp with time zone` | — | `now()` |
| `descripcion` | `text` | — | — |
| `ubicacion` | `text` | — | — |
| `avatar_url` | `text` | — | — |
| `notas_admin` | `text` | — | — |

### `planes`

Protección de filas: **activada** · políticas: 4

| Columna | Tipo | Obligatoria | Por omisión |
|---|---|---|---|
| `id` | `bigint` | sí | `nextval('planes_id_seq'::regclass)` |
| `clave` | `text` | sí | — |
| `nombre` | `text` | sí | — |
| `descripcion` | `text` | — | — |
| `precio_mensual` | `numeric(10,2)` | — | — |
| `precio_anual` | `numeric(10,2)` | — | — |
| `max_alumnos` | `integer` | — | — |
| `max_cursos` | `integer` | — | — |
| `max_facilitadores` | `integer` | — | — |
| `max_almacenamiento_gb` | `integer` | — | — |
| `orden` | `integer` | sí | `0` |
| `activo` | `boolean` | sí | `true` |
| `creado_en` | `timestamp with time zone` | sí | `now()` |

### `progreso_usuario`

Protección de filas: **activada** · políticas: 3

| Columna | Tipo | Obligatoria | Por omisión |
|---|---|---|---|
| `id` | `integer` | sí | `nextval('progreso_usuario_id_seq'::regclass)` |
| `usuario_id` | `uuid` | — | — |
| `recurso_id` | `integer` | — | — |
| `completado` | `boolean` | — | `false` |
| `intentos` | `integer` | — | `0` |
| `ultimo_acceso` | `timestamp with time zone` | — | `now()` |

### `prorrogas`

Protección de filas: **activada** · políticas: 4

| Columna | Tipo | Obligatoria | Por omisión |
|---|---|---|---|
| `id` | `bigint` | sí | `nextval('prorrogas_id_seq'::regclass)` |
| `tipo` | `text` | sí | — |
| `actividad_id` | `bigint` | sí | — |
| `usuario_id` | `uuid` | — | — |
| `generacion_id` | `bigint` | — | — |
| `nueva_fecha` | `timestamp with time zone` | sí | — |
| `motivo` | `text` | — | — |
| `creado_por` | `text` | — | — |
| `creado_en` | `timestamp with time zone` | sí | `now()` |

### `recursos`

Protección de filas: **activada** · políticas: 5

| Columna | Tipo | Obligatoria | Por omisión |
|---|---|---|---|
| `id` | `integer` | sí | `nextval('recursos_id_seq'::regclass)` |
| `modulo_id` | `integer` | — | — |
| `tipo` | `text` | sí | — |
| `titulo` | `text` | sí | — |
| `descripcion` | `text` | — | — |
| `archivo` | `text` | — | — |
| `url` | `text` | — | — |
| `contenido` | `text` | — | — |
| `orden` | `integer` | — | `0` |
| `created_at` | `timestamp with time zone` | — | `now()` |
| `disponible` | `boolean` | sí | `true` |

### `rubrica_criterios`

Protección de filas: **activada** · políticas: 2

| Columna | Tipo | Obligatoria | Por omisión |
|---|---|---|---|
| `id` | `bigint` | sí | `nextval('rubrica_criterios_id_seq'::regclass)` |
| `tarea_id` | `bigint` | sí | — |
| `titulo` | `text` | sí | — |
| `descripcion` | `text` | — | — |
| `peso` | `numeric` | sí | `0` |
| `niveles` | `jsonb` | sí | `'[]'::jsonb` |
| `orden` | `integer` | sí | `100` |

### `sedes`

Protección de filas: **activada** · políticas: 2

| Columna | Tipo | Obligatoria | Por omisión |
|---|---|---|---|
| `id` | `bigint` | sí | `nextval('sedes_id_seq'::regclass)` |
| `organizacion_id` | `bigint` | sí | — |
| `nombre` | `text` | sí | — |
| `ciudad` | `text` | — | — |
| `direccion` | `text` | — | — |
| `responsable` | `text` | — | — |
| `activa` | `boolean` | sí | `true` |
| `creado_en` | `timestamp with time zone` | sí | `now()` |

### `sesiones`

Protección de filas: **activada** · políticas: 2

| Columna | Tipo | Obligatoria | Por omisión |
|---|---|---|---|
| `id` | `bigint` | sí | `nextval('sesiones_id_seq'::regclass)` |
| `generacion_id` | `bigint` | sí | — |
| `modulo_id` | `bigint` | — | — |
| `titulo` | `text` | — | — |
| `fecha` | `date` | sí | — |
| `hora_inicio` | `time without time zone` | — | — |
| `hora_fin` | `time without time zone` | — | — |
| `lugar` | `text` | — | — |
| `impartida_por` | `text` | — | — |
| `notas` | `text` | — | — |
| `cancelada` | `boolean` | sí | `false` |
| `creado_en` | `timestamp with time zone` | sí | `now()` |

### `tareas`

Protección de filas: **activada** · políticas: 4

| Columna | Tipo | Obligatoria | Por omisión |
|---|---|---|---|
| `id` | `bigint` | sí | `nextval('tareas_id_seq'::regclass)` |
| `curso_id` | `bigint` | — | — |
| `modulo_id` | `bigint` | — | — |
| `grupo` | `text` | — | — |
| `titulo` | `text` | sí | — |
| `instrucciones` | `text` | — | — |
| `fecha_limite` | `timestamp with time zone` | — | — |
| `puntos_max` | `numeric` | sí | `100` |
| `permite_reentrega` | `boolean` | sí | `true` |
| `activo` | `boolean` | sí | `true` |
| `creado_en` | `timestamp with time zone` | sí | `now()` |
| `cierra_al_vencer` | `boolean` | sí | `true` |

## Funciones

| Función | Argumentos | Devuelve | security definer |
|---|---|---|---|
| `alumnos_de_curso` | `p_curso_id bigint` | `TABLE(email text, nombre_completo text)` | sí |
| `asistencia_de_generacion` | `p_generacion bigint` | `TABLE(usuario_id uuid, sesiones integer, presentes integer, retardos integer, ausencias integer, justificadas integer, porcentaje numeric)` | sí |
| `bulk_grant_course_access` | `user_ids uuid[], target_course_id integer` | `void` | sí |
| `bulk_remove_course_access` | `user_ids uuid[], target_course_id integer` | `void` | sí |
| `completo_el_curso` | `p_usuario uuid, p_curso bigint` | `boolean` | sí |
| `consumo_organizaciones` | `` | `TABLE(organizacion_id bigint, alumnos integer, cursos integer, facilitadores integer)` | sí |
| `correo_de` | `p_usuario uuid` | `text` | sí |
| `curso_de_actividad` | `p_tipo text, p_id bigint` | `bigint` | sí |
| `curso_de_sesion` | `p_sesion bigint` | `bigint` | sí |
| `curso_de_tarea` | `p_tarea bigint` | `bigint` | sí |
| `curso_del_examen` | `p_curso bigint, p_modulo bigint` | `bigint` | sí |
| `curso_del_modulo` | `p_modulo bigint` | `bigint` | sí |
| `duplicar_curso` | `p_curso bigint, p_titulo text` | `bigint` | sí |
| `emitir_constancia` | `p_curso bigint` | `text` | sí |
| `entregar_examen` | `p_intento bigint, p_respuestas jsonb` | `jsonb` | sí |
| `es_admin` | `` | `boolean` | sí |
| `es_admin_de` | `p_org bigint` | `boolean` | sí |
| `es_alumno_de_org_que_administro` | `p_usuario uuid` | `boolean` | sí |
| `es_alumno_mio` | `p_usuario uuid` | `boolean` | sí |
| `es_correcta_examen` | `p jsonb, r jsonb` | `boolean` | — |
| `es_facilitador` | `` | `boolean` | sí |
| `es_facilitador_de_org` | `p_org bigint` | `boolean` | sí |
| `fecha_limite_efectiva` | `p_tipo text, p_id bigint, p_usuario uuid` | `timestamp with time zone` | sí |
| `get_admin_id` | `` | `uuid` | sí |
| `inscritos_en_generacion` | `p_gen bigint` | `integer` | sí |
| `limites_organizacion` | `p_org bigint` | `TABLE(max_alumnos integer, max_facilitadores integer, max_cursos integer, exenta boolean)` | sí |
| `limpiar_pregunta` | `p jsonb` | `jsonb` | — |
| `listar_usuarios_con_accesos` | `` | `TABLE(usuario_id uuid, email text, nombre_completo text, profesion text, notas_admin text, cursos_inscritos bigint, ultimo_ingreso timestamp with time zone)` | sí |
| `mover_hilo_al_responder` | `` | `trigger` | sí |
| `obtener_usuario_por_email` | `p_email text` | `uuid` | sí |
| `promedio_foro` | `p_hilo bigint, p_usuario uuid` | `numeric` | sí |
| `proteger_calificacion_foro` | `` | `trigger` | sí |
| `proteger_contrato_organizacion` | `` | `trigger` | sí |
| `puede_entregar` | `p_tipo text, p_id bigint, p_usuario uuid` | `boolean` | sí |
| `puede_escribir_a` | `p_destino uuid` | `boolean` | sí |
| `puede_gestionar_curso` | `p_curso bigint` | `boolean` | sí |
| `registrar_auditoria` | `` | `trigger` | sí |
| `registrar_pago` | `p_org bigint, p_monto numeric, p_meses integer, p_metodo text, p_referencia text, p_nota text` | `date` | sí |
| `rls_auto_enable` | `` | `event_trigger` | sí |
| `servir_examen` | `p_examen bigint` | `jsonb` | sí |
| `tablero_cursos` | `p_org bigint` | `TABLE(curso_id bigint, titulo text, alumnos integer, avance_medio numeric, terminados integer, por_calificar integer, constancias integer, ultima_actividad timestamp with time zone)` | sí |
| `tablero_organizacion` | `p_org bigint` | `TABLE(alumnos integer, alumnos_activos integer, inscripciones integer, cursos integer, facilitadores integer, generaciones integer, por_calificar integer, constancias integer, avance_medio numeric)` | sí |
| `tiene_acceso_al_curso` | `p_curso bigint` | `boolean` | sí |
| `tocar_banco_pregunta` | `` | `trigger` | — |
| `usuario_id_por_correo` | `p_email text` | `uuid` | sí |
| `validar_rama_foro` | `` | `trigger` | sí |
| `verificar_constancia` | `p_folio text` | `TABLE(folio text, nombre_completo text, profesion text, curso_titulo text, fecha_emision timestamp with time zone)` | sí |
| `verificar_limite_alumnos` | `` | `trigger` | sí |
| `verificar_limite_cursos` | `` | `trigger` | sí |
| `verificar_limite_facilitadores` | `` | `trigger` | sí |
| `verificar_plazo_entrega` | `` | `trigger` | sí |
| `verificar_plazo_examen` | `` | `trigger` | sí |
| `verificar_plazo_foro` | `` | `trigger` | sí |

## Disparadores

| Tabla | Disparador |
|---|---|
| `acceso` | `acceso_limite_alumnos` |
| `acceso` | `auditar_acceso` |
| `banco_preguntas` | `banco_preguntas_tocar` |
| `categorias` | `auditar_categorias` |
| `constancias` | `auditar_constancias` |
| `cursos` | `auditar_cursos` |
| `cursos` | `cursos_limite` |
| `entregas` | `entregas_plazo` |
| `examenes` | `auditar_examenes` |
| `facilitadores` | `auditar_facilitadores` |
| `facilitadores` | `facilitadores_limite` |
| `foro_hilos` | `auditar_foro_hilos` |
| `foro_respuestas` | `foro_plazo` |
| `foro_respuestas` | `mover_hilo` |
| `foro_respuestas` | `proteger_calificacion` |
| `foro_respuestas` | `validar_rama` |
| `generaciones` | `auditar_generaciones` |
| `intentos_examen` | `intentos_plazo` |
| `modulos` | `auditar_modulos` |
| `organizaciones` | `organizaciones_protege_contrato` |
| `recursos` | `auditar_recursos` |
| `rubrica_criterios` | `auditar_rubrica_criterios` |
| `tareas` | `auditar_tareas` |
