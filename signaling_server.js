// signaling-server.js
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app); // Create an HTTP server
const io = require('socket.io')(server); // Initialize Socket.IO with the HTTP server

// --- Configuration ---
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

// --- Start the Server ---
server.listen(PORT, HOST, () => {
    console.log(`\n🎉 Signaling server is running and listening on http://${HOST}:${PORT}`);
    console.log(`  Accessible from other devices on your local network via your host machine's IP (e.g., http://192.168.1.XX:${PORT})\n`);
});

// --- Socket.IO Connection Event ---
io.on('connection', (socket) => {
    const clientIp = socket.request.connection.remoteAddress;
    console.log(`New client connected! ID: ${socket.id}, IP: ${clientIp}`);

    // --- Socket.IO Event Handlers for this specific client ---

    // Listen for generic 'message' events from the Android client
    // (This handler will now primarily focus on the 'join' message, if sent this way)
    socket.on('message', (message) => {
            let data;
            try {
                data = JSON.parse(message);
            } catch (e) {
                console.error(`Error parsing message from ${socket.id}:`, e);
                return;
            }
            // This 'message' listener should now only log unexpected generic messages,
            // as 'join', 'offer', 'answer', 'candidate' have dedicated listeners.
            console.warn(`[Unexpected Generic Message] Client ${socket.id} sent unknown/unexpected message type: ${data.type || 'unknown'} via generic 'message' event. Data:`, data);
        });

    // --- Dedicated listeners for WebRTC signaling events ---
    // These will catch events emitted directly by name (e.g., socket.emit('offer', data))

    socket.on('offer', (data) => {
        console.log(`[Received Offer from ${socket.id}] Data:`, data);
        const currentRoom = Array.from(socket.rooms).find(room => room !== socket.id);
        if (currentRoom) {
            socket.broadcast.to(currentRoom).emit('offer', data);
            console.log(`[Room: ${currentRoom}] Relayed offer from ${socket.id} to others.`);
        } else {
            console.warn(`[Offer Error] Client ${socket.id} sent offer without joining a room.`);
            socket.emit('error', { message: 'You must join a room before sending WebRTC signals.' });
        }
    });
    socket.on('join', (data) => {
        console.log(`[Received Join from ${socket.id}] Room: ${data.room}`);
        const roomName = data.room; // Assuming 'data' object has a 'room' property

        if (!roomName) {
            console.warn(`[Join Error] Client ${socket.id} tried to join without a room name.`);
            socket.emit('error', { message: 'Room name is required for join.' });
            return;
        }

        socket.join(roomName); // Add client to the Socket.IO room
        console.log(`Client ${socket.id} joined room: ${roomName}.`);

        // Log current room size (for debugging/monitoring)
        io.in(roomName).allSockets().then(sids => {
            console.log(`Current room size for ${roomName}: ${sids.size}`);
        }).catch(err => {
            console.error("Error getting clients in room:", err);
        });

        // Send confirmation back to the client
        socket.emit('join-ack', { room: roomName, message: 'Joined room successfully!' });
    });

    socket.on('answer', (data) => {
        console.log(`[Received Answer from ${socket.id}] Data:`, data);
        const currentRoom = Array.from(socket.rooms).find(room => room !== socket.id);
        if (currentRoom) {
            socket.broadcast.to(currentRoom).emit('answer', data);
            console.log(`[Room: ${currentRoom}] Relayed answer from ${socket.id} to others.`);
        } else {
            console.warn(`[Answer Error] Client ${socket.id} sent answer without joining a room.`);
            socket.emit('error', { message: 'You must join a room before sending WebRTC signals.' });
        }
    });

    // Assuming your Android client sends ICE candidates with the event name 'candidate' or 'ice'
    // Adjust 'candidate' below if your Android client emits it as 'ice'.
    socket.on('ice', (data) => {
        console.log(`[Received ICE Candidate from ${socket.id}] Data:`, data);
        const currentRoom = Array.from(socket.rooms).find(room => room !== socket.id);
        if (currentRoom) {
            socket.broadcast.to(currentRoom).emit('ice', data); // Emit as 'candidate' or 'ice'
            console.log(`[Room: ${currentRoom}] Relayed ICE candidate from ${socket.id} to others.`);
        } else {
            console.warn(`[ICE Error] Client ${socket.id} sent ICE without joining a room.`);
            socket.emit('error', { message: 'You must join a room before sending WebRTC signals.' });
        }
    });

    // Handle client disconnection
    socket.on('disconnect', (reason) => {
        console.log(`Client disconnected: ${socket.id}. Reason: ${reason}`);
    });

    // Handle errors specific to this client's socket
    socket.on('error', (error) => {
        console.error(`Socket.IO error for client ${socket.id}:`, error.message);
    });
});
