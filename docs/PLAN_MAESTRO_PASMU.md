# PASMU — Plan maestro de construcción y puesta en operación

**Documento rector propuesto · Versión 1.0 · 17 de octubre de 2026**

## 1. Decisión estratégica

PASMU se construirá primero como una **plataforma web institucional de salud
mental universitaria**, no como un SaaS para clínicas privadas. El propósito
principal es sostener un servicio real con continuidad, responsabilidad
profesional, derechos de las personas usuarias, información agregada útil para
gestión y controles verificables de privacidad.

Este plan sustituye como hoja de ruta vigente al esquema lineal anterior de
`PLAN_FASES_PASMU.md`. Ese documento se conserva como antecedente del diseño;
el plan maestro es la referencia para priorizar el trabajo desde este corte.
La evaluación de funcionalidades del inventario suministrado está en
`VALORACION_INVENTARIO_PASMU.md`.

El inventario adjunto se presenta como 248 funciones para cinco perfiles y una
capa transversal. Se trata como **banco de propuestas**, no como requisitos
aprobados ni compromiso de construirlas todas. Incluye conceptos duplicados,
funciones de varios tipos de organización y capacidades que podrían aumentar
el riesgo clínico, legal, financiero o de privacidad.

## 2. Alcance del producto

### Dentro de la visión institucional

- Identidad y acceso institucional por unidad, programa, rol y necesidad de
  saber.
- Operación de solicitudes, admisión, agenda, casos, asignaciones,
  canalizaciones y seguimiento.
- Documentación clínica mínima necesaria y continuidad del expediente bajo
  supervisión profesional.
- Experiencia segura, accesible e informativa para la persona usuaria del
  servicio, cuando se apruebe el canal y su gobernanza.
- Indicadores institucionales definidos, verificables y aptos para apoyar
  decisiones sin sustituir juicio clínico.
- Seguridad, continuidad operativa, privacidad, trazabilidad, calidad y
  mejora del servicio como requisitos de cada módulo.

### Fuera del alcance inicial

- SaaS comercial multiempresa, marketplace o plataforma de captación de
  pacientes.
- Monetización, suscripciones, comisiones, pagos, nómina, seguros y facturación
  de servicios clínicos.
- Diagnóstico, triaje, evaluación de crisis, priorización clínica o
  recomendaciones terapéuticas automatizadas.
- Telemedicina, grabación de sesiones, transcripción clínica o IA generativa
  sin una decisión institucional independiente, evaluación de riesgo y
  validación clínica/legal.
- Portal de pacientes, diario clínico personal o mensajería clínica hasta que
  se defina el modelo de atención, disponibilidad, identidad, consentimiento y
  respuesta a urgencias.
- Comparaciones públicas, reputación, rankings de terapeutas, benchmarking
  entre organizaciones o analítica individual de productividad.

Fuera del alcance inicial no significa imposible en el futuro; significa que
no se programa hasta que exista caso de uso institucional, responsable,
financiamiento, evaluación de riesgo, gobernanza y criterios de aceptación.

## 3. Supuestos que deben confirmarse institucionalmente

El repositorio es un prototipo técnico. No prueba por sí solo:

- cuál unidad, universidad o entidad será responsable del servicio;
- población atendida, capacidad, rutas de ingreso y alcance de atención;
- legislación, normas sectoriales, obligaciones documentales y plazo de
  conservación aplicables;
- quién puede acceder, aprobar, corregir y cerrar cada tipo de registro;
- horarios, cobertura de crisis, derivaciones externas ni tiempos de
  respuesta;
- definiciones, fuente, periodicidad y responsable de cada indicador;
- presupuesto, operación de infraestructura, soporte, continuidad y
  capacitación.

La dirección del PASMU debe aprobar estos elementos con responsables clínicos,
operativos, jurídicos, privacidad/seguridad, tecnología y representantes de la
experiencia usuaria antes de piloto con información real. Este documento no es
dictamen jurídico, certificación clínica ni autorización para tratar datos
reales.

## 4. Principios de decisión y diseño

1. **Servicio antes que funciones:** cada módulo debe resolver una necesidad
   institucional demostrable y tener responsable operativo.
2. **Personas y equipos en control:** la tecnología apoya; no diagnostica,
   decide elegibilidad clínica, asigna riesgo ni sustituye supervisión.
3. **Mínimo dato y mínimo privilegio:** recolectar solo lo necesario, limitar
   acceso por contexto y proteger agregados susceptibles de reidentificación.
