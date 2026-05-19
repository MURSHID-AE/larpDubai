const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Game state storage
const SAVE_FILE = 'game_save.json';
let players = new Map();
let zones = {
    industrial: {
        name: "🏭 Industrial Zone",
        color: 0x8B7D6B,
        spawn: { x: -20, z: -20 },
        properties: [
            { id: "ind_apt_1", name: "Worker's Apartment", price: 5000, rent: 250, x: -22, z: -18 },
            { id: "ind_apt_2", name: "Factory Housing", price: 8000, rent: 400, x: -18, z: -22 },
            { id: "ind_apt_3", name: "Steel Loft", price: 12000, rent: 600, x: -24, z: -14 }
        ],
        businesses: [
            { id: "ind_factory", name: "Steel Factory", price: 15000, profit: 800, x: -16, z: -20 },
            { id: "ind_warehouse", name: "Logistics Hub", price: 10000, profit: 500, x: -20, z: -16 }
        ],
        jobs: [
            { id: "ind_worker", name: "Factory Worker", pay: 75, requirement: 0 },
            { id: "ind_operator", name: "Machine Operator", pay: 120, requirement: 2000 }
        ]
    },
    residential: {
        name: "🏘️ Residential Zone",
        color: 0x7CB342,
        spawn: { x: 0, z: -10 },
        properties: [
            { id: "res_apt_1", name: "Garden Apartment", price: 25000, rent: 1200, x: -5, z: -8 },
            { id: "res_apt_2", name: "Family Home", price: 45000, rent: 2200, x: 5, z: -6 },
            { id: "res_villa_1", name: "Executive Villa", price: 80000, rent: 4000, x: 0, z: -2 }
        ],
        businesses: [
            { id: "res_cafe", name: "Neighborhood Cafe", price: 30000, profit: 1500, x: -3, z: -4 },
            { id: "res_gym", name: "Community Gym", price: 40000, profit: 2000, x: 6, z: -10 }
        ],
        jobs: [
            { id: "res_manager", name: "Property Manager", pay: 200, requirement: 10000 },
            { id: "res_agent", name: "Real Estate Agent", pay: 250, requirement: 20000 }
        ]
    },
    business: {
        name: "🏢 Business District",
        color: 0x42A5F5,
        spawn: { x: 15, z: 10 },
        properties: [
            { id: "bus_office_1", name: "Startup Office", price: 100000, rent: 5000, x: 12, z: 12 },
            { id: "bus_office_2", name: "Corporate Space", price: 150000, rent: 7500, x: 18, z: 8 },
            { id: "bus_tower", name: "Tower Suite", price: 250000, rent: 12500, x: 20, z: 15 }
        ],
        businesses: [
            { id: "bus_restaurant", name: "Fine Dining", price: 80000, profit: 4000, x: 14, z: 18 },
            { id: "bus_tech", name: "Tech Startup", price: 200000, profit: 10000, x: 10, z: 20 }
        ],
        jobs: [
            { id: "bus_exec", name: "Executive", pay: 400, requirement: 50000 },
            { id: "bus_director", name: "Director", pay: 600, requirement: 100000 }
        ]
    },
    downtown: {
        name: "🌆 Downtown Luxury",
        color: 0xFFD700,
        spawn: { x: -10, z: 25 },
        properties: [
            { id: "dow_penthouse", name: "Sky Penthouse", price: 500000, rent: 25000, x: -8, z: 28 },
            { id: "dow_mansion", name: "Beach Mansion", price: 1000000, rent: 50000, x: -15, z: 25 },
            { id: "dow_palace", name: "Royal Palace", price: 2000000, rent: 100000, x: -5, z: 32 }
        ],
        businesses: [
            { id: "dow_hotel", name: "7-Star Hotel", price: 500000, profit: 25000, x: -12, z: 30 },
            { id: "dow_mall", name: "Luxury Mall", price: 1000000, profit: 50000, x: -2, z: 35 }
        ],
        jobs: [
            { id: "dow_mogul", name: "Business Mogul", pay: 1000, requirement: 500000 },
            { id: "dow_ceo", name: "CEO", pay: 1500, requirement: 1000000 }
        ]
    }
};

