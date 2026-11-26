const express = require('express');
const repositorio = require('../data/repositorio');

const router = express.Router();

const CICLO_MIN = 5;
const CICLO_MAX = 10;

function esCicloValido(valor) {
  const ciclo = Number(valor);
  return Number.isInteger(ciclo) && ciclo >= CICLO_MIN && ciclo <= CICLO_MAX;
}

// GET /cursos/:codigo — devuelve el detalle de un curso con sus requisitos resueltos.
// Requisitos: 2.1, 2.2
router.get('/:codigo', (req, res) => {
  const curso = repositorio.obtener(req.params.codigo);

  if (!curso) {
    return res.status(404).json({ error: 'curso no encontrado' });
  }

  const prerequisites = curso.prerequisites.map((id) => {
    const req_ = repositorio.obtener(id);
    return { id, name: req_ ? req_.name : id };
  });

  return res.json({ ...curso, prerequisites });
});

// GET /cursos — lista todos los cursos, opcionalmente filtrados por ciclo.
// Requisitos: 1.1, 1.2, 1.3
router.get('/', (req, res) => {
  const { ciclo } = req.query;

  if (ciclo === undefined) {
    return res.json(repositorio.listar());
  }

  if (!esCicloValido(ciclo)) {
    return res.status(400).json({ error: 'ciclo debe ser un entero entre 5 y 10' });
  }

  return res.json(repositorio.listarPorCiclo(Number(ciclo)));
});

module.exports = router;
