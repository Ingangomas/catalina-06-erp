# Validación de interfaz

## Sesión autenticada — 25 de julio de 2026

- La ruta `/gastos` cargó con la sesión autenticada del Administrador.
- La cuadrícula mostró un gasto real, con columna de fecha, descripción, categoría, tipo, responsable, monto, evidencia, estado y acciones.
- Se confirmaron los controles visibles de **Insertar fila**, **Tomar foto**, **Nuevo gasto**, **Cambiar mi nombre** y **Editar**.
- La tabla conserva desplazamiento horizontal para mostrar todas las columnas en pantallas estrechas.

Pendiente de completar en esta sesión: abrir el modal de edición y comprobar el flujo visual de captura de una factura sin crear ni modificar datos reales.

La acción **Editar** de la fila autenticada abrió correctamente el modo de edición en línea. Se mostraron controles de fecha, descripción, categoría, tipo y monto precargados con los valores existentes del gasto. No se guardó ninguna modificación durante esta comprobación.

La sesión autenticada expuso nueve selectores de color, uno por columna de la cuadrícula. Se aplicó temporalmente el color `#fff4cc` a la columna **Fecha** para comprobar su guardado. También se verificó que el control de factura acepta imágenes JPEG y PNG, una sola evidencia por acción, con `capture="environment"` para solicitar la cámara trasera de un teléfono compatible.

Tras recargar `/gastos` en la misma sesión autenticada, la cuadrícula y su gasto volvieron a cargar correctamente. La siguiente comprobación confirmará el valor persistido del selector sin alterar ninguna fila.

La primera simulación de cambio no actualizó la preferencia persistida, por lo que se repitió mediante el evento nativo del control de color. El selector reflejó `#fff4cc` en la sesión actual; se requiere una última recarga para confirmar el valor almacenado antes de cerrar la validación.

La recarga final confirmó la persistencia: el selector de la columna **Fecha** conservó `#fff4cc` y la cabecera se mostró como `rgb(255, 244, 204)`. La verificación se ejecutó en una sesión autenticada y no modificó ningún dato financiero.

La acción **Insertar fila** añadió una segunda fila editable sin guardar ningún gasto. La fila temporal mostró fecha, descripción, categoría, tipo, responsable, monto y el mensaje de que la evidencia se adjunta después de guardar, junto con la acción **Guardar**. Se cerrará sin usar esa acción para no crear un registro de prueba.

Al recargar la ruta autenticada, la fila temporal desapareció y permaneció únicamente el gasto real de **Compra varillas**. Esto confirma que insertar una fila no persiste información hasta la acción explícita de guardar.

En la sesión autenticada se activó el acceso **Tomar foto** sin seleccionar ni cargar ningún archivo. No se creó evidencia ni se modificó el gasto existente durante esta comprobación; la selección de una factura real queda reservada al uso operativo desde el dispositivo móvil.

La acción **Editar** fue validada de forma observable en la fila autenticada. La interfaz mostró los campos precargados con fecha `2026-07-25`, descripción **Compra varillas**, tipo **Global/Compartido** y monto `10000`, además de los selectores de categoría y tipo. No se guardó ninguna modificación durante la prueba.

La factura vertical de prueba se revisó en tres recortes superpuestos, de arriba hacia abajo. Los datos legibles incluyen el proveedor **Ferretería Detallista S.A.**, la referencia de factura **E310000219480**, artículos de construcción (block, cemento gris Titan y varilla) y un total de **RD$22,814.95**. La fecha impresa aparece literalmente como `3/2/2026`; su orden día/mes no se infirió y debe revisarse antes de guardar. El comprobante muestra pago por transferencia bancaria y un código QR.

La carga real de `PRUEBA1.jpeg` se completó dentro del formulario autenticado sin guardar un nuevo gasto. La lectura asistida respondió con **gemini-3.1-pro-preview** (confianza mostrada: 99 %) y propuso descripción de materiales de construcción, monto `22814.95`, fecha `2026-02-03`, mes `2026-02` y categoría **Materiales**. La propuesta coincidió con el total y los artículos visibles; el tipo de gasto se mantuvo en **Global/Compartido** para revisión manual. El formulario quedó sin enviar para no crear datos de prueba no confirmados.

## Anulación segura — 25 de julio de 2026

