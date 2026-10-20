# PASMU — Gobierno de cambios y configuración adaptable

**Versión 1.0 · 17 de octubre de 2026 · Diseño propuesto, pendiente de aprobación institucional**

## 1. Principio: adaptable, trazable y reversible

PASMU no tratará sus flujos ni políticas de negocio como permanentes. La
plataforma deberá permitir que personas autorizadas propongan y mantengan
configuraciones desde una consola propia, con versiones, ámbito, vigencia,
aprobación y evidencia. Los cambios aprobados sustituirán la configuración
activa hacia adelante sin borrar lo que regía antes.

La aplicación contiene tres clases distintas de cambio:

| Clase | Ejemplos | Mecanismo esperado |
| --- | --- | --- |
| Configuración de negocio | Catálogos, etiquetas, formularios no clínicos, estados operativos, rutas informativas, definiciones/metas de indicadores | Consola, esquema tipado, borrador/versionado, revisión y publicación |
| Política de alto impacto | Roles/permisos, protocolo clínico, privacidad, conservación, consentimiento, crisis, reglas que alteren derechos | Consola con aprobadores separados, evaluación de impacto, fecha de vigencia y prueba; si la política lo requiere, aprobación institucional fuera del sistema antes de publicar |
| Cambio técnico estructural | Código, modelo relacional, RLS, funciones, infraestructura, cifrado y despliegues | Control de versiones, revisión técnica, migración reproducible, pruebas y liberación; nunca edición de SQL desde un editor genérico dentro de producción |

La aspiración de que la operación sea modificable **no** implica un editor
genérico de código, acceso directo a la base ni una opción para desactivar
protecciones. Seguridad, separación de funciones, procedencia y auditoría son
invariantes técnicas; su actualización sí debe ser posible mediante un cambio
técnico revisado y rastreable.

## 2. Ciclo común de vida

Estados meta:

`borrador → enviado a revisión → en revisión → aprobado → programado → vigente → sustituido`

Rutas adicionales: `rechazado`, `retirado`, `bloqueado`. El borrador puede
editarse; una vez enviado, su contenido queda congelado. Para cambiarlo se crea
una versión nueva que enlaza con la anterior. Una versión publicada no se
sobrescribe ni elimina. La reversión consiste en aprobar una nueva versión que
restaure una configuración anterior, conservando el evento y su motivo.

Cada cambio registra, al menos:

- identificador, dominio, ámbito organizacional y versión;
- autor, motivo, descripción estructurada y artefactos de respaldo permitidos;
- estado, fechas de creación, envío, decisión, programación y vigencia;
- aprobaciones, rol/facultad, timestamp y comentario sin datos clínicos;
- impacto en usuarios/procesos, compatibilidad y plan de reversión;
- pruebas requeridas/ejecutadas y resultado;
- referencia a versiones sustituidas y notificación requerida.

El formulario de propuestas solicita además motivo, alcance, efecto propuesto,
impacto en personas/procesos, evidencia de validación y plan de reversión. Son
condiciones para decidir con contexto; no sustituyen el payload tipado que cada
dominio deberá definir antes de activar cambios.

La aplicación deberá mostrar qué configuración está vigente **para una fecha y
un ámbito**, quién la aprobó y a partir de cuándo; no asumir que “el último
registro” es el vigente. Cambios incompatibles requieren vigencia programada,
aviso y, cuando aplique, periodo de coexistencia.

## 3. Separación de funciones

Quien propone no debe aprobar su propio cambio de alto impacto. La política
final asignará aprobadores y suplentes por dominio; no se presume que los
roles actuales del prototipo tengan esas facultades.

| Dominio | Revisión requerida antes de activar |
| --- | --- |
| Alcance/estructura institucional | Dirección y tecnología; validar efecto sobre ámbitos/usuarios |
| Flujo operativo/catálogos | Coordinación y responsables de cada etapa; pruebas de aceptación |
| Indicadores/metas | Dueño metodológico, responsable de fuente y autoridad de meta |
| Información de cara a usuarios | Dirección, privacidad y evaluación de accesibilidad/comprensión |
| Roles y permisos | Seguridad + autoridad institucional distinta del proponente; matriz y pruebas negativas |
| Protocolo clínico/consentimiento | Responsable clínico y revisiones institucionales/jurídicas que correspondan |
| Retención/derechos | Privacidad/jurídico y autoridad institucional; evaluación de obligaciones |
| Seguridad/esquema/integraciones | Revisión técnica independiente, análisis de impacto, pruebas y despliegue controlado |

Las firmas, constancias y plazos concretos dependen de la gobernanza aprobada.
Una marca de aprobación en PASMU no reemplaza una autorización legal o
institucional que deba emitirse por otro mecanismo.

## 4. Datos históricos y correcciones

- Una versión nueva de un catálogo o flujo se aplica desde su vigencia; los
  registros previos mantienen el código/versión que les daba significado.
- Un expediente firmado/cerrado no se edita destructivamente: toda corrección
  conserva original, autor, fecha, motivo, relación y revisión cuando aplique.
- Las mediciones validadas/cerradas no se reemplazan en silencio. La corrección
  genera una nueva revisión auditable y declara si cambia comparabilidad.
- Desactivar un elemento significa que deja de ofrecerse en contextos nuevos;
  no elimina referencias históricas.
