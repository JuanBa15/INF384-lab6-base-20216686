# Diseño técnico: Consulta de cursos habilitados (`POST /habilitados`)

## Overview

A new endpoint `POST /habilitados` is added to the existing Express REST API. It receives the list of course codes the student has already passed and returns the courses in the curriculum that the student has not yet passed **and** whose prerequisites are all contained in the received list. The logic is purely in-memory: it uses the already-loaded data repository (`src/data/repositorio.js`) and performs no external queries.

The design also covers the quality and security obligations derived from the penetration test findings (Requirements 3.x) and the IT policy (Requirements 4.x): lodash update, coverage threshold, and CI gates.

---

## Architecture

La nueva funcionalidad sigue la misma arquitectura en capas del proyecto:

```
cliente HTTP
     │
     ▼
app.js  ──► express.json() (parse body)
     │
     ▼
src/routes/habilitados.js   ◄── nueva ruta
     │  validación de entrada (middleware inline)
     │  lógica de cálculo (función pura)
     │
     ▼
src/data/repositorio.js  (listar())
     │
     ▼
data/cursos.json  (ya cargado en memoria al arrancar)
```

No se introduce ninguna dependencia externa nueva para la lógica. `lodash` se **actualiza** de `4.17.20` a `^4.17.21` para eliminar la vulnerabilidad GHSA-35jh-r3h4-6jhm; no se puede eliminar porque `src/util/formato.js` lo usa activamente (ver §Componentes).

### Diagrama de flujo: validación y cálculo

```mermaid
flowchart TD
    A([POST /habilitados]) --> B{¿body.aprobados existe?}
    B -- No --> E1[400 error: campo aprobados requerido]
    B -- Sí --> C{¿aprobados es Array?}
    C -- No --> E2[400 error: aprobados debe ser un array]
    C -- Sí --> D{¿todo elemento es string?}
    D -- No --> E3[400 error: cada elemento debe ser string]
    D -- Sí --> F{¿todo string cumple regex de código?}
    F -- No --> E4[400 error: Formato de código inválido genérico]
    F -- Sí --> G[Construir Set aprobadosSet O(n)]
    G --> H[listar todos los cursos O(C)]
    H --> I[Filtrar: curso no en aprobadosSet\nY todos prereqs en aprobadosSet O(C·P)]
    I --> J[200 array plano de cursos habilitados]
```

---

## Components and Interfaces

### 1. `src/routes/habilitados.js` (nuevo)

Módulo Express Router que expone un único método:

```
POST /habilitados
  Body (JSON): { "aprobados": string[] }
  Respuesta 200: Curso[]   (mismo shape que GET /cursos)
  Respuesta 400: { "error": string }
```

Responsabilidades:
- Validar el cuerpo de la petición (ver §Validación de entrada).
- Invocar la función pura `calcularHabilitados(aprobados, cursos)`.
- Devolver el array resultante como JSON.

### 2. Función pura `calcularHabilitados(aprobados, cursos)` (definida en el mismo módulo)

```
calcularHabilitados(aprobados: string[], cursos: Curso[]) → Curso[]
```

- Recibe la lista de códigos ya validados y el catálogo completo.
- Devuelve los cursos habilitados según el algoritmo descrito abajo.
- **No tiene efectos secundarios**; no accede al repositorio ni a I/O.
- Al ser pura, es directamente testeable con property-based tests sin mocks.

### 3. `src/app.js` (modificación mínima)

Añadir una línea para montar la nueva ruta:

```js
app.use('/habilitados', require('./routes/habilitados'));
```

La línea se coloca **antes** del middleware de error, igual que `/cursos`.

### 4. Dependencia `lodash` (actualización, no eliminación)

`src/util/formato.js` usa lodash activamente: `_.toLower`, `_.capitalize`, `_.sumBy`, `_.groupBy`, `_.mapValues`, `_.sortBy`, `_.orderBy`, `_.isEmpty`, `_.join`. Por lo tanto la dependencia **no se elimina**.

