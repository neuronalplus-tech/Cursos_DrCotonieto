# PASMU — Valoración estratégica del inventario funcional

**Registro de decisiones de producto · Versión 1.0 · 17 de octubre de 2026**

## 1. Cómo leer esta valoración

Se valoró el inventario adjunto, que declara 248 funcionalidades, como conjunto
de ideas y no como backlog aprobado. Las propuestas se repiten entre perfiles
(por ejemplo pagos, auditoría, telemedicina, alertas e indicadores), por lo
que se agrupan por capacidad para evitar contar la misma necesidad varias
veces.

Decisiones usadas:

- **Adoptar:** necesaria para el servicio institucional y alineada con el
  alcance, con controles requeridos.
- **Adaptar:** conservar el propósito, cambiando el diseño para una unidad
  universitaria y sus responsabilidades.
- **Posponer:** potencialmente valiosa, pero depende de gobernanza,
  infraestructura, evidencia, necesidad o presupuesto.
- **Excluir del alcance PASMU actual:** pertenece a un SaaS comercial, clínica
  privada u objetivo no institucional; no programar sin una redefinición
  formal del producto.
- **No automatizar en la primera versión:** alto potencial de daño, sesgo,
  vigilancia o falsa expectativa; una revisión humana puede seguir siendo
  pertinente.

“Adoptar” no significa que la función exista hoy. El estado implementado se
describe en el plan maestro. Ninguna propuesta habilita datos reales o
escrituras clínicas por sí sola.

## 2. Valoración del rol 1 — Dueño de plataforma SaaS global

| Familias del inventario | Decisión | Valoración para PASMU |
| --- | --- | --- |
| Suscripciones, licenciamiento por asiento, comisiones, split payments, pasarelas, reembolsos, impuestos, nómina comercial, margen y add-ons | Excluir del alcance actual | PASMU es un servicio institucional universitario, no un producto que cobre por consulta o licencie clínicas. Introducirlo cambiaría gobernanza, contabilidad, responsabilidad y conflicto de interés. |
| Planes SaaS, gestión de cuentas cliente, Customer Success, churn de clientes, referidos, afiliados, SEO, marketing, marketplace, directorio de terapeutas y reputación pública | Excluir del alcance actual | Busca vender/adquirir clientes. No mejora directamente el servicio universitario y podría comercializar datos/servicios sensibles. |
| Multi-tenant SaaS, marca blanca, dominios por cliente y apps móviles por marca | Posponer; adaptar límites institucionales | Diseñar desde el principio separación de institución/unidad y evitar cruces; no construir administración de tenants, marca blanca ni despliegue de apps de cliente hasta que la universidad apruebe expansión multiinstitucional. |
| Alta disponibilidad, redundancia, respaldos, restauración, monitoreo, límites de consumo y entornos de prueba | Adoptar como requisitos de plataforma | Definir RTO/RPO y SLA institucionales realistas según criticidad, proveedor y presupuesto; hacer pruebas de restauración y continuidad. No prometer 99.9% por copiar una cifra del inventario. |
| APIs, webhooks, importación masiva, SMTP institucional, multilingüe | Posponer por caso de uso | Requieren dueño de integración, minimización, contratos, validación y soporte. Migraciones masivas no se aceptan sin reconciliación, procedencia y controles de privacidad. |
| Form builder clínico y RBAC configurable a la medida | Adaptar / posponer | El modelo debe tener permisos y plantillas gobernados, versionados y probados. No permitir que cada unidad cambie políticas clínicas o roles libremente desde UI. |
| LMS/universidad virtual integrada | Excluir como producto integrado; integrar solo si hay proyecto de formación aprobado | Ya existe un sistema educativo separado; no mezclar expedientes ni dominios. Puede bastar un enlace o integración contractual. |
| Benchmarking, mapas de calor, motivos de consulta y mercado global | Excluir del lanzamiento; reevaluar investigación agregada | Riesgo de reidentificación, uso secundario y clasificación de personas. Solo con propósito, revisión ética/privacidad, umbrales y autorización explícita. |
| Normas clínicas/jurisdiccionales (NOM, HIPAA, GDPR), contratos, informes regulatorios, firmas electrónicas y consentimientos dinámicos | Adoptar la obligación de gobernanza; determinar aplicabilidad antes de construir | Validación jurídica local de alcance, sujeto obligado, custodia y validez de firma. Flujos de autorización/exportación solo después de definir propósito, destinatario, retención y auditoría; no prometer que un clic tiene validez legal. |
| Cifrado, auditoría, gobernanza, acceso por IP/dispositivo, anonimización y buzón ético | Adoptar propósito; adaptar controles | Evitar promesas no verificables como “militar” o “inmutable”. Registrar metadatos necesarios, evaluar proporcionalidad de restricciones IP/dispositivo, proteger denuncias y validar que la anonimización resista reidentificación antes de uso secundario. |
| Super-admin, tickets/helpdesk con SLA, chatbot de soporte, telemedicina técnica, control de versiones, sandbox y bienestar del personal | Adoptar controles de operación; posponer productos no necesarios | La plataforma necesita soporte, gestión de cambios, ambientes y respuesta a incidentes con alcances/tiempos realistas. El super-admin debe tener acceso técnico mínimo, nunca acceso rutinario a expedientes. Chatbot solo para soporte no clínico; bienestar no se usa para desempeño laboral. |
| IA de churn de clientes y generación automática de casos de éxito/prensa | Excluir del alcance actual | Son funciones comerciales, no necesidad asistencial. Las métricas no deben convertir historias clínicas en material promocional. |

