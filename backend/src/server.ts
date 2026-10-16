import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// 1. Create native HTTP server wrapping Express
const server = http.createServer(app);

// 2. Initialize Real-Time Socket.io Server
export const io = new SocketIOServer(server, {
    cors: {
        origin: CLIENT_URL,
        methods: ['GET', 'POST'],
        credentials: true,
    },
});

// 3. Socket.io Connection Event Listener
io.on('connection', (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
        console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
});

// 4. Start Server Listener
server.listen(PORT, () => {
    console.log('====================================================');
    console.log(`🚀 Uber Clone Backend Engine Running on Port: ${PORT}`);
    console.log(`📡 WebSocket Gateway: Ready for connections`);
    console.log(`🛡️  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Health Check: http://localhost:${PORT}/api/v1/health`);
    console.log('====================================================');
});