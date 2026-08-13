'use strict';

const path = require('path');
const http = require('http');
const os = require('os');
const express = require('express');
const { WebSocketServer } = require('ws');
const { Game, CONFIG } = require('./game.js');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);

const PUBLIC = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC, { extensions: ['html'] }));

// basic health/status endpoint
app.get('/api/status', (req, res) => {
  res.json({ name: CONFIG.NAME, players: game.listRooms() });
});

const wss = new WebSocketServer({ server, path: '/ws' });
const game = new Game();

wss.on('connection', (socket) => {
  socket.isAlive = true;
  socket.on('pong', () => { socket.isAlive = true; });

  socket.on('message', (data) => {
    const text = data.toString();
    // first message must be a join
    if (!socket.playerId) {
      let msg;
      try { msg = JSON.parse(text); } catch { return; }
      if (msg.type === 'join') {
        game.join(socket, msg.name, msg.world, msg.team);
      }
      return;
    }
    game.handleMessage(socket, text);
  });

  socket.on('close', () => game.leave(socket));
  socket.on('error', () => game.leave(socket));
});

// heartbeat to prune dead sockets
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    try { ws.ping(); } catch {}
  });
}, 30000);

const tickMs = Math.round(1000 / CONFIG.TICK);
const loop = setInterval(() => game.tick(), tickMs);

function lanAddresses() {
  const out = [];
  const ifs = os.networkInterfaces();
  for (const name in ifs) {
    for (const i of ifs[name]) {
      if (i.family === 'IPv4' && !i.internal) out.push(i.address);
    }
  }
  return out;
}

server.listen(PORT, '0.0.0.0', () => {
  console.log('WOLHUD server (LAN multiplayer)');
  console.log(`  local:   http://localhost:${PORT}`);
  for (const a of lanAddresses()) console.log(`  LAN:     http://${a}:${PORT}`);
  console.log(`  ws path: /ws   tick: ${CONFIG.TICK}Hz`);
  if (!game.serverWorld.custom) console.log('  map:     built-in (drop assets/map.fbx + assets/map.json to replace)');
  else console.log('  map:     custom (assets/map.json)');
});

function shutdown() {
  clearInterval(heartbeat);
  clearInterval(loop);
  server.close();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
