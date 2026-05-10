# Thatcher SDK

**Configuration-Driven Application Framework for Data-Intensive Web Apps**

Thatcher is a complete extraction of the moonlanding application framework. Build full-featured CRUD applications with workflows, permissions, and external integrations — all through YAML configuration, without writing code.

## Features

- **Zero-Code CRUD** — Define entities in YAML; automatic REST API, UI, and database schema
- **Workflow Engine** — State machine with transitions, locks, and permissions
- **Role-Based Access Control** — Fine-grained permission templates per entity
- **Plugin System** — Extend entities with hooks, validators, and custom fields
- **External Integrations** — Google Drive/Gmail, Email (SMTP), PDF generation
- **Hot Reload** — Config changes reflect instantly without restart
- **Production-Ready** — SQLite, WAL mode, connection pooling, metrics, audit logging

## Quick Start

```bash
# 1. Install globally (or use bun x)
npm install -g thatcher

# 2. Generate starter config
thatcher example

# 3. Start the server
thatcher start
```

Or use directly with Bun:

```bash
bun x thatcher start
```

## Configuration

Thatcher is driven by a single `thatcher.config.yml` file:

```yaml
# thatcher.config.yml
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
    admin: [list, view, create, edit, delete, manage_settings]
    user: [list, view]

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
        options: [active, archived]
        default: active

workflows:
  simple:
    stages:
      - draft
      - active
      - completed

thresholds:
  system:
    pagination:
      default_page_size: 20
      max_page_size: 100
```

That's it. Start the server and you have:
- SQLite tables `item` with correct schema
- REST endpoints: `GET/POST/PUT/DELETE /api/item`
- Role-based permissions enforced
- State transitions via `POST /api/item/:id/transition`

## Programmatic Usage

```javascript
import { createThatcher } from 'thatcher';

const thatcher = createThatcher({
  config: './thatcher.config.yml',
  databasePath: './data/app.db',
});

// Initialize (loads config, migrates DB, registers plugins)
await thatcher.init();

// Start HTTP server
await thatcher.startServer({ port: 3000 });

// Use APIs directly
const items = await thatcher.list('item');
const item = await thatcher.get('item', 'id123');
const created = await thatcher.create('item', { name: 'Test' }, { id: 'user1' });

// Workflow transitions
await thatcher.transition('item', item.id, 'simple', 'active', { id: 'user1', role: 'admin' });

// Permissions
const canEdit = await thatcher.can(user, thatcher.getEntitySpec('item'), 'edit');
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `thatcher start` | Start server in production mode |
| `thatcher dev` | Start with hot reload enabled |
| `thatcher migrate` | Run database migrations only |
| `thatcher validate` | Validate configuration file |
| `thatcher console` | Open REPL with thatcher API |
| `thatcher example` | Generate example config |

## Architecture

### Core Components

```
thatcher/
├── src/
│   ├── index.js           # Main entry: createThatcher()
│   ├── cli.js             # CLI commands
│   ├── config/
│   │   ├── config-loader.js     # YAML loading & validation
│   │   ├── spec-helpers.js      # Entity spec utilities
│   │   ├── env.js               # Environment config
│   │   └── constants.js         # HTTP codes, statuses
│   ├── lib/
│   │   ├── database-core.js     # SQLite init, migrations
│   │   ├── query-engine.js      # Read operations (GET, search)
│   │   ├── query-engine-write.js # Write operations (CRUD)
│   │   ├── config-generator-engine.js  # Spec builder
│   │   ├── hook-engine.js       # Event system
│   │   ├── workflow-engine.js   # State machines
│   │   ├── auth-middleware.js   # Auth checks
│   │   ├── crud-factory.js      # Handler factory
│   │   ├── crud-handlers.js     # HTTP handlers
│   │   ├── validate.js          # Validation
│   │   └── logger.js            # Structured logging
│   ├── services/
│   │   └── permission.service.js  # Authorization
│   ├── adapters/
│   │   ├── google-auth.js       # Google OAuth
│   │   └── google-drive.js      # Drive file operations
│   ├── plugins/
│   │   └── index.js             # Plugin auto-discovery
│   └── server/
│       └── server.js            # HTTP server
└── package.json
```

### How It Works

1. **Configuration Load** — `master-config.yml` parsed into memory
2. **Spec Generation** — For each entity, ConfigEngine builds full spec from base + overrides + plugins
3. **Database Migration** — Tables created/updated from spec fields (idempotent)
4. **Plugin Registration** — `.plugin.js` files extend entity behavior
5. **Request Handling** — Generic CRUD handlers enforce permissions, validate, execute hooks

### Entity Specification

Each entity derives from config:

| Config Key | Purpose |
|-----------|---------|
| `fields` | Column definitions (type, required, ref, enum, etc.) |
| `permission_template` | Maps roles → allowed actions |
| `workflow` | State machine name for lifecycle |
| `row_access` | Scoping: `team`, `assigned`, `client` |
| `list.defaultSort` | Default list ordering |
| `has_*` flags | UI features (PDF, collaboration, notifications) |

### Permissions

Permission templates define role capabilities per entity:

```yaml
permission_templates:
  standard:
    admin: [list, view, create, edit, delete, export]
    user: [list, view]
