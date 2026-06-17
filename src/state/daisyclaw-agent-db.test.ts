// DaisyClaw agent database tests cover agent-scoped DB storage and migrations.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { executeSqliteQueryTakeFirstSync, getNodeSqliteKysely } from "../infra/kysely-sync.js";
import { requireNodeSqlite } from "../infra/node-sqlite.js";
import { readSqliteNumberPragma } from "../infra/sqlite-pragma.test-support.js";
import type { DB as DaisyClawAgentKyselyDatabase } from "./daisyclaw-agent-db.generated.js";
import {
  closeDaisyClawAgentDatabasesForTest,
  listDaisyClawRegisteredAgentDatabases,
  openDaisyClawAgentDatabase,
  resolveDaisyClawAgentSqlitePath,
} from "./daisyclaw-agent-db.js";
import {
  closeDaisyClawStateDatabaseForTest,
  openDaisyClawStateDatabase,
} from "./daisyclaw-state-db.js";
import {
  collectSqliteSchemaShape,
  createSqliteSchemaShapeFromSql,
} from "./sqlite-schema-shape.test-support.js";

type AgentDbTestDatabase = Pick<DaisyClawAgentKyselyDatabase, "schema_meta">;

function createTempStateDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "daisyclaw-agent-db-"));
}

afterEach(() => {
  closeDaisyClawAgentDatabasesForTest();
  closeDaisyClawStateDatabaseForTest();
});

