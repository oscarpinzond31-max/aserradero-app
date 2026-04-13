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

app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  store: new PgSession({ pool, tableName: 'session' }),
  secret: process.env.SESSION_SECRET || 'aserradero-secret-cambiar',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7*24*60*60*1000, httpOnly: true, secure: 'auto', sameSite: 'lax' }
}));

app.use('/', authRoutes);
app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/index.html', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  res.redirect('/');
});

app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  res.redirect('/');
});

async function start() {
  await initDb();
  app.listen(PORT, () => console.log('Aserradero en puerto ' + PORT));
}

start().catch(console.error);
