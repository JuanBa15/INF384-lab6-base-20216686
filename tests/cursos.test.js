const request = require('supertest');
const app = require('../src/app');

// GET /cursos — lista y filtro por ciclo (Requisitos 1.1, 1.2, 1.3)
describe('GET /cursos', () => {
  test('devuelve 200 con todos los cursos cuando no se envía ciclo', async () => {
    const res = await request(app).get('/cursos');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('devuelve 200 con cursos filtrados para ciclo=5', async () => {
    const res = await request(app).get('/cursos?ciclo=5');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    res.body.forEach((c) => expect(c.cycle).toBe(5));
  });

  test('devuelve 200 con cursos filtrados para ciclo=10', async () => {
    const res = await request(app).get('/cursos?ciclo=10');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('devuelve 400 cuando ciclo no es numérico (abc)', async () => {
    const res = await request(app).get('/cursos?ciclo=abc');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'ciclo debe ser un entero entre 5 y 10' });
  });

  test('devuelve 400 cuando ciclo es menor que 5 (ciclo=4)', async () => {
    const res = await request(app).get('/cursos?ciclo=4');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'ciclo debe ser un entero entre 5 y 10' });
  });

  test('devuelve 400 cuando ciclo es mayor que 10 (ciclo=11)', async () => {
    const res = await request(app).get('/cursos?ciclo=11');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'ciclo debe ser un entero entre 5 y 10' });
  });
});

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
