const request = require('supertest');
const app = require('../src/app');

describe('GET /cursos/:codigo', () => {
  // Requisito 2.1 — código existente con prerequisitos
  test('devuelve 200 con el curso y sus requisitos resueltos', async () => {
    const res = await request(app).get('/cursos/1INF30');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: '1INF30',
      name: 'Programación 3',
      credits: expect.any(Number),
      cycle: expect.any(Number),
      type: expect.any(String),
      prerequisites: expect.arrayContaining([
        expect.objectContaining({ id: '1INF25', name: 'Programación 2' }),
      ]),
    });
  });

  // Requisito 2.1 — código existente sin prerequisitos
  test('devuelve prerequisites vacío cuando el curso no tiene requisitos', async () => {
    const res = await request(app).get('/cursos/1GES92');

    expect(res.status).toBe(200);
    expect(res.body.prerequisites).toEqual([]);
  });

  // Requisito 2.2 — código inexistente
  test('devuelve 404 con mensaje de error para un código inexistente', async () => {
    const res = await request(app).get('/cursos/XXX999');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'curso no encontrado' });
  });
});
