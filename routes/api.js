const express = require('express');
const { pool } = require('../db');
const router = express.Router();

function auth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'No autenticado' });
  next();
}

// CLIENTES
router.get('/clientes', auth, async (req, res) => {
  const r = await pool.query(`
    SELECT c.*,
      COALESCE(SUM(f.total),0) AS total_facturado,
      COALESCE((SELECT SUM(a.monto) FROM abonos a JOIN facturas f2 ON a.factura_id=f2.id WHERE f2.cliente_id=c.id),0) AS total_pagado
    FROM clientes c LEFT JOIN facturas f ON f.cliente_id=c.id
    GROUP BY c.id ORDER BY c.nombre`);
  res.json(r.rows);
});
router.post('/clientes', auth, async (req, res) => {
  const { nombre, nit, telefono, ciudad, direccion, notas } = req.body;
  if (!nombre || !telefono) return res.status(400).json({ error: 'Nombre y teléfono son obligatorios' });
  const r = await pool.query('INSERT INTO clientes (nombre,nit,telefono,ciudad,direccion,notas) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [nombre.trim(), nit||null, telefono.trim(), ciudad||null, direccion||null, notas||null]);
  res.json(r.rows[0]);
});
router.put('/clientes/:id', auth, async (req, res) => {
  const { nombre, nit, telefono, ciudad, direccion, notas } = req.body;
  if (!nombre || !telefono) return res.status(400).json({ error: 'Nombre y teléfono son obligatorios' });
  const r = await pool.query('UPDATE clientes SET nombre=$1,nit=$2,telefono=$3,ciudad=$4,direccion=$5,notas=$6 WHERE id=$7 RETURNING *',
    [nombre.trim(), nit||null, telefono.trim(), ciudad||null, direccion||null, notas||null, req.params.id]);
  res.json(r.rows[0]);
});
router.delete('/clientes/:id', auth, async (req, res) => {
  await pool.query('DELETE FROM clientes WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});
router.get('/clientes/:id/detalle', auth, async (req, res) => {
  const [cliente, facturas, abonosR] = await Promise.all([
    pool.query('SELECT * FROM clientes WHERE id=$1', [req.params.id]),
    pool.query(`SELECT f.*, COALESCE((SELECT SUM(a.monto) FROM abonos a WHERE a.factura_id=f.id),0) AS pagado FROM facturas f WHERE f.cliente_id=$1 ORDER BY f.fecha DESC`, [req.params.id]),
    pool.query(`SELECT a.*, f.descripcion AS fact_desc, f.id AS fid FROM abonos a JOIN facturas f ON a.factura_id=f.id WHERE f.cliente_id=$1 ORDER BY a.fecha DESC`, [req.params.id])
  ]);
  res.json({ cliente: cliente.rows[0], facturas: facturas.rows, abonos: abonosR.rows });
});

// FACTURAS
router.get('/facturas', auth, async (req, res) => {
  const { estado, buscar } = req.query;
  let q = `SELECT f.*, c.nombre AS cliente_nombre, COALESCE((SELECT SUM(a.monto) FROM abonos a WHERE a.factura_id=f.id),0) AS pagado FROM facturas f JOIN clientes c ON f.cliente_id=c.id WHERE 1=1`;
  const params = [];
  if (estado) { params.push(estado); q += ` AND f.estado=$${params.length}`; }
  if (buscar) { params.push('%'+buscar+'%'); q += ` AND (c.nombre ILIKE $${params.length} OR f.numero ILIKE $${params.length} OR f.descripcion ILIKE $${params.length})`; }
  q += ' ORDER BY f.fecha DESC, f.id DESC';
  const r = await pool.query(q, params);
  res.json(r.rows);
});
router.post('/facturas', auth, async (req, res) => {
  const { cliente_id, fecha, descripcion, cantidad, precio_unitario, flete, subtotal, iva_pct, iva, total, estado, notas, abono_inicial } = req.body;
  if (!cliente_id || !fecha || !total) return res.status(400).json({ error: 'Cliente, fecha y total son obligatorios' });
  const numR = await pool.query("SELECT NEXTVAL('factura_seq') AS n");
  const numero = 'F-' + String(numR.rows[0].n).padStart(4, '0');
  const r = await pool.query(
    `INSERT INTO facturas (numero,cliente_id,fecha,descripcion,cantidad,precio_unitario,flete,subtotal,iva_pct,iva,total,estado,notas,creado_por) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [numero, cliente_id, fecha, descripcion||null, cantidad||null, precio_unitario||null, flete||0, subtotal||0, iva_pct||0, iva||0, total, estado||'pendiente', notas||null, req.session.userId]
  );
  const fid = r.rows[0].id;
  if (abono_inicial && parseFloat(abono_inicial) > 0) {
    await pool.query('INSERT INTO abonos (factura_id,monto,fecha,notas,registrado_por) VALUES ($1,$2,$3,$4,$5)',
      [fid, parseFloat(abono_inicial), fecha, 'Abono inicial', req.session.userId]);
    await actualizarEstadoFactura(fid);
  }
  res.json(r.rows[0]);
});
router.put('/facturas/:id', auth, async (req, res) => {
  const { cliente_id, fecha, descripcion, cantidad, precio_unitario, flete, subtotal, iva_pct, iva, total, notas } = req.body;
  if (!cliente_id || !fecha || !total) return res.status(400).json({ error: 'Datos incompletos' });
  const r = await pool.query(
    `UPDATE facturas SET cliente_id=$1,fecha=$2,descripcion=$3,cantidad=$4,precio_unitario=$5,flete=$6,subtotal=$7,iva_pct=$8,iva=$9,total=$10,notas=$11 WHERE id=$12 RETURNING *`,
    [cliente_id, fecha, descripcion||null, cantidad||null, precio_unitario||null, flete||0, subtotal||0, iva_pct||0, iva||0, total, notas||null, req.params.id]
  );
  await actualizarEstadoFactura(req.params.id);
  res.json(r.rows[0]);
});
router.delete('/facturas/:id', auth, async (req, res) => {
  await pool.query('DELETE FROM facturas WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ABONOS FACTURAS
router.post('/abonos', auth, async (req, res) => {
  const { factura_id, monto, fecha, notas } = req.body;
  if (!factura_id || !monto || !fecha) return res.status(400).json({ error: 'Datos incompletos' });
  await pool.query('INSERT INTO abonos (factura_id,monto,fecha,notas,registrado_por) VALUES ($1,$2,$3,$4,$5)',
    [factura_id, monto, fecha, notas||null, req.session.userId]);
  await actualizarEstadoFactura(factura_id);
  const f = await pool.query(`SELECT f.*, COALESCE((SELECT SUM(a.monto) FROM abonos a WHERE a.factura_id=f.id),0) AS pagado FROM facturas f WHERE f.id=$1`, [factura_id]);
  res.json(f.rows[0]);
});
router.delete('/abonos/:id', auth, async (req, res) => {
  const r = await pool.query('SELECT factura_id FROM abonos WHERE id=$1', [req.params.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'No encontrado' });
  const factura_id = r.rows[0].factura_id;
  await pool.query('DELETE FROM abonos WHERE id=$1', [req.params.id]);
  await actualizarEstadoFactura(factura_id);
  res.json({ ok: true, factura_id });
});
async function actualizarEstadoFactura(fid) {
  const r = await pool.query('SELECT total FROM facturas WHERE id=$1', [fid]);
  if (!r.rows.length) return;
  const total = parseFloat(r.rows[0].total);
  const pagR = await pool.query('SELECT COALESCE(SUM(monto),0) AS pagado FROM abonos WHERE factura_id=$1', [fid]);
  const pagado = parseFloat(pagR.rows[0].pagado);
  const estado = pagado <= 0 ? 'pendiente' : pagado >= total ? 'pagada' : 'parcial';
  await pool.query('UPDATE facturas SET estado=$1 WHERE id=$2', [estado, fid]);
}

// GASTOS
router.get('/gastos', auth, async (req, res) => {
  const { categoria, mes, estado } = req.query;
  let q = `SELECT g.*, u.nombre AS creado_por_nombre,
    COALESCE((SELECT SUM(ag.monto) FROM abonos_gastos ag WHERE ag.gasto_id=g.id),0) AS abonado
    FROM gastos g LEFT JOIN usuarios u ON g.creado_por=u.id WHERE 1=1`;
  const params = [];
  if (categoria) { params.push(categoria); q += ` AND g.categoria=$${params.length}`; }
  if (mes) { params.push(mes+'%'); q += ` AND g.fecha::text ILIKE $${params.length}`; }
  if (estado) { params.push(estado); q += ` AND g.estado=$${params.length}`; }
  q += ' ORDER BY g.fecha DESC, g.id DESC';
  const r = await pool.query(q, params);
  res.json(r.rows);
});
router.post('/gastos', auth, async (req, res) => {
  const { categoria, fecha, descripcion, monto, iva_pct, iva, total, proveedor, estado, metodo_pago } = req.body;
  if (!categoria || !fecha || !monto) return res.status(400).json({ error: 'Categoría, fecha y monto son obligatorios' });
  const totalVal = total || (parseFloat(monto) + parseFloat(iva||0));
  const r = await pool.query(
    'INSERT INTO gastos (categoria,fecha,descripcion,monto,iva_pct,iva,total,proveedor,estado,metodo_pago,creado_por) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',
    [categoria, fecha, descripcion||null, monto, iva_pct||0, iva||0, totalVal, proveedor||null, estado||'pagado', metodo_pago||'Efectivo', req.session.userId]
  );
  res.json(r.rows[0]);
});
router.put('/gastos/:id', auth, async (req, res) => {
  const { categoria, fecha, descripcion, monto, iva_pct, iva, total, proveedor, estado, metodo_pago } = req.body;
  if (!categoria || !fecha || !monto) return res.status(400).json({ error: 'Datos incompletos' });
  const totalVal = total || (parseFloat(monto) + parseFloat(iva||0));
  const r = await pool.query(
    'UPDATE gastos SET categoria=$1,fecha=$2,descripcion=$3,monto=$4,iva_pct=$5,iva=$6,total=$7,proveedor=$8,estado=$9,metodo_pago=$10 WHERE id=$11 RETURNING *',
    [categoria, fecha, descripcion||null, monto, iva_pct||0, iva||0, totalVal, proveedor||null, estado||'pagado', metodo_pago||'Efectivo', req.params.id]
  );
  res.json(r.rows[0]);
});
router.put('/gastos/:id/pagar', auth, async (req, res) => {
  const r = await pool.query('UPDATE gastos SET estado=$1 WHERE id=$2 RETURNING *', ['pagado', req.params.id]);
  res.json(r.rows[0]);
});
router.delete('/gastos/:id', auth, async (req, res) => {
  await pool.query('DELETE FROM gastos WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ABONOS GASTOS
router.post('/abonos-gastos', auth, async (req, res) => {
  const { gasto_id, monto, fecha, notas } = req.body;
  if (!gasto_id || !monto || !fecha) return res.status(400).json({ error: 'Datos incompletos' });
  await pool.query('INSERT INTO abonos_gastos (gasto_id,monto,fecha,notas,registrado_por) VALUES ($1,$2,$3,$4,$5)',
    [gasto_id, monto, fecha, notas||null, req.session.userId]);
  // Verificar si el saldo quedó en 0 y marcar pagado
  const g = await pool.query('SELECT total FROM gastos WHERE id=$1', [gasto_id]);
  const total = parseFloat(g.rows[0].total);
  const pagR = await pool.query('SELECT COALESCE(SUM(monto),0) AS abonado FROM abonos_gastos WHERE gasto_id=$1', [gasto_id]);
  const abonado = parseFloat(pagR.rows[0].abonado);
  if (abonado >= total) await pool.query('UPDATE gastos SET estado=$1 WHERE id=$2', ['pagado', gasto_id]);
  res.json({ ok: true, abonado, saldo: Math.max(0, total - abonado) });
});
router.delete('/abonos-gastos/:id', auth, async (req, res) => {
  await pool.query('DELETE FROM abonos_gastos WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// RESUMEN IVA
router.get('/iva', auth, async (req, res) => {
  const [cobrado, pagado] = await Promise.all([
    pool.query(`SELECT TO_CHAR(fecha,'YYYY-MM') AS mes, SUM(subtotal) AS subtotal, SUM(iva) AS iva FROM facturas WHERE iva>0 GROUP BY mes ORDER BY mes DESC LIMIT 24`),
    pool.query(`SELECT TO_CHAR(fecha,'YYYY-MM') AS mes, SUM(monto) AS subtotal, SUM(iva) AS iva FROM gastos WHERE iva>0 GROUP BY mes ORDER BY mes DESC LIMIT 24`)
  ]);
  const totalCobrado = cobrado.rows.reduce((s,r) => s+parseFloat(r.iva||0), 0);
  const totalPagado = pagado.rows.reduce((s,r) => s+parseFloat(r.iva||0), 0);
  res.json({
    cobrado: cobrado.rows.map(r=>({ mes:r.mes, subtotal:parseFloat(r.subtotal), iva:parseFloat(r.iva) })),
    pagado: pagado.rows.map(r=>({ mes:r.mes, subtotal:parseFloat(r.subtotal), iva:parseFloat(r.iva) })),
    total_cobrado: totalCobrado,
    total_pagado: totalPagado,
    saldo: totalCobrado - totalPagado
  });
});

// DASHBOARD
router.get('/dashboard', auth, async (req, res) => {
  const [factStats, gastoStats, cobrar, pagar, catGastos] = await Promise.all([
    pool.query(`SELECT COALESCE(SUM(f.total),0) AS total_facturado, COALESCE((SELECT SUM(a.monto) FROM abonos a),0) AS total_cobrado, COUNT(CASE WHEN f.estado!='pagada' THEN 1 END) AS facturas_pendientes FROM facturas f`),
    pool.query(`SELECT COALESCE(SUM(CASE WHEN estado='pagado' THEN total END),0) AS total_pagado, COALESCE(SUM(CASE WHEN estado='pendiente' THEN total-COALESCE((SELECT SUM(ag.monto) FROM abonos_gastos ag WHERE ag.gasto_id=g.id),0) END),0) AS total_pendiente FROM gastos g`),
    pool.query(`SELECT f.id, f.numero, f.fecha, f.total, f.subtotal, f.iva, c.nombre AS cliente_nombre, COALESCE((SELECT SUM(a.monto) FROM abonos a WHERE a.factura_id=f.id),0) AS pagado FROM facturas f JOIN clientes c ON f.cliente_id=c.id WHERE f.estado!='pagada' ORDER BY f.fecha LIMIT 5`),
    pool.query(`SELECT g.*, COALESCE((SELECT SUM(ag.monto) FROM abonos_gastos ag WHERE ag.gasto_id=g.id),0) AS abonado FROM gastos g WHERE g.estado='pendiente' ORDER BY fecha LIMIT 5`),
    pool.query(`SELECT categoria, SUM(total) AS total FROM gastos GROUP BY categoria ORDER BY total DESC LIMIT 10`)
  ]);
  res.json({
    facturado: parseFloat(factStats.rows[0].total_facturado),
    cobrado: parseFloat(factStats.rows[0].total_cobrado),
    facturas_pendientes: parseInt(factStats.rows[0].facturas_pendientes),
    gastos_pagados: parseFloat(gastoStats.rows[0].total_pagado),
    gastos_pendientes: parseFloat(gastoStats.rows[0].total_pendiente),
    cobrar: cobrar.rows, pagar: pagar.rows, cat_gastos: catGastos.rows
  });
});

// USUARIOS
router.get('/usuarios', auth, async (req, res) => {
  if (req.session.userRol !== 'admin') return res.status(403).json({ error: 'Sin permiso' });
  const r = await pool.query('SELECT id,nombre,email,rol,creado_en FROM usuarios ORDER BY creado_en');
  res.json(r.rows);
});
router.delete('/usuarios/:id', auth, async (req, res) => {
  if (req.session.userRol !== 'admin') return res.status(403).json({ error: 'Sin permiso' });
  if (parseInt(req.params.id) === req.session.userId) return res.status(400).json({ error: 'No puedes eliminarte' });
  await pool.query('DELETE FROM usuarios WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
