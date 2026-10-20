# PASMU — Matriz de aceptación por perfil y riesgo

**Versión 1.0 · 17 de octubre de 2026 · Casos de prueba con identidades sintéticas**

Esta matriz conecta el propósito del [plan maestro](./PLAN_MAESTRO_PASMU.md)
con requisitos que se deberán validar en cada fase. No constituye una matriz
de permisos institucional aprobada. Los ejemplos no usan datos reales.

## 1. Vocabulario de resultado

- **Permitir:** solo la acción y el ámbito explícitamente autorizados.
- **Denegar:** no filtrar si existe el recurso; no exponer contenido ni
  metadatos sensibles.
- **Auditar:** registrar actor, fecha, acción, contexto y resultado, sin
  copiar contenido clínico innecesario.
- **Escalar a persona responsable:** mantener decisión humana, responsable y
  plazo; no resolver automáticamente.

## 2. Casos transversales

| ID | Actor/condición | Acción | Resultado esperado | Evidencia | Fase |
| --- | --- | --- | --- | --- | --- |
| ACC-01 | Sin sesión | Abrir ruta privada | Denegar; redirigir a acceso sin exponer información | Prueba de ruta/UI y API | B |
| ACC-02 | Auth válido sin perfil/membresía vigente | Consultar módulo | Fallar cerrado, mostrar error accionable sin datos de otro usuario | Prueba auth + RLS | B |
| ACC-03 | Profesional con permiso en unidad A | Consultar unidad B | Denegar aunque manipule URL/filtro/contexto | Prueba negativa RLS directa | B |
| ACC-04 | Profesional asignado a caso A | Abrir caso B no asignado | Denegar sin distinguir inexistente/no autorizado | Prueba RLS/API | B/D |
| ACC-05 | Contexto cambiado durante carga | Termina respuesta previa | No mostrar filas del contexto anterior | Prueba de carrera UI | B |
| ACC-06 | Membresía revocada | Continuar sesión | Nuevas operaciones denegadas y estado actualizado conforme a política de sesión | Prueba con dos sesiones | B |
| ACC-07 | Cuenta de Coordinación | Consultar listado operativo | Solo columnas/filas autorizadas; sin nota clínica o identidad no necesaria | Verificación SQL/UI | C |
| ACC-08 | Cuenta de Dirección | Abrir resumen agregado | Ver solo agregado aprobado; sin drill-down a caso/terapeuta individual no autorizado | Prueba permisos y vista | E |
| ACC-09 | Usuario con permiso de vista pero no exportación | Intentar exportar | Acción no disponible y export directo denegado | UI + backend | E |
| ACC-10 | Excepción/error backend | UI muestra error | Mensaje seguro; sin SQL, token, PII ni texto de expediente | Prueba de errores/logs | B |
| ACC-11 | Cambia profesional del caso | Profesional anterior consulta después de revocación | Acceso cesa; profesional nuevo solo tras asignación autorizada | Prueba transferencia | C/D |
| ACC-12 | Datos sintéticos de prueba | Entorno de desarrollo | Identificadores claramente ficticios y aislados de producción | Revisión de dataset/entorno | B/G |
| CFG-01 | Propuesta local de demo | Guardar cambio completo | Crear borrador versionado local y comunicar que no publica configuración | Prueba unitaria/UI | B |
| CFG-02 | Borrador | Enviar a revisión en demo | Congelar contenido y marcar simulación; no insinuar aprobación real | Prueba transición/UI | B |
| CFG-03 | Propuesta existente | Crear nueva versión | Enlazar nueva versión y conservar intacta la anterior | Prueba unitaria | B |
| CFG-04 | Sesión autenticada sin migración/permisos de configuración | Abrir administración/intentar cambio | Mostrar error; no guardar en browser ni aplicar cambio | Prueba de integración | B |
| CFG-05 | Aprobador igual al proponente en cambio de alto impacto | Intentar aprobar/publicar | Denegar según separación de funciones aprobada | RLS/RPC multicuenta | B |
| CFG-06 | Dos revisores o publicadores concurrentes | Aprobar versión divergente | Una sola transición válida; reportar conflicto sin perder historial | Prueba transaccional | B |
| CFG-07 | Cambio aprobado con vigencia futura | Consultar antes/después de la vigencia | Resolver la configuración correcta por ámbito/fecha | Prueba de servicio | B |
| CFG-08 | Configuración ya vigente | Revertir | Crear versión nueva restauradora; preservar la versión anterior y su auditoría | Prueba RPC/bitácora | B |
| CFG-09 | Cuenta sin permiso de configuración | Invocar RPC directamente | Denegar aunque el usuario evite la UI o cambie el identificador de unidad | Prueba SQL multicuenta | B |
| CFG-10 | Propuesta de alto impacto | Revisor sin permiso `configuracion.aprobar_alto_riesgo` | Denegar decisión; no cambiar estado ni insertar evento parcial | Prueba SQL transaccional | B |
| CFG-11 | Proponente intenta revisar su propia propuesta | Aprobar/rechazar | Denegar por identidad de perfil; mantener solicitud en revisión | Prueba SQL multicuenta | B |
| CFG-12 | Propuesta aprobada | Consultar configuración en uso | No tratar aprobación como publicación; no alterar valores activos | Prueba UI/servicio | B |
| CFG-13 | Sesión autenticada con permiso de propuesta | Crear o versionar cambio | Persistir por RPC y ámbito autorizado; no usar almacenamiento local ni cambiar configuración activa | Prueba de integración Supabase | B |
| CFG-14 | Propuesta incompleta de impacto/reversión/evidencia | Invocar RPC saltando la UI | Rechazar en el servidor sin crear versión ni evento parcial | Prueba SQL/RPC | B |

