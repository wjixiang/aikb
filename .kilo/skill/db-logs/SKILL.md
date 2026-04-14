---
name: db-logs
description: Query and inspect application logs stored in the PostgreSQL log database (shared-logger app_logs table). Use when the user asks to view, search, or analyze logs from the database.
---

# DB Logs Skill

Query application logs from the PostgreSQL log database used by `@shared/logger`.

## Connection

- **URL**: `postgresql://admin:fl5ox03@localhost:5432/log`
- **Table**: `app_logs`
- **`psql` is NOT available** on this machine. Use Node.js `pg` module to query.

## Table Schema

```sql
app_logs (
  time   timestamp NOT NULL,
  level  varchar   NOT NULL,   -- trace|debug|info|warn|error|fatal
  module varchar   DEFAULT '', -- getLogger('Agent') → module='Agent'
  msg    text,
  extra  jsonb               -- additional fields from log context
)
```

Indexes: `idx_app_logs_time`, `idx_app_logs_level`, `idx_app_logs_module`

## Query Method

Use `node -e` with `pg` (available in `libs/shared-logger/node_modules/pg`):

```bash
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://admin:fl5ox03@localhost:5432/log' });
(async () => {
  const r = await pool.query('<SQL>');
  console.table(r.rows);
  await pool.end();
})().catch(e => { console.error(e.message); process.exit(1); });
"
```

Use `console.table(r.rows)` for tabular output. For long msg fields, use `console.log` with `left(msg, N)` in SQL.

## Standard Workflow

When the user asks to check logs, run this **overview query** first:

```sql
SELECT
  (SELECT count(*) FROM app_logs) AS total,
  (SELECT count(*) FROM app_logs WHERE level = 'error') AS errors,
  (SELECT count(*) FROM app_logs WHERE level = 'warn') AS warnings,
  (SELECT max(time) FROM app_logs) AS latest;
```

Then drill down based on what the user asks.

## Query Templates

### Recent logs
```sql
SELECT time, level, module, left(msg, 120) AS msg
  FROM app_logs ORDER BY time DESC LIMIT 50;
```

### Errors only
```sql
SELECT time, module, left(msg, 200) AS msg
  FROM app_logs WHERE level = 'error' ORDER BY time DESC LIMIT 50;
```

### By module
```sql
SELECT time, level, left(msg, 120) AS msg
  FROM app_logs WHERE module = 'Agent' ORDER BY time DESC LIMIT 50;
```

### By time range
```sql
SELECT time, level, module, left(msg, 120) AS msg
  FROM app_logs WHERE time >= '2026-04-14' ORDER BY time DESC LIMIT 100;
```

### Keyword search
```sql
SELECT time, level, module, left(msg, 150) AS msg
  FROM app_logs WHERE msg ILIKE '%keyword%' ORDER BY time DESC LIMIT 50;
```

### Stats by level
```sql
SELECT level, count(*) AS count FROM app_logs GROUP BY level ORDER BY count DESC;
```

### Stats by module
```sql
SELECT module, count(*) AS count FROM app_logs GROUP BY module ORDER BY count DESC;
```

### Hourly volume (last 24h)
```sql
SELECT date_trunc('hour', time) AS hour, count(*) AS count
  FROM app_logs GROUP BY hour ORDER BY hour DESC LIMIT 24;
```

### With extra JSON
```sql
SELECT time, level, module, msg, extra
  FROM app_logs ORDER BY time DESC LIMIT 10;
```

## Notes

- Always `ORDER BY time DESC` + `LIMIT` (default 50) to avoid flooding output
- Truncate `msg` with `left(msg, N)` for readability
- If table doesn't exist, logs haven't been written yet (service needs `initLogger()` + `LOG_DB_URL`)
- Known modules: `Agent`, `AgentContainer`, `A2AClient`, `A2AHandler`, `AgentCardRegistry`, `AckTracker`, `VirtualWorkspace`, `AgentSessionManager`, `PostgresPersistenceService`, `ApiClientFactory`, `ClientPool`, `AnthropicCompatibleApiClient`