## 3. Valoración del rol 2 — Dueño de clínica multiterapeuta

| Familias del inventario | Decisión | Valoración para PASMU |
| --- | --- | --- |
| Multi-sede, panel por unidad, espacios, consultorios, disponibilidad, turnos y equipos | Adaptar | Modelar instituciones/unidades/programas y operación de agenda de manera institucional. La reserva de salas y reglas de turnos se prioriza solo si la operación confirma el problema. |
| Directorio/credenciales del personal, convenios y practicantes, supervisores | Adoptar con minimización | Registrar solo acreditaciones y vigencias necesarias, con responsables de actualización y permisos de administración separados de notas clínicas. El modelo actual ya contempla personal, practicantes y supervisión, pero falta flujo operativo validado. |
| RBAC granular, salida de terapeuta y transferencia de casos | Adoptar como controles de operación | Los cambios de membresía deben tener vigencia y auditoría; las transferencias requieren plan humano de continuidad y revocar accesos previos. Evitar “reasignación automática” sin confirmar aceptación/responsabilidad. |
| Inventario de pruebas impresas, materiales e insumos | Posponer | No es núcleo de atención digital; incluir solo si se demuestra que impacta disponibilidad/seguridad de instrumentos o presupuesto institucional. |
| Lista de espera y triaje | Adaptar con control humano | Cola operativa con estado, fecha, responsable y criterios institucionales; valoración/prioridad clínica solo por personal competente bajo protocolo aprobado. Sin ranking automático por síntomas, presupuesto o predicción. |
| Portal para escuelas/colegios, aseguradoras, proveedores o psiquiatría externa | Posponer; intercambio mínimo y específico | No abrir canal externo general. Cada integración requiere convenio, base jurídica, consentimiento cuando corresponda, destinatario, propósito y revisión de datos divulgados. |
| Biométricos/geolocalización para asistencia | Excluir | Desproporcionado para el propósito y de alta intrusión. Si se necesita gestión de turnos, usar mecanismos menos invasivos y evaluar proporcionalidad. |
| Caja, pagos, honorarios, comisiones, facturación, gastos, cartera, payer mix y seguros | Excluir del alcance actual | Pertenecen a clínica privada/finanzas. Convenios institucionales de atención, si existen, se modelan como proceso administrativo aprobado separado de expediente clínico. |
| Adquisición, fidelización comercial, membresías, marketing, marca blanca | Excluir | No corresponden a un servicio universitario; no optimizar la retención comercial de usuarios de salud. |
| NPS y encuestas | Adaptar / posponer | Medir experiencia y acceso con instrumento y propósito definidos, opción de respuesta segura, tratamiento transparente y reporte agregado; no usar el NPS como resultado clínico ni evaluación laboral. |
| Finanzas en tiempo real, productividad por terapeuta, churn/abandono, previsión | Excluir o adaptar a capacidad del servicio | PASMU puede requerir carga y acceso/cobertura institucional, no rentabilidad ni rankings. Interpretar abandono/inasistencia con criterios clínicos y contexto, no como churn comercial. |
| Custodia del expediente, consentimientos, credenciales y auditoría | Adoptar con validación normativa | Definir responsable de custodia, expediente, acceso, modificación, conservación y exportación con asesoría institucional. La plataforma no “garantiza cumplimiento” sin evaluación formal. |
| Revisión de notas y reunión clínica | Adaptar | Supervisión con alcance, asignación y motivo explícitos. Las alertas de pendientes sirven al flujo, no como vigilancia masiva del personal. |
| Salud mental/burnout del equipo | Posponer como programa institucional independiente | No inferir bienestar individual desde horas o rendimiento. Cualquier medición debe ser voluntaria, confidencial, no disciplinaria y gestionada por un servicio competente. |

