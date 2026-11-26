// Feature: habilitados — Property-Based Tests (P1–P4) sobre calcularHabilitados
// Herramienta: fast-check (numRuns: 100 por propiedad)

const fc = require('fast-check');
const path = require('path');

const { calcularHabilitados } = require('../src/routes/habilitados');

// Cargar el catálogo directamente (misma fuente que el repositorio)
const { courses: cursos } = require(path.join(__dirname, '..', 'data', 'cursos.json'));
const todosLosIds = cursos.map((c) => c.id);

// ---------------------------------------------------------------------------
// Generador: subconjunto aleatorio de ids del catálogo
// Produce un array de ids únicos del catálogo (puede ser vacío)
// ---------------------------------------------------------------------------
const subconjuntoDeIds = fc.array(
  fc.constantFrom(...todosLosIds),
  { minLength: 0, maxLength: todosLosIds.length }
);

// ---------------------------------------------------------------------------
// P1 + P2 + P3 fusionados en un único test (ver nota del diseño)
// Feature: habilitados, Property 1: Exclusion of passed courses
// Feature: habilitados, Property 2: Complete prerequisites
// Feature: habilitados, Property 3: Completeness (no eligible course is omitted)
// Validates: Requirements 1.1, 1.4 (P1) | 1.1 (P2) | 1.1, 1.2 (P3)
// ---------------------------------------------------------------------------
test('P1–P3: exclusión, prerrequisitos completos y completitud', () => {
  fc.assert(
    fc.property(subconjuntoDeIds, (aprobados) => {
      const resultado = calcularHabilitados(aprobados, cursos);
      const aprobadosSet = new Set(aprobados);
      const resultadoIds = new Set(resultado.map((c) => c.id));

      // P1: Exclusion of passed courses — Validates: Requirements 1.1, 1.4
      // Ningún curso devuelto debe estar en aprobados
      for (const curso of resultado) {
        if (aprobadosSet.has(curso.id)) return false;
      }

      // P2: Complete prerequisites — Validates: Requirements 1.1
      // Todos los prerrequisitos de cada curso devuelto deben estar en aprobados
      for (const curso of resultado) {
        for (const prereq of curso.prerequisites) {
          if (!aprobadosSet.has(prereq)) return false;
        }
      }

      // P3: Completeness — Validates: Requirements 1.1, 1.2
      // Todo curso del catálogo que sea elegible debe estar en el resultado
      for (const curso of cursos) {
        const noAprobado = !aprobadosSet.has(curso.id);
        const prereqsCumplidos = curso.prerequisites.every((p) => aprobadosSet.has(p));
        const esElegible = noAprobado && prereqsCumplidos;

        if (esElegible && !resultadoIds.has(curso.id)) return false;
      }

      return true;
    }),
    { numRuns: 100 }
  );
});

// ---------------------------------------------------------------------------
// P4: Stability (idempotence of the query)
// Feature: habilitados, Property 4: Stability (idempotence)
// Validates: Requirements 1.1
// ---------------------------------------------------------------------------
test('P4: estabilidad — dos llamadas con la misma entrada producen el mismo resultado', () => {
  fc.assert(
    fc.property(subconjuntoDeIds, (aprobados) => {
      const resultado1 = calcularHabilitados(aprobados, cursos);
      const resultado2 = calcularHabilitados(aprobados, cursos);

      // Mismo número de cursos
      if (resultado1.length !== resultado2.length) return false;

      // Mismo contenido (mismos ids)
      const ids1 = new Set(resultado1.map((c) => c.id));
      const ids2 = new Set(resultado2.map((c) => c.id));

      for (const id of ids1) {
        if (!ids2.has(id)) return false;
      }
      for (const id of ids2) {
        if (!ids1.has(id)) return false;
      }

      return true;
    }),
    { numRuns: 100 }
  );
});

// ===========================================================================
// P5–P8: Propiedades sobre el endpoint HTTP POST /habilitados
// Herramienta: fast-check (numRuns: 100 donde aplica) + supertest
// ===========================================================================

const request = require('supertest');
const app = require('../src/app');

// ---------------------------------------------------------------------------
// P5: Empty list returns only courses without prerequisites
// Feature: habilitados, Property 5: Empty list returns only courses without prerequisites
// Validates: Requirements 1.5
// ---------------------------------------------------------------------------
test('P5: lista vacía devuelve exactamente los cursos sin prerrequisitos', async () => {
  const res = await request(app)
    .post('/habilitados')
    .send({ aprobados: [] });

  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);

  // Todos los cursos devueltos deben tener prerequisites vacío
  for (const curso of res.body) {
    expect(curso.prerequisites).toEqual([]);
  }

  // Exactamente los cursos sin prerrequisitos del catálogo deben aparecer
  const sinPrereqs = cursos.filter((c) => c.prerequisites.length === 0);
  expect(res.body).toHaveLength(sinPrereqs.length);

  const idsRespuesta = new Set(res.body.map((c) => c.id));
  for (const curso of sinPrereqs) {
    expect(idsRespuesta.has(curso.id)).toBe(true);
  }
});