**Decisión**: actualizar `lodash` de `4.17.20` (fijo) a `^4.17.21`, que corrige GHSA-35jh-r3h4-6jhm y otras CVEs documentadas. El cambio en `package.json`:

```json
"lodash": "^4.17.21"
```

Tras la actualización, `npm audit --audit-level=high` no debe reportar hallazgos high/critical (req. 4.1).

### 5. `jest.config.js` (modificación)

Añadir `coverageThreshold` para cumplir el requisito 4.3:

```js
coverageThreshold: {
  global: {        // "global" aplica sobre el scope definido en collectCoverageFrom
    lines: 80,
  },
},
```

Nota sobre `global`: en jest, la clave `global` del `coverageThreshold` aplica al conjunto de archivos definido por `collectCoverageFrom` — que en este proyecto ya está restringido a `src/**/*.js` excluyendo `src/server.js` — y no a todo el proyecto (incluidos `tests/`). Es decir, el umbral del 80 % de líneas se evalúa solo sobre el código fuente de `src/`.

### 6. `.github/workflows/ci.yml` (modificación)

Añadir steps al job `build` (detalle completo en §Gates de CI):

| Step | Comando | Gate |
|------|---------|------|
| Auditoría de dependencias | `npm audit --audit-level=high` | Falla si hay high/critical en producción **o** dev (req. 4.1) |
| Escaneo de secretos | `gitleaks detect --redact` | Falla si encuentra secretos en el historial Git (req. 4.2) |
| Pruebas con cobertura | `npm test -- --coverage` | Falla si cobertura < 80 % líneas en `src/` (req. 4.3) |

Requisitos previos del job:
- `fetch-depth: 0` en `actions/checkout@v4` para que gitleaks acceda al historial completo.
- `gitleaks` instalado en el runner (p. ej. `gitleaks/gitleaks-action@v3` o descarga del binario), ya que no viene preinstalado en ubuntu-latest.

---

## Data Models

### Tipo `Curso` (ya definido en `data/cursos.json`)

```ts
interface Curso {
  id: string;          // ej. "1INF25"
  name: string;
  credits: number;
  cycle: number;       // 5–10
  type: string;        // "obligatorio" | "electivo"
  prerequisites: string[];  // array de id
}
```

La respuesta de `POST /habilitados` es `Curso[]`: el mismo array plano que devuelve `GET /cursos`, sin clave de envoltura (Decisión D5).

### Formato de código de curso

Un código de curso válido cumple la expresión regular:

```
/^[0-9][A-Z]{3}[0-9]{2}$/
```

Ejemplos válidos: `1INF25`, `1GES92`, `1IND90`.  
Ejemplos inválidos: `1INF30<script>`, `abc`, `""`, `1INF2`.

---

## Decisiones de diseño

