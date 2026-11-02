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

## Módulo 5: capacidad de almacenamiento (se actualiza solo desde OneDrive)
Los asistentes siguen actualizando sus dos Excel en OneDrive. El sitio los descarga **cada hora**, los procesa y publica el análisis; no hay que cargar nada.

Funciona igual que el Módulo 4: una **carpeta** de OneDrive por cada seguimiento.
1. En OneDrive crea (o usa) una carpeta para cada seguimiento, por ejemplo:
   - `Seguimiento Capacidad Backus` → *Seguimiento Cap Almacenamiento Callao 2023 v1.xlsx* (se lee la hoja "Seguimiento").
   - `Seguimiento Capacidad MKP` → *Seguimiento Cap Almacenamiento Callao MKP 2026.xlsx* (hojas "KPI WU MKP <MES> <AÑO>").
   Puedes dejar varios Excel en cada carpeta (por ejemplo, uno por año): se combinan por fecha y, si una fecha se repite, manda el archivo modificado más recientemente. Los Excel que no tengan esas hojas se ignoran.
2. Comparte cada **carpeta**: clic derecho → Compartir → "Cualquier persona con el vínculo" → Puede ver → Copiar vínculo (empieza con `https://1drv.ms/f/...`).
3. En admin.html → **Capacidad** → **Fuentes**: pega los dos enlaces → **Guardar enlaces** → **Sincronizar ahora**.
   (Alternativa: variables de entorno `CAP_BACKUS_URL` y `CAP_MKP_URL` en Netlify.)
4. Desde ese momento la función `cap-sync` revisa las carpetas **cada hora**. Solo vuelve a procesar y publicar cuando algún archivo cambió (nombre, tamaño o fecha de modificación). Requiere que el sitio esté desplegado desde GitHub.
5. Si tu OneDrive es empresarial (SharePoint), las carpetas no se pueden leer sin iniciar sesión. En ese caso comparte cada archivo Excel individual (también se acepta) o usa **Carpeta local** en Fuentes y elige la carpeta sincronizada de OneDrive en tu PC: se procesa y publica al instante.

Reglas del análisis:
- La capacidad total se toma de los layouts **Normal y Peak Season** del Módulo 1 (no de la columna CAPC del Excel).
- WU = almacenado ÷ capacidad. Umbrales: menos de 70 % holgado, 70–85 % alto, 85–95 % alerta, 95 % o más saturado.
- Se excluyen los días con errores de digitación evidentes (RT + NRT ≠ TOTAL en más de 10 %, o un total mayor que 2 veces la capacidad). Se listan en "Calidad de datos".
- Proyección: Holt-Winters estacional mensual (12 meses) con tendencia amortiguada y banda del 80 %. El pico esperado usa la relación pico/promedio histórica de cada mes.

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
- `netlify/functions/cap-sync.mjs` y `lib/`: sincronización horaria de capacidad desde OneDrive (Módulo 5).
- `netlify.toml` y `package.json`: configuración de Netlify.
