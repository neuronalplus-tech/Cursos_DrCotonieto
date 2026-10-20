# PASMU Web

Este subproyecto es un prototipo independiente del sistema PASMU.

La hoja de ruta vigente es [PLAN_MAESTRO_PASMU.md](../../docs/PLAN_MAESTRO_PASMU.md); la valoración de las propuestas funcionales está en [VALORACION_INVENTARIO_PASMU.md](../../docs/VALORACION_INVENTARIO_PASMU.md). El inventario es un banco de propuestas, no un alcance aprobado. La [preparación para Cloudflare Pages](../../docs/DESPLIEGUE_CLOUDFLARE_PASMU.md) describe el build, las variables públicas y las puertas de seguridad previas; no implica que se haya desplegado.

## Configuración inicial

1. Copia `.env.example` a `.env.local`
2. Define:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` (o `VITE_SUPABASE_ANON_KEY` para proyectos que aún usen la clave legacy)
   - Usa la URL raíz del proyecto, por ejemplo `https://<project-ref>.supabase.co`; no agregues `/rest/v1`.
3. Ejecuta:
   - `npm install`
   - `npm run dev`

La clave publishable/anon puede usarse en el navegador junto con políticas RLS correctas. Nunca pongas una clave `secret` o `service_role` en variables `VITE_*`; esas claves no son seguras para el frontend.

## Modo sin Supabase

Si no se configura la conexión, el prototipo mantiene un modo local con usuarios y datos de prueba para validar pantallas. Ese modo no constituye autenticación ni autorización de producción.

## Base de datos y RLS

Para un proyecto vacío, reemplaza primero los datos de ejemplo (`Universidad de Ejemplo`, `UE`) en `05_seed_roles.sql`. Después ejecuta en SQL Editor y en este orden los archivos `01_catalogos.sql`, `02_atencion.sql`, `03_reportes.sql`, `04_rls.sql` y `05_seed_roles.sql` de `../sql`.

Si ya ejecutaste la versión inicial de `01-05`, **no los vuelvas a ejecutar todos**. Ejecuta `07_actualizar_esquema_inicial.sql`, después vuelve a ejecutar el seed idempotente corregido `05_seed_roles.sql` y finalmente `04_rls.sql` para instalar las políticas actualizadas. La migración aborta de forma segura si encuentra mediciones antiguas sin unidad: no las elimines; clasifícalas con responsables antes de reintentar.

Después de aplicar `04_rls.sql`, puedes ejecutar `08_verificar_rls.sql`. Es una consulta de solo lectura que devuelve el estado RLS de las tablas PASMU, los privilegios efectivos de `authenticated`, los grants por columna, las políticas instaladas y los permisos de ejecución de las funciones `SECURITY DEFINER`. La última consulta resume automáticamente RLS, ausencia de grants DML y `SELECT` amplios para `anon`/`authenticated`, permisos de las funciones, la lista permitida exacta de columnas `SELECT` y la allowlist de políticas: deben existir todas las políticas esperadas con comando/modo/rol correctos y no debe haber políticas adicionales en las tablas revisadas. El resumen debe mostrar `status = OK` y `failed_checks = 0`. Revisa también los resultados detallados para comprobar cualquier hallazgo.

La capa RLS inicial es conservadora y revoca los privilegios DML directos, tanto a nivel de tabla como de columna, de los roles de cliente en todas las tablas PASMU: la app conectada es de solo lectura y las políticas por sí solas no habilitan escrituras sin grants. Las escrituras administrativas, clínicas, de gestión de personas/asignaciones y de auditoría requerirán flujos controlados con grants mínimos; también se bloquea la lectura de auditorías sin redacción. Los listados generales de casos y agenda tienen privilegios por columna para no exponer identidades, motivos u observaciones. No ejecutes los scripts contra una base con datos existentes sin respaldar y revisar primero el plan de migración. No cargues datos clínicos reales: todavía faltan las políticas de Storage y pruebas de autorización con identidades reales.

### Inicio de sesión con Supabase

