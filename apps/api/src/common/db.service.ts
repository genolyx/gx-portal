import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';
import Database from 'better-sqlite3';

/**
 * Shared SQLite database service.
 * All tables (users, clients, labs, client_services, lab_services) live in one file.
 */
@Injectable()
export class DbService implements OnModuleInit {
  private readonly logger = new Logger(DbService.name);
  db!: Database.Database;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const dbPath = this.config.get<string>('USERS_DB_PATH', './data/portal.db');
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.migrate();
    this.logger.log(`Database ready: ${dbPath}`);
  }

  private migrate() {
    this.db.exec(`
      -- Clients
      CREATE TABLE IF NOT EXISTS clients (
        id                       INTEGER PRIMARY KEY AUTOINCREMENT,
        name                     TEXT    NOT NULL,
        address                  TEXT,
        email                    TEXT,
        phone                    TEXT,
        language                 TEXT,
        type                     TEXT    NOT NULL DEFAULT 'Service',
        sequencing_data_method   TEXT    NOT NULL DEFAULT 'Remote',
        is_managing_hospitals    INTEGER NOT NULL DEFAULT 0,
        auto_approve_orders      INTEGER NOT NULL DEFAULT 0,
        sign_report              INTEGER NOT NULL DEFAULT 0,
        created_at               TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      -- Labs
      CREATE TABLE IF NOT EXISTS labs (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT    NOT NULL,
        address    TEXT,
        email      TEXT,
        phone      TEXT,
        client_id  INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        created_at TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      -- Allowed services per client
      CREATE TABLE IF NOT EXISTS client_services (
        client_id    INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        service_code TEXT    NOT NULL,
        PRIMARY KEY (client_id, service_code)
      );

      -- Allowed services per lab
      CREATE TABLE IF NOT EXISTS lab_services (
        lab_id       INTEGER NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
        service_code TEXT    NOT NULL,
        PRIMARY KEY (lab_id, service_code)
      );

      -- Users (extended)
      CREATE TABLE IF NOT EXISTS users (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        username            TEXT    NOT NULL UNIQUE,
        first_name          TEXT,
        last_name           TEXT,
        display_name        TEXT,
        email               TEXT,
        password_hash       TEXT    NOT NULL,
        role                TEXT    NOT NULL DEFAULT 'client',
        client_id           INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        lab_id              INTEGER REFERENCES labs(id)    ON DELETE SET NULL,
        email_notification  INTEGER NOT NULL DEFAULT 0,
        created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // seed default admin
    const count = (this.db.prepare('SELECT COUNT(*) as n FROM users').get() as { n: number }).n;
    if (count === 0) {
      const bcrypt = require('bcryptjs') as typeof import('bcryptjs');
      const hash = bcrypt.hashSync('admin1234', 10);
      this.db
        .prepare(`INSERT INTO users (username, first_name, last_name, role, password_hash)
                  VALUES (?, ?, ?, 'admin', ?)`)
        .run('admin', 'Admin', 'User', hash);
      this.logger.warn('Default admin created — username: admin / password: admin1234 — CHANGE IMMEDIATELY');
    }
  }
}
