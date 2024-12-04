import { Request, Response } from "express";
import express from "express";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
const cors= require("cors")

const app = express();
app.use(express.json());
app.use(cors());

const port = process.env.PORT || 3000;
const server = http.createServer(app);

// Initialize WebSocket server
const wss = new WebSocketServer({ server });

// In-memory storage for chat messages
const messages: { user: string; message: string; roomId: string }[] = [];

// A map to store connected users by roomId
const roomMap = new Map<string, WebSocket[]>();

app.get("/", (req: Request, res: Response) => {
  res.send("Hello World");
});

// Endpoint to get all messages (for client-side persistence)
app.get("/api/messages", (req: Request, res: Response) => {
  res.json(messages);
});

// Endpoint to delete all chat history
app.delete("/api/messages", (req: Request, res: Response) => {
  messages.length = 0;
  res.send("All messages cleared");
});

// Handle WebSocket connections
wss.on('connection', (ws: WebSocket) => {
  console.log("Client connected to server");

  // Send existing messages to newly connected client
  ws.send(JSON.stringify({ type: 'initialMessages', messages }));

  // Handle incoming message from client
  ws.on('message', (message: string) => {
    const parsedMessage = JSON.parse(message);
    const { user, roomId, text } = parsedMessage;

    // Store the message in the in-memory storage
    const newMessage = { user, message: text, roomId };
    messages.push(newMessage);

    // Ensure room exists in the roomMap
    if (!roomMap.has(roomId)) {
      roomMap.set(roomId, []);
    }

    // Add the current WebSocket connection to the room's list of connections
    const roomClients = roomMap.get(roomId)!;
    if (!roomClients.includes(ws)) {
      roomClients.push(ws);
    }

    // Determine if the room has more than one client
    if (roomClients.length > 1) {
      // Broadcast message to all clients in the room (group chat)
      roomClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'newMessage',
            message: newMessage
          }));
        }
      });
    } else {
      // If only one client in the room (private chat), send the message only to the other user in the room
      roomClients.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'newMessage',
            message: newMessage
          }));
        }
      });
    }
  });

  // Handle WebSocket disconnection
  ws.on('close', () => {
    console.log("Client disconnected from server");

    // Remove the WebSocket connection from the room map
    roomMap.forEach((clients, roomId) => {
      const index = clients.indexOf(ws);
      if (index !== -1) {
        clients.splice(index, 1); // Remove client from room
        // If room is empty, delete it
        if (clients.length === 0) {
          roomMap.delete(roomId);
        }
      }
    });
  });

  // Handle WebSocket errors
  ws.on('error', (error) => {
    console.error("WebSocket error:", error);
  });
});

// Start the HTTP server
server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
