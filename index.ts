const cors= require("cors")
import { Request, Response } from "express";
import express from "express";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";

const app = express();
app.use(express.json());
app.use(cors());

const port = process.env.PORT || 3000;
const server = http.createServer(app);

// Initialize WebSocket server
const wss = new WebSocketServer({ server });

// In-memory storage for chat messages
const messages: { user: string; message: string }[] = [];

// A map to store connected users with their WebSocket connections
const users = new Map<string, WebSocket>();

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
  ws.send(JSON.stringify({ type: 'init', messages }));

  // Handle incoming messages from clients
  ws.on('message', (message: string) => {
    try {
      const data = JSON.parse(message); 

      // If a new user joins
      if (data.type === 'join') {
        const username = data.username;
        if (username) {
          users.set(username, ws);
          console.log(`User joined: ${username}`);
        }
      }

      // If a chat message is sent
      if (data.type === 'message') {
        const { user, message } = data;
        // Save the message
        messages.push({ user, message });

        // Broadcast the message to all connected clients
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'message', user, message }));
          }
        });
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  // Handle client disconnection
  ws.on('close', () => {
    users.forEach((value, key) => {
      if (value === ws) {
        users.delete(key);
        console.log(`User disconnected: ${key}`);
      }
    });
  });
});

// Start the HTTP server
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
