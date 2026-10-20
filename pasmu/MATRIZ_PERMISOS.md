# Matriz inicial de permisos para PASMU

## Roles propuestos

| Rol | Descripción | Alcance sugerido |
|---|---|---|
| `coordinador_pasu` | Coordina la unidad de atención | institucional / unidad |
| `psicologo` | Atiende casos y registra expediente | unidad / caso |
| `supervisor` | Supervisa atención y practicantes | unidad / programa |
| `practicante` | Realiza atención bajo supervisión | caso / programa |
| `administrativo` | Maneja agenda y procesos administrativos | unidad |
| `analista_indicadores` | Consulta y reporta indicadores | institucional / unidad |
| `direccion` | Revisa resultados institucionales | institucional |
| `seguridad` | Evalúa eventos de auditoría y seguridad | institucional |

## Permisos sugeridos por categoría

### Autenticación y acceso

- `auth.login`
- `auth.recuperar_password`
- `auth.configurar_credenciales`

### Personas y perfiles

- `personas.ver`
- `personas.crear`
- `personas.editar`
- `personas.baja`

### Casos y atención

- `casos.ver`
- `casos.crear`
- `casos.editar`
- `casos.cerrar`
- `casos.reabrir`
- `agenda.ver`
- `agenda.programar`
- `agenda.editar`

### Expediente clínico

- `expediente.ver`
- `expediente.editar`
- `expediente.notas`
- `expediente.documentos`
- `expediente.consentimientos`

### Indicadores y reportes

- `reportes.ver`
- `reportes.exportar`
- `indicadores.crear`
- `indicadores.editar`

### Administración

- `admin.unidades`
- `admin.programas`
- `admin.roles`
- `admin.permisos`
- `admin.auditoria`
- `configuracion.ver`
- `configuracion.proponer`
- `configuracion.revisar`
- `configuracion.aprobar_alto_riesgo`

Los permisos `configuracion.*` se añadieron como capacidades separadas para el
flujo versionado de cambios. **No se asignan automáticamente a ningún rol**:
Dirección y Seguridad deben validar quién propone, quién revisa y quién puede
decidir sobre dominios de alto impacto. `aprobada` no significa `publicada`;
la activación requiere un mecanismo posterior, tipado y auditado.

## Regla importante

Los permisos deben evaluarse por contexto: rol + unidad + programa + caso. No basta con “usuario autenticado” ni “es admin”.
