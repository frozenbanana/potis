# Potis - Decentralized Key-Value Store

**Potis** (POT + Redis) - A decentralized key-value store using POT.js and Swarm. Store, backup, and restore your configurations immutably on decentralized storage with a Redis-like interface.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [DappNode Integration](#dappnode-integration)
- [Development Guide](#development-guide)
- [POT.js Reference](#potjs-reference)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)

---

## Overview

Potis provides a web interface and REST API for managing key-value data using [POT.js](https://github.com/brainiac-five/potjs) - a JavaScript library for storing key-value maps on Swarm using Proximity Order Tries.

### What is Potis?

**Potis** combines the power of **P**roximity **O**rder **T**rie (POT) with a **Redis-like** interface for decentralized storage. It offers:

- Simple key-value operations (GET, PUT, DELETE)
- Immutable backups to Swarm decentralized storage
- Reference-based data sharing between nodes
- In-memory mode for testing and development

### Why Use Potis?

| Use Case | Description |
|----------|-------------|
| **Config Backup** | Backup your configurations to Swarm |
| **Data Sharing** | Share data between nodes using reference hashes |
| **Immutable History** | Every save creates a new immutable reference |
| **Version Control** | Track data changes over time |
| **Disaster Recovery** | Restore data from Swarm after node failure |
| **Redis Alternative** | Familiar key-value interface for decentralized storage |

### Features

- **Decentralized Storage**: Save data to Swarm, an immutable decentralized storage network
- **In-Memory Mode**: Test and develop without Swarm connection
- **Key-Value Operations**: Store and retrieve arbitrary key-value pairs
- **Reference Management**: Save/load data using Swarm references
- **Web UI**: Real-time web interface for data management
- **REST API**: Full programmatic access to all operations
- **Swagger Docs**: Interactive API documentation at `/api/docs`
- **DappNode Ready**: Health checks, environment variables, and volume persistence

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Web UI (Browser)                            │
│   http://potis.public.dappnode.eth:8080                           │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTP
┌───────────────────────────────▼─────────────────────────────────┐
│                    Node.js Server (Potis)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────────┐ │
│  │  Express    │  │   POT.js    │  │   Reference Storage       │ │
│  │  REST API   │  │  (WASM)     │  │   /app/data/refs.json     │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────────────────────┘ │
│         │                │                                        │
└─────────┼────────────────┼────────────────────────────────────────┘
          │                │
          │                ├─────────────────┐
          │                │                 │
          │                ▼                 ▼
          │         ┌──────────────┐  ┌────────────────┐
          │         │ In-Memory    │  │ Swarm Network  │
          │         │ Storage      │  │ (via Bee Node) │
          │         │              │  │                │
          │         │ - Testing    │  │ - Production   │
          │         │ - Fast       │  │ - Decentralized│
          │         │ - Temporary  │  │ - Persistent   │
          │         └──────────────┘  └────────────────┘
          │
          ▼
   ┌──────────────────────────────┐
   │      Docker Volume           │
   │      potis-data              │
   │   - Reference history        │
   │   - Cached data              │
   └──────────────────────────────┘
```

---

## Quick Start

### Prerequisites

- Docker and Docker Compose (for containerized deployment)
- Node.js 20+ (for local development)
- Swarm Bee node (optional, for production)

### Running Locally (In-Memory Mode)

```bash
# Clone the repository
git clone <repo-url>
cd potis

# Build and run with Docker Compose
docker-compose up --build

# Or run directly with Node.js
cd build
npm install
npm start
```

Access the web interface at `http://localhost:8080`
Access API docs at `http://localhost:8080/api/docs`

### Running with Swarm (Production Mode)

1. **Start a Swarm Bee node** (or use DappNode's Bee package)

2. **Purchase a postage batch** on Swarm:
   ```bash
   # Using Bee debug API
   curl -X POST http://localhost:1635/stamps/10000000/17
   ```

3. **Set environment variables**:
   ```bash
   export BEE_URL=http://bee.dappnode:1633
   export BATCH_ID=your-postage-batch-id-here
   docker-compose up --build
   ```

### First Steps in the UI

1. Open `http://localhost:8080`
2. The KVS auto-initializes on first use
3. Add key-value pairs in the Database section
4. Click **"Save Snapshot"** to get a reference hash
5. Copy the reference to restore later or share with others

---

## API Reference

### Base URL

```
http://potis.public.dappnode.eth:8080
```

### Swagger Documentation

Interactive API documentation is available at:
```
http://localhost:8080/api/docs
```

### Authentication

No authentication required for local operation. In production, restrict access via DappNode VPN.

---

### Status Endpoints

#### GET /health

Health check endpoint for DappNode monitoring.

**Response:**
```json
{
  "status": "healthy",
  "mode": "in-memory",
  "beeUrl": "http://bee.dappnode:1633",
  "hasBatchId": false,
  "kvsReady": true
}
```

#### GET /api/status

Detailed system status.

**Response:**
```json
{
  "initialized": true,
  "mode": "in-memory",
  "beeUrl": "http://bee.dappnode:1633",
  "savedConfigs": 3
}
```

#### GET /api/environment

Current environment configuration.

**Response:**
```json
{
  "beeUrl": "http://bee.dappnode:1633",
  "hasBatchId": true,
  "mode": "swarm",
  "port": 8080
}
```

---

### KVS Management

#### POST /api/init

Initialize a new Key-Value Store.

**Request:**
```bash
curl -X POST http://localhost:8080/api/init
```

**Response:**
```json
{
  "success": true,
  "mode": "in-memory"
}
```

**Notes:**
- Automatically called on first use if KVS not initialized
- In memory mode: creates temporary in-process storage
- Swarm mode: connects to Bee node at `BEE_URL`

---

### Configuration Operations

#### GET /api/config

Retrieve the stored configuration.

**Request:**
```bash
curl http://localhost:8080/api/config
```

**Response:**
```json
{
  "success": true,
  "config": "{\"setting\":\"value\",\"nested\":{\"key\":42}}",
  "hasConfig": true
}
```

#### POST /api/config

Store a configuration to the KVS.

**Request:**
```bash
curl -X POST http://localhost:8080/api/config \
  -H "Content-Type: application/json" \
  -d '{"config": {"mySetting": "value", "port": 8080}}'
```

**Response:**
```json
{
  "success": true,
  "message": "Config saved to KVS"
}
```

---

### Key-Value Operations

#### PUT /api/config/key

Store a key-value pair.

**Request:**
```bash
curl -X PUT http://localhost:8080/api/config/key \
  -H "Content-Type: application/json" \
  -d '{"key": "mySetting", "value": "some-value"}'
```

**Response:**
```json
{
  "success": true,
  "message": "Key 'mySetting' saved"
}
```

#### GET /api/config/key/:key

Retrieve a value by key.

**Request:**
```bash
curl http://localhost:8080/api/config/key/mySetting
```

**Response:**
```json
{
  "success": true,
  "key": "mySetting",
  "value": "some-value"
}
```

#### DELETE /api/config/key/:key

Delete a key-value pair.

**Request:**
```bash
curl -X DELETE http://localhost:8080/api/config/key/mySetting
```

**Response:**
```json
{
  "success": true,
  "message": "Key 'mySetting' deleted"
}
```

---

### Swarm Operations

#### POST /api/config/save

Save the current KVS to Swarm and get a reference hash.

**Request:**
```bash
curl -X POST http://localhost:8080/api/config/save
```

**Response:**
```json
{
  "success": true,
  "reference": "b85cdc6b62ace6a049e81ba730fcd9e072f0ebe7c16c2fb7678a806a5681d0af",
  "message": "Config saved to decentralized storage"
}
```

**Notes:**
- Returns a 64-character hex hash
- This hash can be used to restore the KVS later
- The original data remains accessible even after local changes
- Reference is stored in `refs.json` for history

#### POST /api/config/load

Load a KVS from a Swarm reference.

**Request:**
```bash
curl -X POST http://localhost:8080/api/config/load \
  -H "Content-Type: application/json" \
  -d '{"reference": "b85cdc6b62ace6a049e..."}'
```

**Response:**
```json
{
  "success": true,
  "message": "KVS loaded from reference",
  "reference": "b85cdc6b62ace6a049e..."
}
```

**Notes:**
- Replaces the current KVS with the loaded one
- Use `GET /api/config` after to retrieve contents
- In-memory mode also supports references (stored in process memory)

---

### Reference History

#### GET /api/refs

List all saved reference hashes.

**Request:**
```bash
curl http://localhost:8080/api/refs
```

**Response:**
```json
{
  "success": true,
  "refs": [
    {
      "reference": "b85cdc6b62ace6a049e...",
      "timestamp": "2025-04-21T08:30:00.000Z",
      "mode": "swarm"
    },
    {
      "reference": "72f0ebe7c16c2fb767...",
      "timestamp": "2025-04-21T07:15:00.000Z",
      "mode": "in-memory"
    }
  ]
}
```

#### DELETE /api/refs/:reference

Remove a reference from the history.

**Request:**
```bash
curl -X DELETE http://localhost:8080/api/refs/b85cdc6b62ace6a049e...
```

**Response:**
```json
{
  "success": true,
  "message": "Reference removed from history"
}
```

**Note:** This only removes from local history, not from Swarm.

---

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `BEE_URL` | Swarm Bee node URL | `http://bee.dappnode:1633` | No* |
| `BATCH_ID` | Swarm postage batch ID | `""` (empty) | No* |
| `PORT` | Server port | `8080` | No |
| `NODE_ENV` | Environment mode | `production` | No |
| `DATA_DIR` | Data directory path | `/app/data` | No |

*BEE_URL and BATCH_ID are required for Swarm mode. Leave empty for in-memory mode.

### Modes of Operation

#### In-Memory Mode (Default)

When `BATCH_ID` is empty or not set:

```yaml
environment:
  - BEE_URL=http://bee.dappnode:1633
  - BATCH_ID=
```

**Characteristics:**
- Data stored in process memory
- References work within the same process
- Fast, no network overhead
- Data lost on container restart
- Ideal for: Testing, development, demonstration

#### Swarm Mode (Production)

When `BATCH_ID` is set:

```yaml
environment:
  - BEE_URL=http://bee.dappnode:1633
  - BATCH_ID=your-64-character-batch-id
```

**Characteristics:**
- Data persisted to Swarm network
- References work across nodes and restarts
- Requires running Bee node
- Postage batch purchase required
- Ideal for: Production, sharing data, backup

### Docker Compose Configuration

```yaml
version: "3.8"
services:
  potis:
    build: ./build
    image: potis.public.dappnode.eth:0.1.0
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - potis-data:/app/data
    environment:
      - BEE_URL=http://bee.dappnode:1633
      - BATCH_ID=${BATCH_ID:-}
      - PORT=8080
      - NODE_ENV=production
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
volumes:
  potis-data: {}
```

### Volume Persistence

The Docker volume `potis-data` stores:
- `/app/data/refs.json` - History of saved references

In Swarm mode, the actual data is stored on the Swarm network, not in the volume.

---

## DappNode Integration

### Package Manifest

The `dappnode_package.json` defines the DappNode package:

```json
{
  "name": "potis.public.dappnode.eth",
  "version": "0.1.0",
  "description": "Decentralized key-value store using POT.js...",
  "type": "service",
  "categories": ["Storage", "Developer Tools"],
  "architectures": ["linux/arm64", "linux/amd64"]
}
```

### Building the Package

```bash
# Install DappNode SDK (if not installed)
npm install -g @dappnode/dappnodesdk

# Navigate to project root
cd potis

# Build the package
dappnodesdk build
```

This creates an IPFS hash pointing to your package.

### Publishing to Dappstore

Community packages are published to `public.dappnode.eth`:

```bash
# Requires ETH for gas
# Requires an ETH RPC endpoint
dappnodesdk publish --type=patch \
  --eth-provider=https://eth.dappnode:8545 \
  --developer-address=0xYourAddress
```

### Installing on DappNode

#### Method 1: IPFS Hash

1. Run `dappnodesdk build`
2. Copy the IPFS hash from output
3. Open DappNode UI > Dappstore
4. Paste IPFS hash in search bar
5. Click "Install"

#### Method 2: Docker Registry

```bash
# Build and push to registry
docker build -t your-registry/potis:0.1.0 ./build
docker push your-registry/potis:0.1.0

# On DappNode, pull and run
docker pull your-registry/potis:0.1.0
```

### DappNode Networking

The package is configured to:
- Expose port 8080 via HTTP
- Use DappNode's DNS (`*.public.dappnode.eth`)
- Connect to Bee at `http://bee.dappnode:1633`

---

## Development Guide

### Project Structure

```
potis/
├── dappnode_package.json       # DappNode package metadata
├── docker-compose.yml          # Docker Compose configuration
├── docker-compose.swarm.yml    # Swarm-specific configuration
├── README.md                   # Documentation (this file)
├── .env                        # Environment variables
└── build/
    ├── Dockerfile              # Multi-stage Docker build
    ├── package.json            # Node.js dependencies
    ├── server.js               # Express server + POT.js
    └── public/
        ├── index.html          # Web interface
        ├── style.css           # Dark theme styling
        ├── api-docs.html       # Swagger API documentation
        ├── pot.wasm            # POT.js WASM binary
        ├── pot-node.js         # Node.js bindings
        └── wasm_exec.js        # Go WASM runtime
```

### Local Development

```bash
# Install dependencies
cd build && npm install

# Run in development mode
NODE_ENV=development node server.js

# Or with auto-reload (install nodemon first)
npm install -g nodemon
nodemon server.js
```

### Adding API Endpoints

Edit `build/server.js`:

```javascript
// Add new endpoint
app.get('/api/custom', async (req, res) => {
  try {
    // Your logic here
    if (!kvs) {
      await initKVS();
    }
    
    const result = await kvs.get('customKey');
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### POT.js Integration Patterns

```javascript
// Initialize POT
const pot = await loadPot();

// Create in-memory KVS
const kvs = await pot.new();

// Or create Swarm-connected KVS
const kvs = await pot.new(beeUrl, batchId);

// Store value
await kvs.put('key', 'value');
await kvs.put('number', 42);
await kvs.put('object', JSON.stringify({nested: true}));

// Retrieve value
const value = await kvs.get('key');

// Store raw bytes
await kvs.putRaw('binary', new Uint8Array([1,2,3]));
const bytes = await kvs.getRaw('binary');

// Save and get reference
const ref = await kvs.save();

// Load from reference
const restored = await pot.load(ref);
```

### Testing

```bash
# Manual API testing
curl http://localhost:8080/health
curl -X POST http://localhost:8080/api/init
curl -X POST http://localhost:8080/api/config -H "Content-Type: application/json" -d '{"config": "test"}'
```

---

## POT.js Reference

### Key Concepts

#### Proximity Order Trie (POT)

A POT is a data structure that:
- Stores key-value pairs efficiently
- Supports updates and deletions
- Produces immutable references
- Persists to content-addressed storage

#### Swarm

Swarm is a decentralized storage network:
- Content-addressed (each item has a unique hash)
- Immutable (content cannot be changed)
- Decentralized (stored across many nodes)
- Incentivized (postage stamps pay for storage)

#### Key-Value Store (KVS)

The main abstraction in POT.js:
- Create with `pot.new()` or `pot.new(beeUrl, batchId)`
- Store with `kvs.put(key, value)`
- Retrieve with `kvs.get(key)`
- Persist with `kvs.save()` → returns reference
- Restore with `pot.load(reference)`

### Value Types

```javascript
// Strings
await kvs.put('string', 'Hello World');
const s = await kvs.get('string'); // "Hello World"

// Numbers
await kvs.put('number', 3.14159);
const n = await kvs.get('number'); // 3.14159

// Booleans
await kvs.put('bool', true);
const b = await kvs.get('bool'); // true

// Objects (must stringify)
await kvs.put('object', JSON.stringify({key: 'value'}));
const obj = JSON.parse(await kvs.get('object'));

// Binary (raw bytes)
await kvs.putRaw('binary', new Uint8Array([1, 2, 3, 4]));
const bytes = await kvs.getRaw('binary'); // Uint8Array
```

### Limits

| Item | Limit |
|------|-------|
| Key size | Depends on encoding (strings recommended) |
| Value size | Check with `pot.getValueSizeLimit()` |
| KVS entries | No hard limit |
| Reference length | 64 hex characters (32 bytes) |
| Postage batch duration | Depends on depth and amount |

### Error Handling

```javascript
try {
  const value = await kvs.get('nonexistent');
} catch (err) {
  // Key not found
  console.error(err.message);
}

try {
  const kvs = await pot.new(invalidUrl, invalidBatch);
} catch (err) {
  // Connection or batch error
  console.error(err.message);
}
```

---

## Examples

### Example 1: Basic Key-Value Storage

```bash
# Initialize
curl -X POST http://localhost:8080/api/init

# Store key-value pairs
curl -X PUT http://localhost:8080/api/config/key \
  -H "Content-Type: application/json" \
  -d '{"key": "user:1:name", "value": "Alice"}'

curl -X PUT http://localhost:8080/api/config/key \
  -H "Content-Type: application/json" \
  -d '{"key": "user:1:email", "value": "alice@example.com"}'

# Get value
curl http://localhost:8080/api/config/key/user:1:name

# Save to Swarm
curl -X POST http://localhost:8080/api/config/save
# Returns: {"success":true,"reference":"abc123..."}
```

### Example 2: Configuration Backup

```bash
# Store configuration
curl -X POST http://localhost:8080/api/config \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "network": "mainnet",
      "syncMode": "full",
      "pruning": true
    }
  }'

# Get config
curl http://localhost:8080/api/config

# Save to Swarm
curl -X POST http://localhost:8080/api/config/save
# Returns: {"success":true,"reference":"abc123..."}
```

### Example 3: Sharing Data Between Nodes

**On Node A:**
```bash
# Save data
curl -X POST http://node-a:8080/api/config -d '{"config": {...}}'
curl -X POST http://node-a:8080/api/config/save
# Returns: {"reference": "b85cdc6b..."}
```

**On Node B:**
```bash
# Load data from reference
curl -X POST http://node-b:8080/api/config/load \
  -H "Content-Type: application/json" \
  -d '{"reference": "b85cdc6b..."}'

# Retrieve loaded data
curl http://node-b:8080/api/config
```

### Example 4: Redis-like Operations

```bash
# SET operation
curl -X PUT http://localhost:8080/api/config/key \
  -H "Content-Type: application/json" \
  -d '{"key": "session:abc123", "value": "{\"user\":\"alice\",\"ttl\":3600}"}'

# GET operation
curl http://localhost:8080/api/config/key/session:abc123

# DEL operation
curl -X DELETE http://localhost:8080/api/config/key/session:abc123

# KEYS operation (list all keys)
curl http://localhost:8080/api/keys
```

---

## Troubleshooting

### Common Issues

#### KVS Not Initialized

**Error:** `KVS not initialized. Call /api/init first.`

**Solution:**
```bash
curl -X POST http://localhost:8080/api/init
```

#### Bee Node Connection Failed

**Error:** `Failed to connect to Bee node`

**Diagnostic:**
```bash
# Check if Bee is running
curl http://bee.dappnode:1633/health

# Check Bee debug API
curl http://bee.dappnode:1635/node
```

**Solution:**
- Ensure Bee DNP is installed and running
- Check `BEE_URL` environment variable
- Verify network connectivity

#### Invalid Batch ID

**Error:** `Invalid postage batch ID`

**Diagnostic:**
```bash
# List your batches
curl http://bee.dappnode:1635/stamps

# Check batch details
curl http://bee.dappnode:1635/stamps/<batch-id>
```

**Solution:**
- Purchase a new batch if needed
- Ensure batch ID is 64 hex characters
- Check batch has sufficient balance

#### WASM Initialization Timeout

**Error:** `POT.js initialization timeout`

**Possible causes:**
1. `pot.wasm` file missing
2. Insufficient memory
3. File corruption

**Solution:**
```bash
# Verify files exist
ls -la build/public/pot.wasm

# Re-download WASM file
curl -L -o build/public/pot.wasm \
  https://raw.githubusercontent.com/brainiac-five/potjs/dev/lib/pot.wasm
```

### Debugging

#### Enable Verbose Logging

Add to environment:
```yaml
environment:
  - DEBUG=pot:*
```

#### Check POT.js Status

```bash
curl http://localhost:8080/api/status
curl http://localhost:8080/health
```

#### View Container Logs

```bash
docker-compose logs -f potis
```

#### Memory Issues

If container runs out of memory:

```yaml
services:
  potis:
    # ...
    deploy:
      resources:
        limits:
          memory: 512M
```

---

## License

GPL-3.0

---

## Resources

### Official Documentation

- [POT.js Repository](https://github.com/brainiac-five/potjs)
- [POT.js Manual (PDF)](./POT_JS_manual.pdf)
- [DappNode Developer Docs](https://docs.dappnode.io/)
- [Swarm Bee Documentation](https://docs.ethswarm.org/)

### Related Projects

- [DappNode](https://dappnode.com/)
- [Swarm](https://www.ethswarm.org/)
- [Redis](https://redis.io/)
- [Ethereum](https://ethereum.org/)

### Support

- [DappNode Discord](https://discord.gg/dappnode)
- [POT.js Issues](https://github.com/brainiac-five/potjs/issues)

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -am 'Add my feature'`
4. Push to branch: `git push origin feature/my-feature`
5. Submit a pull request

---

## Changelog

### v0.1.0 (Initial Release)

- Basic KVS operations (put, get, delete)
- Swarm storage integration
- Web interface
- Reference history management
- In-memory and Swarm modes
- DappNode package configuration
- Swagger API documentation