## 4. Valoración del rol 3 — Coordinación y supervisión clínica

| Familias del inventario | Decisión | Valoración para PASMU |
| --- | --- | --- |
| Admisión, asignación, reasignación, interconsulta y continuidad | Adoptar/adaptar | Son flujos centrales. Las recomendaciones del sistema pueden ordenar información operativa, pero la decisión de asignación corresponde al equipo autorizado y queda trazada. |
| Matching por diagnóstico, gravedad, presupuesto, modelo terapéutico o “compatibilidad” automatizada | No automatizar; descartar scoring inicial | Puede producir sesgo, sobreinterpretar datos y trasladar responsabilidad clínica al algoritmo. Permitir filtros operativos aprobados y decisión humana explicable. |
| Espera con semáforo de riesgo, early warning suicida, escalación automática en cadena | No automatizar en el lanzamiento | Antes se necesitan protocolo clínico, cobertura real, responsabilidad, tiempos, contactos alternos y pruebas. La interfaz no debe sugerir vigilancia 24/7. |
| Revisión/aprobación de notas, retroalimentación y diligenciamiento | Adaptar tras gobernanza clínica | Definir qué notas requieren supervisión, quién tiene acceso, plazo, addenda y desacuerdos; evitar que todo coordinador vea todos los contenidos. Supervisión formativa no equivale a auditoría de cumplimiento laboral. |
| Auditoría de adherencia a guías, diagnóstico, comorbilidad y estancamiento | Posponer como evaluación humana | Auditoría de calidad clínica exige marco autorizado, datos adecuados y revisión competente. No imponer rutas terapéuticas ni inferencias diagnósticas automatizadas. |
| Planes de seguridad, consentimiento, informes legales e incidentes críticos | Adoptar como procesos/políticas; digitalizar después | Definir responsables y respuesta fuera del sistema primero. Reportes externos requieren autorización, minimización y registro. No enviar detalles clínicos en notificaciones. |
| Horas de supervisión, competencias de practicantes y formación | Adoptar con separación de datos | Alinea con misión universitaria; diferenciar registro académico/formativo de expediente. Establecer supervisión y atribuciones; no exponer expedientes al curso/LMS. |
| Casos anonimizados, observación en vivo, grabación y calibración diagnóstica | Posponer; grabación desactivada por defecto | Requiere consentimiento separado, evaluación ética/jurídica, anonimización comprobada, derechos de revocación y borrado. Para formación, preferir casos sintéticos o material desidentificado revisado. |
| Peer review, reuniones clínicas e interconsultas | Adaptar | Facilitar agenda/minuta de acuerdos con control de acceso; registrar solo información necesaria. La minuta no debe duplicar indiscriminadamente la nota clínica. |
| Resultados clínicos, PHQ-9/GAD-7/ORS/SRS, tareas e interrupción | Posponer sujeto a validación/licencia clínica | Seleccionar instrumentos pertinentes y autorizados, traducción/población, propósito, consentimiento y respuesta a respuestas preocupantes. No inferir estancamiento o abandono con X sesiones sin validar. |
| Bienestar y carga de complejidad por terapeuta, burnout, plan de mejora individual | Adaptar/posponer | La institución puede monitorear capacidad agregada y disponibilidad para prevenir sobrecarga; no construir score personal opaco, vigilancia emocional o PIP automático. |
| Alta, abandono, derivación externa, quejas y dilemas éticos | Adoptar flujos humanos con acceso diferenciado | Incorporar motivos, responsable, seguimiento, acceso y límites; canal ético/queja debe ser confidencial y no compartir con el supervisor denunciado por defecto. |