- La ruta autenticada `/gastos` mostró la acción visible **Anular** junto a **Editar** para un gasto en borrador; la acción queda disponible de acuerdo con el rol y el estado del registro.
- La revisión de `voidExpenseRecord()` confirmó que la transacción solamente consulta el gasto, actualiza su estado a `voided` y agrega una entrada `voided` a `expense_change_logs`. No ejecuta borrados sobre `expense_invoices` ni opera sobre el almacenamiento S3.
- La relación con las evidencias se conserva: `expense_invoices` mantiene la clave de almacenamiento y la URL de cada archivo, mientras que `listExpenseRecords()` excluye el gasto anulado del listado operativo después de obtener sus filas. Por tanto, la anulación elimina el gasto de los totales operativos sin eliminar la evidencia vinculada.
- Se reinició el servicio para limpiar el módulo en memoria. La comprobación de TypeScript, las 21 pruebas Vitest y la compilación de producción finalizaron correctamente.
- La prueba automatizada `expenseVoidPersistence.test.ts` ejecutó la transacción de anulación con una factura hipotéticamente ya archivada y confirmó que la operación solamente actualiza el gasto e inserta la auditoría; no invoca ninguna eliminación de la relación de facturas.
- No se ejecutó el clic final de anulación sobre el gasto real de la sesión autenticada, ya que ello modificaría datos operativos. Queda pendiente una prueba controlada con un registro autorizado para validar visualmente el motivo, la confirmación y el resultado posterior a la anulación.

## Auditoría de anulaciones — 25 de julio de 2026

- Se añadió la ruta autenticada `/auditoria`, visible exclusivamente para **Contador** y **Administrador**. Expone el gasto anulado, motivo, estado previo, usuario y fecha de anulación, además de los enlaces de las evidencias preservadas.
- El procedimiento `expenses.listVoided` aplica la misma restricción en el servidor; `voidAuditAccess.test.ts` verifica que un socio recibe acceso denegado y que el Contador obtiene únicamente los registros del mes solicitado.
- La pantalla muestra estados de carga, estado vacío y un mensaje recuperable con el botón **Reintentar** si la consulta de auditoría falla. La vista se revisó en escritorio y móvil sin crear ni modificar registros productivos.
- La comprobación final `pnpm check && pnpm test && pnpm build` terminó correctamente: 21 pruebas en 8 archivos y empaquetado de producción exitoso. El empaquetador mantiene una advertencia no bloqueante sobre el tamaño del bundle principal, que podrá optimizarse con división de código en una mejora posterior.

## Prueba operativa autorizada de anulación — 25 de julio de 2026

- Con autorización explícita se creó el gasto controlado **“PRUEBA CONTROLADA — conservar evidencia tras anulación”**, por **RD$1.00**, con fecha y período `2026-07`, categoría **Materiales**, tipo **Global/Compartido** y la evidencia `PRUEBA1.jpeg` cargada mediante el formulario autenticado. La evidencia fue archivada y el gasto quedó enviado para revisión.
- Se detectó que los avisos nativos del navegador impedían una confirmación fiable en la interfaz. Se sustituyeron por un diálogo accesible propio, con explicación de las consecuencias, campo de motivo obligatorio y acción explícita **Confirmar anulación**. TypeScript, las 21 pruebas Vitest y la compilación de producción terminaron correctamente después del cambio.
- La anulación se confirmó con el motivo **“Prueba autorizada de preservación de evidencia y trazabilidad.”**. La cuadrícula operativa pasó de dos a un registro y el gasto de prueba dejó de aparecer en `/gastos`.
- El resumen mensual permaneció en **RD$10,000.00** y un registro operativo, por lo que el gasto de prueba de RD$1.00 no afectó los totales ni las métricas activas.
- En `/auditoria` se verificó un registro anulado, una evidencia preservada, el motivo, el estado previo `submitted`, la persona que anuló y la fecha. El enlace `PRUEBA1.jpeg` abrió correctamente el archivo archivado, lo que confirma su accesibilidad posterior a la anulación.

## Sistema visual corporativo — 29 de julio de 2026

