# PASMU — Réplica de lógicas Cursos_DrCotonieto

**18-oct-2026 · Diseño + SQL/frontend local. Solo PRUEBAS. Sin datos reales.**

## Mapeo Cursos → PASMU
| Cursos | PASMU | Archivo nuevo |
|---|---|---|
| `permisos.js mis_permisos/org + roles.js puede()` | `mis_permisos_pasmu` + hook | `13_altas_bitacora.sql`, `lib/permisosPasmu.js` |
| `AdminRoles.jsx` alta con sede/categoría | Altas con instituto/unidad + 2 botones | `components/Altas.jsx` |
| `padron.js parsePadron` TSV | Padrón clínico (email ancla, sin crear por typo) | `lib/padronClinico.js` |
| `CentroGestion SECCIONES/ANATOMIA` | `ANATOMIA_PASMU` expediente modular | `lib/anatomiaPasmu.js`, `components/ExpedienteModular.jsx` |
| `banco.js + material.js RPC` | Banco recursos por objetivo clínico | `14_expediente_banco.sql`, `components/BancoRecursos.jsx` |
| `correo.js edge + whatsapp.js` | Avisos cita por canal + consentimiento | `lib/avisos.js`, `16_avisos_asistencia.sql` |
| `BITACORA.sql` triggers | Triggers a `auditoria_actividad` por instituto | `13_altas_bitacora.sql` |
| `asistencia.js + PaseDeLista` | `PaseSesion.jsx` presente-default | `components/PaseSesion.jsx` |
| `ExportarDatos.jsx` CSV+LEEME | `ExportarCaso.jsx` sin notas crudas | `components/ExportarCaso.jsx` |

## Reglas clínicas (no negociables)
- Responsable solo alta en sus unidades; admin general → responsables.
- Botón Equipo ≠ botón Paciente. Paciente nunca ve expediente ajeno ni banco crudo.
- Material sensible sin SELECT directo; solo RPC `material_del_caso`.
- Avisos solo con consentimiento + canal elegido; sin PII clínica en texto.
- Bitácora inmutable por triggers; vista redactada por instituto.
