require('dotenv').config();
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const { pool, initDb } = require('./db');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sesiones ANTES de servir archivos
app.use(session({
  store: new PgSession({ pool, tableName: 'session' }),
  secret: process.env.SESSION_SECRET || 'aserradero-secret-2024-cambiar',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  }
}));

// Rutas auth (login, logout, registro)
app.use('/', authRoutes);

// API protegida
app.use('/api', apiRoutes);

// Página principal — requiere login
app.get('/', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Admin
app.get('/admin/usuarios', (req, res) => {
  if (!req.session.userId || req.session.userRol !== 'admin') return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Bloquear acceso directo a index.html
app.get('/index.html', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  res.redirect('/');
});

// Archivos estáticos al final
app.use(express.static(path.join(__dirname, 'public')));

// Cualquier otra ruta sin login → login
app.use((req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  res.redirect('/');
});

async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log('Aserradero corriendo en puerto ' + PORT);
  });
}

start().catch(console.error);