- Se renovó la identidad de Catalina #06 con una base institucional de azul marino, fondos claros de baja saturación y una tipografía contemporánea de alta legibilidad. La navegación incorpora una firma `CATALINA #06`, iconografía contenida y una jerarquía editorial enfocada en control y trazabilidad.
- La identidad tipográfica está implementada de forma global: `client/index.html` carga **Manrope** y **Newsreader** desde Google Fonts, mientras `client/src/index.css` aplica Manrope al cuerpo de la aplicación. Esta combinación produce una lectura limpia, con una referencia editorial sobria para el estilo solicitado.
- Los tokens y utilidades de diseño están centralizados en `client/src/index.css`. El bloque `:root` define la paleta semántica, radios, bordes, colores de gráfico y navegación; las utilidades `glass-surface`, `surface-card`, `hero-surface`, `glass-input`, `page-eyebrow`, `page-title` y `page-lede` implementan transparencias, elevación, desenfoque, espaciado y jerarquía compartidos.
- Se definieron superficies claras translúcidas, bordes suaves, sombras de baja profundidad, campos de formulario redondeados y controles tipo pastilla. Los botones secundarios adoptan un acabado de cristal con desenfoque y los botones principales mantienen contraste suficiente para acciones financieras.
- El nuevo lenguaje se aplicó a la navegación, cabeceras, resumen, gastos, reportes, auditoría, equipo y roles. La cuadrícula conserva sus funciones existentes de edición, color y desplazamiento horizontal; los estados, permisos y flujos no se modificaron.
- Se revisaron `/gastos`, `/reportes`, `/auditoria` y `/equipo` en escritorio, y `/gastos`, `/auditoria` y `/equipo` en móvil. Las superficies, jerarquía, acciones y campos se conservaron legibles en ambos tamaños. Las tablas siguen ofreciendo desplazamiento horizontal cuando el contenido supera el ancho móvil.
- La verificación final `pnpm check && pnpm test && pnpm build` completó correctamente: 21 pruebas en 8 archivos, TypeScript sin errores y compilación de producción exitosa. Permanece únicamente la advertencia no bloqueante del empaquetador sobre el tamaño del bundle principal.

## Identidades operativas y permisos — 30 de julio de 2026

- Se configuró **Ing. Raymond Angomas** (`ingangomas@gmail.com`) como Administrador y titular de **Gastos Ing. Raymond**. Conserva el acceso completo del proyecto.
- Se preasignó **Ing. Johan Nuñez** (`ing.johannunez@gmail.com`) como Administrador y titular de **Gastos Ing. Johan**. Al iniciar sesión con ese correo, su perfil autorizado sustituirá de forma segura la identidad provisional y conservará ambos atributos.
- Se preasignó **Lic. Juan Isidro Caraballo** (`contabilidad@constructoraangote.com`) como Contador. Puede crear, editar, revisar y asignar gastos para ambos titulares, sin quedar asociado a una categoría personal de gastos.
- Se separó el permiso de acceso de la titularidad de gasto mediante `expenseOwnerType`. Con ello, Raymond y Johan mantienen acceso administrativo sin perder el vínculo correcto para la asignación de sus gastos; el Contador puede seleccionar a cualquiera de ellos al crear o editar un registro.
- La vista `/equipo` muestra los tres nombres, correos, accesos y titulares de gasto. Johan y Juan aparecen como **Pendiente de primer acceso**, evitando atribuirles un inicio de sesión que no ha ocurrido. La suite final completó **25 pruebas en 9 archivos**, TypeScript sin errores y una compilación de producción correcta.

## Exportación mensual de reportes y evidencias — 25 de agosto de 2026

- La pantalla `/reportes` incorpora **Exportar reporte + fotos**. El paquete se genera para el mes seleccionado y descarga un archivo ZIP independiente; por ejemplo, julio produce `catalina-06-reporte-evidencias-2026-07.zip`.
- La estructura interna se organiza bajo una carpeta legible como `catalina-06-julio-2026/`, con `reporte/` para el CSV, `inventario-evidencias.json`, `LEEME.txt` y `evidencias/julio-2026/` para las facturas y fotografías. Agosto y septiembre siguen el mismo patrón con `agosto-2026` y `septiembre-2026`.
- La exportación obtiene copias temporales de las evidencias mediante URL firmada de S3 y crea un ZIP nuevo en el área de exportaciones. No modifica ni elimina las claves ni los archivos fuente ya archivados bajo facturas; el inventario conserva la referencia de cada evidencia incluida.
- El procedimiento reutiliza los filtros de visibilidad de gastos, por lo que cada usuario solo exporta las evidencias y registros que tiene permiso de consultar. Se mantiene el control de acceso de los socios, Contador y Administrador.
- La interfaz confirma el número de evidencias empaquetadas, muestra un estado específico si el período no tiene facturas o fotografías y ofrece **Reintentar** ante un error sin cambiar el mes elegido.
- La prueba `monthlyEvidenceExport.test.ts` ejecuta la creación real del ZIP, inspecciona sus entradas y verifica CSV, inventario, carpeta mensual, contenido de evidencia y que solo se consulte la fuente y se guarde el nuevo archivo. La validación final completó **30 pruebas en 11 archivos**, TypeScript sin errores y compilación de producción exitosa.
