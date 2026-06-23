# Herramienta de Diagnóstico de Fallas

Aplicación web para análisis de causa raíz (RCA) que guía al usuario a través de 4 pasos: captura del problema, diagrama de Ishikawa, 5 porqués y plan de acción.

## Características

- **Captura del problema** — registro de fecha, máquina, tiempo de paro, síntomas, responsable
- **Diagrama de Ishikawa** — 6 categorías (Máquina, Método, Materiales, Mano de obra, Medición, Medio ambiente) con generación automática del diagrama
- **5 Porqués** — análisis jerárquico con historial y causa raíz
- **Plan de Acción** — acciones correctivas y preventivas con responsable, fecha y prioridad
- **Vista de datos** — tabla completa con edición inline
- **Exportación** — PDF profesional y Excel (.xlsx)
- **Gráfico de Pareto** — acumulado histórico de causas raíz por máquina
- **Persistencia** — auto-guardado en localStorage + archivo JSON

## Tecnologías

- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [Font Awesome 6](https://fontawesome.com/)
- [jsPDF](https://github.com/parallax/jsPDF) — exportación PDF
- [ExcelJS](https://github.com/exceljs/exceljs) — exportación Excel
- [Notyf](https://github.com/caroso1222/notyf) — notificaciones

## Instalación

```bash
npm install
```

## Desarrollo

```bash
npm run dev
```

Abre `http://localhost:5173` en el navegador.

## Build

```bash
npm run build
```

Genera los archivos en `dist/`.

## Vista previa

```bash
npm run preview
```

## Estructura del proyecto

```
src/
├── main.ts                # Inicialización, navegación, eventos
├── style.css              # Estilos globales (Tailwind + custom)
├── state/
│   └── store.ts           # Estado global, tipos, helpers
├── components/
│   ├── data-table.ts      # Tabla de datos con edición inline
│   ├── drawer.ts          # Panel lateral de resumen
│   ├── plan.ts            # Plan de acción (correctivas/preventivas)
│   └── whys-wizard.ts     # Wizard de 5 porqués
├── services/
│   ├── analysisStorage.ts # CRUD de archivo JSON
│   ├── exportPDF.ts       # Exportación a PDF
│   ├── exportExcel.ts     # Exportación a Excel
│   ├── ishikawaHistory.ts # Histórico de Ishikawa
│   └── pareto.ts          # Datos acumulados de Pareto
├── utils/
│   ├── confirm.ts         # Diálogos de confirmación
│   ├── dom.ts             # Utilidades de canvas
│   └── text.ts            # Formateo de texto
└── assets/
    └── logo.png           # Logo corporativo
```

## API endpoints (dev server)

El archivo JSON de análisis se sirve desde `analyses/analisis.json` mediante middleware en `vite.config.ts`:

- `GET /api/analysis` — leer análisis guardado
- `POST /api/analysis` — guardar análisis
- `DELETE /api/analysis` — eliminar análisis
- `GET /api/analysis/exists` — verificar existencia
