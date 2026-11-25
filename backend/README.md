# Aegis Salud API

Backend REST para Aegis Salud, desarrollado con Laravel 13, PHP 8.4, Sanctum y una base de datos MySQL compatible. En el entorno local actual se usa MariaDB de XAMPP; MySQL 8.4 también es compatible.

## Requisitos

- PHP 8.3 o posterior, con `fileinfo`, `mbstring`, `openssl`, `pdo_mysql` y `zip`.
- Composer 2.
- MySQL 8.4 o MariaDB compatible.

## Preparar la base de datos en Windows

1. Copia `.env.example` a `.env` y ejecuta `php artisan key:generate`.
2. Define en `.env` `DB_CONNECTION=mysql`, `DB_DATABASE=aegis_salud`, `DB_USERNAME=aegis_app`, `DB_PASSWORD` (la contraseña que elijas) y `AEGIS_DEMO_PASSWORD` (mínimo 8 caracteres; solo para cuentas de demostración locales). No compartas ni subas `.env`.
3. En MySQL o MariaDB como administrador, ejecuta [aegis-database-setup.sql](database/aegis-database-setup.sql); cambia ahí la contraseña de `aegis_app` para que coincida con `.env`.
4. Inicia el servicio MySQL/MariaDB que ya instalaste (por ejemplo, desde el panel de XAMPP). No inicialices ni reemplaces un directorio de datos existente.

Las cuentas de demostración se crean únicamente en `local` o `testing` y usan el valor configurado en `AEGIS_DEMO_PASSWORD`. Usa exclusivamente información ficticia. Las cuentas locales de Farmacia son `farmacia@aegissalud.test` y `farmacia2@aegissalud.test`; la misma configuración demo aplica. En el entorno local actual, MariaDB 10.4 de XAMPP escucha en `127.0.0.1:3306`.

## Iniciar la aplicación

Para reiniciar todo de forma consistente en Windows, ejecuta `Iniciar-AegisSalud.ps1` desde la carpeta raíz del proyecto. El iniciador comprueba MySQL/MariaDB, aplica solo migraciones pendientes, vuelve a asegurar las cuentas locales de demostración usando `AEGIS_DEMO_PASSWORD` y levanta la API y Angular si no están activos. No elimina ni reinicia la base de datos.

Como alternativa, con MySQL/MariaDB activo, crea las tablas y usuarios demo e inicia la API manualmente:

```powershell
Set-Location 'C:\Users\josia\Downloads\Proyecto_Calidad_de_Software\backend'
php artisan migrate --force
php artisan db:seed --force
php artisan serve
```

La API estará disponible en `http://127.0.0.1:8000`; las rutas API están bajo `/api`. Mantén también activa la interfaz Angular en `http://localhost:4200` (pasos en el README del frontend). El proxy de desarrollo reenvía `/api` a Laravel.

## Funciones operativas

- Los roles controlan las rutas y módulos disponibles. Las sesiones de la interfaz se cierran tras 15 minutos sin actividad.
- Administración y Recepción pueden actualizar pacientes y perfiles médicos. El personal clínico solo puede editar pacientes con consulta a su cargo; Enfermería solo puede actualizar pacientes vinculados a su Kardex. La edición de perfiles médicos está bloqueada para Enfermería y otros roles clínicos.
- El código rojo habilita solicitudes de acceso de emergencia por paciente, sujetas a motivo, expiración y auditoría. Los permisos temporales de rol también expiran y pueden revocarse.
- Se registran ausencias y candidatos de cobertura; se gestionan fichas de cobro y pagos parciales, requisiciones quirúrgicas con descuento de inventario y reportes de defectos con tiempo de resolución.
- Administración y Alimentación reciben payloads sin notas clínicas, síntomas ni diagnósticos; las notas de consulta son inmutables y las correcciones se agregan como adendas.
- El alta requiere autorizaciones médica y administrativa por separado. La facturación calcula cobertura y copago según la póliza; descuentos y cancelaciones requieren reautenticación de Administración.
- La dispensación farmacéutica consume primero lotes vigentes con caducidad más próxima (FEFO), registra cada lote, rechaza existencias vencidas/no trazables y crea el cargo del paciente. Los medicamentos controlados exigen credenciales válidas de un médico además de la sesión de Farmacia.
- Los cambios de agenda, consultorios y órdenes notifican a los usuarios según el flujo existente.
- Administración puede asignar dos cuentas activas de Farmacia y responsables activos para Almacén y Alimentos desde Usuarios y roles. La misma sección permite asignar enfermería a consultorios; las asignaciones se mantienen en la base de datos.
- El médico vinculado a su cuenta puede registrar la atención de sus propias citas. El administrador puede consultar el historial diario de pacientes atendidos, consultorios y horarios registrados.
- Administración puede vincular cuentas médicas a sus perfiles desde la edición del directorio; el registro de atención se autoriza únicamente contra ese vínculo.
- Consultorios ofrece calendario de reservas futuras con validación de empalmes; creación y cancelación quedan en la bitácora administrativa, al igual que sus cambios de disponibilidad.
- La integración con lectores biométricos o tarjetas requiere hardware y protocolo del dispositivo; no está implementada.

Al añadir migraciones, aplica únicamente las pendientes con `php artisan migrate --force`. No vuelvas a sembrar cuentas en producción; las cuentas demo solo se aseguran en los entornos locales y de prueba.

## Comandos útiles

```powershell
composer install
php artisan migrate
php artisan route:list --path=api
php artisan test
```

Las pruebas usan SQLite en memoria y no modifican la base local.