| # | Decisión | Opción elegida | Justificación |
|---|----------|---------------|---------------|
| D1 | Rendimiento para 5 000 códigos | Algoritmo O(n + C·P) con `Set`; sin límite explícito de tamaño | Ver §Algoritmo: la construcción del Set es O(n) y el filtrado O(C·P) ≈ O(522) con C ≈ 87 y P ≈ 6. Para n = 5 000 el coste total es ≈ 5 522 operaciones elementales, muy por debajo del timeout de Jest (5 s). Dado que el cuello de botella es O(n) y n = 5 000 es tolerable, no se impone límite; el middleware de errores existente protege ante fallos no previstos. Si el volumen creciera, se puede añadir un límite de tamaño con respuesta 413 **sin cambiar la lógica de negocio** (la validación solo ganaría un paso previo). |
| D2 | Códigos malformados (ej. `1INF30<script>`) | Validar con regex `/^[0-9][A-Z]{3}[0-9]{2}$/`, responder 400 con **mensaje de error genérico sin reflejar el valor** | Elimina el riesgo de inyección reflejada: el mensaje de error es un literal fijo `"Formato de código inválido"` que no incluye el valor recibido, ni total ni parcialmente (hallazgo 2). |
| D3 | Códigos desconocidos pero bien formados (ej. `XXX999`) | Ignorar | Simplifica la API: el cliente puede incluir códigos de otros planes sin romper la consulta. No afecta la corrección del resultado. |
| D4 | Duplicados en `aprobados` | Deduplicar con `Set` antes de procesar | El `Set` lo resuelve de forma natural como parte del algoritmo. Sin efecto observable en la respuesta. |
| D5 | Forma de la respuesta | Array plano de objetos `Curso` | Consistente con `GET /cursos`. El cliente puede reutilizar el mismo parseado. |
| — | Dependencia `lodash` | Actualizar de `4.17.20` a `^4.17.21`, no eliminar | `src/util/formato.js` usa lodash activamente (_.sumBy, _.groupBy, _.sortBy, _.orderBy, _.capitalize, _.toLower, _.isEmpty, _.join, _.mapValues). `4.17.21` corrige GHSA-35jh-r3h4-6jhm y otras CVEs documentadas (req. 4.1). |

---

## Algoritmo de cálculo de cursos habilitados

```
función calcularHabilitados(aprobados: string[], cursos: Curso[]) → Curso[]:
    aprobadosSet ← new Set(aprobados)          // O(n), deduplicación incluida

    return cursos.filter(curso →
        NOT aprobadosSet.has(curso.id)          // excluir ya aprobados (req. 1.4)
        AND curso.prerequisites.every(prereq →  // todos los prereqs cumplidos (req. 1.1)
            aprobadosSet.has(prereq)
        )
    )
```

### Análisis de complejidad (corregido)

El algoritmo completo tiene tres partes:

1. **Construcción del `Set`**: O(n), donde n = tamaño de `aprobados`. Insertar n elementos en un `Set` es una operación amortizada O(1) por elemento. Con n = 5 000, esto son ~5 000 operaciones.
2. **Recorrido del catálogo**: O(C · P), donde C = número de cursos del catálogo (87) y P = máximo de prerrequisitos por curso (≈6, verificado en `data/cursos.json`). Cada curso se examina una vez; para cada curso se hacen hasta P lookups O(1) en el `Set`. Esto es ≈ 522 operaciones.
3. **Total**: O(n + C·P) ≈ O(5 522) operaciones elementales para n = 5 000.

Por lo tanto, la complejidad **sí depende del tamaño de `aprobados`** a través del término O(n), pero de forma lineal y con una constante mínima: incluso con 5 000 códigos, la ejecución completa es del orden de miles de operaciones en memoria, muy por debajo del timeout de Jest (5 s) y del hallazgo original (40 s). El problema original no era el orden de magnitud, sino una implementación con búsqueda O(n) por curso (O(C·P·n) ≈ 2.6 millones de operaciones con búsquedas lineales ineficientes y/o validaciones repetidas).

**Casos derivados del algoritmo:**
- Curso sin prerrequisitos: `prerequisites.every(...)` sobre array vacío → `true` (req. 1.2).
- `aprobados = []`: `aprobadosSet` vacío → solo cursos con `prerequisites = []` pasan el filtro (req. 1.5).
- Duplicados en `aprobados`: el `Set` los colapsa sin ninguna lógica adicional (D4).

**Escalabilidad futura**: dado que el cuello de botella es O(n) y n = 5 000 es tolerable, no se impone un límite explícito de tamaño. El middleware de error existente (`errorHandler`) protege ante crashes no previstos devolviendo 500 genérico. Si el volumen creciera, se puede añadir un límite de tamaño con respuesta 413 como paso previo de validación, **sin cambiar la lógica de negocio** de `calcularHabilitados`.