4. **Separación de dominios:** cuenta del personal, perfil institucional,
   persona atendida, caso clínico y datos agregados son identidades/dominios
   distintos.
5. **Trazabilidad honesta:** registrar cambios y accesos relevantes con
   controles de backend; no llamar “inmutable” a un log si no se ha demostrado
   esa propiedad.
6. **Seguridad verificable:** RLS y permisos del cliente son una capa, no un
   sello de producción; probar con identidades y privilegios reales.
7. **Diseño centrado en la persona:** acceso comprensible, accesible,
   culturalmente adecuado y no coercitivo; evitar dark patterns y mensajes
   que prometan monitoreo que no existe.
8. **Interoperabilidad intencional:** integrar solo tras definir propósito,
   autoridad, contrato, semántica, consentimiento y controles del receptor.
9. **Medición antes de automatización:** acordar datos base y procesos; no
   automatizar una regla que aún no esté validada.
10. **Avance por evidencia:** cada fase termina con pruebas, responsables,
    aprobación y reversibilidad; no solo con código compilado.

## 5. Perspectivas de servicio y responsabilidad

| Perfil | Qué debe poder hacer | Qué no debe asumir el sistema |
| --- | --- | --- |
| Dirección institucional | Revisar capacidad, cumplimiento de metas aprobadas, calidad de datos, brechas y recursos | Inferir causas, calidad clínica individual o desempeño profesional desde conteos |
| Coordinación operativa/clínica | Organizar solicitudes, capacidad, agenda, casos pendientes y revisiones asignadas | Ver notas clínicas de todos los casos por ser coordinador, ni recibir alertas sin dueño/tiempo de respuesta |
| Terapeuta/profesional | Ver agenda y casos asignados, documentar atención, recibir supervisión y realizar derivaciones autorizadas | Ser rankeado por retención, velocidad de notas o resultados sin ajuste clínico y contexto |
| Practicante/residente | Acceder solo a actividades asignadas y bajo supervisión definida | Firmar/validar trabajo fuera de atribuciones o ver expedientes no asignados |
| Persona usuaria del servicio | Entender el servicio, sus derechos, acuerdos y canales seguros aprobados | Ser tratada como cuenta de personal ni recibir promesas de respuesta 24/7 sin cobertura |
| Administración técnica | Mantener plataforma y soporte técnico con acceso mínimo y auditado | Usar privilegio técnico para leer expedientes como operación habitual |
| Seguridad/privacidad | Investigar eventos bajo mandato, acceso restringido y registro de auditoría | Consultar contenido clínico por defecto para revisar logs |

Los nombres finales de roles y responsabilidades deben corresponder a la
estructura y normativa de la institución.

## 6. Hoja de ruta desde el estado construido

El código actual incluye autenticación/contexto, RLS inicial, lectura de
algunos módulos operativos y clínicos, reportes básicos de indicadores,
demostración local y pruebas frontend. Es una **base de prototipo**, no una
implementación institucional validada. La secuencia siguiente usa lo ya
construido, pero reabre decisiones de dominio antes de ampliar escrituras.

### Paquete de trabajo inmediato — Fase A

La construcción de pantallas nuevas queda subordinada al descubrimiento
institucional; el trabajo técnico seguro continúa mediante artefactos
verificables y pruebas con datos sintéticos. El paquete de trabajo actual se
operacionaliza en:

- [Cuaderno de descubrimiento](./DESCUBRIMIENTO_PASMU.md): sesiones,
  participantes, recorrido, matriz de decisiones, riesgos y puerta de salida.
- [Fichas de indicadores](./FICHAS_INDICADORES_PASMU.md): definición,
  linaje, calidad, privacidad y validación; no contiene valores institucionales.
- [Matriz de aceptación](./MATRIZ_ACEPTACION_PASMU.md): autorización,
  continuidad, perfiles, indicadores y pruebas negativas.
- Base SQL opcional [09_gobierno_configuracion.sql](../pasmu/sql/09_gobierno_configuracion.sql):
  propuestas versionadas y revisión en backend, todavía no ejecutada ni
  conectada a la consola.

Estos artefactos preparan el trabajo institucional, no afirman que ya hubo
entrevistas ni que la Fase A esté aprobada. El siguiente incremento de
software debe implementar primero pruebas reproducibles de permisos y
contratos de datos; las escrituras, protocolos clínicos y funciones que
impliquen decisiones institucionales permanecen bloqueadas.