1. Crea la cuenta en **Authentication → Users**; el registro público no está habilitado en la app. Confirma la cuenta y copia su UUID.
2. Personaliza y ejecuta `06_vincular_primera_cuenta.sql` para enlazar el Auth user, crear su perfil y asignarle el rol inicial de coordinación en UAP. El perfil debe existir antes del primer inicio de sesión.
3. El frontend valida correo/contraseña con Supabase Auth, resuelve el perfil y carga el rol/permisos desde la base. Si el perfil o la membresía faltan, el acceso no continúa.
4. Las rutas internas redirigen a Acceso si no hay sesión; después de autenticar, se abre la ruta solicitada. El menú solo muestra módulos permitidos por el rol. Si llegas a Acceso al abrir Dashboard sin iniciar sesión, es el comportamiento de protección esperado.

Al iniciar sesión se cargan las membresías vigentes con roles activos; cuando hay más de un contexto aparece un selector de unidad, programa y rol. Los módulos operativos y reportes filtran la vista por el contexto seleccionado, y RLS sigue validando el acceso en la base. El selector organiza la vista: la política RLS actual autoriza conforme al conjunto de membresías vigentes del usuario, no a una selección de contexto del navegador. Al cambiar de contexto se ocultan inmediatamente los resultados anteriores mientras cargan los nuevos. Agenda se limita a la unidad activa porque el esquema actual no asigna un programa directamente a cada cita. Si se requiere que el rol seleccionado restrinja también las llamadas API, habrá que implementar contexto activo validado del lado servidor antes de producción.

### Lectura de datos reales

Dashboard, casos, agenda, expediente y reportes consultan Supabase durante una sesión autenticada; las cuentas de demostración locales continúan usando datos mock. Estos módulos son de lectura. Los listados de casos/agenda exponen columnas limitadas y no muestran identidades; el expediente se abre por caso seleccionado y requiere permiso y asignación activa al caso. Auditoría y administración operativa siguen sin lectura/escritura de datos reales hasta contar con vistas/RPCs seguras.

El Dashboard distingue la perspectiva de Dirección y Coordinación, muestra ámbito y hora de consulta cuando hay datos reales, y ofrece únicamente accesos autorizados. Sus conteos tienen definiciones explícitas: agenda cuenta registros de todos los estados; mediciones cuenta filas del mes visibles, no la cobertura esperada. No presenta prioridades clínicas, rendimiento profesional ni causas que los datos actuales no permitan comprobar. El terapeuta requiere flujos de trabajo por caso/agenda con autorización propia; la persona usuaria del servicio no tiene actualmente cuenta ni portal en este prototipo. Cualquier portal futuro requiere un diseño separado de identidad, consentimiento, derechos, privacidad y accesibilidad.

El reporte solo consulta el catálogo de indicadores activos, mediciones y metas existentes; permite filtrar las mediciones por periodo/nombre y el catálogo por nombre/código, actualizar la consulta, paginar mediciones visibles y exportar las filas filtradas a CSV para roles con `reportes.exportar`. Muestra el avance matemático valor/meta, la variación frente al mes calendario anterior cuando ambos periodos `YYYY-MM` tienen una sola captura comparable, metas ausentes y posibles capturas repetidas. Estas señales no determinan si un indicador mejoró: falta configurar la dirección esperada y la frecuencia por indicador. No se infieren periodos faltantes mientras esa frecuencia no exista. La exportación local incluye contexto visible y marca temporal, y neutraliza valores que podrían interpretarse como fórmulas en hojas de cálculo. No se precargan metas ni valores ficticios, y la pantalla aún no permite capturar mediciones. Un resultado vacío significa que no hay filas visibles para la sesión actual; RLS puede ocultar filas de otros ámbitos, por lo que no demuestra que la base completa esté vacía. La meta se empareja por indicador, periodo, unidad y programa, con alternativa a una meta definida para toda la unidad. Las consultas usan páginas de hasta 200 filas y avisan cuando puede haber más resultados.

## Gobierno, descubrimiento y aceptación

