# PASMU — Cambios generados 18-oct-2026 (bloques A+B+C, sin desplegar)

> Prototipo. Sin datos clínicos reales. SQL solo para proyecto Supabase de PRUEBAS aprobado.

## A) Fixes seguros aplicados
- `src/components/Expediente.jsx`: `Datos care` → `Datos del caso`.
- `src/components/Casos.jsx`: aviso demo vs real + formulario `Crear caso controlado`
  (solo `casos.crear` + sesión Supabase; motivo 5-500 sin PII; expediente sintético `SIN-xxxxxxxx`).
- `src/components/Agenda.jsx`: aviso demo vs real; programación aún vía RPC pendiente de habilitar.
- `src/services/pasmuService.js`: `crearCasoControlado/programarAgendaControlada/crearNotaControlada`
  vía wrappers `pasmu_caso_crear/pasmu_agenda_programar/pasmu_nota_crear`.

## B) Gobierno tipado sin activar
- `sql/10_payloads_tipados.sql`: tabla `configuracion_contratos` + RLS solo-lectura.
- `sql/10b_contratos_seed.sql`: 9 contratos v1 por dominio.
- `sql/10c_validador_contrato.sql`: `private.pasmu_payload_contrato_valido`
  anti-PII/clínico/SQL/scripts/URLs.
- `src/lib/configurationGovernance.js`: `containsForbiddenPayloadContent()` +
  rechazo en `validateConfigurationDraft()` en rationale/proposal/impact/rollback/evidence.
- Tests: 27/27 en `pasmu/web` (`npm test --prefix pasmu/web`).
- No asigna `configuracion.*`. No publica ni activa. Requiere 04+09 antes; 08 en OK antes/después.

## C) Lecturas + escrituras controladas (mínimo viable)
- `sql/11a_casos_controlados.sql`: vista `vista_auditoria_redactada` (hora+evento, sin PII)
  + `private.pasmu_caso_crear` (permiso `casos.crear`, motivo genérico, auto-asigna responsable).
- `sql/11b_agenda_notas.sql`: `pasmu_agenda_programar` (permiso `agenda.programar`,
  valida rango) + `pasmu_nota_crear` (permiso caso + asignación `caso_profesionales`).
- `sql/11c_wrappers_publicos.sql`: wrappers `public.pasmu_*` SECURITY DEFINER con
  `grant execute to authenticated`; revoca ejecución directa de `private.*` a `authenticated`.
- Negativas cubiertas en servidor: 42501 sin permiso/asignación/perfil; 22023 rango/contenido inválido.
- Storage clínico sigue pendiente (sin políticas Storage; sin adjuntos reales).

## Orden de aplicación en PRUEBAS (manual, por responsable autorizado)
1. `01,02,03,04,05` (o `07+05+04` si venías de v1) → `08` debe dar `OK/0`.
2. `09` → `04` → `08` debe seguir `OK/0`.
3. `10,10b,10c` → `08` debe seguir `OK/0`.
4. `11a,11b,11c` → prueba: crear caso con rol sin `casos.crear` debe fallar 42501;
   programar con rango inválido 22023; nota sin asignación 42501.
5. Asignar `configuracion.ver/proponer/revisar` solo tras aprobar matriz autoridad;
   `aprobar_alto_riesgo` solo Dirección+Seguridad para 4 dominios críticos.

## Qué NO se hizo (requiere decisión institucional)
- Publicación/activación de configuraciones, vigencia, notificaciones, reversión operativa.
- Payloads tipados por dominio más allá de contrato mínimo (queda como `esquema` JSON extensible).
- Políticas Storage + adjuntos/documentos/consentimientos desde UI.
- Auditoría redactada completa (solo vista de eventos de cambio, no de `auditoria_*`).
- Despliegue Pages, dominios Auth/CORS, SMTP, respaldos, accesibilidad/monitoreo.
