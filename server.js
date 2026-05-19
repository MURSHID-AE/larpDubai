const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const { GameState, CITY_ZONES } = require('./gameState');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const gameState = new GameState();

// Serve static files
app.use(express.static(path.join(__dirname, '../client')));

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    
    // Create player
    const player = gameState.createPlayer(socket.id, `Guest_${Math.floor(Math.random() * 1000)}`);
    
    // Send initial game state
    socket.emit('game-init', {
        player: player,
        zones: CITY_ZONES,
        players: gameState.getAllPlayers()
    });
    
    // Broadcast new player to others
    socket.broadcast.emit('player-joined', {
        id: socket.id,
        username: player.username,
        position: player.position,
        rotation: player.rotation
    });
    
    // Handle movement updates
    socket.on('player-move', (data) => {
        gameState.updatePlayerPosition(socket.id, data.position, data.rotation);
        socket.broadcast.emit('player-moved', {
            id: socket.id,
            position: data.position,
            rotation: data.rotation
        });
    });
    
    // Handle work action
    socket.on('work-job', () => {
        const result = gameState.workJob(socket.id);
        socket.emit('work-result', result);
        if (result.success) {
            const player = gameState.getPlayer(socket.id);
            io.emit('player-update', { id: socket.id, money: player.money });
        }
    });
    
    // Handle property purchase
    socket.on('buy-property', (propertyId) => {
        const result = gameState.buyProperty(socket.id, propertyId);
        socket.emit('purchase-result', result);
        if (result.success) {
            const player = gameState.getPlayer(socket.id);
            io.emit('player-update', { id: socket.id, money: player.money, properties: player.properties });
        }
    });
    
    // Handle business purchase
    socket.on('buy-business', (businessId) => {
        const result = gameState.buyBusiness(socket.id, businessId);
        socket.emit('purchase-result', result);
        if (result.success) {
            const player = gameState.getPlayer(socket.id);
            io.emit('player-update', { id: socket.id, money: player.money, businesses: player.businesses });
        }
    });
    
    // Handle job change
    socket.on('change-job', (jobId) => {
        const result = gameState.changeJob(socket.id, jobId);
        socket.emit('job-change-result', result);
        if (result.success) {
            const player = gameState.getPlayer(socket.id);
            io.emit('player-update', { id: socket.id, job: player.job });
        }
    });
    
    // Handle disconnect
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        io.emit('player-left', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