// Load saved data
function loadGameData() {
    try {
        if (fs.existsSync(SAVE_FILE)) {
            const data = JSON.parse(fs.readFileSync(SAVE_FILE));
            players = new Map(Object.entries(data.players || {}));
            console.log(`Loaded ${players.size} saved players`);
        }
    } catch(e) { console.log("Fresh start"); }
}

function saveGameData() {
    const data = { players: Object.fromEntries(players) };
    fs.writeFileSync(SAVE_FILE, JSON.stringify(data, null, 2));
}

function createPlayer(socketId, username) {
    const player = {
        id: socketId,
        username: username || `Guest_${Math.floor(Math.random() * 1000)}`,
        position: { x: zones.industrial.spawn.x, y: 1.6, z: zones.industrial.spawn.z },
        rotation: { yaw: -Math.PI / 3, pitch: 0 },
        money: 1000,
        job: zones.industrial.jobs[0],
        properties: [],
        businesses: [],
        lastWork: 0,
        lastIncome: 0
    };
    players.set(socketId, player);
    saveGameData();
    return player;
}

function getPropertyById(id) {
    for (const zone of Object.values(zones)) {
        const prop = zone.properties.find(p => p.id === id);
        if (prop) return prop;
    }
    return null;
}

function getBusinessById(id) {
    for (const zone of Object.values(zones)) {
        const biz = zone.businesses.find(b => b.id === id);
        if (biz) return biz;
    }
    return null;
}

function getJobById(id) {
    for (const zone of Object.values(zones)) {
        const job = zone.jobs.find(j => j.id === id);
        if (job) return job;
    }
    return null;
}