---

## Validación de entrada

La validación se realiza en el handler antes de invocar `calcularHabilitados`. Si cualquier condición falla, se devuelve 400 con `{ "error": "<mensaje descriptivo>" }` y no se ejecuta el cálculo.

```
1. body.aprobados no existe           → 400 { "error": "El campo 'aprobados' es requerido" }
2. body.aprobados no es Array         → 400 { "error": "El campo 'aprobados' debe ser un array" }
3. algún elemento no es string        → 400 { "error": "Cada elemento de 'aprobados' debe ser un string" }
4. algún string no cumple regex       → 400 { "error": "Formato de código inválido" }
```

La validación es secuencial: se detiene en el primer error.

**El mensaje del paso 4 es un literal fijo: no incluye el valor recibido, ni total ni parcialmente.** Justificación: reflejar cualquier fragmento del valor de entrada del atacante (incluso truncado a 20 caracteres alfanuméricos) puede ser aprovechado para inyección reflejada o para que el atacante confirme qué caracteres pasan la validación (oráculo de fuzzing). Un mensaje genérico fijo previene ambos vectores: el atacante no recibe información sobre el contenido procesado ni sobre el formato interno de la validación.

---

## Correctness Properties

*Una propiedad es una característica o comportamiento que debe ser verdadero en todas las ejecuciones válidas del sistema: esencialmente, un enunciado formal sobre lo que el sistema debe hacer. Las propiedades sirven como puente entre las especificaciones legibles por humanos y las garantías de corrección verificables por máquina.*

La función `calcularHabilitados` es una función pura sobre colecciones finitas, lo que la hace directamente adecuada para property-based testing.

### Property 1: Exclusion of passed courses

*Para cualquier* subconjunto de códigos `aprobados` (válidos o no presentes en el catálogo), ningún curso cuyo `id` esté en `aprobados` debe aparecer en la respuesta.

**Validates: Requirements 1.1, 1.4**

---

### Property 2: Complete prerequisites

*Para cualquier* subconjunto de códigos `aprobados`, todo curso en la respuesta tiene todos sus `prerequisites` contenidos en `aprobados`.

**Validates: Requirements 1.1**

---

### Property 3: Completeness (no eligible course is omitted)

*Para cualquier* subconjunto de códigos `aprobados`, todo curso del catálogo que (a) no está en `aprobados` y (b) tiene todos sus `prerequisites` en `aprobados` debe aparecer en la respuesta.

**Validates: Requirements 1.1, 1.2**

---

### Property 4: Stability (idempotence of the query)

*Para cualquier* lista `aprobados`, llamar a `calcularHabilitados` dos veces con la misma entrada produce exactamente el mismo conjunto de cursos (mismo contenido, misma longitud).

**Validates: Requirements 1.1**

---

### Property 5: Empty list returns only courses without prerequisites

*Para cualquier* catálogo de cursos, cuando `aprobados = []`, la respuesta contiene exactamente los cursos cuyo campo `prerequisites` es un array vacío.

**Validates: Requirements 1.5**

---

### Property 6: Input with non-string elements always returns 400

*Para cualquier* array que contenga al menos un elemento que no sea de tipo `string` (number, boolean, null, object, array), el endpoint debe responder HTTP 400.

**Validates: Requirements 2.2**

---

### Property 7: Non-array input always returns 400

*Para cualquier* valor de `aprobados` que no sea un `Array` (string, number, object, boolean, null), el endpoint debe responder HTTP 400.

**Validates: Requirements 3.3**

---

### Property 8: Malformed code always returns 4xx without stack trace

