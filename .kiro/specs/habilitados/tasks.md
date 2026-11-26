# Implementation Plan: Consulta de cursos habilitados

## Overview

Se añade `POST /habilitados` a la API Express existente, con una función pura `calcularHabilitados` y validación de entrada con regex fija, más la actualización de lodash y los gates de calidad en CI. El diseño usa JavaScript/Node.js (no pseudocódigo), por lo que no se requiere selección de lenguaje.

## Tasks

- [ ] 1. Actualizar lodash a ^4.17.21
  - Cambiar `"lodash": "4.17.20"` por `"lodash": "^4.17.21"` en `package.json`
  - Ejecutar `npm install` para actualizar `package-lock.json`
  - Verificar con `npm audit --audit-level=high` que no quedan hallazgos high/critical
  - _Requirements: 4.1_

- [ ] 2. Crear la ruta POST /habilitados con función pura
  - [ ] 2.1 Crear `src/routes/habilitados.js` con `calcularHabilitados(aprobados, cursos)`
    - Función pura: construye `Set` de aprobados, filtra catálogo con `!set.has(id) && prerequisites.every(p => set.has(p))`
    - Exportar `calcularHabilitados` además del router para permitir tests unitarios directos
    - _Requirements: 1.1, 1.2, 1.4, 1.5_
  - [ ] 2.2 Implementar el handler POST con validación de entrada
    - Validación secuencial: campo ausente → `aprobados` no es array → elemento no-string → string que no cumpla `/^[0-9][A-Z]{3}[0-9]{2}$/`
    - Cada fallo responde 400 con `{ "error": "<mensaje>" }`; el mensaje de formato inválido es el literal fijo `"Formato de código inválido"` sin reflejar el valor
    - Invoca `calcularHabilitados` con `repositorio.listar()` y responde 200 con el array plano de cursos (mismo shape que `GET /cursos`)
    - _Requirements: 1.1, 2.1, 2.2, 3.2, 3.3_
  - [ ] 2.3 Montar la ruta en `src/app.js`
    - Añadir `app.use('/habilitados', require('./routes/habilitados'));` antes del middleware de error, igual que `/cursos`
    - _Requirements: 1.1_
  - [ ] 2.4 Pruebas de estrés de rendimiento
    - Test con 5,000 códigos válidos (mezcla de ids reales y desconocidos bien formados): 200 y respuesta dentro del timeout de Jest (5 s)
    - _Requirements: 3.1_

- [ ] 3. Pruebas de integración del endpoint
  - [ ] 3.1 Crear `tests/habilitados.test.js` con los casos de cálculo
    - Ejemplo canónico `["1INF25","1INF27","1INF49"]` → 200, 27 cursos, incluye `1INF29`..`1INF32`
    - `[]` → 200, solo cursos sin prerrequisitos
    - Cursos aprobados no aparecen aunque cumplan prereqs
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - [ ] 3.2 Añadir casos de validación y seguridad
    - Sin campo `aprobados` → 400; `{"aprobados":"1INF25"}` → 400; `[42]`/`[null]` → 400
    - `["1INF30<script>"]` → código ≠ 500, body sin `C:\`, `/home/`, `node_modules`, sin fragmentos del valor enviado
    - _Requirements: 2.1, 2.2, 3.2, 3.3_

- [ ] 4. Checkpoint - Verificar suite completa
  - Ejecutar `npm test` y `npm test -- --coverage`; todos los tests deben pasar
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Pruebas de propiedad (opcional)
  - [ ] 5.1 Crear `tests/habilitados.property.test.js` con P1–P4 sobre `calcularHabilitados` (función pura)
    - **Property 1: Exclusion of passed courses** — **Validates: Requirements 1.1, 1.4**
    - **Property 2: Complete prerequisites** — **Validates: Requirements 1.1**
    - **Property 3: Completeness (no eligible course is omitted)** — **Validates: Requirements 1.1, 1.2**
    - **Property 4: Stability (idempotence)** — **Validates: Requirements 1.1**
    - Generadores: subconjuntos aleatorios de ids del catálogo; ≥100 iteraciones por propiedad (fast-check con `numRuns: 100`, o `test.each` con ≥10 combinaciones)
    - P1–P3 pueden fusionarse en un único test que verifique las tres condiciones
  - [ ] 5.2 Añadir P5–P8 sobre el endpoint HTTP
    - **Property 5: Empty list returns only courses without prerequisites** — **Validates: Requirements 1.5**
    - **Property 6: Input with non-string elements always returns 400** — **Validates: Requirements 2.2**
    - **Property 7: Non-array input always returns 400** — **Validates: Requirements 3.3**
    - **Property 8: Malformed code always returns 4xx without stack trace** — **Validates: Requirements 3.2**
    - Si se usa fast-check, añadirlo como devDependency (`npm install --save-dev fast-check`)
    - _Requirements: 1.5, 2.2, 3.2, 3.3_

- [ ] 6. Configurar umbral de cobertura en jest.config.js
  - Añadir `coverageThreshold: { global: { lines: 80 } }`; el scope ya está definido por `collectCoverageFrom` (`src/**/*.js`, excluye `src/server.js`)
  - Ejecutar `npm test -- --coverage` y verificar que el umbral se cumple
  - _Requirements: 4.3_

- [ ] 7. Actualizar CI con los tres gates
  - [ ] 7.1 Modificar `.github/workflows/ci.yml`
    - `fetch-depth: 0` en `actions/checkout@v4`
    - Step gitleaks (`gitleaks/gitleaks-action@v3`): falla si hay secretos en el historial
    - Step `npm audit --audit-level=high` tras `npm ci`: falla si hay high/critical
    - Cambiar `npm test` por `npm test -- --coverage` para activar el umbral de cobertura
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [ ] 7.2 Verificación local de los gates
    - Comprobar que `npm audit --audit-level=high` sale 0 y que `npm test -- --coverage` pasa el umbral de 80 % en local antes de confiar en CI
    - _Requirements: 4.1, 4.3_

- [ ] 8. Checkpoint final - Verificación completa
  - Ejecutar `npm test -- --coverage`, `npm audit --audit-level=high` y confirmar que `ci.yml` es YAML válido
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP (ninguna tarea opcional en este plan; los sub-tasks de propiedad 5.1/5.2 son la parte opcional del enunciado y se marcaron como tales dentro del épico 5)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3"] },
    { "id": 3, "tasks": ["2.4", "3.1"] },
    { "id": 4, "tasks": ["3.2"] },
    { "id": 5, "tasks": ["4"] },
    { "id": 6, "tasks": ["5.1", "5.2", "6"] },
    { "id": 7, "tasks": ["7.1"] },
    { "id": 8, "tasks": ["7.2"] },
    { "id": 9, "tasks": ["8"] }
  ]
}
```