## 5. Valoración del rol 4 — Terapeuta/profesional

| Familias del inventario | Decisión | Valoración para PASMU |
| --- | --- | --- |
| Agenda diaria/semanal, modalidad, disponibilidad, recurrencia, salas y cancelaciones | Adoptar por etapas | Agenda es parte del flujo. Comenzar con consulta protegida y cambios controlados/auditados; sincronización Google/Outlook solo tras revisar terceros, metadatos y consentimiento. |
| Telemedicina, sala de espera, chat, temporizador y modo Focus | Posponer | Necesita política de atención remota, proveedor, seguridad, privacidad, respuesta a fallas, identificación y plan de contingencia. No construir videollamada propia de inicio. |
| Expediente longitudinal y plantillas clínicas | Adoptar tras validación clínica/legal | Acordar contenido mínimo y criterios de nota, autoría, corrección, firma, cierre, confidencialidad y conservación antes de habilitar captura. Las plantillas no prescriben una escuela teórica. |
| Dictado, redacción asistida por IA, diagnóstico DSM/CIE y treatment planner inteligente | No incluir inicialmente | Riesgos de exposición a proveedores, alucinación, sesgo, errores y autoría. Si se evalúa, requiere análisis de impacto, evaluación clínica y legal, contratos, consentimiento y control humano; nunca decisión autónoma. |
| Multimedia, archivos, PDF y expedientes familiares/vinculados | Posponer | Storage y exportación requieren políticas independientes, prevención de filtración, segregación, consentimiento y manejo de terceros; la identidad compartida familiar multiplica riesgos. |
| Pruebas psicométricas, genograma, farmacoterapia, vademécum | Posponer por gobernanza y licencia | Definir autorización profesional, derechos de uso, validez para población, interpretación y respuesta a resultado. No traducir/escalar instrumentos o recomendaciones farmacológicas sin autoridad competente. |
| Recursos psicoeducativos | Adoptar como biblioteca curada más adelante | Controlar licencia, versión, accesibilidad, responsable del material y adecuación poblacional. Asignar recurso no significa monitorear conducta del usuario. |
| Tareas, diarios y resultados reportados por usuario | Posponer como intervención optativa | Requiere consentimiento y límites de revisión/respuesta, separación de notas privadas y clínica, política de retención, riesgo de mensajes sin atender y carga del equipo. No incorporar diarios privados en MVP. |
| Checklist de crisis, contactos, seguridad, auditoría y tareas posconsulta | Adaptar | Procedimiento con juicio profesional, protocolos aprobados, acceso y auditoría. No es un sustituto de emergencias ni debe activar mensajes automáticos a personas no responsables. |
| Honorarios, cobros, no-show con sanción y análisis personal de productividad | Excluir/adaptar a operación | Sin cobro por consulta. Las inasistencias pueden medirse como acceso/continuidad con contexto y revisión; no generar deuda o ranking automáticamente. |
| Reportes externos, cierre/alta, límites de comunicación y autocuidado | Adoptar/adaptar por política | Cierre, derivación e informes requieren revisión humana. Horarios y canales de comunicación deben indicar si son monitoreados y qué hacer en urgencia. El autocuidado no se usa para evaluación laboral. |

## 6. Valoración del rol 5 — Persona usuaria del servicio

