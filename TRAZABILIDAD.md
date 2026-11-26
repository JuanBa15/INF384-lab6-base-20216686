# Trazabilidad

## Requisito → gate → evidencia

| Requisito | Gate (herramienta y umbral) | Bloquea / avisa | Etapa | Run fallido | Run corregido |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

## Cambios a la propuesta de Kiro

| Documento | Qué propuso Kiro | Qué cambiaste | Por qué |
| --- | --- | --- | --- |
| `.kiro/specs/habilitados/requirements.md` | El hallazgo 3 (validación del tipo de `aprobados`) aparecía dos veces: como criterio 2.2 de validación y como criterio 3.3 de seguridad, con nota de "duplicado intencional". | Se eliminó la duplicación: la regla "SI `aprobados` no es una lista, responder 400 y no 200" vive solo en 3.3. El Requisito 2 conserva la validación de campo ausente (2.1) y de elementos no string (2.2, antes 2.3). | Para evitar duplicar el hallazgo de validación entre los requisitos 2 y 3 y mantener exactamente un requisito de seguridad por hallazgo (3.1, 3.2, 3.3). |
| `.kiro/specs/habilitados/requirements.md` | 3.1 decía "responder en un tiempo acotado" y 3.2 "responder sin error 500" sin resultado observable preciso. | 3.1 ahora exige responder con el resultado correcto antes del timeout de Jest (5 s); 3.2 exige código HTTP distinto de 500, sin stack trace, sin rutas internas y sin reflejar el valor sin sanitizar. | Cada requisito debe tener una condición verificable y respuesta observable según EARS, sin inventar límites. |
| `.kiro/specs/habilitados/requirements.md` | Notas de decisión pendiente mezcladas dentro de los criterios 3.1 y 3.2. | Las decisiones pendientes se consolidaron en la tabla D1–D5 del documento: D1 límites de rendimiento, D2 política de códigos malformados, D3 tratamiento de códigos desconocidos (más D4 duplicados y D5 forma de la respuesta), todas para justificar en `design.md`. | Hay que mantener explícitamente pendientes para `design.md` los límites de rendimiento, la política de códigos malformados y el tratamiento de códigos desconocidos. |