*Para cualquier* array donde al menos un elemento sea un string que no cumpla la regex `/^[0-9][A-Z]{3}[0-9]{2}$/`, el endpoint debe responder con código HTTP distinto de 500 y el cuerpo no debe contener substrings de rutas internas del sistema (`C:\`, `/home/`, `node_modules`) ni fragmentos del valor enviado.

**Validates: Requirements 3.2**

---

> **Decisión pendiente de revisión**: Evaluar si `fast-check` se añade como devDependency o si las propiedades se implementan como pruebas parametrizadas manuales (tabla de casos). Si el equipo decide no añadir fast-check, cada propiedad se convierte en un `test.each` que cubre al menos 10 combinaciones representativas. Esta decisión no afecta a `design.md` más allá de esta nota; las propiedades P1–P8 se mantienen en el diseño por su justificación técnica (la función `calcularHabilitados` es pura y opera sobre colecciones finitas, lo que hace que PBT sea especialmente adecuado).

---

## Error Handling

| Situación | Código HTTP | Cuerpo | Responsable |
|-----------|------------|--------|-------------|
| Campo `aprobados` ausente | 400 | `{ "error": "El campo 'aprobados' es requerido" }` | handler de `/habilitados` |
| `aprobados` no es array | 400 | `{ "error": "El campo 'aprobados' debe ser un array" }` | handler de `/habilitados` |
| Elemento no-string en `aprobados` | 400 | `{ "error": "Cada elemento de 'aprobados' debe ser un string" }` | handler de `/habilitados` |
| Código con formato inválido | 400 | `{ "error": "Formato de código inválido" }` (literal fijo, sin reflejar el valor) | handler de `/habilitados` |
| Error no previsto (bug interno) | 500 | `{ "error": "internal server error" }` | `errorHandler` middleware existente |

### Verificación del middleware de errores (código real)

El middleware existente ya cumple el requisito 3.2. Código verificado en `src/middleware/errorHandler.js`:

```js
// src/middleware/errorHandler.js (código verificado)
function errorHandler(err, req, res, next) {
  console.error(err);                          // stack trace solo en consola del servidor
  res.status(500).json({ error: 'internal server error' }); // sin detalles en la respuesta
}
```

Comportamiento garantizado:

- El cuerpo de la respuesta es **siempre** `{ "error": "internal server error" }` (literal fijo, sin interpolación del error ni de ningún dato de la petición).
- El stack trace se imprime en `console.error` del servidor (útil para depuración operativa), pero **nunca se serializa en la respuesta HTTP**.
- No se exponen rutas internas (`C:\`, `/home/`, `node_modules`) ni detalles del error.

**Prueba de regresión para 3.2** (en `tests/habilitados.test.js`): enviar `{"aprobados": ["1INF30<script>"]}` y verificar que (a) el código HTTP es distinto de 500, (b) el body no contiene `C:\`, `/home/`, `node_modules`, y (c) el body no contiene ningún substring del valor enviado (`1INF30`, `<script>`, `script>`, etc.).

---

## Testing Strategy

### Pruebas unitarias / integración (`tests/habilitados.test.js`)

Usando **supertest** (ya instalado) sobre la app Express:

| Caso | Entrada | Verificación |
|------|---------|-------------|
| Ejemplo canónico (req. 1.3) | `["1INF25","1INF27","1INF49"]` | 200, longitud 27, contiene `1INF29`..`1INF32` |
| Lista vacía (req. 1.5) | `[]` | 200, solo cursos sin prerrequisitos |
| Sin campo `aprobados` (req. 2.1) | `{}` | 400 |
| `aprobados` es string (req. 3.3) | `{"aprobados":"1INF25"}` | 400, no 200 |
| Elemento numérico (req. 2.2) | `{"aprobados":[42]}` | 400 |
| Elemento null (req. 2.2) | `{"aprobados":[null]}` | 400 |
| Código malformado (req. 3.2) | `{"aprobados":["1INF30<script>"]}` | 4xx, sin stack trace, sin rutas internas, sin reflejar el valor |
| 5 000 códigos (req. 3.1) | array de 5 000 strings válidos | 200, respuesta en <5 s (timeout de Jest) |

### Pruebas de propiedad (`tests/habilitados.property.test.js`)

Implementación preferida con **fast-check** (si el equipo lo aprueba, ver nota en §Correctness Properties); alternativa: `test.each` con ≥10 combinaciones por propiedad.

Cada property test debe ejecutarse con **mínimo 100 iteraciones** (`numRuns: 100` en fast-check).

Tag de referencia para cada test:  
`// Feature: habilitados, Property N: <texto de la propiedad>`

| Property | Generadores | Aserción |
|----------|------------|---------|
| P1 (Exclusión) | Subconjunto aleatorio de ids del catálogo como `aprobados` | `result.every(c => !aprobadosSet.has(c.id))` |
| P2 (Prereqs completos) | Ídem | `result.every(c => c.prerequisites.every(p => aprobadosSet.has(p)))` |
| P3 (Completitud) | Ídem | Cada curso del catálogo elegible está en `result` |
| P4 (Idempotencia) | Subconjunto aleatorio | Dos llamadas producen mismo resultado |
| P5 (Lista vacía) | Sin generador (fijo `[]`) | Solo cursos sin prerrequisitos |
| P6 (No-string → 400) | Array con al menos un elemento no-string | Respuesta HTTP 400 |
| P7 (No-array → 400) | Valor arbitrario no-array para `aprobados` | Respuesta HTTP 400 |
| P8 (Malformado → 4xx sin leak) | String no-regex en `aprobados` | Código ≠ 500, sin rutas internas ni valor reflejado en body |

> **Nota**: Las propiedades P1, P2 y P3 se pueden implementar como un único property test que verifica las tres condiciones a la vez, reduciendo el número de llamadas HTTP.

---

## Gates de CI

| Gate | Herramienta | Comando | Umbral | ¿Bloquea? | Etapa | Justificación |
|------|------------|---------|--------|-----------|-------|---------------|
| Vulnerabilidades (req. 4.1) | npm audit | `npm audit --audit-level=high` | 0 high/critical en **todas** las dependencias (producción + dev) | Sí, falla el pipeline | Después de `npm ci` | La política de TI exige cero dependencias con severidad High o Critical; `--omit=dev` ocultaría vulnerabilidades en herramientas de build/test que se ejecutan en CI. |
| Secretos (req. 4.2) | gitleaks | `gitleaks detect --redact` (sin `--no-git`) | 0 hallazgos en el historial Git del repositorio | Sí, falla el pipeline | Después de `actions/checkout@v4` con `fetch-depth: 0` | El modo `--no-git` solo escanea el directorio de trabajo; `gitleaks detect` sin ese flag recorre el historial Git completo, que es donde suelen quedar secretos accidentalmente commiteados (req. 4.2). Se requiere `fetch-depth: 0` en el checkout para que gitleaks tenga acceso al historial completo. |
| Cobertura de líneas (req. 4.3) | jest | `npm test -- --coverage` | ≥ 80 % líneas en `src/` | Sí, falla el pipeline | Después de las pruebas | El umbral se declara en `jest.config.js` con `coverageThreshold`; jest falla con código de salida no-cero si no se alcanza. |

Notas operativas:

- **gitleaks**: el job de CI necesita `fetch-depth: 0` en el step `actions/checkout@v4` para que el histórico esté disponible. `gitleaks` no viene preinstalado en los runners de GitHub Actions; se instala vía `gitleaks/gitleaks-action@v3` o descargando el binario.
- **npm audit**: `npm audit --audit-level=high` sin `--omit=dev` analiza todas las dependencias. Si se quiere excluir devDependencies en entornos de producción, ese es un gate distinto; para CI se auditan todas.
- **Cobertura**: el `collectCoverageFrom` existente (`['src/**/*.js', '!src/server.js']`) define el scope; el `coverageThreshold.global.lines: 80` se aplica sobre ese scope.
