/**
 * Minimal Thatcher Application
 * Demonstrates programmatic usage of thatcher SDK
 */

import { createThatcher, Thatchers } from 'thatcher';
import path from 'path';
import fs from 'fs';

async function main() {
  // Load config
  const configPath = path.resolve(import.meta.dirname, 'thatcher.config.yml');

  if (!fs.existsSync(configPath)) {
    console.error('Config not found. Run: thatcher example');
    process.exit(1);
  }

  // Create thatcher instance
  const thatcher = createThatcher({
    config: configPath,
    databasePath: path.resolve(import.meta.dirname, '../data/app.db'),
    server: {
      port: 3000,
      host: '0.0.0.0',
      hotReload: true,
    },
    ui: true,
  });

  try {
    // Initialize (loads config, creates DB, registers plugins)
    await thatcher.init();
    console.log('✓ Thatcher initialized');

    // Show some info
    const entities = thatcher.getAllEntities();
    console.log('  Entities:', entities.join(', '));

    // Create a sample item if DB empty
    const count = await thatcher.list('item');
    if (count.length === 0) {
      await thatcher.create('item', {
        name: 'Sample Item',
        description: 'Created by minimal example',
        status: 'active',
        priority: 'medium',
      }, { id: 'system', role: 'admin' });
      console.log('✓ Created sample item');
    }

    // Start server
    await thatcher.startServer();
    console.log('✓ Server listening on http://localhost:3000');
    console.log('Try: GET /api/item');

  } catch (err) {
    console.error('Failed to start:', err.message || err);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
}

main();
