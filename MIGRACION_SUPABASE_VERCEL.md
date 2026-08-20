# Guía de Migración a Supabase y Vercel — Catalina #06

Esta guía detalla los pasos para migrar el Mini ERP **Catalina #06** a tu propia infraestructura en **Supabase** (Base de datos PostgreSQL y almacenamiento) y **Vercel** (Despliegue web), garantizando que no pierdas ningún dato ni las evidencias fotográficas archivadas.

---

## 1. Crear el proyecto en Supabase

1. Entra a [Supabase Dashboard](https://app.supabase.com) y crea un nuevo proyecto.
2. Copia la **Connection String (URI de conexión PostgreSQL)** en modo *Session* o *Transaction* desde *Settings > Database*.
3. Ejecuta el esquema Drizzle PostgreSQL (`drizzle/schema_pg.ts`) en el Editor SQL de Supabase para crear las tablas (`users`, `expense_categories`, `expenses`, `expense_invoices`, `expense_approvals`, `expense_change_logs`, `expense_grid_styles`) con sus respectivos enums.

---

## 2. Configurar el Almacenamiento en Supabase (S3 / Storage)

1. En tu panel de Supabase, ve a **Storage** y crea un Bucket público o privado llamado `catalina-06-invoices`.
2. Configura las credenciales S3 compatibles que provee Supabase Storage (*Settings > Storage > S3 API*):
   - `S3_ENDPOINT`
   - `S3_ACCESS_KEY_ID`
   - `S3_SECRET_ACCESS_KEY`
   - `S3_REGION` (ej. `us-east-1`)

---

## 3. Subir el Repositorio a GitHub

1. Crea un repositorio nuevo en tu cuenta personal u organización de GitHub.
2. Sube el código fuente preparado:
   ```bash
   git remote add origin https://github.com/TU_USUARIO/catalina-erp-06.git
   git branch -M main
   git push -u origin main
   ```

---

## 4. Desplegar en Vercel

1. Entra a [Vercel Dashboard](https://vercel.com), haz clic en **Add New > Project** e importa tu repositorio de GitHub.
2. Configura las **Environment Variables** en Vercel con los siguientes valores:
   - `DATABASE_URL`: Tu cadena de conexión PostgreSQL de Supabase.
   - `JWT_SECRET`: Una clave secreta segura para las sesiones de usuario.
   - `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`: Credenciales de Supabase Storage.
   - `BUILT_IN_FORGE_API_KEY` y `BUILT_IN_FORGE_API_URL` (si usas funciones avanzadas de IA).
3. Haz clic en **Deploy**. Vercel compilará automáticamente el proyecto utilizando el archivo `vercel.json` y la estructura configurada.

---

## 5. Verificación de Datos y Usuarios

Al iniciar sesión por primera vez con los correos autorizados:
- **Ing. Raymond Angomas** (`ingangomas@gmail.com`)
- **Ing. Johan Nuñez** (`Ing.johannunez@gmail.com`)
- **Lic. Juan Isidro Caraballo** (`contabilidad@constructoraangote.com`)

El sistema reconocerá sus perfiles preasignados y conservará todos los registros de gastos, aprobaciones, auditorías y evidencias archivadas.
