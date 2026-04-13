const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.send(loginPage(''));
});
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const r = await pool.query('SELECT * FROM usuarios WHERE email=$1', [email.trim().toLowerCase()]);
    const user = r.rows[0];
    if (!user) return res.send(loginPage('Correo o contraseña incorrectos'));
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.send(loginPage('Correo o contraseña incorrectos'));
    req.session.userId = user.id; req.session.userName = user.nombre; req.session.userRol = user.rol;
    res.redirect('/');
  } catch(e) { console.error(e); res.send(loginPage('Error del servidor')); }
});
router.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });
router.get('/registro', async (req, res) => {
  const r = await pool.query('SELECT COUNT(*) FROM usuarios');
  const count = parseInt(r.rows[0].count);
  if (count > 0 && (!req.session.userId || req.session.userRol !== 'admin')) return res.redirect('/login');
  res.send(registroPage('', count === 0));
});
router.post('/registro', async (req, res) => {
  const { nombre, email, password, password2 } = req.body;
  const r = await pool.query('SELECT COUNT(*) FROM usuarios');
  const count = parseInt(r.rows[0].count);
  if (count > 0 && (!req.session.userId || req.session.userRol !== 'admin')) return res.redirect('/login');
  if (password !== password2) return res.send(registroPage('Las contraseñas no coinciden', count === 0));
  if (password.length < 6) return res.send(registroPage('Mínimo 6 caracteres', count === 0));
  try {
    const hash = await bcrypt.hash(password, 10);
    const rol = count === 0 ? 'admin' : 'usuario';
    await pool.query('INSERT INTO usuarios (nombre,email,password_hash,rol) VALUES ($1,$2,$3,$4)',
      [nombre.trim(), email.trim().toLowerCase(), hash, rol]);
    if (count === 0) {
      const u = await pool.query('SELECT * FROM usuarios WHERE email=$1', [email.trim().toLowerCase()]);
      req.session.userId = u.rows[0].id; req.session.userName = u.rows[0].nombre; req.session.userRol = 'admin';
      return res.redirect('/');
    }
    res.redirect('/');
  } catch(e) {
    if (e.code === '23505') return res.send(registroPage('Ese correo ya existe', count === 0));
    res.send(registroPage('Error del servidor', count === 0));
  }
});

const CSS = `*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',sans-serif;background:#F5F2EC;min-height:100vh;display:flex;align-items:center;justify-content:center}.card{background:#fff;border:1px solid #D5D0C6;border-radius:14px;padding:40px 36px;width:100%;max-width:400px}.logo{font-family:'Fraunces',serif;font-size:24px;font-weight:600;color:#1A1814;margin-bottom:4px}.sub{font-size:13px;color:#9C9890;margin-bottom:28px}label{font-size:12px;color:#5C5850;font-weight:500;display:block;margin-bottom:5px}input{width:100%;padding:10px 12px;border:1px solid #D5D0C6;border-radius:7px;background:#F5F2EC;font-family:'DM Sans',sans-serif;font-size:14px;outline:none;margin-bottom:16px}input:focus{border-color:#4A8C61;background:#fff}.btn{width:100%;padding:11px;background:#2D5A3D;color:#fff;border:none;border-radius:7px;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:500;cursor:pointer}.btn:hover{background:#4A8C61}.error{background:#FAECEC;color:#7A2626;border:1px solid #E5B0B0;border-radius:6px;padding:10px 12px;font-size:13px;margin-bottom:16px}.info{background:#E8F2EB;color:#2D5A3D;border:1px solid #A8D4B4;border-radius:6px;padding:10px 12px;font-size:13px;margin-bottom:16px}`;
const G = `<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet">`;

function loginPage(error) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Aserradero</title>${G}<style>${CSS}</style></head><body><div class="card"><div class="logo">🪵 Aserradero</div><div class="sub">Sistema de gestión financiera</div>${error?`<div class="error">${error}</div>`:''}<form method="POST" action="/login"><label>Correo</label><input type="email" name="email" required autocomplete="email"><label>Contraseña</label><input type="password" name="password" required autocomplete="current-password"><button class="btn">Ingresar</button></form></div></body></html>`;
}
function registroPage(error, isFirst) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Registro</title>${G}<style>${CSS}</style></head><body><div class="card"><div class="logo">🪵 Aserradero</div><div class="sub">${isFirst?'Crear cuenta administrador':'Crear usuario'}</div>${isFirst?'<div class="info">Primer usuario — será administrador.</div>':''}${error?`<div class="error">${error}</div>`:''}<form method="POST" action="/registro"><label>Nombre</label><input type="text" name="nombre" required><label>Correo</label><input type="email" name="email" required><label>Contraseña</label><input type="password" name="password" required><label>Confirmar</label><input type="password" name="password2" required><button class="btn">Crear cuenta</button></form></div></body></html>`;
}
module.exports = router;