describe("daisyclaw agent database", () => {
  it("resolves under the per-agent state directory", () => {
    const stateDir = createTempStateDir();

    expect(
      resolveDaisyClawAgentSqlitePath({
        agentId: "Worker-1",
        env: { DAISYCLAW_STATE_DIR: stateDir },
      }),
    ).toBe(path.join(stateDir, "agents", "worker-1", "agent", "daisyclaw-agent.sqlite"));
  });

  it("keeps test default state under a worker-sharded temp directory", () => {
    expect(
      resolveDaisyClawAgentSqlitePath({
        agentId: "main",
        env: {
          VITEST: "true",
          VITEST_WORKER_ID: "7",
        } as NodeJS.ProcessEnv,
      }),
    ).toBe(
      path.join(
        os.tmpdir(),
        "daisyclaw-test-state",
        `${process.pid}-7`,
        "agents",
        "main",
        "agent",
        "daisyclaw-agent.sqlite",
      ),
    );
  });

  it("creates the per-agent schema and registers it globally", () => {
    const stateDir = createTempStateDir();
    const database = openDaisyClawAgentDatabase({
      agentId: "worker-1",
      env: { DAISYCLAW_STATE_DIR: stateDir },
    });

    expect(collectSqliteSchemaShape(database.db)).toEqual(
      createSqliteSchemaShapeFromSql(new URL("./daisyclaw-agent-schema.sql", import.meta.url)),
    );
    expect(database.agentId).toBe("worker-1");
    expect(database.path).toBe(
      path.join(stateDir, "agents", "worker-1", "agent", "daisyclaw-agent.sqlite"),
    );

    const registered = listDaisyClawRegisteredAgentDatabases({
      env: { DAISYCLAW_STATE_DIR: stateDir },
    }).find((entry) => entry.agentId === "worker-1");

    expect(registered).toMatchObject({
      agentId: "worker-1",
      path: database.path,
      schemaVersion: 1,
    });
    expect(registered?.sizeBytes).toBeGreaterThan(0);
  });

  it("keeps multiple registered paths for the same agent", () => {
    const stateDir = createTempStateDir();
    const env = { DAISYCLAW_STATE_DIR: stateDir };
    const relocatedPath = path.join(stateDir, "relocated", "worker-1.sqlite");
    const relocated = openDaisyClawAgentDatabase({
      agentId: "worker-1",
      env,
      path: relocatedPath,
    });
    const defaultDatabase = openDaisyClawAgentDatabase({
      agentId: "worker-1",
      env,
    });

    expect(
      listDaisyClawRegisteredAgentDatabases({ env })
        .filter((entry) => entry.agentId === "worker-1")
        .map((entry) => entry.path),
    ).toEqual([defaultDatabase.path, relocated.path].toSorted());
  });

  it("rejects the legacy agent registry primary key with a doctor repair hint", () => {
    const stateDir = createTempStateDir();
    const env = { DAISYCLAW_STATE_DIR: stateDir };
    const stateDatabasePath = path.join(stateDir, "state", "daisyclaw.sqlite");
    fs.mkdirSync(path.dirname(stateDatabasePath), { recursive: true });
    const { DatabaseSync } = requireNodeSqlite();
    const legacyDb = new DatabaseSync(stateDatabasePath);
    legacyDb.exec(`
      CREATE TABLE agent_databases (
        agent_id TEXT NOT NULL PRIMARY KEY,
        path TEXT NOT NULL,
        schema_version INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL,
        size_bytes INTEGER
      );
      INSERT INTO agent_databases (
        agent_id,
        path,
        schema_version,
        last_seen_at,
        size_bytes
      ) VALUES (
        'worker-1',
        '/legacy/worker-1/daisyclaw-agent.sqlite',
        1,
        10,
        20
      );
    `);
    legacyDb.close();

    expect(() =>
      openDaisyClawAgentDatabase({
        agentId: "worker-1",
        env,
      }),
    ).toThrow(/run daisyclaw doctor --fix/);
  });

  it("rejects sharing one explicit database path across agent ids", () => {
    const stateDir = createTempStateDir();
    const env = { DAISYCLAW_STATE_DIR: stateDir };
    const databasePath = path.join(stateDir, "relocated", "shared.sqlite");

    openDaisyClawAgentDatabase({
      agentId: "worker-1",
      env,
      path: databasePath,
    });

    expect(() =>
      openDaisyClawAgentDatabase({
        agentId: "worker-2",
        env,
        path: databasePath,
      }),
    ).toThrow(/already open for agent worker-1/);

    closeDaisyClawAgentDatabasesForTest();
    expect(() =>
      openDaisyClawAgentDatabase({
        agentId: "worker-2",
        env,
        path: databasePath,
      }),
    ).toThrow(/belongs to agent worker-1/);
  });

  it("rejects explicit paths that point at the global state database", () => {
    const stateDir = createTempStateDir();
    const env = { DAISYCLAW_STATE_DIR: stateDir };
    const databasePath = path.join(stateDir, "state", "daisyclaw.sqlite");
    const stateDatabase = openDaisyClawStateDatabase({
      env,
      path: databasePath,
    });
    closeDaisyClawStateDatabaseForTest();

    expect(() =>
      openDaisyClawAgentDatabase({
        agentId: "worker-1",
        env,
        path: stateDatabase.path,
      }),
    ).toThrow(/schema role global/);

    const reopenedStateDatabase = openDaisyClawStateDatabase({
      env,
      path: databasePath,
    });
    const row = reopenedStateDatabase.db
      .prepare("SELECT role, agent_id FROM schema_meta WHERE meta_key = 'primary'")
      .get() as { agent_id?: unknown; role?: unknown } | undefined;
    expect(row).toEqual({ role: "global", agent_id: null });
  });

  it("does not chmod shared parent directories for explicit database paths", () => {
    const parentDir = createTempStateDir();
    const env = { DAISYCLAW_STATE_DIR: parentDir };
    fs.chmodSync(parentDir, 0o755);
    const databasePath = path.join(parentDir, "worker-1.sqlite");

    openDaisyClawAgentDatabase({
      agentId: "worker-1",
      env,
      path: databasePath,
    });

    expect(fs.statSync(parentDir).mode & 0o777).toBe(0o755);
  });

  it("configures durable SQLite connection pragmas", () => {
    const stateDir = createTempStateDir();
    const database = openDaisyClawAgentDatabase({
      agentId: "worker-1",
      env: { DAISYCLAW_STATE_DIR: stateDir },
    });

    expect(readSqliteNumberPragma(database.db, "busy_timeout")).toBe(30_000);
    expect(readSqliteNumberPragma(database.db, "foreign_keys")).toBe(1);
    expect(readSqliteNumberPragma(database.db, "synchronous")).toBe(1);
    expect(readSqliteNumberPragma(database.db, "user_version")).toBe(1);
    expect(readSqliteNumberPragma(database.db, "wal_autocheckpoint")).toBe(1000);
    const journalMode = database.db.prepare("PRAGMA journal_mode").get() as
      | { journal_mode?: string }
      | undefined;
    expect(journalMode?.journal_mode?.toLowerCase()).toBe("wal");
  });

  it("records durable per-agent schema metadata", () => {
    const stateDir = createTempStateDir();
    const database = openDaisyClawAgentDatabase({
      agentId: "worker-1",
      env: { DAISYCLAW_STATE_DIR: stateDir },
    });
    const agentDb = getNodeSqliteKysely<AgentDbTestDatabase>(database.db);

    expect(
      executeSqliteQueryTakeFirstSync(
        database.db,
        agentDb.selectFrom("schema_meta").select(["role", "schema_version", "agent_id"]),
      ),
    ).toEqual({
      role: "agent",
      schema_version: 1,
      agent_id: "worker-1",
    });
  });

  it("refuses to open newer per-agent schema versions", () => {
    const stateDir = createTempStateDir();
    const databasePath = path.join(
      stateDir,
      "agents",
      "worker-1",
      "agent",
      "daisyclaw-agent.sqlite",
    );
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    const { DatabaseSync } = requireNodeSqlite();
    const db = new DatabaseSync(databasePath);
    db.exec("PRAGMA user_version = 2;");
    db.close();

    expect(() =>
      openDaisyClawAgentDatabase({
        agentId: "worker-1",
        env: { DAISYCLAW_STATE_DIR: stateDir },
      }),
    ).toThrow(/newer schema version 2/);
  });
});