// Economy tick every 30 seconds
setInterval(() => {
    let totalEconomyActivity = 0;
    for (const [id, player] of players) {
        let income = 0;
        
        // Property rent
        for (const propId of player.properties) {
            const prop = getPropertyById(propId);
            if (prop) income += prop.rent;
        }
        
        // Business profit
        for (const bizId of player.businesses) {
            const biz = getBusinessById(bizId);
            if (biz) {
                const demand = 0.5 + Math.random() * 0.8;
                income += Math.floor(biz.profit * demand);
            }
        }
        
        if (income > 0) {
            player.money += income;
            player.lastIncome = income;
            totalEconomyActivity += income;
            
            // Notify player of income
            if (player.socket) {
                player.socket.emit('income-tick', { amount: income, newMoney: player.money });
            }
        }
    }
    console.log(`Economy tick: ${totalEconomyActivity} generated`);
    saveGameData();
}, 30000);

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    
    let username = `Explorer_${Math.floor(Math.random() * 1000)}`;
    const player = createPlayer(socket.id, username);
    player.socket = socket;
    
    socket.emit('game-init', {
        player: {
            id: player.id,
            username: player.username,
            money: player.money,
            job: player.job,
            properties: player.properties,
            businesses: player.businesses,
            position: player.position,
            stats: { energy: 100, happiness: 80 }
        },
        zones: zones,
        players: Array.from(players.values()).map(p => ({
            id: p.id,
            username: p.username,
            position: p.position,
            rotation: p.rotation
        }))
    });
    
    // Broadcast new player to others
    socket.broadcast.emit('player-joined', {
        id: player.id,
        username: player.username,
        position: player.position,
        rotation: player.rotation
    });
    
    // Handle movement
    socket.on('player-move', (data) => {
        const p = players.get(socket.id);
        if (p) {
            p.position = data.position;
            p.rotation = data.rotation;
            socket.broadcast.emit('player-moved', {
                id: socket.id,
                position: data.position,
                rotation: data.rotation
            });
        }
    });
    
    // Handle work
    socket.on('work-job', () => {
        const p = players.get(socket.id);
        if (!p || !p.job) {
            socket.emit('work-result', { success: false, message: "No job equipped" });
            return;
        }
        
        const now = Date.now();
        if (now - (p.lastWork || 0) < 5000) {
            const wait = Math.ceil((5000 - (now - p.lastWork)) / 1000);
            socket.emit('work-result', { success: false, message: `Wait ${wait}s` });
            return;
        }
        
        p.money += p.job.pay;
        p.lastWork = now;
        saveGameData();
        
        socket.emit('work-result', { 
            success: true, 
            amount: p.job.pay, 
            newMoney: p.money 
        });
        
        // Broadcast money update to all (for leaderboard)
        io.emit('player-update', { id: socket.id, money: p.money });
    });
    
    // Handle property purchase
    socket.on('buy-property', (propertyId) => {
        const p = players.get(socket.id);
        const property = getPropertyById(propertyId);
        
        if (!property) {
            socket.emit('purchase-result', { success: false, message: "Property not found" });
            return;
        }
        
        if (p.properties.includes(propertyId)) {
            socket.emit('purchase-result', { success: false, message: "Already owned" });
            return;
        }
        
        if (p.money < property.price) {
            socket.emit('purchase-result', { success: false, message: `Need $${property.price - p.money} more` });
            return;
        }
        
        p.money -= property.price;
        p.properties.push(propertyId);
        saveGameData();
        
        socket.emit('purchase-result', {
            success: true,
            type: 'property',
            item: property,
            newMoney: p.money
        });
        
        io.emit('player-update', { id: socket.id, money: p.money, properties: p.properties });
    });
    
    // Handle business purchase
    socket.on('buy-business', (businessId) => {
        const p = players.get(socket.id);
        const business = getBusinessById(businessId);
        
        if (!business) {
            socket.emit('purchase-result', { success: false, message: "Business not found" });
            return;
        }
        
        if (p.businesses.includes(businessId)) {
            socket.emit('purchase-result', { success: false, message: "Already owned" });
            return;
        }
        
        if (p.money < business.price) {
            socket.emit('purchase-result', { success: false, message: `Need $${business.price - p.money} more` });
            return;
        }
        
        p.money -= business.price;
        p.businesses.push(businessId);
        saveGameData();
        
        socket.emit('purchase-result', {
            success: true,
            type: 'business',
            item: business,
            newMoney: p.money
        });
        
        io.emit('player-update', { id: socket.id, money: p.money, businesses: p.businesses });
    });
    
    // Handle job change
    socket.on('change-job', (jobId) => {
        const p = players.get(socket.id);
        const job = getJobById(jobId);
        
        if (!job) {
            socket.emit('job-change-result', { success: false, message: "Job not found" });
            return;
        }
        
        if (p.money < job.requirement) {
            socket.emit('job-change-result', { success: false, message: `Need $${job.requirement} for this job` });
            return;
        }
        
        p.job = job;
        saveGameData();
        
        socket.emit('job-change-result', {
            success: true,
            job: job
        });
        
        io.emit('player-update', { id: socket.id, job: job });
    });
    
    // Handle chat
    socket.on('chat-message', (message) => {
        const p = players.get(socket.id);
        if (p && message.trim()) {
            io.emit('chat-message', {
                username: p.username,
                message: message.slice(0, 100),
                time: new Date().toLocaleTimeString()
            });
        }
    });
    
    // Handle disconnect
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        players.delete(socket.id);
        io.emit('player-left', socket.id);
        saveGameData();
    });
});

loadGameData();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n🎮 Ghost City Multiplayer Server Running!`);
    console.log(`📍 Local: http://localhost:${PORT}`);
    console.log(`🌍 Share this URL with friends to play together!\n`);
});
