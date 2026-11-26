# Requisitos: Consulta de cursos habilitados

## Introducción

Funcionalidad para que el alumno consulte qué cursos puede llevar: recibe la lista de cursos que ya aprobó y devuelve los cursos de la malla que todavía no aprobó y cuyos prerrequisitos están todos incluidos en esa lista. Incluye los requisitos de seguridad derivados de los tres hallazgos del test de intrusión y los requisitos de calidad de la política de TI.

## Requisitos

### Requisito 1: Cálculo de cursos habilitados

**Historia de usuario:** Como alumno, quiero saber qué cursos puedo llevar según lo que ya aprobé, para planificar mi matrícula.

#### Criterios de aceptación

1.1 CUANDO se envíe `POST /habilitados` con `{"aprobados": [...]}` lista de códigos de cursos, EL sistema DEBE responder 200 con los cursos no aprobados por el alumno cuyos prerrequisitos están todos contenidos en `aprobados`.

1.2 CUANDO un curso no aprobado no tenga prerrequisitos, EL sistema DEBE incluirlo en la respuesta (los cursos sin prerrequisitos quedan habilitados por defecto).

1.3 CUANDO se envíe `{"aprobados": ["1INF25", "1INF27", "1INF49"]}`, EL sistema DEBE responder 200 con exactamente 27 cursos, incluyendo `1INF29`, `1INF30`, `1INF31` y `1INF32` (verificado contra `data/cursos.json`).

1.4 CUANDO un curso esté incluido en `aprobados`, EL sistema NO DEBE incluirlo en la respuesta aunque cumpla sus prerrequisitos.

1.5 CUANDO se envíe `{"aprobados": []}`, EL sistema DEBE responder 200 con todos los cursos sin prerrequisitos (ningún curso con prerrequisitos queda habilitado).

### Requisito 2: Validación de la entrada

**Historia de usuario:** Como alumno, quiero mensajes de error claros cuando envío datos mal formados, para corregir mi solicitud.

#### Criterios de aceptación

2.1 SI el cuerpo de la solicitud no incluye el campo `aprobados`, EL sistema DEBE responder 400 con `{ "error": "<mensaje>" }` y no calcular resultados.

2.2 SI algún elemento de `aprobados` no es un string, EL sistema DEBE responder 400 con `{ "error": "<mensaje>" }` y no calcular resultados.

### Requisito 3: Seguridad

**Historia de usuario:** Como administrador del servicio, quiero que la entrada no pueda degradar ni exponer el servicio, para cumplir la política de TI.

Un criterio por cada hallazgo del test de intrusión.

#### Criterios de aceptación

3.1 CUANDO se envíe una solicitud con 5,000 códigos en `aprobados`, EL sistema DEBE responder con el resultado correcto antes de que expire el tiempo de espera de la prueba automatizada (timeout de Jest, 5 s por defecto), sin dejar el servicio sin responder (hallazgo 1: hoy tarda 40 s). _El umbral de rendimiento concreto y la posible limitación de tamaño de entrada quedan pendientes para `design.md`._

3.2 CUANDO se envíe un valor como `1INF30<script>` en `aprobados`, EL sistema DEBE responder con un código HTTP distinto de 500, sin stack trace, sin rutas internas del proyecto y sin reflejar el valor sin sanitizar en la respuesta (hallazgo 2). _La política exacta para valores malformados (rechazar con 400 o ignorar el elemento) queda pendiente para `design.md`; cualquier opción elegida debe cumplir este criterio._

3.3 SI `aprobados` no es una lista (por ejemplo, es un string, un número o un objeto), EL sistema DEBE responder 400 con `{ "error": "<mensaje>" }` y NO 200, sin calcular ni devolver resultados (hallazgo 3: hoy responde 200 con resultados incorrectos).

### Requisito 4: Calidad

**Historia de usuario:** Como administrador del servicio, quiero cumplir la política de TI, para mantener el proyecto en producción.

#### Criterios de aceptación

4.1 SI se ejecuta `npm audit`, NO DEBE reportar vulnerabilidades de severidad alta o crítica en dependencias de producción (hoy: lodash 4.17.20, severidad alta, GHSA-35jh-r3h4-6jhm y otras).

4.2 SI se escanea el repositorio con gitleaks, NO DEBE reportar secretos en el repositorio.

4.3 CUANDO se ejecuten las pruebas, la cobertura de líneas de `src/` NO DEBE ser menor al 80 % (configurar umbral en `jest.config.js` mediante `coverageThreshold`).

4.4 CUANDO se abra un pull request, el pipeline de CI DEBE ejecutar las pruebas con cobertura y los gates 4.1 y 4.2, y fallar si no se cumplen.

### Criterios verificables con prueba automatizada (resumen)

| Criterio | Prueba automatizada |
| --- | --- |
| 1.1, 1.4 | POST con lista válida: cursos aprobados no aparecen; cursos con prerrequisitos incompletos no aparecen. |
| 1.2 | POST con `aprobados` lista vacía: solo cursos sin prerrequisitos. |
| 1.3 | POST con el ejemplo del enunciado: exactamente 27 cursos, incluye `1INF29`..`1INF32`. |
| 1.5 | POST con `[]`: lista de cursos sin prerrequisitos. |
| 2.1 | POST sin `aprobados`: 400. |
| 2.2 | POST con `[42]` o `[null]`: 400. |
| 3.1 | POST con 5,000 códigos: responde dentro del timeout de Jest con el resultado correcto (hallazgo 1). |
| 3.2 | POST con `1INF30<script>`: respuesta con código distinto de 500, sin stack trace, sin `C:\`, `/home/` ni rutas internas (hallazgo 2). |
| 3.3 | POST con `{"aprobados": "1INF25"}`: 400 y no 200 (hallazgo 3). |
| 4.1 | `npm audit --omit=dev` sin hallazgos high/critical (gate en CI). |
| 4.2 | gitleaks sin hallazgos (gate en CI). |
| 4.3 | `npm test -- --coverage` con umbral 80 % de líneas. |

### Decisiones pendientes (justificar en `design.md`)

| # | Decisión | Opciones |
| --- | --- | --- |
| D1 | Límites de rendimiento para 3.1 | (a) solo eficiencia algorítmica (Set/Map, un solo pase) sin límite explícito; (b) umbral de ms verificado en test; (c) límite de tamaño de `aprobados` con 400/413. Ningún valor está definido en el enunciado. |
| D2 | Política para códigos malformados (`1INF30<script>`) en 3.2 | (a) validar formato y responder 400; (b) ignorar el elemento y responder 200. Requiere definir el formato válido de un código, hoy no especificado en `data/cursos.json`. |
| D3 | Tratamiento de códigos desconocidos pero bien formados (p. ej., `XXX999`) | (a) ignorar; (b) rechazar con 400; (c) deduplicar y advertir. Afecta 1.1 y 3.1 (los 5,000 códigos del hallazgo 1 son casi todos desconocidos). |
| D4 | Duplicados en `aprobados` | Detalle de diseño (un Set lo resuelve), sin efecto observable en la respuesta. |
| D5 | Forma exacta de la respuesta de 1.1 | ¿Array plano de objetos de curso (igual que `GET /cursos`) o con clave de envoltura? Pendiente de confirmar en `design.md`. |
