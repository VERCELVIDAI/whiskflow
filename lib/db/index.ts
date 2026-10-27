import { promises as fs } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import postgres, { type Sql } from "postgres";

export type QueryParams = unknown[];

export interface DbClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: QueryParams,
  ): Promise<T[]>;
}

export interface Database extends DbClient {
  transaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export class DatabaseUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

function normalizeParams(params: QueryParams = []): QueryParams {
  return params.map((value) => {
    if (value === undefined) return null;
    return value;
  });
}

function rowsFromPGlite<T>(result: { rows: unknown[] }): T[] {
  return result.rows as T[];
}

export async function createLocalDatabase(options?: {
  dataDir?: string;
  memory?: boolean;
  applySchema?: boolean;
}): Promise<Database> {
  const memory = options?.memory ?? false;
  const dataDir = options?.dataDir ?? path.join(process.cwd(), ".data", "whisk-flow-db");

  if (!memory) {
    await fs.mkdir(dataDir, { recursive: true });
  }

  const pglite = memory ? new PGlite("memory://") : new PGlite(dataDir);

  if (options?.applySchema !== false) {
    const schema = await fs.readFile(path.join(process.cwd(), "db", "schema.sql"), "utf8");
    const localAuth = await fs.readFile(path.join(process.cwd(), "db", "local-auth.sql"), "utf8");
    await pglite.exec(schema);
    await pglite.exec(localAuth);
  }

  return {
    async query<T extends Record<string, unknown>>(text: string, params?: QueryParams) {
      const result = await pglite.query(text, normalizeParams(params));
      return rowsFromPGlite<T>(result);
    },
    async transaction<T>(fn: (tx: DbClient) => Promise<T>) {
      return pglite.transaction(async (tx) => {
        const client: DbClient = {
          async query<TRow extends Record<string, unknown>>(
            text: string,
            params?: QueryParams,
          ) {
            const result = await tx.query(text, normalizeParams(params));
            return rowsFromPGlite<TRow>(result);
          },
        };
        return fn(client);
      }) as Promise<T>;
    },
    async close() {
      await pglite.close();
    },
  };
}

export async function createPostgresDatabase(connectionString: string): Promise<Database> {
  let sql: Sql;
  try {
    sql = postgres(connectionString, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 15,
      prepare: false,
      onnotice: () => undefined,
    });
  } catch (error) {
    throw new DatabaseUnavailableError(
      `Could not initialize PostgreSQL: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }

  try {
    const rows = await sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'profiles'
      LIMIT 1
    `;
    if (rows.length === 0) {
      throw new DatabaseUnavailableError(
        "The Whisk Flow tables are missing. Apply supabase/migrations/0001_whisk_flow.sql in your Supabase project.",
      );
    }
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      await sql.end({ timeout: 2 });
      throw error;
    }
    await sql.end({ timeout: 2 });
    throw new DatabaseUnavailableError(
      `Could not connect to PostgreSQL. Check DATABASE_URL. ${
        error instanceof Error ? error.message : ""
      }`.trim(),
    );
  }

  return {
    async query<T extends Record<string, unknown>>(text: string, params?: QueryParams) {
      const rows = await sql.unsafe(text, normalizeParams(params) as never[]);
      return rows as unknown as T[];
    },
    async transaction<T>(fn: (tx: DbClient) => Promise<T>) {
      return sql.begin(async (tx) => {
        const client: DbClient = {
          async query<TRow extends Record<string, unknown>>(
            text: string,
            params?: QueryParams,
          ) {
            const rows = await tx.unsafe(text, normalizeParams(params) as never[]);
            return rows as unknown as TRow[];
          },
        };
        return fn(client);
      }) as Promise<T>;
    },
    async close() {
      await sql.end({ timeout: 5 });
    },
  };
}

type GlobalDb = typeof globalThis & {
  __whiskFlowDb?: Promise<Database>;
};

export function isRemoteDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function getDatabase(): Promise<Database> {
  const globalStore = globalThis as GlobalDb;
  if (!globalStore.__whiskFlowDb) {
    const pending = (async () => {
      if (process.env.DATABASE_URL) {
        return createPostgresDatabase(process.env.DATABASE_URL);
      }
      if (isSupabaseConfigured()) {
        throw new DatabaseUnavailableError(
          "Supabase Auth is configured but DATABASE_URL is missing. Add the direct Postgres connection string to .env.local.",
        );
      }
      return createLocalDatabase();
    })();
    globalStore.__whiskFlowDb = pending;
    // Do not cache a failed connection forever: a transient outage or a fixed
    // environment variable should be able to recover without a restart.
    void pending.catch(() => {
      if (globalStore.__whiskFlowDb === pending) {
        globalStore.__whiskFlowDb = undefined;
      }
    });
  }
  return globalStore.__whiskFlowDb;
}

export function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  return code === "23505";
}

export function databaseErrorMessage(error: unknown): string {
  if (error instanceof DatabaseUnavailableError) return error.message;
  if (error instanceof Error) {
    if (/ECONNREFUSED|ENOTFOUND|password authentication|timeout/i.test(error.message)) {
      return "The database is temporarily unavailable. Please try again.";
    }
    return error.message;
  }
  return "An unexpected database error occurred.";
}
