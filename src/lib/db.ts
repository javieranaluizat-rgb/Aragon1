import "server-only";

/**
 * Acceso a la base de datos.
 *
 * - Si existe DATABASE_URL, se usa PostgreSQL (Supabase, Neon, etc.).
 * - Si no, se usa PGlite: un PostgreSQL embebido que guarda los datos en la
 *   carpeta .data/ del proyecto. Sirve para probar la app sin instalar nada.
 */

type Fila = Record<string, unknown>;

interface Conexion {
  query<T = Fila>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

const ESQUEMA = `
CREATE TABLE IF NOT EXISTS casas (
  id SERIAL PRIMARY KEY,
  numero TEXT NOT NULL UNIQUE,
  propietario TEXT,
  email TEXT,
  alicuota NUMERIC(10,2) NOT NULL DEFAULT 0,
  creado TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cargas_estado_cuenta (
  id SERIAL PRIMARY KEY,
  nombre_archivo TEXT NOT NULL,
  total_movimientos INTEGER NOT NULL DEFAULT 0,
  creado TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS movimientos (
  id SERIAL PRIMARY KEY,
  carga_id INTEGER NOT NULL REFERENCES cargas_estado_cuenta(id) ON DELETE CASCADE,
  fecha DATE,
  monto NUMERIC(12,2) NOT NULL,
  referencia TEXT,
  descripcion TEXT,
  huella TEXT NOT NULL UNIQUE,
  creado TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pagos (
  id SERIAL PRIMARY KEY,
  casa_id INTEGER NOT NULL REFERENCES casas(id),
  monto NUMERIC(12,2) NOT NULL,
  fecha_pago DATE,
  banco TEXT,
  referencia TEXT,
  ordenante TEXT,
  cuenta_destino TEXT,
  concepto TEXT,
  archivo BYTEA NOT NULL,
  archivo_tipo TEXT NOT NULL,
  archivo_nombre TEXT,
  lectura_ia JSONB,
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'conciliado', 'rechazado')),
  movimiento_id INTEGER UNIQUE REFERENCES movimientos(id) ON DELETE SET NULL,
  forma_verificacion TEXT,
  nota_admin TEXT,
  creado TIMESTAMPTZ NOT NULL DEFAULT now(),
  verificado TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS pagos_estado_idx ON pagos(estado);
CREATE INDEX IF NOT EXISTS pagos_casa_idx ON pagos(casa_id);
`;

declare global {
  var __samaraDb: Promise<Conexion> | undefined;
}

async function conectar(): Promise<Conexion> {
  let conexion: Conexion;

  if (process.env.DATABASE_URL) {
    const { Pool } = await import("pg");
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      ssl: process.env.DATABASE_URL.includes("localhost")
        ? undefined
        : { rejectUnauthorized: false },
    });
    conexion = {
      query: async (sql, params) => {
        const r = await pool.query(sql, params as unknown[]);
        return { rows: r.rows };
      },
    };
    // Varias sentencias juntas solo se pueden ejecutar sin parámetros.
    await pool.query(ESQUEMA);
  } else {
    if (process.env.VERCEL) {
      throw new Error(
        "Falta DATABASE_URL: en Vercel la base de datos local no guarda los datos. Configura Supabase o Neon.",
      );
    }
    const { PGlite } = await import("@electric-sql/pglite");
    const { mkdirSync } = await import("node:fs");
    mkdirSync(".data", { recursive: true });
    const pg = new PGlite(".data/pglite");
    conexion = {
      query: async (sql, params) => {
        const r = await pg.query(sql, params as unknown[]);
        return { rows: r.rows as never[] };
      },
    };
    await pg.exec(ESQUEMA);
  }

  await sembrarCasasDemo(conexion);
  return conexion;
}

async function sembrarCasasDemo(c: Conexion) {
  if (process.env.SEMBRAR_CASAS_DEMO === "false") return;
  const { rows } = await c.query<{ total: number }>(
    "SELECT count(*)::int AS total FROM casas",
  );
  if (rows[0].total > 0) return;
  for (let n = 1; n <= 20; n++) {
    await c.query(
      "INSERT INTO casas (numero, propietario, alicuota) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
      [String(n), `Propietario casa ${n}`, 60],
    );
  }
}

export function db(): Promise<Conexion> {
  if (!globalThis.__samaraDb) {
    globalThis.__samaraDb = conectar().catch((e) => {
      globalThis.__samaraDb = undefined;
      throw e;
    });
  }
  return globalThis.__samaraDb;
}

export async function q<T = Fila>(sql: string, params: unknown[] = []) {
  const c = await db();
  const r = await c.query<T>(sql, params);
  return r.rows;
}

export async function q1<T = Fila>(sql: string, params: unknown[] = []) {
  const filas = await q<T>(sql, params);
  return filas[0] as T | undefined;
}
