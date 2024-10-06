// Install with: npm install ws
import {WebSocket} from 'ws';

const PORT = 8079;
const wss = new WebSocket.Server({ port: PORT });

const clients = new Map();

wss.on('connection', (ws: any) => {
  const clientId = Date.now();
  clients.set(clientId, ws);
  console.log(`Client connected: ${clientId}`);

  ws.on('message', (message: any) => {
    const data = JSON.parse(message);
    if (data.to && clients.has(Number(data.to))) {
      clients.get(Number(data.to)).send(JSON.stringify({ from: clientId, ...data }));
    }else {
        console.log('else')
    }
  });

  ws.on('close', () => {
    clients.delete(clientId);
    console.log(`Client disconnected: ${clientId}`);
  });
});

console.log(`WebSocket signaling server running on ws://localhost:${PORT}`);
