const express = require('express');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 8080;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

let beeUrl = process.env.BEE_URL || 'http://bee.dappnode:1633';
let batchId = process.env.BATCH_ID || '';
let kvs = null;
let potReady = false;
let savedRefs = [];
let knownKeys = new Set();

const potModule = require('./public/pot-node.js');

function getMode() {
  return batchId ? 'swarm' : 'in-memory';
}

async function loadPot() {
  if (potReady) return global.pot;
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('POT.js initialization timeout'));
    }, 30000);
    
    global.pot.ready().then(() => {
      clearTimeout(timeout);
      potReady = true;
      console.log('POT.js initialized successfully');
      resolve(global.pot);
    }).catch(err => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

async function initKVS() {
  const pot = await loadPot();
  
  if (batchId && beeUrl) {
    kvs = await pot.new(beeUrl, batchId);
    console.log(`POT KVS initialized with Bee: ${beeUrl} (Swarm mode)`);
  } else {
    kvs = await pot.new();
    console.log('POT KVS initialized in-memory mode');
  }
  
  return kvs;
}

async function loadSavedRefs() {
  try {
    const refsPath = path.join(DATA_DIR, 'refs.json');
    const data = await fs.readFile(refsPath, 'utf-8');
    savedRefs = JSON.parse(data);
  } catch {
    savedRefs = [];
  }
}

async function saveRefs() {
  const refsPath = path.join(DATA_DIR, 'refs.json');
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(refsPath, JSON.stringify(savedRefs, null, 2));
}

async function loadKnownKeys() {
  try {
    const keysPath = path.join(DATA_DIR, 'known-keys.json');
    const data = await fs.readFile(keysPath, 'utf-8');
    knownKeys = new Set(JSON.parse(data));
  } catch {
    knownKeys = new Set();
  }
}

async function saveKnownKeys() {
  const keysPath = path.join(DATA_DIR, 'known-keys.json');
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(keysPath, JSON.stringify([...knownKeys], null, 2));
}

async function loadBeeConfig() {
  try {
    const configPath = path.join(DATA_DIR, 'bee-config.json');
    const data = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(data);
    if (config.beeUrl) beeUrl = config.beeUrl;
    if (config.batchId !== undefined) batchId = config.batchId;
    console.log(`Loaded Bee config from disk - URL: ${beeUrl}, Batch: ${batchId ? '***set***' : '(empty)'}`);
  } catch {
    console.log('No saved Bee config, using defaults/env');
  }
}

async function saveBeeConfig() {
  const configPath = path.join(DATA_DIR, 'bee-config.json');
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(configPath, JSON.stringify({ beeUrl, batchId }, null, 2));
}

async function addKey(key) {
  knownKeys.add(key);
  await saveKnownKeys();
}

async function removeKey(key) {
  knownKeys.delete(key);
  await saveKnownKeys();
}

function cleanConfigValue(val) {
  if (typeof val === 'string' && val.length > 0 && val.charCodeAt(0) < 32) {
    return val.substring(1);
  }
  return val;
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/docs', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'api-docs.html'));
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    mode: getMode(),
    beeUrl: beeUrl,
    hasBatchId: !!batchId,
    kvsReady: kvs !== null
  });
});

