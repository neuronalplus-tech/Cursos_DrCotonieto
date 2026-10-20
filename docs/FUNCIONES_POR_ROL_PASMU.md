# PASMU — Qué puede ver y qué puede gestionar cada rol

**Documento generado desde la aplicación** (`pasmu/web/scripts/generar-funciones-por-rol.mjs`): cada elemento de las listas es una
pantalla a la que el rol sí llega, comprobada por pruebas automáticas. Vuelve a generarlo después de cambiar permisos o pantallas.

## Cómo leerlo

- **Ver**: consulta, sin modificar.
- **Gestionar**: registrar, editar o decidir.
- La ruta indica dónde está en la aplicación (se llega desde el Panel de gestión o el Panel de indicadores).

## Dirección PASMU

Define metas, indicadores, dependencias y reglas; pide seguimiento; no atiende personas ni asigna terapeutas.

Perfiles de la demostración: **Dirección PASMU**.

### Qué puede ver

- **Indicadores de todos los institutos** (`/indicadores`): Asistencia, espera, primer contacto, cobertura de tamizaje, revisión, talleres y los indicadores que se agreguen, con meta y semáforo; global, por instituto o por persona terapeuta (solo agregados).
- **Alertas con responsable y plazo** (`/indicadores`): Personas sin asignar o con mucha espera, riesgo en espera, notas sin firmar, incidentes sin atender; cada alerta sube de nivel si nadie la atiende.
- **Lista de espera priorizada (solo lectura)** (`/casos`): Quién espera, con qué riesgo y cuántos días, sin contenido clínico.
- **Incidentes críticos (solo lectura)** (`/incidentes`): Qué incidentes hay, en qué estado y si escalaron; no los atiende.
- **Personal y credenciales** (`/personal`): Directorio por instituto con cédula, seguro y constancia, y sus vencimientos.
- **Calendario** (`/calendario`): Actividades globales y de cada instituto.
- **Auditoría** (`/seguridad`): Consultas a expedientes, incidentes, consentimientos, correos y credenciales.

### Qué puede gestionar

- **Metas, fases y línea base** (`/indicadores`): Fija cada meta con motivo; queda el historial de fechas, valores anteriores y quién los cambió (al final del panel de indicadores).
- **Dependencias y unidades** (`/admin`): Da de alta dependencias y unidades de atención psicológica y elige los indicadores con que se miden, de todo el catálogo vigente ese día.
- **Catálogo de indicadores** (`/admin`): Agrega indicadores de captura manual que quedan disponibles para toda unidad nueva y para activarlos en las existentes.
- **Altas de responsables, coordinación y supervisión** (`/altas`): Con las facultades recomendadas de cada rol, ajustables por unidad.
- **Facultades y visto bueno** (`/admin`): Ajusta lo que puede hacer cada persona y decide si las altas y cambios de rol de cada responsable llevan su visto bueno, por plazo en el puesto o persona por persona.
- **Solicitudes de seguimiento** (`/seguimientos`): Pide a la unidad que dé seguimiento a un caso y lee el motivo por el que no avanza.
- **Actividades globales y hoja membretada global** (`/calendario`): Publica actividades para todos los grupos y carga la hoja de los documentos.
- **Correos** (`/comunicaciones`): A todo el personal o a un instituto, con bitácora.
- **Mi perfil** (`/perfil`): Edita su contacto y su horario; cambia su contraseña desde el correo.

### Qué no puede hacer

- Asignar terapeutas o canalizar a talleres
- Valorar el riesgo ni evaluar a personas
- Ver el contenido clínico de los expedientes
- Atender o cerrar incidentes

### Herramientas de su Panel de gestión (13)

Personas usuarias y expedientes · Solicitudes y asignación · Solicitudes de seguimiento · Agenda y citas · Calendario · Pase de sesión · Incidentes críticos · Auditoría y seguridad · Personal y credenciales · Altas · Correos y avisos · Mensajes internos · Configuración de la plataforma

Permisos recomendados: 22 (los ajusta Dirección por persona al darla de alta).

## Responsable de unidad

Administra su instituto: asigna, canaliza a talleres, da de alta a su equipo y responde las solicitudes de seguimiento.

Perfiles de la demostración: **Responsable ICSA**, **Responsable ICBI 1**, **Responsable ICBI 2**, **Responsable ICEA**.

### Qué puede ver