| Familias del inventario | Decisión | Valoración para PASMU |
| --- | --- | --- |
| Portal, onboarding, derechos, encuadre, ubicación y accesibilidad | Adoptar por fases, empezando por información pública segura | Una persona atendida no es un usuario Auth de personal. Antes de mostrar información propia se requiere identidad, recuperación segura, apoyo y proceso de privacidad. |
| Matching público, perfiles comerciales, ranking y adquisición | Excluir | PASMU no es directorio ni mercado de terapeutas. La asignación del servicio se gobierna institucionalmente, no por ranking comercial. |
| Solicitud/cita/reprogramación propia | Posponer como primer servicio transaccional de portal | Puede mejorar acceso, pero requiere capacidad operativa, reglas, autenticación, privacidad de recordatorios y manejo de cancelaciones. |
| Pagos, wallets, seguros, facturas, paquetes, financiación | Excluir del alcance actual | No corresponden a prestación universitaria no comercial; reevaluar únicamente si existe esquema institucional formal distinto. |
| Consentimientos/avisos, acceso a derechos y solicitudes de datos | Adoptar proceso y lenguaje claro; implementación digital tras revisión | No tratar un clic como firma legal suficiente. Portabilidad/eliminación requiere identidad, custodia, retención y excepciones verificadas. |
| Teleconsulta, mensajería, tareas, plan terapéutico y material asignado | Posponer | Cada canal crea expectativas de disponibilidad y respuesta. Iniciar con canales informativos; servicios clínicos requieren cobertura, consentimiento y supervisión. |
| Diario emocional, seguimiento de ánimo, microhábitos y puntuaciones | No incluir por defecto | Generan datos de alta sensibilidad y posibles señales de riesgo. Solo incorporarlos si paciente y profesional los acuerdan, se define quién monitoriza, por cuánto tiempo y qué respuesta existe. |
| Botón de crisis, grounding y plan personal | No presentar como servicio de emergencia automática | Publicar recursos locales verificados, horarios y límites; cualquier plan de seguridad es individual y elaborado con profesional. Ejercicios digitales no sustituyen atención de crisis. |
| Familia, red de apoyo, sesiones grupales y comunidad | Posponer con consentimiento y moderación | Requieren delegación granular, revocación, identidad de participantes, protección de menores, confidencialidad y reglas de comunidad. |
| Recursos de continuidad, cierre, mantenimiento y acceso tras alta | Adaptar | Es coherente con continuidad asistencial, pero el contenido y acceso posalta dependen de retención, política de custodia y capacidad del servicio. |
| Gamificación, mensajes motivacionales y notificaciones | Posponer / limitar | Evitar presión, estigma, exposición en pantalla bloqueada y falsa inferencia de progreso. Preferir preferencias explícitas y comunicaciones discretas. |

## 7. Valoración de capacidades transversales

| Familia transversal | Decisión | Condiciones |
| --- | --- | --- |
| RBAC/ABAC, RLS, separación por contexto | Adoptar | Roles institucionales aprobados, pruebas negativas/positivas, revocación eficaz y revisión por cambios de personal. ABAC adicional solo si resuelve una regla real. |
| Auditoría, cambios, exportación y accesos | Adoptar | Backend, mínimo dato, acceso a logs restringido, retención definida y protección contra alteración acorde a capacidades reales. No usar contenido de nota en telemetría. |
| Cifrado y cadena de consentimiento | Adoptar controles proporcionados | Cifrado en tránsito/reposo según proveedores y arquitectura; E2EE no prometer en todo flujo si impide funciones de supervisión/recuperación. Separar consentimiento asistencial, investigación, grabación y comunicaciones. |
| Alertas en cadena y crisis automatizadas | No automatizar | Solo diseñar tras protocolo aprobado, personal cubriendo turnos, escalación probada, falsas alarmas/omisiones tratadas y explicación inequívoca del horario del servicio. |
| Split payment y conciliación fiscal | Excluir | Inherente a SaaS/negocio privado, no al producto PASMU actual. |
| Comunicación multidisciplinaria | Adaptar | Interconsulta con necesidad de saber, resumen mínimo, propósito, autorizaciones y registro. No construir un chat general dentro de expedientes. |
| Notificaciones omnicanal | Posponer | Preferencias, plantillas, zona horaria, metadatos discretos, proveedor y consentimiento; no enviar diagnóstico ni “crisis” a pantalla bloqueada. |
| Satisfacción, calibración, calidad y resolución de quejas | Adaptar | Gobernanza independiente, confidencialidad, instrumento y propósito válidos; no mezclar queja clínica con reputación pública. |
| Early warning de abandono y analítica predictiva | No incluir inicialmente | No hay definición de abandono, datos de entrenamiento, validación, consentimiento ni proceso de respuesta. Primero medir descriptivamente con límites. |
| Psicometría y diagnóstico automatizados | No incluir inicialmente | Licencia, evidencia, población, responsabilidad y gobernanza clínica obligatorias; puntuación no equivale a diagnóstico. |
| Derechos, privacidad, portabilidad y custodia | Adoptar como proceso institucional | Canal verificable para solicitudes, plazo/responsable y revisión de conservación; no prometer borrado total cuando pueda existir obligación de retención. |
| Continuidad por ausencia de terapeuta | Adoptar como proceso, no como acceso de emergencia abierto | Plan de cobertura y reasignación humana, acceso temporal por necesidad y registro; revocar permisos al terminar. |
| Repositorio institucional de conocimiento | Adaptar | Curaduría, licencias, vigencia, accesibilidad, clasificación y responsable. Material global no se publica al usuario sin revisión institucional. |

