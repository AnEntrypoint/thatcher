#!/usr/bin/env bun

/**
 * Thatcher CLI
 * Usage:
 *   thatcher start           - Start server with auto-discovered config
 *   thatcher dev             - Start server with hot reload
 *   thatcher console         - Open REPL with thatcher API
 *   thatcher migrate         - Run database migrations only
 *   thatcher validate        - Validate configuration
 *   thatcher example         - Generate example config
 */

import { startThatcher, Thatcher } from './index.js';
import { command } from 'commander'; // We'll use simple args parsing
import * as readline from 'readline';

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  switch (command) {
    case 'start':
    case 'dev':
      console.log(`[Thatcher] Starting in ${command} mode...`);
      const thatcher = new Thatcher({
        server: { hotReload: command === 'dev' },
      });
      try {
        await thatcher.init();
        await thatcher.startServer();
      } catch (err) {
        console.error('[Thatcher] Failed to start:', err.message);
        if (err.stack) console.error(err.stack);
        process.exit(1);
      }
      break;

    case 'migrate':
      console.log('[Thatcher] Running migrations...');
      const t1 = new Thatcher({});
      await t1.init();
      console.log('✓ Migrations complete');
      break;

    case 'validate':
      console.log('[Thatcher] Validating configuration...');
      try {
        const t2 = new Thatcher({});
        await t2.init();
        console.log('✓ Configuration is valid');
        console.log(`  Entities: ${t2.getAllEntities().length}`);
        console.log(`  Workflows: ${Object.keys(t2.config?.workflows || {}).length}`);
      } catch (err) {
        console.error('✗ Configuration error:', err.message);
        process.exit(1);
      }
      break;

    case 'console':
    case 'repl':
      await startRepl();
      break;

    case 'example':
      generateExampleConfig();
      break;

    case '--help':
    case '-h':
    case 'help':
      printHelp();
      break;

    default:
      if (!command) {
        printHelp();
      } else {
        console.error(`[Thatcher] Unknown command: ${command}`);
        console.log('Run `thatcher help` for usage.');
        process.exit(1);
      }
  }
}

async function startRepl() {
  console.log('[Thatcher] Starting REPL...');
  console.log('Available: thatcher (instance), create, get, list, etc.\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'thatcher> ',
  });

  const thatcher = new Thatcher({});
  await thatcher.init();

  // Expose thatcher in REPL context
  const context = {
    thatcher,
    create: async (entity, data, user) => thatcher.create(entity, data, user),
    get: async (entity, id) => thatcher.get(entity, id),
    list: async (entity, where) => thatcher.list(entity, where),
    update: async (entity, id, data, user) => thatcher.update(entity, id, data, user),
    remove: async (entity, id) => thatcher.delete(entity, id),
    search: async (entity, q, where) => thatcher.search(entity, q, where),
    transition: async (entityType, entityId, wf, toState, user, reason) =>
      thatcher.transition(entityType, entityId, wf, toState, user, reason),
    config: thatcher.config,
    entities: thatcher.getAllEntities(),
  };

  rl.prompt();

  rl.on('line', async (line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      rl.prompt();
      return;
    }

    try {
      // Simple evaluation - in production use a proper sandbox
      const result = eval(trimmed);
      if (result && typeof result.then === 'function') {
        const resolved = await result;
        console.log(JSON.stringify(resolved, null, 2));
      } else if (result !== undefined) {
        console.log(JSON.stringify(result, null, 2));
      }
    } catch (err) {
      console.error('Error:', err.message);
    }
    rl.prompt();
  });

  rl.on('close', () => {
    console.log('\n[Thatcher] Goodbye');
    process.exit(0);
  });
}

function generateExampleConfig() {
  const exampleDir = path.resolve(process.cwd(), 'thatcher-example');
  fs.mkdirSync(exampleDir, { recursive: true });

  const config = `# Thatcher Example Configuration
# This is a minimal config to get you started
# Copy moonlanding's master-config.yml for full features

roles:
  admin:
    hierarchy: 0
    label: Admin
    permissions_scope: global
  user:
    hierarchy: 1
    label: User
    permissions_scope: assigned

permission_templates:
  basic:
    admin:
      - list
      - view
      - create
      - edit
      - delete
    user:
      - list
      - view

entities:
  item:
    label: Item
    label_plural: Items
    fields:
      name:
        type: text
        required: true
      description:
        type: textarea
      status:
        type: enum
        options: ['active', 'archived']
        default: active

workflows:
  simple_workflow:
    stages:
      - draft
      - active
      - completed

thresholds:
  system:
    pagination:
      default_page_size: 20
      max_page_size: 100
`;

  fs.writeFileSync(path.join(exampleDir, 'thatcher.config.yml'), config);
  console.log(`✓ Example config written to ${exampleDir}/`);
  console.log('  cd', exampleDir);
  console.log('  thatcher start');
}

function printHelp() {
  console.log(`
 Thatcher CLI - Configuration-Driven Application Framework

Usage:
  thatcher <command>

Commands:
  start      Start the server (production mode)
  dev        Start the server with hot reload
  migrate    Run database migrations only
  validate   Validate configuration file
  console    Open interactive REPL
  example    Generate example configuration
  help       Show this help

Configuration:
  Place a thatcher.config.yml or master-config.yml in the current directory.
  See the documentation for full configuration options.

Environment Variables:
  DATABASE_PATH   Path to SQLite database (default: ./data/app.db)
  PORT            Server port (default: 3000)
  NODE_ENV        Environment (development|production)

Quick Start:
  thatcher example    # Generate a starter config
  thatcher start      # Launch the server
`);
}

main().catch((err) => {
  console.error('[Thatcher] Fatal error:', err);
  process.exit(1);
});
