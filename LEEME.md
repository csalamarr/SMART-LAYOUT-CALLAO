# SmartLayout CALLAO: publicación automática en la web

## Cómo funciona
- **admin.html** (solo tú): cargas el CIERRE PT diario, las ventas, el maestro o el pronóstico, y **se publica solo** en la web.
- **index.html** (asistentes, operadores y demás usuarios): siempre muestra la última información publicada y se actualiza sola cada 5 minutos. No tiene opciones para cargar ni configurar nada.
- Los datos se guardan en tu propio sitio de Netlify (Netlify Functions + Netlify Blobs). Solo se puede publicar con la **clave de administrador** (ADMIN_KEY).

## Configuración inicial (una sola vez, unos 15 minutos)
1. **GitHub**: entra a github.com, crea un repositorio nuevo (puede ser privado), por ejemplo `smartlayout-callao`.
   Elige "uploading an existing file" y arrastra **todo el contenido de esta carpeta**, incluida la carpeta `netlify`. Pulsa "Commit changes".
2. **Netlify**: Add new site → Import an existing project → GitHub → elige el repositorio → Deploy.
   La configuración se toma sola del archivo netlify.toml.
   - Si ya tienes el sitio creado con arrastrar y soltar y quieres conservar la misma dirección: en tu sitio ve a Site configuration → Build & deploy → **Link repository**.
3. **Clave**: en Netlify ve a Site configuration → Environment variables → Add variable:
   - Key: `ADMIN_KEY`
   - Value: una clave larga que solo tú conozcas.
   Después ve a Deploys → Trigger deploy → Deploy site.
4. Abre `https://TU-SITIO.netlify.app/admin.html` → botón **Publicar** → escribe la clave → **Guardar y probar clave**. Debe aparecer "✓ Clave correcta".

## Uso diario: sin generar HTML ni volver a subir nada a Netlify
- **Módulos 2 y 3**: en admin.html → Layout Diario → arrastra el CIERRE PT del día. Se publica al terminar de procesarse.
- **Módulo 4**: en admin.html → Analítica ABC → agrega los VENTA del mes, el MAESTRO actualizado o el PRONÓSTICO. Se publica al terminar.
- **Módulo 1**: si cambias un layout maestro (Cargar Excel local / Sincronizar OneDrive), también se publica solo.
- Para comprobar qué hay en la web: botón **Publicar** → muestra la fecha de cada paquete y permite republicar.

## Seguridad
- Sin la ADMIN_KEY nadie puede modificar los datos, aunque abra admin.html.
- La clave se guarda solo en el navegador donde la escribiste. Cámbiala en Netlify cuando quieras.
- Los datos publicados se pueden leer con el enlace del sitio, igual que index.html.

## Módulo 4: reglas aplicadas
- Se excluyen las líneas ANULADO = X y la fila de totales al final de cada archivo de venta.
- ABC: A ≤ 80 %, B 80–95 %, C 95–100 % del volumen acumulado, calculado dentro de cada portafolio (Backus / Marketplace, según la columna TIPO del maestro).
- Adherencia del pronóstico = 1 − Σ|real − pronóstico| ÷ Σ real, en hectolitros.

## Archivos
- `index.html`: vista de consulta.
- `admin.html`: carga y publicación.
- `netlify/functions/api.mjs` y `handler.mjs`: servicio de datos.
- `netlify.toml` y `package.json`: configuración de Netlify.
