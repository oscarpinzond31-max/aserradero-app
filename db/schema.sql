CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  rol TEXT DEFAULT 'usuario' CHECK (rol IN ('admin','usuario')),
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  nit TEXT,
  telefono TEXT NOT NULL,
  ciudad TEXT,
  direccion TEXT,
  notas TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS facturas (
  id SERIAL PRIMARY KEY,
  numero TEXT UNIQUE NOT NULL,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  descripcion TEXT,
  cantidad NUMERIC(12,2),
  precio_unitario NUMERIC(12,2),
  flete NUMERIC(12,2) DEFAULT 0,
  subtotal NUMERIC(12,2) DEFAULT 0,
  iva_pct NUMERIC(5,2) DEFAULT 0,
  iva NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) NOT NULL,
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente','parcial','pagada')),
  notas TEXT,
  creado_por INTEGER REFERENCES usuarios(id),
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS abonos (
  id SERIAL PRIMARY KEY,
  factura_id INTEGER REFERENCES facturas(id) ON DELETE CASCADE,
  monto NUMERIC(12,2) NOT NULL,
  fecha DATE NOT NULL,
  notas TEXT,
  registrado_por INTEGER REFERENCES usuarios(id),
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gastos (
  id SERIAL PRIMARY KEY,
  categoria TEXT NOT NULL,
  fecha DATE NOT NULL,
  descripcion TEXT,
  monto NUMERIC(12,2) NOT NULL,
  iva_pct NUMERIC(5,2) DEFAULT 0,
  iva NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) NOT NULL,
  proveedor TEXT,
  estado TEXT DEFAULT 'pagado' CHECK (estado IN ('pagado','pendiente')),
  metodo_pago TEXT DEFAULT 'Efectivo',
  creado_por INTEGER REFERENCES usuarios(id),
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS abonos_gastos (
  id SERIAL PRIMARY KEY,
  gasto_id INTEGER REFERENCES gastos(id) ON DELETE CASCADE,
  monto NUMERIC(12,2) NOT NULL,
  fecha DATE NOT NULL,
  notas TEXT,
  registrado_por INTEGER REFERENCES usuarios(id),
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS factura_seq START 1;

CREATE TABLE IF NOT EXISTS session (
  sid TEXT NOT NULL COLLATE "default" PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS IDX_session_expire ON session (expire);

-- Migraciones para bases de datos existentes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='facturas' AND column_name='subtotal') THEN
    ALTER TABLE facturas ADD COLUMN subtotal NUMERIC(12,2) DEFAULT 0;
    ALTER TABLE facturas ADD COLUMN iva_pct NUMERIC(5,2) DEFAULT 0;
    ALTER TABLE facturas ADD COLUMN iva NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='gastos' AND column_name='iva') THEN
    ALTER TABLE gastos ADD COLUMN iva_pct NUMERIC(5,2) DEFAULT 0;
    ALTER TABLE gastos ADD COLUMN iva NUMERIC(12,2) DEFAULT 0;
    ALTER TABLE gastos ADD COLUMN total NUMERIC(12,2);
    UPDATE gastos SET total = monto WHERE total IS NULL;
    ALTER TABLE gastos ALTER COLUMN total SET NOT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='abonos_gastos') THEN
    CREATE TABLE abonos_gastos (
      id SERIAL PRIMARY KEY,
      gasto_id INTEGER REFERENCES gastos(id) ON DELETE CASCADE,
      monto NUMERIC(12,2) NOT NULL,
      fecha DATE NOT NULL,
      notas TEXT,
      registrado_por INTEGER REFERENCES usuarios(id),
      creado_en TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;