```

Actions: `list`, `view`, `create`, `edit`, `delete`, `archive`, `export`, `manage_settings`, etc.

Row access controls which records a user can see:
- `team` — Only records in user's team
- `assigned` — Only records assigned to user
- `client` — Only records for user's client
- `assigned_or_team` — Either condition

### Workflows

State machines with transitions:

```yaml
workflows:
  engagement_lifecycle:
    state_field: stage
    stages:
      - name: draft
        label: Draft
        forward: [review, submitted]
        readonly: true
      - name: review
        label: In Review
        forward: [approved, rejected]
        backward: [draft]
        requires_role: [manager, partner]
      - name: closed
        label: Closed
        entry: partner_only
```

Transitions validated automatically:
- Only allowed transitions
- Role requirements
- Lockout period (configurable)
- Readonly state blocks

### Hooks

Listen to lifecycle events:

```javascript
// my-entity.plugin.js
export default {
  entityName: 'item',
  hooks: [
    {
      event: 'create:item:after',
      handler: async ({ entity, id, data, user }) => {
        console.log(`Item ${id} created by ${user.id}`);
        // Send notification, sync external system, etc.
      },
    },
  ],
};
```

Hook naming: `<timing>:<entity>:<phase>`
- `create:entity:before` / `after`
- `update:entity:before` / `after`
- `delete:entity:before` / `after`
- `transition:entity:before` / `after`
- Custom: `upload_files:entity:after`, `resolve_highlight:review:after`

### Plugins

Extend entities with custom fields and behavior:

```javascript
// plugins/custom-item.plugin.js
export default {
  entityName: 'item',
  fields: {
    custom_field: {
      type: 'text',
      label: 'Custom Field',
      required: false,
    },
  },
  validators: {
    validateCustom: (data) => {
      if (data.custom_field && !data.custom_field.startsWith('X')) {
        return 'Custom field must start with X';
      }
      return null;
    },
  },
};
```

All `.plugin.js` files in `plugins/` directory auto-loaded on startup.

## External Integrations

### Google OAuth & Drive

Set env vars:

```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_SERVICE_ACCOUNT_PATH=./service-account.json
GOOGLE_DRIVE_FOLDER_ID=...
```

Drive operations via `@/adapters/google-drive`:

```javascript
import { uploadFile, downloadFile, exportToPdf } from 'thatcher/adapters/google-drive';

await uploadFile('./local.pdf', 'Document.pdf', { folderId: '...' });
const pdf = await exportToPdf('docId');
```

### Email (SMTP)

```bash
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=...
EMAIL_PASSWORD=...
EMAIL_FROM=noreply@example.com
```

Use via `@/lib/email-sender` (included).

## API Reference

All APIs accessible via thatcher instance:

### CRUD
- `thatcher.list(entity, where, opts)` → Array
- `thatcher.get(entity, id)` → object
- `thatcher.create(entity, data, user)` → object
- `thatcher.update(entity, id, data, user)` → object
- `thatcher.delete(entity, id)` → void

### Search
- `thatcher.search(entity, query, where, opts)` → Array (uses FTS)

### Workflow
- `thatcher.transition(entityType, entityId, workflowName, toState, user, reason)` → object
- `thatcher.getAvailableTransitions(workflowName, currentState, user, record)` → Array

### AuthZ
- `thatcher.can(user, spec, action)` → boolean
- `thatcher.requirePermission(user, spec, action)` → throws if denied

### Config
- `thatcher.getConfigEngine()` → ConfigGeneratorEngine
- `thatcher.getEntitySpec(entityName)` → spec object
- `thatcher.getAllEntities()` → Array<string>

### Direct DB
- `thatcher.withTransaction(cb)` → Promise<result>

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `PORT` | Server port | 3000 |
| `DATABASE_PATH` | SQLite file path | `./data/app.db` |
| `NODE_ENV` | `development` \| `production` | `development` |
| `DEBUG` | Enable debug logging | `false` |
| `GOOGLE_CLIENT_ID` | OAuth client ID | — |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret | — |
| `GOOGLE_DRIVE_FOLDER_ID` | Root Drive folder | — |
| `EMAIL_HOST` | SMTP host | `smtp.gmail.com` |
| `EMAIL_PORT` | SMTP port | `587` |
| `EMAIL_USER` | SMTP username | — |
| `EMAIL_PASSWORD` | SMTP password | — |

## Migrating from Moonlanding

Thatcher is a drop-in replacement for moonlanding's core:

1. Copy `master-config.yml` → `thatcher.config.yml`
2. Move any `.plugin.js` files to new project's `plugins/`
3. Change import paths: `@/lib/...` → `thatcher/...`
4. Replace `import ... from '@/engine'` with `thatcher.*` methods
5. Update server initialization: `new Thatcher({ config: '...' })`

All business logic remains in config and plugins — no code changes required.

## Publishing

Thatcher is published to npm as `thatcher`. Every push to `main` triggers:

1. Bump version (from git tags or conventional commits)
2. Build & test
3. Publish to npm registry
4. Create GitHub release

CI/CD ready via included GitHub Actions workflow.

## License

MIT — Extracted from moonlanding with all functionality preserved.
