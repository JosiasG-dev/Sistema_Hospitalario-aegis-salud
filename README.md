# Aegis Salud - Sistema Integral de Gestion Hospitalaria

Aegis Salud es una solucion tecnologica integral disenada para la gestion clinica, operativa, logistica y administrativa de instituciones hospitalarias y centros de salud. La plataforma articula la atencion de pacientes, la practica medica, el control de inventarios farmaceuticos y de suministros, la nutricion hospitalaria, la programacion quirurgica y el flujo de facturacion bajo estrictos estandares de seguridad, trazabilidad y control de acceso basado en roles (RBAC).

---

## Indice

1. Arquitectura del Sistema
2. Modulos Principales
3. Flujos de Trabajo y Logica de Negocio
4. Seguridad y Auditoria
5. Roles y Permisos
6. Requisitos del Entorno
7. Instalacion y Puesta en Marcha
8. Pruebas Automatizadas y Validacion
9. Estructura del Repositorio

---

## 1. Arquitectura del Sistema

El sistema esta construido con una arquitectura desacoplada cliente-servidor:

- **Frontend (aegis-salud):**
  - Framework: Angular 19+ con componentes standalone.
  - Estilos y Componentes: Tailwind CSS, diseno responsivo y paleta institucional uniforme.
  - Iconografia: Lucide Angular.
  - Comunicacion: Servicios HTTP orientados a endpoints REST con interceptores de autenticacion y proxies de desarrollo.
  - Validaciones: Formularios reactivos con catalogos cerrados (evitando errores manuales de captura en unidades de medida, proveedores y estados).

- **Backend (backend):**
  - Framework: Laravel (PHP 8.3 / 8.4).
  - Autenticacion: Laravel Sanctum para emision y validacion de tokens de sesion con expiracion por inactividad.
  - Base de Datos: MySQL 8.4 / MariaDB con integridad referencial estricta, llaves foraneas y restricciones unicas de asignacion y citas.
  - Arquitectura Interna: Controladores tipados, FormRequests para saneamiento y validacion de entradas, politicas de autorizacion, migraciones incrementales y seeders con datos realistas y pruebas de consistencia.

---

## 2. Modulos Principales

### Gestion de Pacientes y Expedientes
- Registro, actualizacion y control de expedientes clinicos con expediente unico.
- Proteccion de datos sensibles mediante reautenticacion por contrasena para modificaciones criticas.
- Admision, triaje, gestion de estancias y asignacion a camas/consultorios.
- Flujo bidireccional de altas: propuesta y autorizacion medica complementada con la autorizacion administrativa final.

### Directorio y Programacion Medica
- Registro de facultativos con cedula profesional, especialidad y vinculacion a cuentas de acceso.
- Asignacion de turnos y consultorios con validacion temporal que cubre registros historicos pasados y programaciones futuras.
- Baja y desactivacion de personal medico con verificacion estricta de credenciales de seguridad.

### Consultorios y Espacios Hospitalarios
- Administracion de salas de consulta, areas de especialidad y quirofanos.
- Asignacion de personal de enfermeria por consultorio y turno.
- Inventario de equipamiento por espacio.
- Control de disponibilidad operativa con botonera directa y confirmacion por contrasena para modificaciones de estado o bajas.
- Deteccion automatica de traslapes en la programacion de espacios.

### Agenda de Citas Medicas
- Programacion interactiva con comprobacion de conflictos de agenda para medico, paciente y consultorio.
- Registro explicito del motivo de la consulta.
- Modulo de edicion de citas y cancelacion respaldada por justificacion y validacion de contrasena del operador.

### Atencion Clinica y Consultas
- Registro de constantes vitales, notas clinicas, diagnosticos (CIE-10/estandares) y prescripciones.
- Inmutabilidad de notas clinicas: toda correccion se realiza mediante adendas cronologicas no destructivas.
- Separacion de privilegios: los roles de logistica, compras y alimentos no tienen visibilidad de notas intimas ni sintomas.

### Farmacia y Dispensacion de Medicamentos
- Control de stock farmaceutico clasificado por lotes y fechas de caducidad.
- Algoritmo de dispensacion FEFO (First-Expired, First-Out): consumo prioritario de existencias proximas a expirar y bloqueo automatico de lotes vencidos o no trazables.
- Doble autorizacion obligatoria para medicamentos controlados (requiere intervencion y credenciales de medico facultativo ademas del personal de farmacia).
- Integracion directa con el estado de cuenta y facturacion del paciente al momento del despacho.