// ---------------------------------------------------------------------------
// P6: Input with non-string elements always returns 400
// Feature: habilitados, Property 6: Input with non-string elements always returns 400
// Validates: Requirements 2.2
// ---------------------------------------------------------------------------
test('P6: array con al menos un elemento no-string siempre devuelve 400', async () => {
  // Generador de valores no-string: number, boolean, null, object, nested array
  const nonStringArb = fc.oneof(
    fc.integer(),
    fc.float(),
    fc.boolean(),
    fc.constant(null),
    fc.record({ x: fc.integer() }),
    fc.array(fc.string())
  );

  // Array que contiene al menos un elemento no-string (puede mezclar strings válidos)
  const arrayConNoStringArb = fc.tuple(
    fc.array(fc.constant('1INF25')), // strings válidos antes (puede estar vacío)
    nonStringArb,                    // el elemento no-string obligatorio
    fc.array(fc.constant('1INF27'))  // strings válidos después (puede estar vacío)
  ).map(([before, nonStr, after]) => [...before, nonStr, ...after]);

  await fc.assert(
    fc.asyncProperty(arrayConNoStringArb, async (aprobados) => {
      const res = await request(app)
        .post('/habilitados')
        .send({ aprobados });

      return res.status === 400;
    }),
    { numRuns: 100 }
  );
});

// ---------------------------------------------------------------------------
// P7: Non-array input always returns 400
// Feature: habilitados, Property 7: Non-array input always returns 400
// Validates: Requirements 3.3
// ---------------------------------------------------------------------------
test('P7: valor no-array para aprobados siempre devuelve 400', async () => {
  // Generador de valores no-array: string, number, boolean, object, null
  const nonArrayArb = fc.oneof(
    fc.string(),
    fc.integer(),
    fc.float(),
    fc.boolean(),
    fc.constant(null),
    fc.record({ aprobados: fc.string() })
  );

  await fc.assert(
    fc.asyncProperty(nonArrayArb, async (aprobados) => {
      const res = await request(app)
        .post('/habilitados')
        .send({ aprobados });

      return res.status === 400;
    }),
    { numRuns: 100 }
  );
});

// ---------------------------------------------------------------------------
// P8: Malformed code always returns 4xx without stack trace
// Feature: habilitados, Property 8: Malformed code always returns 4xx without stack trace
// Validates: Requirements 3.2
// ---------------------------------------------------------------------------
test('P8: código malformado devuelve 4xx sin filtración de información interna', async () => {
  const CODIGO_REGEX = /^[0-9][A-Z]{3}[0-9]{2}$/;

  // Genera strings que NO cumplen el regex de código válido
  // Mínimo 3 caracteres para que la comprobación de "no reflejar" sea significativa
  // (strings de 1-2 caracteres podrían aparecer por coincidencia en cualquier mensaje de error)
  const malformedCodeArb = fc.string({ minLength: 3, maxLength: 30 }).filter(
    (s) => !CODIGO_REGEX.test(s)
  );

  // Array con al menos un código malformado (puede ir acompañado de válidos)
  const arrayConMalformadoArb = fc.tuple(
    fc.array(
      fc.stringMatching(/^[0-9][A-Z]{3}[0-9]{2}$/),
      { minLength: 0, maxLength: 3 }
    ),
    malformedCodeArb,
    fc.array(
      fc.stringMatching(/^[0-9][A-Z]{3}[0-9]{2}$/),
      { minLength: 0, maxLength: 3 }
    )
  ).map(([before, malformed, after]) => ({ codes: [...before, malformed, ...after], malformed }));

  await fc.assert(
    fc.asyncProperty(arrayConMalformadoArb, async ({ codes, malformed }) => {
      const res = await request(app)
        .post('/habilitados')
        .send({ aprobados: codes });

      // Código debe ser distinto de 500 (esperamos 400)
      if (res.status === 500) return false;

      const bodyStr = JSON.stringify(res.body);

      // No debe contener rutas internas del sistema
      if (bodyStr.includes('C:\\')) return false;
      if (bodyStr.includes('/home/')) return false;
      if (bodyStr.includes('node_modules')) return false;

      // No debe reflejar fragmentos del valor malformado enviado
      // (el mensaje de error debe ser un literal fijo)
      if (bodyStr.includes(malformed)) return false;

      return true;
    }),
    { numRuns: 100 }
  );
});
