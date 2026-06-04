SELECT id, nombre FROM negocios WHERE nombre IN (
  SELECT nombre FROM negocios GROUP BY nombre HAVING COUNT(*) > 1
);