# Preparación para Cloudflare Pages

Este documento prepara el despliegue estático de PASMU; no autoriza ni ejecuta una publicación. La aplicación sigue siendo un prototipo y no debe recibir datos clínicos reales.

## Configuración de Pages

- Directorio raíz del proyecto: `pasmu/web`
- Framework: Vite
- Comando de instalación: `npm ci`
- Comando de compilación: `npm run build`
- Directorio de salida: `dist`
- El archivo `public/_redirects` conserva las rutas de React Router al recargar una URL profunda.
- `public/_headers` aplica cabeceras de seguridad básicas y evita cachear el HTML de entrada. No se configura una CSP hasta probar todos los orígenes y flujos de autenticación requeridos.

Configurar primero un proyecto/ambiente de preview separado del de producción. Revisar el artefacto y recorrer inicio de sesión, rutas protegidas, cierre de sesión y navegación directa antes de habilitar un dominio institucional. Si se vincula el repositorio, limitar las publicaciones de producción a la rama aprobada.

## Variables públicas de compilación

Si se prueba integración con Supabase, configurar en el ambiente de preview:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (o `VITE_SUPABASE_ANON_KEY` para la clave pública legacy)

Estas variables se incorporan al JavaScript que recibe cualquier visitante: son configuración pública, no secretos. Nunca configurar `service_role`, claves secretas ni credenciales administrativas en variables `VITE_*`, en el repositorio o en el navegador. No copiar `.env.local` al proyecto de Pages.

En Supabase, autorizar el dominio temporal/preview y el dominio final en las URL de redirección de Auth; mantener los orígenes de preview separados de producción. Verificar también CORS, URL del sitio, recuperación de cuenta y callbacks antes de probar autenticación.

## Puertas antes de publicar con datos institucionales

1. Aplicar las migraciones solo en un proyecto Supabase de pruebas aprobado y comprobarlas con `08_verificar_rls.sql`; la migración `09_gobierno_configuracion.sql` aún no se ha aplicado ni ejecutado en PostgreSQL.
2. Probar autorización y RLS con cuentas separadas, roles, unidades, casos sin unidad y usuarios sin permisos; cubrir también intentos de acceso directo a RPC.
3. Obtener aprobación de Dirección, responsable clínico, privacidad/jurídico y tecnología/seguridad para el alcance y el tratamiento de datos.
4. Completar pruebas de accesibilidad, privacidad, recuperación de errores, respaldo, monitoreo y respuesta a incidentes.
5. Revisar el build de producción y la configuración del dominio; confirmar que no se publicaron datos, mapas fuente ni secretos.

Una publicación estática de demostración también requiere aprobación explícita si va a hacerse desde la cuenta institucional. No ejecutar despliegues, migraciones remotas ni habilitar datos reales como parte de esta preparación.
