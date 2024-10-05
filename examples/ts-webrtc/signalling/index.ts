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
    // console.log(message)
    // console.log(data)
    // console.log(data.to)
    // console.log(clients)
    // console.log(clients.has(data.to))
    if (data.to && clients.has(Number(data.to))) {
      // Forward message to the intended recipient (hop-to-hop)
      console.log(clients)
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