### Nutricion y Dietetica (Servicio de Alimentos)
- Gestion de requerimientos dieteticos segun indicaciones clinicas del paciente.
- Flujo de preparacion en dos etapas: elaboracion culinaria por parte del nutricionista/cocina y liberacion/autorizacion administrativa para distribucion.
- Solicitudes de viveres e insumos mediante catalogo estructurado.

### Almacenes, Suministros e Inventarios
- Gestion multicatalogo de insumos medicos, quirurgicos, material de curacion, viveres y enseres hospitalarios.
- Catalogos predeterminados con unidades de medida estandarizadas mediante selectores (Kilogramo, Gramo, Litro, Mililitro, Pieza, Caja, Paquete, Frasco, Ampolleta, Rollo, etc.) para eliminar inconsistencias tipograficas.
- Directorio de proveedores clasificados por giro comercial (farmaceutica, alimentos, equipos medicos, material descartable, etc.).

### Flujo de Compras y Adquisiciones
- Circuito controlado de compras donde la Administracion tiene la primera y la ultima palabra:
  1. Solicitud de mercancia emitida por los encargados de area (Almacen, Farmacia, Nutricion, Enfermeria).
  2. Evaluacion y aprobacion inicial por parte de la Administracion.
  3. Ejecucion de la compra y recepcion fisica por parte del responsable del almacen.
  4. Confirmacion de cierre y verificacion de conformidad a cargo de la Administracion.
- Alertas y notificaciones automaticas dirigidas a la bandeja administrativa ante cualquier requerimiento.

### Facturacion y Cobranza
- Ficha de cuenta de paciente unificada: concentracion de cargos por consulta, estancia, medicamentos y procedimientos.
- Calculo parametrico de coberturas de seguros de gastos medicos, deducibles y copagos.
- Registro de pagos parciales y totales.
- Modificaciones, descuentos y cancelaciones protegidas bajo reautenticacion de supervisores administrativos.

---

## 3. Flujos de Trabajo y Logica de Negocio

### Aprobaciones Administrativas y Logistica
A diferencia de sistemas convencionales donde el personal de almacen puede cerrar compras arbitrariamente, Aegis Salud implementa segregacion de funciones:
- Los encargados de Almacen, Farmacia y Nutricion no pueden dar por finalizado un pedido sin intervencion central.
- El Administrador recibe notificaciones en tiempo real en su panel y valida la recepcion documental y fisica de las compras.

### Proteccion de Operaciones Criticas por Contrasena
Para evitar errores involuntarios o manipulacion no autorizada, las siguientes operaciones requieren el ingreso de la contrasena del usuario en sesion:
- Edicion de datos personales y sensibles de pacientes.
- Alta, modificacion de datos y baja de personal medico.
- Modificacion de especificaciones o baja de consultorios.
- Reagendamiento y cancelacion de citas medicas.
- Aplicacion de descuentos y cancelacion de comprobantes fiscales/recibos.

---

## 4. Seguridad y Auditoria

- **Laravel Sanctum:** Gestion segura de tokens de autorizacion con cierre automatico de sesion tras 15 minutos de inactividad.
- **Protocolo Codigo Rojo:** Mecanismo de excepcion para acceso a expedientes en emergencias clinicas, sujeto a justificacion obligatoria, vigencia limitada en el tiempo y generacion de log de auditoria forense.
- **Bitacora de Auditoria:** Registro detallado (usuario, direccion IP, operacion realizada, entidad modificada, marca de tiempo) en base de datos para todas las acciones administrativas y clinicas.
- **Proteccion de Variables Sensibles:** Exclusion total de credenciales y claves privadas (.env) del control de versiones.

---

## 5. Roles y Permisos

El sistema contempla una estructura de roles con permisos estrictamente acotados:

- `admin`: Control total del sistema, supervision global de flujos, aprobacion final de compras, altas hospitalarias, configuracion de usuarios y asignacion de roles.
- `recepcion`: Registro de pacientes, asignacion y gestion de citas, directorio de atencion al publico.
- `medico_general`: Consulta externa, atencion de citas asignadas, expedicion de recetas y propuesta de altas.
- `especialista`: Consultas especializadas, emision de interconsultas y prescripciones.
- `enfermeria`: Gestion de Kardex, administracion de medicamentos, soporte en consultorios y asignaciones clinicas.
- `farmacia`: Despacho de medicamentos segun ordenes medicas, control de lotes FEFO y recepcion de inventario farmaceutico.
- `nutricion`: Preparacion y despacho de dietas, solicitud de insumos alimenticios.
- `almacen`: Recepcion, custodia, control de existencias y registro fisico de pedidos autorizados.
- `compras`: Cotizacion y gestion con proveedores bajo ordenes aprobadas.
- `cirugia`: Programacion quirurgica y requisicion de material especializado.

