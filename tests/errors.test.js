const request = require('supertest');
const express = require('express');
const errorHandler = require('../src/middleware/errorHandler');

function crearApp() {
  const app = express();
  app.get('/boom', () => {
    throw new Error('fallo inesperado con secreto interno');
  });
  app.use(errorHandler);
  return app;
}

describe('Middleware de manejo de errores', () => {
  // Valida: Requisito 3.1
  test('responde 500 con un error genérico ante errores no controlados', async () => {
    const res = await request(crearApp()).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'internal server error' });
  });

  test('no filtra el mensaje del error interno', async () => {
    const res = await request(crearApp()).get('/boom');

    expect(JSON.stringify(res.body)).not.toContain('secreto');
    expect(JSON.stringify(res.body)).not.toContain('stack');
  });
});
