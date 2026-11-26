const {
  formatearNombre,
  formatearCreditos,
  formatearCiclo,
  formatearTipo,
  resumenCurso,
  totalCreditos,
  agruparPorCiclo,
  ordenarPorCreditos,
  listaRequisitos,
} = require('../src/util/formato');

describe('formatearNombre', () => {
  test('capitaliza cada palabra', () => {
    expect(formatearNombre('estructuras de DATOS')).toBe('Estructuras De Datos');
  });

  test('funciona con una sola palabra', () => {
    expect(formatearNombre('programación')).toBe('Programación');
  });

  test('no altera una cadena ya capitalizada', () => {
    expect(formatearNombre('Cálculo')).toBe('Cálculo');
  });
});

describe('formatearCreditos', () => {
  test('formatea con un decimal y la palabra créditos', () => {
    expect(formatearCreditos(4)).toBe('4.0 créditos');
  });

  test('formatea correctamente créditos no enteros', () => {
    expect(formatearCreditos(3.5)).toBe('3.5 créditos');
  });

  test('formatea cero créditos', () => {
    expect(formatearCreditos(0)).toBe('0.0 créditos');
  });
});

describe('formatearCiclo', () => {
  test('devuelve Electivo para null', () => {
    expect(formatearCiclo(null)).toBe('Electivo');
  });

  test('devuelve Electivo para undefined', () => {
    expect(formatearCiclo(undefined)).toBe('Electivo');
  });

  test('devuelve Ciclo N para un número válido', () => {
    expect(formatearCiclo(6)).toBe('Ciclo 6');
  });

  test('devuelve Ciclo 5 para ciclo mínimo', () => {
    expect(formatearCiclo(5)).toBe('Ciclo 5');
  });
});

describe('formatearTipo', () => {
  test('capitaliza obligatorio', () => {
    expect(formatearTipo('obligatorio')).toBe('Obligatorio');
  });

  test('devuelve Electivo para electivo', () => {
    expect(formatearTipo('electivo')).toBe('Electivo');
  });

  test('devuelve Electivo para valores desconocidos', () => {
    expect(formatearTipo('otro')).toBe('Electivo');
  });
});

describe('resumenCurso', () => {
  test('genera el resumen con formato id · nombre · créditos', () => {
    expect(resumenCurso({ id: 'X', name: 'Foo', credits: 3 })).toBe('X · Foo · 3.0 créditos');
  });

  test('incluye créditos con un decimal', () => {
    expect(resumenCurso({ id: 'A1', name: 'Álgebra', credits: 4 })).toBe('A1 · Álgebra · 4.0 créditos');
  });
});

describe('totalCreditos', () => {
  test('suma los créditos de una lista de cursos', () => {
    expect(totalCreditos([{ credits: 3 }, { credits: 4 }])).toBe(7);
  });

  test('devuelve 0 para lista vacía', () => {
    expect(totalCreditos([])).toBe(0);
  });

  test('devuelve los créditos del único curso', () => {
    expect(totalCreditos([{ credits: 5 }])).toBe(5);
  });
});

describe('ordenarPorCreditos', () => {
  test('ordena de mayor a menor por créditos', () => {
    const cursos = [
      { id: 'B', credits: 3 },
      { id: 'A', credits: 5 },
      { id: 'C', credits: 2 },
    ];
    const result = ordenarPorCreditos(cursos);
    expect(result.map((c) => c.id)).toEqual(['A', 'B', 'C']);
  });

  test('usa id como desempate ascendente cuando créditos son iguales', () => {
    const cursos = [
      { id: 'C', credits: 3 },
      { id: 'A', credits: 3 },
      { id: 'B', credits: 3 },
    ];
    const result = ordenarPorCreditos(cursos);
    expect(result.map((c) => c.id)).toEqual(['A', 'B', 'C']);
  });

  test('no modifica el arreglo original', () => {
    const cursos = [{ id: 'Z', credits: 1 }, { id: 'A', credits: 4 }];
    const original = [...cursos];
    ordenarPorCreditos(cursos);
    expect(cursos).toEqual(original);
  });
});

describe('agruparPorCiclo', () => {
  test('agrupa cursos por ciclo formateado', () => {
    const cursos = [
      { id: 'B', credits: 3, cycle: 5 },
      { id: 'A', credits: 4, cycle: 5 },
      { id: 'C', credits: 2, cycle: 6 },
    ];
    const result = agruparPorCiclo(cursos);
    expect(Object.keys(result)).toContain('Ciclo 5');
    expect(Object.keys(result)).toContain('Ciclo 6');
    // dentro de cada grupo, ordenados por id
    expect(result['Ciclo 5'].map((c) => c.id)).toEqual(['A', 'B']);
  });

  test('agrupa cursos sin ciclo como Electivo', () => {
    const cursos = [
      { id: 'X', credits: 2, cycle: null },
      { id: 'Y', credits: 3, cycle: undefined },
    ];
    const result = agruparPorCiclo(cursos);
    expect(result['Electivo']).toHaveLength(2);
    expect(result['Electivo'].map((c) => c.id)).toEqual(['X', 'Y']);
  });
});

describe('listaRequisitos', () => {
  test('devuelve Sin requisitos para lista vacía', () => {
    expect(listaRequisitos([])).toBe('Sin requisitos');
  });

  test('devuelve los códigos ordenados y unidos por coma', () => {
    expect(listaRequisitos(['b', 'a'])).toBe('a, b');
  });

  test('devuelve un único requisito sin coma', () => {
    expect(listaRequisitos(['X1'])).toBe('X1');
  });
});