## 3. Aceptación según perspectiva

### Dirección

- [ ] Puede identificar unidad, programa, periodo, fecha de actualización y
  estado de validación de cada agregado.
- [ ] Distingue dato provisional de validado/cerrado.
- [ ] La ficha explica fuente, definición, cobertura y límites de interpretación.
- [ ] No hay ranking individual ni inferencia de causa/efectividad no aprobada.
- [ ] Grupos pequeños y exportaciones siguen umbrales y permisos aprobados.

### Coordinación

- [ ] Una cola futura tiene evento, estado, responsable, antigüedad y siguiente
  acción verificables.
- [ ] Los pendientes se derivan de reglas aprobadas, no de texto genérico.
- [ ] La coordinación no obtiene automáticamente acceso a notas clínicas.
- [ ] Cambio/reasignación incluye aceptación, continuidad, auditoría y revocación.
- [ ] Excepciones tienen ruta manual y responsable suplente.

### Terapeuta/profesional

- [ ] Solo ve casos asignados o cuyo acceso temporal se haya aprobado.
- [ ] Puede reconocer citas propias y distinguir estado/fecha de zona horaria.
- [ ] La nota cerrada no se sobrescribe; la corrección es addendum versionado.
- [ ] La supervisión muestra solo contenido/casos autorizados y registra motivo.
- [ ] Los canales indican límites y no prometen cobertura no existente.

### Practicante/residente

- [ ] El alcance de casos, acciones y supervisión está explícito y vigente.
- [ ] No puede firmar, cerrar o validar fuera de atribuciones.
- [ ] Acceso a material docente está separado del expediente y del LMS.
- [ ] Terminación de práctica revoca permisos y conserva trazabilidad necesaria.

### Persona usuaria del servicio

- [ ] Información pública explica alcance, horarios, canales, privacidad y
  rutas de urgencia aprobadas.
- [ ] Lenguaje comprensible y pruebas con tecnologías de asistencia.
- [ ] Toda vista autenticada devuelve solo su propia información.
- [ ] Puede localizar derechos/solicitudes/quejas y conocer tiempos/responsable.
- [ ] Mensajes no revelan la relación con el servicio en pantalla bloqueada.
- [ ] No hay diario/chat/alerta de crisis sin responsable de revisión y límites.

## 4. Pruebas de indicadores

| ID | Escenario sintético | Resultado esperado |
| --- | --- | --- |
| IND-01 | Indicador sin ficha aprobada | No aparece como meta institucional oficial |
| IND-02 | Valor igual a cero | Se conserva como cero; no se confunde con dato faltante |
| IND-03 | Periodo sin captura y sin frecuencia aprobada | No se genera alerta de atraso |
| IND-04 | Definición cambia a mitad de serie | Comparación se bloquea o marca quiebre metodológico |
| IND-05 | Dos filas para indicador/periodo | Se muestra señal de revisión, no se deduplica ni borra automáticamente |
| IND-06 | Meta ausente/no positiva | Avance no se inventa ni divide silenciosamente |
| IND-07 | Grupo menor al umbral de privacidad | Supresión/reducción de detalle conforme política |
| IND-08 | Corrección posterior a validación | Conserva valor anterior, motivo, autor, revisor y nueva versión |
| IND-09 | Consulta parcial/paginada | Cobertura y límite visibles; no presentarla como total institucional |
| IND-10 | CSV abre en hoja de cálculo | Fórmulas potenciales neutralizadas; alcance y tiempo incluidos |

## 5. Incidentes y continuidad

- [ ] Simular pérdida de acceso de responsable y probar suplencia.
- [ ] Simular cuenta comprometida y practicar revocación de sesión/credencial.
- [ ] Restaurar respaldo en ambiente aislado y comparar conteos/integridad.
- [ ] Simular indisponibilidad y aplicar proceso alterno institucional aprobado.
- [ ] Documentar incidentes y acciones sin incluir contenido de nota clínica en
  tickets generales.
- [ ] Para canales de crisis, prueba humana completa antes de cualquier
  notificación digital; sin ensayo no se habilita alerta.

## 6. Evidencia de aceptación

Por cada prueba conservar: ID, versión de app/esquema, ambiente, actor sintético,
precondición, acción, resultado esperado/real, captura/log redactado,
responsable y fecha. No adjuntar tokens, contraseñas, contenido clínico ni
datos productivos a tickets o repositorios.

Una fase no pasa por contar pruebas ejecutadas; debe cumplir sus resultados
esperados, tener riesgos residuales aceptados por autoridad competente y
documentar los defectos bloqueantes.

## 7. Revisión de esta matriz

La matriz y las plantillas asociadas se revisaron técnicamente para incluir
adaptación, versionado, aprobación y reversión. No existe aún validación de la
institución; las facultades y requisitos de aprobación permanecen pendientes.
El estado detallado del mecanismo está en
[Gobierno de cambios PASMU](./GOBIERNO_CAMBIOS_PASMU.md).