- El retiro/eliminación de datos obedece a la política de conservación
  aprobada y a mecanismos controlados distintos de “desactivar catálogo”.

## 5. Cambios urgentes y configuración temporal

Si aparece una necesidad urgente, no se publica desde una cuenta individual
sin control. El mecanismo institucional que se apruebe deberá exigir autoridad
de guardia, motivo, ámbito y duración acotados, registrar quién autorizó,
notificar a revisores y forzar vencimiento/revisión. No usar este mecanismo
para improvisar cobertura clínica ni alertas de crisis. Su diseño requiere
definir responsables y cobertura reales.

## 6. Requisitos de producto para la consola

- Catálogo de configuraciones tipadas, no JSON/SQL arbitrario ejecutable.
- Filtrado por dominio, ámbito, estado, vigencia y responsable.
- Comparación visual entre versiones y explicación del impacto.
- Validación de campos, referencias, duplicados y compatibilidad en servidor.
- Aprobación separada por permiso y por dominio/contexto.
- Reglas de publicación con vigencia, pruebas, notificación y plan de vuelta.
- Versiones anteriores consultables según autorización; logs sin datos
  clínicos innecesarios.
- API/RPC atómica y auditada, permisos mínimos, idempotencia y concurrencia
  controlada.
- Pruebas de autorización con distintas identidades; denegar cambios fuera del
  ámbito aunque se manipule la interfaz.
- Exportación legible de configuración vigente y sus metadatos para continuidad.
- UI accesible y comprensión del efecto, no solo formularios administrativos.

## 7. Estado real de esta entrega

- Los instrumentos de descubrimiento, indicadores y aceptación fueron
  **revisados técnicamente** para coherencia, trazabilidad, reversibilidad y
  apertura al cambio. No han sido validados por Dirección ni por los
  responsables institucionales.
- La consola `/admin` incorpora un flujo demostrativo de borrador, envío
  simulado a revisión y creación de nuevas versiones. En modo demo usa
  `localStorage` de este navegador, no crea un registro compartido, no aplica
  cambios operativos y no constituye auditoría institucional.
- `pasmu/sql/09_gobierno_configuracion.sql` incorpora una base opcional de
  persistencia para borradores/versiones, decisiones de revisión y eventos,
  junto con funciones transaccionales controladas. El script no se ejecutó en
  Supabase y no habilita publicación/activación.
- La pantalla ya integra lectura de propuestas institucionales y llamadas a
  las funciones públicas RPC para crear borradores, enviar a revisión y
  registrar aprobación/rechazo cuando exista la migración y se asignen los
  permisos correspondientes. Los errores se muestran y la sesión autenticada
  nunca recurre a `localStorage`.
- La revisión rechaza self-approval; el servidor exige permiso adicional para
  dominios de alto impacto y comentario al rechazar. La interfaz distingue una
  aprobación de una publicación. No se simula una identidad revisora para
  saltar la separación de funciones.
- El SQL no asigna los permisos nuevos a roles, no ofrece edición de
  configuraciones tipadas, no publica ni activa, y no proporciona vigencia,
  notificaciones o reversión operativa. La integración aún necesita instalación
  y pruebas de extremo a extremo en un Supabase de pruebas.
- Por tanto, aún no es posible cambiar una configuración activa de instancia
  institucional desde este prototipo.
- No ejecutar cambios remotos ni cargar información clínica por esta entrega.

## 8. Criterios para habilitar gestión persistente

- [ ] Autoridad institucional, dominios y aprobadores por tipo aprobados.
- [ ] Modelo de configuración y versionado revisado por tecnología/seguridad.
- [ ] Migración 09 revisada y aplicada en un ambiente separado, con el
      verificador 08 mostrando `OK` después de instalar sus políticas.
- [ ] Contratos de payload tipados por dominio y pantalla conectada al backend;
      no basta con aceptar JSON arbitrario.
- [ ] Motivo, alcance, impacto, evidencia de prueba y reversión validados en
      servidor para cada dominio.
- [ ] Sin editor arbitrario de JSON/SQL ni actualización destructiva de historia.
- [ ] RPCs transaccionales: propuesta, aprobación, publicación, retiro y
      reversión.
- [ ] RLS y pruebas negativas para proponente, aprobador, auditor y usuario sin
      facultad.
- [ ] Prueba de concurrencia, vigencia futura, reversión y fallo parcial.
- [ ] Registro de auditoría protegido y estrategia de respaldo/recuperación.
- [ ] Accesibilidad, comunicación y comprensión probadas por perfil.
- [ ] Evidencia de revisión clínica/privacidad cuando afecte dichos dominios.
- [ ] Migración revisada, probada en entorno separado y aplicada por responsable
      autorizado.

## 9. Validación y revisión periódica

La validación tiene dos niveles: (1) revisión técnica de que el instrumento y el
software implementan el ciclo sin pérdida de historia; (2) aprobación
institucional de responsables, reglas y autoridad. Esta entrega completa el
primer nivel de contrato y build del frontend y revisión estática de las
guardas SQL, pero no prueba ejecución real del backend. No completa el segundo
nivel ni la validación de integración con Supabase.

Revisar cada configuración en su fecha acordada y cuando cambien población,
capacidad, contexto institucional, normativa, infraestructura, incidentes o
necesidades de usuarios. Toda revisión puede conservarla, modificarla,
suspenderla o retirarla; ninguna fecha de revisión implica aprobación tácita.
