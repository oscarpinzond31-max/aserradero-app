# 🪵 Aserradero — Sistema de Gestión Financiera

App web privada para gestión de clientes, facturas, cobros y gastos de aserradero.

---

## 🚀 Despliegue en Railway (recomendado)

### Paso 1 — Crear cuenta en Railway
1. Ve a [railway.app](https://railway.app) y crea una cuenta gratuita (puedes usar tu cuenta de Google o GitHub).

### Paso 2 — Subir el código a GitHub
1. Ve a [github.com](https://github.com) y crea una cuenta gratis si no tienes.
2. Crea un nuevo repositorio (botón **New repository**), llámalo `aserradero-app`, **privado**.
3. En tu computador, instala [Git](https://git-scm.com/downloads) si no lo tienes.
4. Abre una terminal en la carpeta del proyecto y ejecuta:

```bash
git init
git add .
git commit -m "primer commit"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/aserradero-app.git
git push -u origin main
```

### Paso 3 — Crear el proyecto en Railway
1. En Railway, haz clic en **New Project**.
2. Selecciona **Deploy from GitHub repo** y conecta tu cuenta de GitHub.
3. Selecciona el repositorio `aserradero-app`.
4. Railway detectará automáticamente que es una app Node.js.

### Paso 4 — Agregar la base de datos PostgreSQL
1. En tu proyecto Railway, haz clic en **+ New** → **Database** → **PostgreSQL**.
2. Railway creará la base de datos y automáticamente agregará la variable `DATABASE_URL` a tu app.

### Paso 5 — Configurar variables de entorno
1. En tu servicio (no en la base de datos), ve a **Variables**.
2. Agrega esta variable:
   - `SESSION_SECRET` = (escribe cualquier texto largo y aleatorio, ej: `mi-aserradero-secreto-2024-xk29`)

### Paso 6 — Desplegar
1. Railway desplegará automáticamente. Espera ~2 minutos.
2. Ve a **Settings** → **Networking** → **Generate Domain** para obtener tu URL pública.
3. Abre esa URL — verás la pantalla de login.

### Paso 7 — Crear el primer usuario (administrador)
1. Ve a `https://TU-URL.railway.app/registro`
2. Crea el primer usuario — este será automáticamente **administrador**.
3. Desde el panel, el administrador puede agregar más usuarios en **Usuarios → Crear nuevo usuario**.

---

## 👥 Agregar más usuarios
- Solo el administrador puede crear usuarios.
- Ve al menú **Usuarios** en el panel lateral → botón **Crear nuevo usuario**.
- O ve directamente a `https://TU-URL.railway.app/registro` mientras estás logueado como admin.

---

## 💰 Costo en Railway
- Plan **Starter** (gratuito): incluye $5 USD en créditos al mes.
- Una app + base de datos pequeña consume aproximadamente $3-7/mes.
- Si necesitas más, el plan **Pro** es $20/mes con recursos ilimitados.

---

## 🔧 Desarrollo local (opcional)

Requiere Node.js 18+ y PostgreSQL instalados.

```bash
# Instalar dependencias
npm install

# Crear archivo .env basado en el ejemplo
cp .env.example .env
# Edita .env con tus datos de PostgreSQL local

# Iniciar servidor
npm start
```

La app estará en http://localhost:3000

---

## 📋 Funcionalidades
- ✅ Dashboard financiero (ingresos, gastos, utilidad, cuentas pendientes)
- ✅ Gestión de clientes (nombre, NIT, teléfono, ciudad, dirección)
- ✅ Facturas con numeración automática (F-0001, F-0002...)
- ✅ Registro de abonos parciales y control de saldo
- ✅ Cuentas por cobrar con detección de vencidas
- ✅ Gastos por 13 categorías (madera, tractor, personal, etc.)
- ✅ Cuentas por pagar
- ✅ Login privado con usuarios y contraseñas
- ✅ Múltiples usuarios con roles (admin / usuario)
- ✅ Datos compartidos en tiempo real entre todos los usuarios