La capacidad de adaptación se regirá por
[Gobierno de cambios PASMU](./GOBIERNO_CAMBIOS_PASMU.md): las configuraciones
de negocio serán gestionables desde la plataforma mediante versiones,
revisión, vigencia y reversión. La consola prototipo solo demuestra propuestas
locales; no publica una configuración ni habilita persistencia en la instancia
conectada.

### Fase A — Descubrimiento institucional y mapa del servicio

**Prioridad inmediata.** Antes de nuevas pantallas clínicas, validar el
servicio con las personas responsables.

Entregables:

- mapa del recorrido: solicitud, admisión, valoración profesional, atención,
  agenda, seguimiento, canalización, cierre y reingreso;
- catálogo de perfiles, responsabilidades, decisiones y separación de
  funciones;
- clasificación de datos y mapa de flujos/terceros;
- reglas institucionales para urgencias, fuera de horario, cobertura y
  derivaciones, documentadas fuera de la aplicación mientras no exista
  operación digital aprobada;
- matriz de indicadores, fuentes y responsables iniciales;
- decisiones de alcance, jurisdicción, titularidad/custodia, retención,
  consentimiento, acceso y continuidad;
- registro priorizado de riesgos, supuestos y decisiones pendientes.

**Puerta de salida:** visto bueno documentado de Dirección, responsable
clínico, coordinación operativa, tecnología/seguridad, privacidad/jurídico y
representantes de la experiencia usuaria. No se cargan datos clínicos reales.

### Fase B — Fundamentos técnicos y de confianza

Completar la base existente antes de habilitar cambios persistentes:

- separar desarrollo, pruebas y producción; secretos y respaldos bajo
  administración institucional;
- revisar el modelo de Auth, identidad y membresías; resolver el alcance real
  del contexto seleccionado (hoy el selector organiza la vista y no constituye
  por sí solo una frontera de autorización);
- ejecutar el verificador RLS actualizado y probar acceso permitido/denegado
  con cuentas y contextos de prueba;
- comprobar revocación de sesiones, cambios de rol, exportaciones, errores,
  rate limits y privilegios heredados;
- establecer pruebas automatizadas de negocio, autorización y contratos de
  datos; revisión de dependencias y requisitos técnicos de seguridad;
- definir respaldo, restauración, retención, continuidad, manejo de incidentes
  y recuperación de acceso;
- completar accesibilidad objetivo WCAG 2.2 AA en flujos prioritarios.

**Puerta de salida:** evidencia reproducible de las pruebas y revisión de
seguridad/privacidad; sin hallazgos críticos o altos sin mitigación aprobada.

### Fase C — Operación institucional mínima

Construir flujos auditables que sostengan el trabajo cotidiano antes de
expandir el expediente:

- solicitud/admisión con minimización de datos;
- lista de trabajo/espera con reglas operativas aprobadas y revisión humana;
- disponibilidad, agenda, cambios, cancelaciones y registro de asistencia
  conforme a política institucional;
- asignación, reasignación y transferencia de continuidad cuando cambia el
  profesional, revocando acceso anterior oportunamente;
- canalizaciones internas/externas con estado, responsable, consentimiento
  aplicable y datos mínimos;
- estados de caso y cierre/reapertura con motivo autorizado;
- auditoría de las operaciones y cola visible para la persona responsable.

**No usar** semáforos automáticos basados en síntomas para ordenar una lista
de espera. La prioridad clínica pertenece a un proceso humano, definido,
supervisado y cubierto operativamente.

**Puerta de salida:** pruebas de doble rol/contexto, casos de reasignación,
errores y cancelaciones; validación de coordinación y profesionales.

### Fase D — Continuidad clínica y supervisión

Solo después de aprobar modelos clínicos, documentales y jurídicos:

- notas estructuradas acordes a la práctica y normativa aplicable;
- firma/cierre según política, correcciones como addenda/versiones trazables,
  sin sobrescritura silenciosa;
- consentimiento, confidencialidad, restricciones por tipo de documento y
  trazabilidad de acceso;
- acceso por atribución al caso, con supervisión explícita y temporal cuando
  aplique;
- Storage privado separado por finalidad, validación de tipo/tamaño, malware,
  URL temporal y políticas probadas;
- exportación/redacción de informes con motivo, autorización y registro;
- alta, canalización y continuidad clínica con responsabilidad humana.