---

## 6. Requisitos del Entorno

- **PHP:** Version 8.3 o 8.4 con extensiones `pdo_mysql`, `mbstring`, `openssl`, `fileinfo`, `zip`, `tokenizer`.
- **Node.js:** Version 18.x, 20.x o 22.x LTS y npm.
- **Gestor de paquetes PHP:** Composer 2.x.
- **Base de Datos:** MySQL 8.4 o MariaDB 10.4+ (incluido en entornos locales como XAMPP).
- **Sistema Operativo:** Compatible con Windows, Linux y macOS.

---

## 7. Instalacion y Puesta en Marcha

### Opcion Rapida para Windows (Recomendada)

El proyecto incluye un script de inicializacion que verifica el servicio MySQL, aplica migraciones pendientes, asegura las cuentas de demostracion y levanta tanto la API como la interfaz:

```powershell
.\Iniciar-AegisSalud.ps1
```

### Configuracion Manual

#### 1. Configuracion del Backend

1. Acceder al directorio del backend:
   ```powershell
   cd backend
   ```
2. Instalar dependencias de PHP:
   ```powershell
   composer install
   ```
3. Configurar el archivo de entorno:
   Copiar `.env.example` a `.env` y configurar las credenciales de base de datos (`DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`) y la clave demo (`AEGIS_DEMO_PASSWORD`).
4. Generar la clave de la aplicacion:
   ```powershell
   php artisan key:generate
   ```
5. Ejecutar migraciones y semillero de datos:
   ```powershell
   php artisan migrate --force
   php artisan db:seed --force
   ```
6. Iniciar el servidor local de desarrollo:
   ```powershell
   php artisan serve
   ```
   La API quedara accesible en `http://127.0.0.1:8000`.

#### 2. Configuracion del Frontend

1. Acceder al directorio del cliente Angular:
   ```powershell
   cd aegis-salud
   ```
2. Instalar dependencias de Node.js:
   ```powershell
   npm install
   ```
3. Iniciar el servidor de desarrollo con proxy a la API:
   ```powershell
   npm start
   ```
4. Ingresar a la aplicacion desde el navegador en `http://localhost:4200`.

---

## 8. Pruebas Automatizadas y Validacion

### Pruebas Unitarias y de Integracion del Backend
El backend cuenta con una suite completa de pruebas automatizadas (Feature y Unit) configuradas para ejecutarse sobre una base de datos SQLite en memoria:

```powershell
cd backend
php artisan test
```

### Compilacion de Produccion del Frontend
Para verificar la integridad de los tipos y construir los activos estaticos optimizados:

```powershell
cd aegis-salud
npm run build
```

---

## 9. Estructura del Repositorio

```text
Proyecto_Calidad_de_Software/
├── Iniciar-AegisSalud.ps1      # Script de inicializacion y orquestacion automatica
├── Logo.jpeg                   # Logotipo oficial del sistema
├── README.md                   # Documentacion general del proyecto
├── .gitignore                  # Exclusion de artefactos, dependencias y credenciales
├── aegis-salud/                # Aplicacion cliente (Angular 19)
│   ├── src/
│   │   ├── app/                # Componentes standalone, servicios, guardias e interfaces
│   │   └── assets/             # Recursos estaticos e imagenes
│   ├── angular.json            # Configuracion de compilacion y proxy
│   ├── package.json            # Dependencias de npm
│   └── tsconfig.json           # Configuracion del compilador TypeScript
└── backend/                    # API de servicios (Laravel 13 / PHP 8.4)
    ├── app/
    │   ├── Http/Controllers/  # Controladores REST por modulo
    │   ├── Models/             # Modelos Eloquent y relaciones
    │   └── Policies/           # Politicas de autorizacion y seguridad
    ├── database/
    │   ├── migrations/         # Definicion de esquemas y tablas
    │   └── seeders/            # Semilleros de demostracion con datos clinicos realistas
    ├── routes/                 # Rutas de API y autenticacion
    └── tests/                  # Suite de pruebas automatizadas con PHPUnit
```

---

## Licencia

Este proyecto ha sido desarrollado con fines academicos y de demostracion de calidad de software y seguridad hospitalaria. Todos los datos precargados son ficticios.