Antes de ampliar flujos clínicos o habilitar escrituras, completar el [cuaderno
de descubrimiento](../../docs/DESCUBRIMIENTO_PASMU.md), aprobar las
[definiciones metodológicas de indicadores](../../docs/FICHAS_INDICADORES_PASMU.md)
y validar los [casos de aceptación por perfil y riesgo](../../docs/MATRIZ_ACEPTACION_PASMU.md).
Son instrumentos pendientes de validación institucional; no sustituyen
protocolos aprobados ni significan que se hayan realizado entrevistas.

## Configuración adaptable

La página Administración permite guardar borradores locales, simular el envío
a revisión y crear versiones en modo demo. Ese modo usa el almacenamiento de
este navegador, no sincroniza entre cuentas, no registra auditoría institucional
ni modifica configuración activa. En sesión autenticada, puede leer y registrar
propuestas/revisiones mediante RPC y RLS cuando estén instalada la migración 09
y asignados los permisos; no cae a almacenamiento local si backend falla. No
incluyas información personal ni clínica en propuestas.

La persistencia de producción debe usar un servicio/RPC versionado, aprobaciones separadas, RLS por dominio y ámbito,
vigencia, auditoría protegida y mecanismo de reversión. La migration inicial
implementa propuestas y decisiones, pero no publicación ni activación.
Permisos, protocolos clínicos, retención, RLS y esquema requieren controles
reforzados; no se habilitan como edición libre. Consulta
[Gobierno de cambios PASMU](../../docs/GOBIERNO_CAMBIOS_PASMU.md).

### Base SQL de propuestas de cambio (opcional y aún no aplicada)

Se preparó `../sql/09_gobierno_configuracion.sql` para crear propuestas
persistentes, versiones enlazadas, revisiones y eventos, con RLS, lectura por
ámbito y funciones controladas para crear borradores, enviarlos a revisión y
decidirlos. La pantalla ya llama esas RPCs para sesiones autenticadas; la
integración solo funciona después de instalar la migración y probarla en un
proyecto de pruebas. La migración **no publica ni activa configuraciones**, no
concede permisos a ningún rol y no habilita DML directo. Los cuatro permisos
`configuracion.*` quedan sin asignación inicial; deben asignarse solo tras
aprobar la matriz de autoridad.

Si la institución decide ensayar esta base, respalda y revisa primero el
ambiente; aplica manualmente `09_gobierno_configuracion.sql` después de
`04_rls.sql`, y vuelve a ejecutar `08_verificar_rls.sql`. El verificador ahora
espera las tablas, columnas, políticas y funciones de la migración. Si no se
aplica 09, los checks ampliados de 08 para configuración fallarán. Ninguna de
estas instrucciones implica que el cambio remoto ya se haya ejecutado.

Al instalar la versión actual, vuelve a ejecutar `04_rls.sql` para aplicar las políticas y privilegios por columna requeridos por estos módulos. Además de las columnas filtrables de agenda, el script limita perfiles, membresías, unidades, programas, roles y permisos a los campos que usa la autenticación y el selector de contexto. Las notas clínicas solo exponen los campos consumidos por el expediente y su lectura continúa requiriendo permiso y asignación al caso. En reportes concede solo las columnas necesarias, excluye observaciones/datos de captura, permite consultar el catálogo global a roles con `reportes.ver` y leer metas generales solo en sus unidades, sin ampliar el acceso a mediciones de otros programas. Retira también el `SELECT` de tablas clínicas, administrativas y de auditoría que todavía no consume ninguna pantalla; deberán recibir grants mínimos al habilitar sus interfaces. El script revoca todos los privilegios DML directos a los roles cliente: para habilitar escrituras en el futuro, además de políticas habrá que instalar grants controlados por tabla y columna. El SQL es idempotente respecto de sus funciones/políticas. No cargues datos clínicos reales hasta probar con usuarios Auth distintos y validar la matriz de acceso.

## Scripts

- `npm run dev`
- `npm run build`
- `npm test` (pruebas unitarias de permisos, indicadores y gobierno de cambios)
- `npm run preview`

## Distribución estática

Pages debe usar este directorio como raíz, `npm ci` como instalación, `npm run build` como build y `dist` como salida. Los archivos `public/_redirects` y `public/_headers` se copian al artefacto de producción. Sigue la guía enlazada arriba antes de crear previews o publicar; no conectes datos clínicos reales ni uses secretos en el frontend.
