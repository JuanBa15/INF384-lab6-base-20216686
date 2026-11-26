const express = require('express');
const repositorio = require('../data/repositorio');

const router = express.Router();

const CODIGO_REGEX = /^[A-Z0-9]{5,6}$/;

// Función pura: dado el arreglo de códigos aprobados y el catálogo completo,
// devuelve los cursos que el estudiante aún no ha aprobado y cuyos
// prerequisitos están todos contenidos en la lista de aprobados.
// Requisitos: 1.1, 1.2, 1.4, 1.5
function calcularHabilitados(aprobados, cursos) {
  const aprobadosSet = new Set(aprobados);

  return cursos.filter(
    (curso) =>
      !aprobadosSet.has(curso.id) &&
      curso.prerequisites.every((p) => aprobadosSet.has(p))
  );
}

// POST /habilitados — validación secuencial y cálculo de cursos habilitados.
// Requisitos: 1.1, 2.1, 2.2, 3.2, 3.3
router.post('/', (req, res) => {
  const { aprobados } = req.body;

  // 1. Campo requerido
  if (aprobados === undefined) {
    return res.status(400).json({ error: "El campo 'aprobados' es requerido" });
  }

  // 2. Debe ser un array
  if (!Array.isArray(aprobados)) {
    return res.status(400).json({ error: "El campo 'aprobados' debe ser un array" });
  }

  // 3. Cada elemento debe ser string
  if (!aprobados.every((el) => typeof el === 'string')) {
    return res.status(400).json({ error: "Cada elemento de 'aprobados' debe ser un string" });
  }

  // 4. Cada string debe cumplir el formato de código (mensaje fijo, sin reflejar el valor)
  if (!aprobados.every((el) => CODIGO_REGEX.test(el))) {
    return res.status(400).json({ error: 'Formato de código inválido' });
  }

  const habilitados = calcularHabilitados(aprobados, repositorio.listar());
  return res.status(200).json(habilitados);
});

module.exports = router;
module.exports.calcularHabilitados = calcularHabilitados;
