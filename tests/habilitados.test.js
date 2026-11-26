const request = require('supertest');
const app = require('../src/app');

describe('POST /habilitados', () => {
  // -------------------------------------------------------------------------
  // 3.1 Casos de cálculo
  // -------------------------------------------------------------------------

  // Requisito 1.3 — ejemplo canónico del enunciado
  test('devuelve 200 con exactamente 27 cursos para el ejemplo canónico', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: ['1INF25', '1INF27', '1INF49'] });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(27);
  });

  // Requisito 1.3 — incluye 1INF29..1INF32
  test('incluye 1INF29, 1INF30, 1INF31 y 1INF32 en el ejemplo canónico', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: ['1INF25', '1INF27', '1INF49'] });

    const ids = res.body.map((c) => c.id);
    expect(ids).toContain('1INF29');
    expect(ids).toContain('1INF30');
    expect(ids).toContain('1INF31');
    expect(ids).toContain('1INF32');
  });

  // Requisito 1.5 — lista vacía devuelve solo cursos sin prerrequisitos
  test('devuelve 200 con solo cursos sin prerrequisitos cuando aprobados es []', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: [] });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    // Todos los cursos devueltos deben tener prerequisites vacío
    for (const curso of res.body) {
      expect(curso.prerequisites).toEqual([]);
    }

    // Ningún curso con prerrequisitos debe aparecer
    expect(res.body.map((c) => c.id)).not.toContain('1INF29'); // prereq: 1INF25
    expect(res.body.map((c) => c.id)).not.toContain('1INF32'); // prereq: 1INF27, 1INF25
  });

  // Requisito 1.4 — cursos aprobados no aparecen en la respuesta
  test('no incluye cursos aprobados aunque cumplan sus prerrequisitos', async () => {
    const aprobados = ['1INF25', '1INF27', '1INF49'];
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados });

    const ids = res.body.map((c) => c.id);
    for (const codigo of aprobados) {
      expect(ids).not.toContain(codigo);
    }
  });

  // Requisito 1.1 — solo cursos cuyos prerrequisitos están todos en aprobados
  test('no incluye cursos con prerrequisitos incompletos', async () => {
    // Con solo 1INF25 aprobado, 1INF32 (prereqs: 1INF27 y 1INF25) no debe aparecer
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: ['1INF25'] });

    expect(res.status).toBe(200);
    const ids = res.body.map((c) => c.id);
    expect(ids).not.toContain('1INF32'); // falta 1INF27
  });

  // Requisito 1.2 — cursos sin prerrequisitos quedan habilitados por defecto
  test('incluye cursos sin prerrequisitos con cualquier lista de aprobados', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: ['1INF25'] });

    expect(res.status).toBe(200);
    const ids = res.body.map((c) => c.id);
    // 1GES92 no tiene prerrequisitos y no está aprobado → debe aparecer
    expect(ids).toContain('1GES92');
  });

  // -------------------------------------------------------------------------
  // 3.2 Casos de validación y seguridad
  // -------------------------------------------------------------------------

  // Requisito 2.1 — sin campo aprobados → 400
  test('devuelve 400 cuando falta el campo aprobados', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  // Requisito 3.3 — aprobados es string → 400 (hallazgo 3)
  test('devuelve 400 cuando aprobados es un string en lugar de array', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: '1INF25' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  // Requisito 2.2 — elemento numérico → 400
  test('devuelve 400 cuando aprobados contiene un número', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: [42] });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  // Requisito 2.2 — elemento null → 400
  test('devuelve 400 cuando aprobados contiene null', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: [null] });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  // Requisito 3.2 — código malformado (hallazgo 2): no 500, sin rutas internas ni valor reflejado
  test('responde con código distinto de 500 para código malformado con XSS', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: ['1INF30<script>'] });

    expect(res.status).not.toBe(500);
  });

  test('no filtra rutas internas del sistema para código malformado', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: ['1INF30<script>'] });

    const body = JSON.stringify(res.body);
    expect(body).not.toContain('C:\\');
    expect(body).not.toContain('/home/');
    expect(body).not.toContain('node_modules');
  });

  test('no refleja el valor enviado en la respuesta para código malformado', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: ['1INF30<script>'] });

    const body = JSON.stringify(res.body);
    // El mensaje de error debe ser un literal fijo, sin incluir el valor del atacante
    expect(body).not.toContain('1INF30');
    expect(body).not.toContain('<script>');
    expect(body).not.toContain('script>');
  });
});