Grabación, dictado, transcripción, diagnóstico asistido, puntuación
psicométrica automatizada y sugerencias de tratamiento son decisiones futuras
independientes y no se incluyen en el primer flujo clínico.

**Puerta de salida:** revisión por profesionales autorizados, pruebas de
integridad/auditoría, RLS y Storage, plan de incidentes, consentimiento y
revisión legal aplicable.

### Fase E — Indicadores y evaluación institucional

Hacer confiables las decisiones directivas y coordinadoras:

- ficha versionada para cada indicador: propósito, marco lógico, fórmula,
  fuente, unidad, sentido, periodicidad, población, exclusiones y limitaciones;
- definición de metas, fechas de corte, responsables de captura y validación;
- linaje del dato, reglas de calidad, estados pendiente/capturado/revisado/
  validado/cerrado y correcciones auditables;
- paneles diferenciados por rol; resultados agregados, supresión de celdas
  pequeñas y límites de exportación según riesgo;
- comparación solo cuando los periodos, definiciones y cobertura sean
  comparables; notas metodológicas junto con el dato;
- auditoría de consultas/exportaciones y revisión periódica de las definiciones.

La pantalla actual ofrece lectura y cálculos descriptivos sobre filas visibles.
No debe convertirse en un sistema de captura/cierre mediante permisos DML
directos; definir una RPC/servicio controlado y aprobar su modelo de auditoría
antes de escribir.

**Puerta de salida:** aceptación de definiciones por responsables de datos y
programa, reconciliación de muestras y prueba de privacidad/reidentificación.

### Fase F — Experiencia digital de la persona usuaria

Evaluar un canal separado y progresivo, no un “portal completo” por defecto:

1. información institucional accesible, derechos, canales, ubicación y
   límites/horarios de respuesta;
2. solicitudes y citas propias, si la operación puede responderlas con
   capacidad y autenticación adecuadas;
3. consulta/descarga de información propia, cuando custodia, identidad,
   retención y excepciones estén definidas;
4. objetivos o materiales psicoeducativos compartidos por su profesional,
   solo si el servicio los incorpora y revisa.

No empezar con diarios de estado de ánimo, chat clínico abierto, familiares
con acceso delegado, gamificación de salud, crisis 24/7 ni seguimiento
automatizado. Evaluar cada uno como subproducto clínico y de privacidad.

**Puerta de salida:** pruebas de accesibilidad/usabilidad con usuarios
representativos, autenticación/recuperación de cuenta, soporte y política de
incidentes/respuesta publicada y operativa.

### Fase G — Piloto institucional controlado y expansión

- entorno separado con datos sintéticos y pruebas de aceptación;
- piloto acotado por unidad, perfiles, procesos y periodo aprobados;
- formación del personal, soporte, protocolo de contingencia y reversibilidad;
- medición de seguridad, calidad de datos, experiencia, accesibilidad y
  continuidad del servicio;
- revisión de incidentes, efectos no deseados y carga administrativa;
- decisión de ampliar, corregir, pausar o retirar, con acta de gobernanza.

Integraciones, FHIR, aplicación móvil, multiinstitución, marca blanca y
analítica avanzada se evalúan después del piloto y solo con necesidad,
financiación, acuerdos y controles establecidos.

## 7. Arquitectura de entrega

- **Núcleo institucional primero:** una institución/organización lógica, con
  unidad y programa; diseñar límites explícitos para futuras ampliaciones sin
  construir multi-tenancy SaaS prematuramente.
- **Autorización server-side:** RLS y APIs/RPC controladas; UI solo presenta
  capacidades, no concede acceso.
- **Separación progresiva:** esquema/tablas o vistas diferenciadas para
  identidad, operación, expediente, datos de medición y auditoría.
- **Eventos auditables:** log de quién/qué/cuándo/ámbito/resultado, evitando
  guardar contenido sensible en telemetría; controlar modificación del log
  conforme a capacidades reales del backend y proveedor.
- **Datos sintéticos:** desarrollo y pruebas con identidades y expedientes
  ficticios. No copiar producción a staging sin autorización y controles de
  desidentificación verificados.
- **Cambios de base:** migraciones versionadas, revisadas, respaldadas y
  ensayadas; evitar SQL manual no reproducible en ambiente productivo.
- **Integración:** APIs documentadas bajo contratos/versiones y necesidad de
  intercambio. HL7 FHIR es candidato de interoperabilidad a evaluar, no una
  obligación ni un modelo que deba imponerse ahora.
