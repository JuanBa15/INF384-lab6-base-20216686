const request = require('supertest');
const app = require('../src/app');

// Todos los IDs reales del catálogo (87 cursos) — cumplen /^[A-Z0-9]{5,6}$/
const CODIGOS_REALES = require('../data/cursos.json').courses.map((c) => c.id);

// Códigos bien formados pero inexistentes que cumplen /^[A-Z0-9]{5,6}$/
const CODIGOS_DESCONOCIDOS = [
  '9ZZZ99', '1AAA00', '2BBB11', '3CCC22', '4DDD33',
  '5EEE44', '6FFF55', '7GGG66', '8HHH77', '0JJJ88',
];

/**
 * Construye un arreglo de `total` códigos válidos:
 * mezcla de IDs reales (repetidos/ciclados, ~80 %) y códigos
 * desconocidos pero bien formados según /^[A-Z0-9]{5,6}$/ (~20 %).
 * Todos pasan la validación del endpoint.
 */
function construirAprobados(total = 5000) {
  const aprobados = [];
  for (let i = 0; i < total; i++) {
    if (i % 5 === 4) {
      // ~20% códigos desconocidos válidos
      aprobados.push(CODIGOS_DESCONOCIDOS[Math.floor(i / 5) % CODIGOS_DESCONOCIDOS.length]);
    } else {
      // ~80% códigos reales ciclados
      aprobados.push(CODIGOS_REALES[i % CODIGOS_REALES.length]);
    }
  }
  return aprobados;
}

// Requisito 3.1 — el endpoint responde con 5,000 códigos dentro del timeout (5 s)
describe('POST /habilitados — rendimiento (5,000 códigos)', () => {
  test('responde 200 con un array dentro del timeout por defecto de Jest', async () => {
    const aprobados = construirAprobados(5000);
    expect(aprobados).toHaveLength(5000);

    const inicio = process.hrtime.bigint();
    const res = await request(app).post('/habilitados').send({ aprobados });
    const fin = process.hrtime.bigint();

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const ms = Number(fin - inicio) / 1e6;
    // eslint-disable-next-line no-console
    console.log(`POST /habilitados con 5,000 códigos respondió en ${ms.toFixed(2)} ms`);
  });
});