## 8. Decisiones de alto riesgo explícitas

### Funciones de crisis y riesgo suicida

No hay base en el prototipo para monitorización clínica ni cobertura continua.
No crear una alerta automática, panel de riesgo global, algoritmo de
priorización o botón “emergencia” que dé a entender que alguien responderá.
La institución debe definir primero el protocolo, roles, horarios, servicios
externos, respaldo y comunicaciones, y aprobarlo clínicamente. El sistema
posterior puede apoyar registro/seguimiento, con responsabilidad humana
explícita y pruebas de extremo a extremo.

### Productividad y evaluación del personal

No mostrar rankings de terapeutas por número de sesiones, notas, retención,
abandono o escalas sin gobernanza, ajuste de carga, calidad de datos y
oportunidad de revisión. Separar medición de capacidad institucional,
supervisión formativa y evaluación laboral.

### IA y automatización clínica

No enviar texto clínico a servicios externos de IA en este alcance. Cualquier
experimento futuro exige análisis de impacto, finalidad autorizada, datos
controlados, contrato/procesamiento, pruebas de sesgo y seguridad, revisión
profesional y opción de no uso. Nunca atribuir la decisión al sistema.

### Atención a menores, terceros y terapias vinculadas

Las propuestas sobre menores, tutores, familiares, parejas o escuelas requieren
reglas de capacidad, representación, consentimiento, acceso diferenciado,
secreto profesional y conflicto de intereses. No deben modelarse como un
usuario adicional con acceso al mismo expediente.

## 9. Marcos internacionales y límites de cumplimiento

La selección de referencias se explica en el plan maestro. Se aplican como
guías de diseño y evidencia:

- OMS: comparar beneficios, daños, factibilidad, aceptabilidad, recursos y
  equidad; lo digital complementa, no sustituye, un servicio funcional.
- OMS para IA en salud: derechos, responsabilidad y gobernanza antes de usos
  clínicos automatizados.
- W3C WCAG 2.2 y OWASP ASVS 5.0.0: objetivos verificables de accesibilidad y
  seguridad web.
- HL7 FHIR R5: opción futura de interoperabilidad, si hay sistema receptor y
  caso aprobado.

No afirmar cumplimiento HIPAA/GDPR/NOM o certificación de seguridad por usar
Supabase, RLS o estos marcos. La aplicabilidad se determina con la institución
y asesoría jurídica/técnica competente según jurisdicción y servicio.

## 10. Resultado de la revisión

Las propuestas que más aportan al propósito de PASMU son: continuidad de
atención, admisión/asignación humana y trazable, agenda y canalizaciones,
documentación clínica gobernada, supervisión y formación de practicantes,
experiencia/derechos de la persona usuaria, indicadores con ficha y calidad de
datos, auditoría y continuidad operativa.

Las funciones comerciales de clínica/SaaS se excluyen; las capacidades
predictivas, diagnósticas, de crisis y vigilancia se posponen o no se
automatizan. La matriz no solicita que se construyan 248 funciones: establece
un filtro estratégico para decidir qué entra en el plan maestro y en qué
condiciones.

## 11. Referencias

- OMS, *Recommendations on digital interventions for health system
  strengthening* (2019):
  <https://www.who.int/publications/i/item/9789241550505>
- OMS, *Global strategy on digital health 2020–2025*:
  <https://www.who.int/publications/i/item/9789240020924>
- OMS, *Ethics and governance of artificial intelligence for health* (2021):
  <https://www.who.int/publications/i/item/9789240029200>
- W3C, *Web Content Accessibility Guidelines (WCAG) 2.2*:
  <https://www.w3.org/TR/WCAG22/>
- OWASP, *Application Security Verification Standard 5.0.0*:
  <https://owasp.org/www-project-application-security-verification-standard/>
- HL7, *FHIR Release 5 (R5)*:
  <https://www.hl7.org/fhir/summary.html>