- **Seguridad de aplicación:** usar OWASP ASVS como lista de verificación
  técnica seleccionada y versionada, adaptada al nivel de riesgo; no afirmar
  conformidad sin una evaluación.

## 8. Gobierno de indicadores y desempeño

Toda decisión gerencial debe distinguir:

- volumen de actividad vs acceso/cobertura;
- resultado observado vs causalidad;
- periodo de captura vs periodo atendido;
- ausencia de registros visibles vs ausencia de actividad;
- meta institucional aprobada vs valor de referencia;
- tendencia válida vs cambio de definición o población.

No rankear terapeutas ni unidades usando métricas sin contexto, ajuste,
volumen suficiente, oportunidad de datos y revisión de sesgo. Los indicadores
de bienestar del equipo deben ser voluntarios, agregados cuando sea seguro y
separados de evaluación laboral.

## 9. Criterios transversales para aprobar una función

Cada propuesta nueva debe responder por escrito:

1. ¿Qué persona y decisión/proceso mejora?
2. ¿Quién es responsable del contenido y de responder a alertas/solicitudes?
3. ¿Qué dato requiere y cuál es el mínimo?
4. ¿Qué daño puede causar si falla, se filtra o se malinterpreta?
5. ¿Qué permiso, auditoría, retención, consentimiento y reversibilidad requiere?
6. ¿Cómo se prueba con casos permitidos y denegados?
7. ¿Cómo se mide adopción, equidad, calidad y carga operativa?
8. ¿Qué estándar, licencia, convenio o revisión local debe confirmarse?

Una función sin responsable de operación, fuente de verdad o respuesta segura
no se implementa todavía.

## 10. Marcos internacionales y uso correcto

Se usarán como referencias de diseño y verificación, no como certificaciones
ni sustitutos de la normativa aplicable:

- OMS, *Recommendations on digital interventions for health system
  strengthening* (2019): valora beneficios, daños, aceptabilidad,
  factibilidad, recursos y equidad, y advierte que una intervención digital
  no sustituye un sistema de salud funcional.
- OMS, *Global strategy on digital health 2020–2025*: referencia de
  gobernanza, interoperabilidad, privacidad, capacidades y enfoque centrado
  en las personas. Su periodo terminó; verificar estrategias sucesoras y
  políticas vigentes antes de usarla como política actual.
- OMS, *Ethics and governance of artificial intelligence for health* (2021):
  referencia de derechos, responsabilidad y gobernanza; no habilita por sí
  sola usos clínicos de IA.
- W3C, WCAG 2.2: objetivo de accesibilidad para los flujos prioritarios,
  sujeto a pruebas con tecnologías de asistencia.
- OWASP ASVS 5.0.0: base versionada para controles y pruebas de seguridad de
  aplicaciones web; no declarar cumplimiento sin evaluación.
- HL7 FHIR R5: estándar candidato para interoperabilidad clínica si existe un
  intercambio real aprobado; no es requisito de la fase actual.

Revisar con asesoría competente la aplicabilidad concreta en México, incluida
protección de datos personales sensibles, expediente clínico, conservación,
firma, firma electrónica, atención remota y convenios. NOM-004, NOM-024 y las
leyes mexicanas vigentes de protección de datos aplicables a particulares o
sujetos obligados (según naturaleza jurídica y rol de la universidad) solo se
incorporarán como obligaciones del proyecto después de confirmar alcance
institucional y servicio efectivamente prestado. HIPAA, GDPR u otros marcos
extranjeros no se declaran aplicables por analogía.

## 11. Próximo bloque de trabajo autorizado por este plan

El siguiente trabajo debe ser de definición y validación, no de sumar
funcionalidades sensibles:

1. validar con el usuario institucional responsable la definición del servicio
   y las perspectivas de roles;
2. construir el mapa operativo y la matriz de decisiones/permisos;
3. depurar el modelo actual contra esas decisiones, registrando migraciones
   necesarias sin ejecutarlas remotamente;
4. preparar fichas iniciales de indicadores como plantilla vacía, sin inventar
   metas ni definiciones institucionales;
5. elaborar pruebas de aceptación por rol/contexto con datos sintéticos;
6. actualizar el estado del plan después de cada puerta aprobada.

No ejecutar SQL contra Supabase ni introducir información clínica real como
parte de este bloque.
