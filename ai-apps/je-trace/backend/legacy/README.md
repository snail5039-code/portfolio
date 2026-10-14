# Legacy database schemas

These files are historical references only and must not be used to initialize a new database.

- `schema-v1-unused.txt` describes an abandoned `assignments/submissions/chat_logs` model that the current DAO layer does not use.
- `schema-v2-incremental.txt` is an accumulated development script containing obsolete tables and follow-up `ALTER TABLE` statements.

Use [`../schema.sql`](../schema.sql) as the single canonical MySQL 8 initialization script.
