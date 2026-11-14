'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { WebSocketServer, WebSocket } = require('ws');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;
const MAX_PLAYERS_PER_ROOM = 8;
const MAX_BIRDS_PER_PLAYER = 26;
const rooms = new Map();
const pages = new Map([
  ['/', 'index.html'],
  ['/index.html', 'index.html']
]);

function reply(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(body);
}

function cleanText(value, maxLength) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maxLength);
}

function boundedNumber(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : 0;
}

function sanitizeState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const heading = boundedNumber(value.h, -1e6, 1e6);
  const birds = Array.isArray(value.birds) ? value.birds.slice(0, MAX_BIRDS_PER_PLAYER).map((bird) => {
    if (!bird || typeof bird !== 'object') return null;
    const id = cleanText(bird.id, 32);
    if (!id) return null;
    const state = cleanText(bird.st, 12);
    return {
      id,
      name: cleanText(bird.name, 24) || 'Güvercin',
      breed: cleanText(bird.breed, 48) || 'Kaya Güvercini',
      male: bird.male === true,
      x: boundedNumber(bird.x, -64, 64),
      z: boundedNumber(bird.z, -64, 64),
      y: boundedNumber(bird.y, 0, 20),
      h: boundedNumber(bird.h, -1e6, 1e6),
      st: ['idle', 'walk', 'out', 'home', 'eat', 'peck', 'eatF', 'go'].includes(state) ? state : 'idle'
    };
  }).filter(Boolean) : [];
  return {
    x: boundedNumber(value.x, -64, 64),
    z: boundedNumber(value.z, -64, 64),
    h: ((heading % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2),
    birds
  };
}

function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}

function broadcast(room, data, except) {
  for (const client of room.values()) {
    if (client !== except) send(client, data);
  }
}

function playerView(client) {
  return { id: client.id, name: client.name, state: client.state };
}

function joinRoom(ws, message) {
  if (ws.room) return;
  const roomCode = cleanText(message.room, 8).toUpperCase();
  const name = cleanText(message.name, 16) || 'Misafir';
  if (!/^[A-Z0-9]{4,8}$/.test(roomCode)) {
    send(ws, { type: 'error', message: 'Oda kodu 4–8 harf/rakam olmalı.' });
    ws.close(1008, 'Invalid room');
    return;
  }
  let room = rooms.get(roomCode);
  if (!room) {
    room = new Map();
    rooms.set(roomCode, room);
  }
  if (room.size >= MAX_PLAYERS_PER_ROOM) {
    send(ws, { type: 'error', message: 'Oda dolu (en fazla 8 oyuncu).' });
    ws.close(1008, 'Room full');
    return;
  }

  const peers = [...room.values()];
  ws.id = randomUUID();
  ws.name = name;
  ws.room = roomCode;
  ws.state = null;
  ws.lastStateAt = 0;
  room.set(ws.id, ws);
  send(ws, { type: 'welcome', id: ws.id, room: roomCode, players: peers.map(playerView) });
  broadcast(room, { type: 'peer-join', player: playerView(ws) }, ws);
}

function removeFromRoom(ws) {
  if (!ws.room) return;
  const room = rooms.get(ws.room);
  if (!room) return;
  room.delete(ws.id);
  broadcast(room, { type: 'peer-leave', id: ws.id });
  if (!room.size) rooms.delete(ws.room);
  ws.room = null;
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (error) {
    reply(res, 400, 'Bad request');
    return;
  }

  if (req.method === 'GET' && pathname === '/health') {
    reply(res, 200, JSON.stringify({ ok: true, rooms: rooms.size }), 'application/json; charset=utf-8');
    return;
  }
  if (req.method !== 'GET' || !pages.has(pathname)) {
    reply(res, 404, 'Not found');
    return;
  }

  const file = path.join(ROOT, pages.get(pathname));
  fs.readFile(file, (error, content) => {
    if (error) {
      console.error('Dosya sunulamadı:', file, error);
      reply(res, 500, 'Dosya okunamadı');
      return;
    }
    reply(res, 200, content, 'text/html; charset=utf-8');
  });
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 32 * 1024 });
server.on('upgrade', (req, socket, head) => {
  let pathname;
  let originHost = '';
  try {
    pathname = new URL(req.url, 'http://localhost').pathname;
    if (req.headers.origin && req.headers.origin !== 'null') originHost = new URL(req.headers.origin).host;
  } catch (error) {
    socket.destroy();
    return;
  }
  if (pathname !== '/ws' || (originHost && originHost !== req.headers.host)) {
    socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

wss.on('connection', (ws) => {
  ws.isAlive = true;
  const joinTimeout = setTimeout(() => {
    if (!ws.room) {
      send(ws, { type: 'error', message: 'Odaya katılma bilgisi gelmedi.' });
      ws.close(1008, 'Join required');
    }
  }, 5000);
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', (raw, isBinary) => {
    if (isBinary) {
      ws.close(1003, 'Text messages only');
      return;
    }
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch (error) {
      send(ws, { type: 'error', message: 'Geçersiz mesaj biçimi.' });
      ws.close(1003, 'Invalid JSON');
      return;
    }
    if (!message || typeof message !== 'object' || Array.isArray(message)) return;
    if (!ws.room && message.type === 'join') {
      joinRoom(ws, message);
      if (ws.room) clearTimeout(joinTimeout);
      return;
    }
    if (!ws.room || message.type !== 'state') return;
    const now = Date.now();
    if (now - ws.lastStateAt < 50) return;
    const state = sanitizeState(message.state);
    if (!state) return;
    ws.lastStateAt = now;
    ws.state = state;
    const room = rooms.get(ws.room);
    if (room) broadcast(room, { type: 'peer-state', player: playerView(ws) }, ws);
  });
  ws.on('close', () => {
    clearTimeout(joinTimeout);
    removeFromRoom(ws);
  });
  ws.on('error', (error) => console.error('WebSocket bağlantı hatası:', error.message));
});

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Güvercin oyunu hazır: http://localhost:${PORT}`);
  console.log('Online odalar WebSocket üzerinden çalışıyor.');
});

function shutdown() {
  clearInterval(heartbeat);
  for (const ws of wss.clients) ws.close(1001, 'Server shutting down');
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
