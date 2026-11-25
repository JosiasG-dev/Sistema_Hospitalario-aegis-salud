# Aegis Salud

Aplicación Angular para el entorno demostrativo Aegis Salud. La interfaz requiere la API Laravel del directorio `../backend` y una base MySQL local; usa únicamente datos ficticios.

## Ejecutar localmente en Windows

La forma recomendada de iniciar o reiniciar el sistema es ejecutar `Iniciar-AegisSalud.ps1` en la carpeta raíz del proyecto. El script aplica migraciones pendientes, asegura las cuentas demo y levanta la API y la interfaz sin borrar datos.

También puedes iniciar MySQL y Laravel siguiendo las instrucciones de [backend/README.md](../backend/README.md). En otra terminal:

```powershell
Set-Location 'C:\Users\josia\Downloads\Proyecto_Calidad_de_Software\aegis-salud'
npm install
npm start
```

Abre `http://localhost:4200/`. El servidor de desarrollo reenvía las solicitudes `/api` a Laravel en `http://127.0.0.1:8000`. Las cuentas de demostración creadas por el seeder usan la contraseña indicada en `AEGIS_DEMO_PASSWORD` en `backend/.env`.

## Compilar

```powershell
npm run build
```