- **Indicadores de su instituto** (`/indicadores`): Los indicadores que Dirección activó para su unidad, con semáforo, alertas y carga por terapeuta.
- **Personas usuarias y expedientes de su instituto** (`/gestion/personas`): Ruta de atención, historia, notas, seguridad, resultados y revisiones.
- **Historial de metas** (`/indicadores`): Cómo han cambiado las metas que le aplican.

### Qué puede gestionar

- **Lista de espera: valorar, asignar y canalizar** (`/casos`): Valora el riesgo en cada contacto, asigna a una persona terapeuta acreditada o canaliza a un taller cuando el riesgo es bajo o moderado.
- **Responder solicitudes de seguimiento** (`/seguimientos`): Explica a Dirección por qué un caso no avanza (horarios, espacios, saturación…) y cuándo será la siguiente acción.
- **Altas de su equipo** (`/altas`): Personal clínico-administrativo, prácticas, talleristas y terapeutas, de una en una o por lista; con visto bueno de Dirección si se exige.
- **Facultades de su equipo** (`/admin`): Ajusta lo que puede hacer cada persona de su instituto.
- **Reglas de la unidad y hoja membretada** (`/admin`): Quién lleva la agenda, muestreo de revisión, plazo de firma y hoja de la unidad.
- **Captura de indicadores manuales** (`/indicadores`): Registra cada mes los indicadores que la unidad mide a mano.
- **Incidentes, derivaciones, prácticas y credenciales** (`/incidentes`): Atiende incidentes, da seguimiento a derivaciones, firma horas y verifica cédulas de su instituto.
- **Talleres, calendario y correos** (`/talleres`): Cupo y asistencia de talleres, actividades del instituto y avisos al equipo o a las personas usuarias que autorizaron el correo.
- **Mi perfil** (`/perfil`): Edita su contacto y su horario; cambia su contraseña desde el correo.

### Qué no puede hacer

- Cambiar metas o fases
- Dar de alta a otras personas responsables
- Ver otros institutos

### Herramientas de su Panel de gestión (17)

Personas usuarias y expedientes · Solicitudes y asignación · Solicitudes de seguimiento · Interconsultas y derivaciones · Banco de recursos · Agenda y citas · Calendario · Pase de sesión · Talleres · Revisión de expedientes · Incidentes críticos · Prácticas y servicio social · Personal y credenciales · Altas · Correos y avisos · Mensajes internos · Configuración de la plataforma

Permisos recomendados: 31 (los ajusta Dirección por persona al darla de alta).

## Coordinación clínica

Coordina la atención: lista de espera, asignaciones, revisión de contenido, incidentes y derivaciones.

Perfiles de la demostración: **Coordinación clínica**.

### Qué puede ver

- **Indicadores operativos** (`/indicadores`): Espera, pases pendientes, cancelación y carga por terapeuta.
- **Expedientes y revisiones** (`/gestion/personas`): Contenido clínico para revisar notas, historia y familiograma.

### Qué puede gestionar

- **Lista de espera** (`/casos`): Valora riesgo, asigna, traspasa y canaliza a talleres.
- **Revisión de contenido** (`/revision`): Checklist de cumplimiento con comentario breve.
- **Incidentes y derivaciones** (`/incidentes`): Acuse, acciones y seguimiento.
- **Seguimientos, talleres, correos y prácticas** (`/seguimientos`): Responde solicitudes de Dirección, gestiona talleres y horas de prácticas.
- **Mi perfil** (`/perfil`): Edita su contacto y su horario; cambia su contraseña desde el correo.

### Qué no puede hacer

- Definir metas
- Dar de alta personal

### Herramientas de su Panel de gestión (15)

Personas usuarias y expedientes · Solicitudes y asignación · Solicitudes de seguimiento · Interconsultas y derivaciones · Banco de recursos · Agenda y citas · Calendario · Pase de sesión · Talleres · Revisión de expedientes · Incidentes críticos · Prácticas y servicio social · Altas · Correos y avisos · Mensajes internos

Permisos recomendados: 24 (los ajusta Dirección por persona al darla de alta).

## Supervisión clínica

Revisa el contenido clínico, atiende incidentes críticos y firma horas de prácticas.

Perfiles de la demostración: **Supervisión clínica**.

### Qué puede ver

- **Indicadores de revisión y notas** (`/indicadores`): Cobertura de revisión, notas por firmar, historia completa.
- **Expedientes (contenido)** (`/gestion/personas`): Para revisarlos.

### Qué puede gestionar

