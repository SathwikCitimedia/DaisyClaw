// DaisyClaw agent database stores agent-scoped persisted runtime state.
import { chmodSync, existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import {
  clearNodeSqliteKyselyCacheForDatabase,
  executeSqliteQuerySync,
  getNodeSqliteKysely,
} from "../infra/kysely-sync.js";
import { requireNodeSqlite } from "../infra/node-sqlite.js";
import { runSqliteImmediateTransactionSync } from "../infra/sqlite-transaction.js";
import { configureSqliteWalMaintenance, type SqliteWalMaintenance } from "../infra/sqlite-wal.js";
import { normalizeAgentId } from "../routing/session-key.js";
import type { DB as DaisyClawAgentKyselyDatabase } from "./daisyclaw-agent-db.generated.js";
import { resolveDaisyClawAgentSqlitePath } from "./daisyclaw-agent-db.paths.js";
import { DAISYCLAW_AGENT_SCHEMA_SQL } from "./daisyclaw-agent-schema.generated.js";
import type { DB as DaisyClawStateKyselyDatabase } from "./daisyclaw-state-db.generated.js";
import {
  DAISYCLAW_SQLITE_BUSY_TIMEOUT_MS,
  openDaisyClawStateDatabase,
  runDaisyClawStateWriteTransaction,
  type DaisyClawStateDatabaseOptions,
} from "./daisyclaw-state-db.js";
export { resolveDaisyClawAgentSqlitePath } from "./daisyclaw-agent-db.paths.js";

/**
 * Per-agent SQLite database lifecycle and shared-state registration.
 *
 * Each opened agent database is schema-owned by one normalized agent id, cached
 * per pathname, protected with private file modes, and registered in the shared
 * DaisyClaw state database for discovery and maintenance.
 */
const DAISYCLAW_AGENT_SCHEMA_VERSION = 1;
const DAISYCLAW_AGENT_DB_DIR_MODE = 0o700;
const DAISYCLAW_AGENT_DB_FILE_MODE = 0o600;
const DAISYCLAW_AGENT_DB_SIDECAR_SUFFIXES = ["", "-shm", "-wal"] as const;

/** Open per-agent SQLite database handle plus lifecycle maintenance. */
export type DaisyClawAgentDatabase = {
  agentId: string;
  db: DatabaseSync;
  path: string;
  walMaintenance: SqliteWalMaintenance;
};

/** Options for resolving and opening one agent database. */
export type DaisyClawAgentDatabaseOptions = DaisyClawStateDatabaseOptions & {
  agentId: string;
};

/** Shared-state registry row describing an agent database seen by this process. */
export type DaisyClawRegisteredAgentDatabase = {
  agentId: string;
  path: string;
  schemaVersion: number;
  lastSeenAt: number;
  sizeBytes: number | null;
};

type DaisyClawAgentMetadataDatabase = Pick<DaisyClawAgentKyselyDatabase, "schema_meta">;
type DaisyClawAgentRegistryDatabase = Pick<DaisyClawStateKyselyDatabase, "agent_databases">;

const cachedDatabases = new Map<string, DaisyClawAgentDatabase>();

type ExistingSchemaMeta = {
  agentId: string | null;
  role: string | null;
};

function readSqliteUserVersion(db: DatabaseSync): number {
  const row = db.prepare("PRAGMA user_version").get() as { user_version?: unknown } | undefined;
  return Number(row?.user_version ?? 0);
}

function assertSupportedAgentSchemaVersion(db: DatabaseSync, pathname: string): void {
  const userVersion = readSqliteUserVersion(db);
  if (userVersion > DAISYCLAW_AGENT_SCHEMA_VERSION) {
    throw new Error(
      `DaisyClaw agent database ${pathname} uses newer schema version ${userVersion}; this DaisyClaw build supports ${DAISYCLAW_AGENT_SCHEMA_VERSION}.`,
    );
  }
}

function ensureDaisyClawAgentDatabasePermissions(
  pathname: string,
  options: DaisyClawAgentDatabaseOptions,
): void {
  const dir = path.dirname(pathname);
  const defaultPath = resolveDaisyClawAgentSqlitePath({
    agentId: options.agentId,
    env: options.env,
  });
  const isDefaultAgentDatabase = path.resolve(pathname) === path.resolve(defaultPath);
  const dirExisted = existsSync(dir);
  mkdirSync(dir, { recursive: true, mode: DAISYCLAW_AGENT_DB_DIR_MODE });
  // Default agent state is private by contract; custom pre-existing dirs keep caller ownership.
  if (isDefaultAgentDatabase || !dirExisted) {
    chmodSync(dir, DAISYCLAW_AGENT_DB_DIR_MODE);
  }
  for (const suffix of DAISYCLAW_AGENT_DB_SIDECAR_SUFFIXES) {
    const candidate = `${pathname}${suffix}`;
    if (existsSync(candidate)) {
      chmodSync(candidate, DAISYCLAW_AGENT_DB_FILE_MODE);
    }
  }
}

function readExistingSchemaMeta(db: DatabaseSync): ExistingSchemaMeta | null {
  const schemaMetaTable = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_meta'")
    .get();
  if (!schemaMetaTable) {
    return null;
  }
  const row = db
    .prepare("SELECT role, agent_id FROM schema_meta WHERE meta_key = 'primary'")
    .get() as { agent_id?: unknown; role?: unknown } | undefined;
  if (!row) {
    return null;
  }
  return {
    agentId: typeof row.agent_id === "string" ? row.agent_id : null,
    role: typeof row.role === "string" ? row.role : null,
  };
}

function assertExistingSchemaOwner(
  existing: ExistingSchemaMeta | null,
  agentId: string,
  pathname: string,
): void {
  if (!existing) {
    return;
  }
  // Agent DB files are not interchangeable; opening another role/id would corrupt ownership.
  if (existing.role !== "agent") {
    throw new Error(
      `DaisyClaw agent database ${pathname} has schema role ${existing.role ?? "unknown"}; expected agent.`,
    );
  }
  if (!existing.agentId) {
    throw new Error(`DaisyClaw agent database ${pathname} has no agent owner.`);
  }
  if (normalizeAgentId(existing.agentId) !== agentId) {
    throw new Error(
      `DaisyClaw agent database ${pathname} belongs to agent ${existing.agentId}; requested agent ${agentId}.`,
    );
  }
}

function ensureAgentSchema(db: DatabaseSync, agentId: string, pathname: string): void {
  assertSupportedAgentSchemaVersion(db, pathname);
  assertExistingSchemaOwner(readExistingSchemaMeta(db), agentId, pathname);
  db.exec(DAISYCLAW_AGENT_SCHEMA_SQL);
  const kysely = getNodeSqliteKysely<DaisyClawAgentMetadataDatabase>(db);
  db.exec(`PRAGMA user_version = ${DAISYCLAW_AGENT_SCHEMA_VERSION};`);
  const now = Date.now();
  executeSqliteQuerySync(
    db,
    kysely
      .insertInto("schema_meta")
      .values({
        meta_key: "primary",
        role: "agent",
        schema_version: DAISYCLAW_AGENT_SCHEMA_VERSION,
        agent_id: agentId,
        app_version: null,
        created_at: now,
        updated_at: now,
      })
      .onConflict((conflict) =>
        conflict.column("meta_key").doUpdateSet({
          role: "agent",
          schema_version: DAISYCLAW_AGENT_SCHEMA_VERSION,
          agent_id: agentId,
          app_version: null,
          updated_at: now,
        }),
      ),
  );
}

function registerAgentDatabase(params: {
  agentId: string;
  path: string;
  env?: NodeJS.ProcessEnv;
}): void {
  let sizeBytes: number | null = null;
  try {
    sizeBytes = statSync(params.path).size;
  } catch {
    sizeBytes = null;
  }
  const lastSeenAt = Date.now();
  runDaisyClawStateWriteTransaction(
    (database) => {
      const db = getNodeSqliteKysely<DaisyClawAgentRegistryDatabase>(database.db);
      executeSqliteQuerySync(
        database.db,
        db
          .insertInto("agent_databases")
          .values({
            agent_id: params.agentId,
            path: params.path,
            schema_version: DAISYCLAW_AGENT_SCHEMA_VERSION,
            last_seen_at: lastSeenAt,
            size_bytes: sizeBytes,
          })
          .onConflict((conflict) =>
            conflict.columns(["agent_id", "path"]).doUpdateSet({
              schema_version: DAISYCLAW_AGENT_SCHEMA_VERSION,
              last_seen_at: lastSeenAt,
              size_bytes: sizeBytes,
            }),
          ),
      );
    },
    { env: params.env },
  );
}

/** List agent databases recorded in the shared DaisyClaw state registry. */
export function listDaisyClawRegisteredAgentDatabases(
  options: DaisyClawStateDatabaseOptions = {},
): DaisyClawRegisteredAgentDatabase[] {
  const database = openDaisyClawStateDatabase(options);
  const db = getNodeSqliteKysely<DaisyClawAgentRegistryDatabase>(database.db);
  const rows = executeSqliteQuerySync(
    database.db,
    db.selectFrom("agent_databases").selectAll().orderBy("agent_id", "asc").orderBy("path", "asc"),
  ).rows;
  return rows.map((row) => ({
    agentId: normalizeAgentId(row.agent_id),
    path: row.path,
    schemaVersion: row.schema_version,
    lastSeenAt: row.last_seen_at,
    sizeBytes: row.size_bytes,
  }));
}

/** Open or return a cached per-agent database after schema and owner validation. */
export function openDaisyClawAgentDatabase(
  options: DaisyClawAgentDatabaseOptions,
): DaisyClawAgentDatabase {
  const agentId = normalizeAgentId(options.agentId);
  const databaseOptions = { ...options, agentId };
  const pathname = resolveDaisyClawAgentSqlitePath(databaseOptions);
  const cached = cachedDatabases.get(pathname);
  if (cached?.db.isOpen) {
    if (cached.agentId !== agentId) {
      throw new Error(
        `DaisyClaw agent database ${pathname} is already open for agent ${cached.agentId}; requested agent ${agentId}.`,
      );
    }
    registerAgentDatabase({ agentId, path: pathname, env: options.env });
    return cached;
  }
  if (cached) {
    // A closed handle can leave Kysely and WAL helpers cached; clear both before reopening.
    cached.walMaintenance.close();
    clearNodeSqliteKyselyCacheForDatabase(cached.db);
    cachedDatabases.delete(pathname);
  }

  ensureDaisyClawAgentDatabasePermissions(pathname, databaseOptions);
  const sqlite = requireNodeSqlite();
  const db = new sqlite.DatabaseSync(pathname);
  const walMaintenance = configureSqliteWalMaintenance(db, {
    databaseLabel: `daisyclaw-agent:${agentId}`,
    databasePath: pathname,
  });
  db.exec("PRAGMA synchronous = NORMAL;");
  db.exec(`PRAGMA busy_timeout = ${DAISYCLAW_SQLITE_BUSY_TIMEOUT_MS};`);
  db.exec("PRAGMA foreign_keys = ON;");
  try {
    ensureAgentSchema(db, agentId, pathname);
  } catch (err) {
    walMaintenance.close();
    db.close();
    throw err;
  }
  ensureDaisyClawAgentDatabasePermissions(pathname, databaseOptions);
  const database = { agentId, db, path: pathname, walMaintenance };
  cachedDatabases.set(pathname, database);
  registerAgentDatabase({ agentId, path: pathname, env: options.env });
  return database;
}

/** Run a synchronous immediate transaction against an agent database. */
export function runDaisyClawAgentWriteTransaction<T>(
  operation: (database: DaisyClawAgentDatabase) => T,
  options: DaisyClawAgentDatabaseOptions,
): T {
  const database = openDaisyClawAgentDatabase(options);
  const result = runSqliteImmediateTransactionSync(database.db, () => operation(database));
  ensureDaisyClawAgentDatabasePermissions(database.path, options);
  return result;
}

/** Close cached agent databases so tests can remove temp dirs and reopen cleanly. */
export function closeDaisyClawAgentDatabasesForTest(): void {
  for (const database of cachedDatabases.values()) {
    database.walMaintenance.close();
    clearNodeSqliteKyselyCacheForDatabase(database.db);
    database.db.close();
  }
  cachedDatabases.clear();
}
