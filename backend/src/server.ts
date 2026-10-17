import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app';
import { initSocketHandlers } from './sockets/socket.handler'; // <-- 1. Add this import
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

const server = http.createServer(app);

export const io = new SocketIOServer(server, {
    cors: {
        origin: CLIENT_URL,
        methods: ['GET', 'POST'],
        credentials: true,
    },
});

// 2. Initialize Real-Time Event Handlers
initSocketHandlers(io); // <-- Call the handler here

server.listen(PORT, () => {
    console.log('====================================================');
    console.log(`🚀 Uber Clone Backend Engine Running on Port: ${PORT}`);
    console.log(`📡 WebSocket Gateway: Initialized and Listening`);
    console.log(`🔗 Health Check: http://localhost:${PORT}/api/v1/health`);
    console.log('====================================================');
});