app.get('/api/status', async (req, res) => {
  try {
    await loadPot();
    res.json({
      initialized: kvs !== null,
      mode: getMode(),
      beeUrl: beeUrl,
      hasBatchId: !!batchId,
      savedConfigs: savedRefs.length,
      keyCount: knownKeys.size
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/environment', (req, res) => {
  res.json({
    beeUrl: beeUrl,
    hasBatchId: !!batchId,
    mode: getMode(),
    port: PORT
  });
});

app.post('/api/bee/test', async (req, res) => {
  const url = req.body.beeUrl || beeUrl;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url.replace(/\/$/, '') + '/health', { signal: controller.signal });
    clearTimeout(timeout);
    if (response.ok) {
      res.json({ success: true, message: 'Bee node is reachable', beeUrl: url });
    } else {
      res.json({ success: false, message: 'Bee node responded with status ' + response.status, beeUrl: url });
    }
  } catch (err) {
    res.json({ success: false, message: 'Cannot reach Bee node: ' + err.message, beeUrl: url });
  }
});

app.post('/api/bee/configure', async (req, res) => {
  try {
    const newBeeUrl = req.body.beeUrl;
    const newBatchId = req.body.batchId;
    
    if (newBeeUrl !== undefined) {
      beeUrl = newBeeUrl.replace(/\/$/, '') || '';
    }
    if (newBatchId !== undefined) {
      batchId = newBatchId || '';
    }
    
    await saveBeeConfig();
    
    console.log(`Configuration updated - Bee URL: ${beeUrl}, Batch ID: ${batchId ? '***set***' : '(empty)'}, Mode: ${getMode()}`);
    
    res.json({ 
      success: true, 
      mode: getMode(),
      beeUrl: beeUrl,
      hasBatchId: !!batchId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/init', async (req, res) => {
  try {
    await initKVS();
    res.json({ 
      success: true, 
      mode: getMode() 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// New /kv endpoints (Redis-like interface)
// GET /api/kv - List all keys
app.get('/api/kv', async (req, res) => {
  try {
    if (!kvs) {
      return res.status(400).json({ error: 'KVS not initialized. Call /api/init first.' });
    }

    const entries = [];
    for (const key of knownKeys) {
      try {
        const value = await kvs.get(key);
        entries.push({ key, value: cleanConfigValue(value) });
      } catch {
        entries.push({ key, value: null });
      }
    }

    res.json({ success: true, keys: entries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/kv - Store a key-value pair
app.put('/api/kv', async (req, res) => {
  try {
    if (!kvs) {
      await initKVS();
    }

    const { key, value } = req.body;

    if (!key) {
      return res.status(400).json({ error: 'Key is required' });
    }

    const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
    await kvs.put(key, valueStr);
    await addKey(key);

    res.json({
      success: true,
      message: `Key '${key}' saved`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/kv/:key - Get a value by key
app.get('/api/kv/:key', async (req, res) => {
  try {
    if (!kvs) {
      return res.status(400).json({ error: 'KVS not initialized' });
    }

    const { key } = req.params;
    const value = await kvs.get(key);

    res.json({
      success: true,
      key: key,
      value: cleanConfigValue(value)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/kv/:key - Delete a key
app.delete('/api/kv/:key', async (req, res) => {
  try {
    if (!kvs) {
      return res.status(400).json({ error: 'KVS not initialized' });
    }

    const { key } = req.params;
    await kvs.delete(key);
    await removeKey(key);

    res.json({
      success: true,
      message: `Key '${key}' deleted`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Legacy endpoints (kept for backward compatibility)
app.get('/api/keys', async (req, res) => {
  try {
    if (!kvs) {
      return res.status(400).json({ error: 'KVS not initialized. Call /api/init first.' });
    }

    const entries = [];
    for (const key of knownKeys) {
      try {
        const value = await kvs.get(key);
        entries.push({ key, value: cleanConfigValue(value) });
      } catch {
        entries.push({ key, value: null });
      }
    }

    res.json({ success: true, keys: entries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/config', async (req, res) => {
  try {
    if (!kvs) {
      return res.status(400).json({ error: 'KVS not initialized. Call /api/init first.' });
    }
    
    const rawValue = await kvs.getRaw('config');
    const configStr = await kvs.getString('config');
    res.json({ 
      success: true, 
      config: cleanConfigValue(configStr),
      hasConfig: rawValue !== null && rawValue !== undefined
    });
  } catch (err) {
    if (err.message && err.message.includes('not found')) {
      res.json({ 
        success: true, 
        config: null,
        hasConfig: false
      });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

app.post('/api/config', async (req, res) => {
  try {
    if (!kvs) {
      await initKVS();
    }
    
    const { config } = req.body;
    
    if (!config) {
      return res.status(400).json({ error: 'Config is required' });
    }
    
    const configStr = typeof config === 'string' ? config : JSON.stringify(config, null, 2);
    
    await kvs.put('config', configStr);
    await addKey('config');
    
    res.json({ 
      success: true, 
      message: 'Config saved to KVS'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/config/save', async (req, res) => {
  try {
    if (!kvs) {
      await initKVS();
    }
    
    const ref = await kvs.save();
    
    await loadSavedRefs();
    savedRefs.push({
      reference: ref,
      timestamp: new Date().toISOString(),
      mode: getMode(),
      keys: [...knownKeys]
    });
    await saveRefs();
    
    res.json({ 
      success: true, 
      reference: ref,
      mode: getMode(),
      message: 'Config saved to decentralized storage'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/config/load', async (req, res) => {
  try {
    const { reference } = req.body;
    
    if (!reference) {
      return res.status(400).json({ error: 'Reference is required' });
    }
    
    const pot = await loadPot();
    
    if (batchId && beeUrl) {
      kvs = await pot.load(reference, beeUrl, batchId);
    } else {
      kvs = await pot.load(reference);
    }
    
    // Probe stored key names to rebuild knownKeys
    const refEntry = savedRefs.find(r => r.reference === reference);
    const keysToProbe = refEntry && refEntry.keys ? refEntry.keys : [...knownKeys];
    
    knownKeys = new Set();
    for (const key of keysToProbe) {
      try {
        const value = await kvs.get(key);
        if (value !== null && value !== undefined) {
          knownKeys.add(key);
        }
      } catch {
        // key doesn't exist in loaded KVS
      }
    }
    await saveKnownKeys();
    
    res.json({ 
      success: true, 
      message: 'KVS loaded from reference',
      reference: reference,
      keysRecovered: knownKeys.size
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/config/key', async (req, res) => {
  try {
    if (!kvs) {
      await initKVS();
    }
    
    const { key, value } = req.body;
    
    if (!key) {
      return res.status(400).json({ error: 'Key is required' });
    }
    
    const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
    await kvs.put(key, valueStr);
    await addKey(key);
    
    res.json({ 
      success: true, 
      message: `Key '${key}' saved`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/config/key/:key', async (req, res) => {
  try {
    if (!kvs) {
      return res.status(400).json({ error: 'KVS not initialized' });
    }
    
    const { key } = req.params;
    const value = await kvs.get(key);
    
    res.json({ 
      success: true, 
      key: key,
      value: cleanConfigValue(value)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/config/key/:key', async (req, res) => {
  try {
    if (!kvs) {
      return res.status(400).json({ error: 'KVS not initialized' });
    }
    
    const { key } = req.params;
    await kvs.delete(key);
    await removeKey(key);
    
    res.json({ 
      success: true, 
      message: `Key '${key}' deleted`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/refs', async (req, res) => {
  try {
    await loadSavedRefs();
    res.json({ 
      success: true, 
      refs: savedRefs 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/refs/:reference', async (req, res) => {
  try {
    const { reference } = req.params;
    
    await loadSavedRefs();
    savedRefs = savedRefs.filter(r => r.reference !== reference);
    await saveRefs();
    
    res.json({ 
      success: true, 
      message: 'Reference removed from history'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  try {
    const dataDir = path.join(__dirname, 'data');
    await fs.mkdir(dataDir, { recursive: true });
    
    await loadBeeConfig();
    await loadKnownKeys();
    await loadSavedRefs();
    
    console.log('Starting Potis - Decentralized Key-Value Store...');
    console.log(`Bee URL: ${beeUrl}`);
    console.log(`Mode: ${batchId ? 'Swarm' : 'In-memory'}`);
    console.log(`Known keys: ${knownKeys.size}`);
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();