- **Revisión de contenido** (`/revision`): Cumple / no cumple con comentario; la persona terapeuta confirma.
- **Incidentes críticos** (`/incidentes`): Atiende y cierra con acciones y fecha de seguimiento.
- **Prácticas y servicio social** (`/practicantes`): Firma horas y evalúa competencias.
- **Mi perfil** (`/perfil`): Edita su contacto y su horario; cambia su contraseña desde el correo.

### Qué no puede hacer

- Asignar casos
- Dar de alta personal
- Enviar correos

### Herramientas de su Panel de gestión (10)

Personas usuarias y expedientes · Solicitudes y asignación · Banco de recursos · Agenda y citas · Calendario · Pase de sesión · Revisión de expedientes · Incidentes críticos · Prácticas y servicio social · Mensajes internos

Permisos recomendados: 13 (los ajusta Dirección por persona al darla de alta).

## Personal clínico-administrativo

Agenda, primer contacto, altas de personas usuarias, consentimientos y correos; sin contenido clínico.

Perfiles de la demostración: **Clínico-administrativo ICSA**, **Clínico-administrativo ICBI**.

### Qué puede ver

- **Indicadores de agenda y primer contacto** (`/indicadores`): Espera, cancelación y pendientes de su instituto.
- **Lista de espera (sin contenido clínico)** (`/casos`): Con el nivel de riesgo que ya valoró una persona profesional.

### Qué puede gestionar

- **Altas de personas usuarias** (`/altas`): Una a una o por lista, con acuse por correo.
- **Agenda y pase de sesión** (`/agenda`): Programa y reprograma donde la unidad le asigna la agenda.
- **Consentimientos y derivaciones** (`/derivaciones`): Registra la aceptación de consentimientos y da seguimiento a derivaciones.
- **Correos y recordatorios** (`/comunicaciones`): Solo a quien autorizó el canal.
- **Mi perfil** (`/perfil`): Edita su contacto y su horario; cambia su contraseña desde el correo.

### Qué no puede hacer

- Ver notas o historia clínica
- Valorar el riesgo
- Asignar terapeutas

### Herramientas de su Panel de gestión (10)

Personas usuarias y expedientes · Solicitudes y asignación · Interconsultas y derivaciones · Agenda y citas · Calendario · Pase de sesión · Revisión de expedientes · Altas · Correos y avisos · Mensajes internos

Permisos recomendados: 13 (los ajusta Dirección por persona al darla de alta).

## Prácticas y servicio social

Atiende bajo supervisión los casos de su vínculo; todo lo que registra entra a revisión.

Perfiles de la demostración: **Practicante1Demo**, **Practicante2Demo**.

### Qué puede ver

- **Mis indicadores** (`/indicadores`): Pases, notas y revisión de los casos de su vínculo.
- **Mis casos** (`/gestion/personas`): Solo los vinculados a su práctica.

### Qué puede gestionar

- **Atención bajo supervisión** (`/gestion/personas`): Notas, seguridad y resultados; todo entra a revisión.
- **Mis horas de práctica** (`/practicantes`): Las registra; las firma la supervisión.
- **Mi perfil** (`/perfil`): Edita su contacto y su horario; cambia su contraseña desde el correo.

### Qué no puede hacer

- Ver casos que no son suyos
- Firmar sus propias horas
- Cerrar incidentes

### Herramientas de su Panel de gestión (9)

Personas usuarias y expedientes · Solicitudes y asignación · Banco de recursos · Agenda y citas · Calendario · Pase de sesión · Revisión de expedientes · Prácticas y servicio social · Mensajes internos

Permisos recomendados: 12 (los ajusta Dirección por persona al darla de alta).

## Tallerista

Gestiona cupo, estado y asistencia de sus talleres; sin acceso a expedientes.

Perfiles de la demostración: **Tallerista1Demo**, **Tallerista2Demo**.

### Qué puede ver

- **Indicadores de sus talleres** (`/indicadores`): Ocupación y asistencia.
- **Calendario** (`/calendario`): Sus talleres y las actividades del instituto.

### Qué puede gestionar

- **Talleres** (`/talleres`): Cupo, estado y sesiones realizadas con asistencia.
- **Mi perfil** (`/perfil`): Edita su contacto y su horario; cambia su contraseña desde el correo.

### Qué no puede hacer

- Ver personas usuarias o expedientes

### Herramientas de su Panel de gestión (5)

Agenda y citas · Calendario · Pase de sesión · Talleres · Mensajes internos

Permisos recomendados: 7 (los ajusta Dirección por persona al darla de alta).

## Terapeuta

Lleva a sus personas usuarias: expediente, notas, seguridad, resultados, tareas y derivaciones.

Perfiles de la demostración: **Terapeuta1Demo**, **Terapeuta2Demo**, **Terapeuta3Demo**, **Terapeuta4Demo**, **Terapeuta5Demo**, **Terapeuta6Demo**.

### Qué puede ver

- **Mis indicadores** (`/indicadores`): Pases, notas por firmar, historia completa, casos sin seguimiento.
- **Mi día** (`/mi-dia`): Sesiones de hoy, pases, notas y mensajes de las personas usuarias.

### Qué puede gestionar

- **Expediente de mis personas usuarias** (`/gestion/personas`): Historia por selección, notas, familiograma, evaluaciones, material, seguridad, consentimientos, resultados y tareas.
- **Agenda y pase** (`/agenda`): Programa (donde la unidad lo permite) y registra la asistencia.
- **Derivaciones y correos a sus personas** (`/derivaciones`): Solo a quien autorizó el canal.
- **Mi perfil** (`/perfil`): Edita su contacto y su horario; cambia su contraseña desde el correo.

### Qué no puede hacer

- Ver casos de otras personas terapeutas
- Dar de alta personal
- Cambiar su acreditación

### Herramientas de su Panel de gestión (11)

Personas usuarias y expedientes · Solicitudes y asignación · Mi día · Interconsultas y derivaciones · Banco de recursos · Agenda y citas · Calendario · Pase de sesión · Revisión de expedientes · Correos y avisos · Mensajes internos

Permisos recomendados: 20 (los ajusta Dirección por persona al darla de alta).

## Persona usuaria

Ve y gestiona lo suyo: citas, plan de seguridad, consentimientos, cuestionarios, tareas y diario.

Perfiles de la demostración: **Persona usuaria**.

### Qué puede ver

- **Mi progreso** (`/mi-progreso`): Asistencia, tareas y evolución de mis cuestionarios.

### Qué puede gestionar

- **Mi espacio** (`/mi-espacio`): Citas, plan de seguridad, consentimientos, cuestionarios, tareas, diario y encuesta anónima.
- **Mi perfil** (`/perfil`): Contacto y preferencias.

### Qué no puede hacer

- Ver información de otras personas

Permisos recomendados: 6 (los ajusta Dirección por persona al darla de alta).

## Guion sugerido para la demostración (15 minutos)

1. **Dirección PASMU → Panel de indicadores**: semáforos por instituto, alertas con responsable y plazo; al final, fijar una meta con motivo y ver el historial.
2. **Dirección → Panel de gestión → Configuración**: dar de alta una dependencia nueva eligiendo indicadores; agregar un indicador al catálogo y activarlo en una unidad existente.
3. **Dirección → Altas**: dar de alta a una persona responsable con sus facultades recomendadas; activar el visto bueno.
4. **Dirección → alerta de espera → Solicitar seguimiento** (también desde Solicitudes y asignación).
5. **Responsable ICSA → Solicitudes de seguimiento**: responder con el motivo (horarios, espacios, saturación…).
6. **Responsable ICSA → Solicitudes y asignación**: valorar el riesgo de una persona en espera (la lista se reordena), asignar terapeuta y canalizar a taller a una persona de riesgo bajo.
7. **Coordinación → valorar riesgo inminente**: se abre un incidente crítico; **Supervisión** lo atiende y lo cierra con fecha de seguimiento.
8. **Terapeuta1Demo → Mi día**: pase de sesión, nota por selección, plan de seguridad y resultados de una persona.
9. **Clínico-administrativo → Altas**: registrar a una persona usuaria y enviarle el acuse; **Correos y avisos** con bitácora.
10. **Persona usuaria → Mi espacio y Mi progreso**: aceptar un consentimiento, responder un cuestionario, ver su curva y la encuesta anónima.

## Estado honesto de la demostración

- **Corre completo** con datos locales del navegador: todo lo anterior. Se restablece en Configuración → Instrumentos y personal → Restablecer datos.
- **Comprobado automáticamente**: pantallas de cada perfil, permisos, flujos de extremo a extremo y la base de datos (scripts SQL 23 a 41 en Postgres simulado).
- **Pendiente**: envío real de correos (hoy se registra en la bitácora); conectar cada pantalla nueva con Supabase; permisos por persona en la base (hoy salen del rol); excluir de los indicadores de la base a quienes están canalizados a un taller.
- **No incluido por decisión**: cobros, biometría o geolocalización, dictado por voz y cualquier algoritmo que decida severidad o diagnostique.
