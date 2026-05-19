// Game state management with persistent storage
const fs = require('fs');
const path = require('path');

const SAVE_FILE = path.join(__dirname, 'game_save.json');

// City zones with properties
const CITY_ZONES = {
    industrial: {
        name: "Industrial Zone",
        spawnPoint: { x: -15, z: -15 },
        properties: [
            { id: "ind_apt_1", name: "Worker's Apartment", price: 5000, rent: 250, zone: "industrial", level: 1, position: { x: -18, z: -12 } },
            { id: "ind_apt_2", name: "Factory Housing", price: 8000, rent: 400, zone: "industrial", level: 1, position: { x: -12, z: -18 } },
            { id: "ind_apt_3", name: "Steel Loft", price: 12000, rent: 600, zone: "industrial", level: 1, position: { x: -20, z: -8 } }
        ],
        businesses: [
            { id: "ind_factory", name: "Steel Factory", price: 15000, profit: 800, workers: 3, demand: 0.6, position: { x: -10, z: -15 } },
            { id: "ind_warehouse", name: "Logistics Hub", price: 10000, profit: 500, workers: 2, demand: 0.5, position: { x: -15, z: -10 } }
        ],
        jobs: [
            { id: "ind_worker", name: "Factory Worker", pay: 75, requirement: 0, position: { x: -10, z: -15 } },
            { id: "ind_operator", name: "Machine Operator", pay: 120, requirement: 2000, position: { x: -10, z: -15 } }
        ]
    },
    residential: {
        name: "Residential Zone",
        spawnPoint: { x: 0, z: -5 },
        properties: [
            { id: "res_apt_1", name: "Garden Apartment", price: 25000, rent: 1200, zone: "residential", level: 2, position: { x: -3, z: -2 } },
            { id: "res_apt_2", name: "Family Home", price: 45000, rent: 2200, zone: "residential", level: 2, position: { x: 3, z: -1 } },
            { id: "res_villa_1", name: "Executive Villa", price: 80000, rent: 4000, zone: "residential", level: 2, position: { x: 0, z: 5 } },
            { id: "res_townhouse", name: "Townhouse", price: 60000, rent: 3000, zone: "residential", level: 2, position: { x: 5, z: 0 } }
        ],
        businesses: [
            { id: "res_cafe", name: "Neighborhood Cafe", price: 30000, profit: 1500, workers: 2, demand: 0.7, position: { x: -2, z: 2 } },
            { id: "res_gym", name: "Community Gym", price: 40000, profit: 2000, workers: 3, demand: 0.65, position: { x: 4, z: -3 } }
        ],
        jobs: [
            { id: "res_manager", name: "Property Manager", pay: 200, requirement: 10000, position: { x: -2, z: 2 } },
            { id: "res_agent", name: "Real Estate Agent", pay: 250, requirement: 20000, position: { x: 4, z: -3 } }
        ]
    },
    business: {
        name: "Business District",
        spawnPoint: { x: 10, z: 5 },
        properties: [
            { id: "bus_office_1", name: "Startup Office", price: 100000, rent: 5000, zone: "business", level: 3, position: { x: 8, z: 8 } },
            { id: "bus_office_2", name: "Corporate Space", price: 150000, rent: 7500, zone: "business", level: 3, position: { x: 12, z: 5 } },
            { id: "bus_tower_suite", name: "Tower Suite", price: 250000, rent: 12500, zone: "business", level: 3, position: { x: 15, z: 10 } }
        ],
        businesses: [
            { id: "bus_restaurant", name: "Fine Dining", price: 80000, profit: 4000, workers: 5, demand: 0.8, position: { x: 10, z: 12 } },
            { id: "bus_agency", name: "Marketing Agency", price: 120000, profit: 6000, workers: 4, demand: 0.75, position: { x: 14, z: 7 } },
            { id: "bus_tech", name: "Tech Startup", price: 200000, profit: 10000, workers: 6, demand: 0.85, position: { x: 7, z: 15 } }
        ],
        jobs: [
            { id: "bus_exec", name: "Executive", pay: 400, requirement: 50000, position: { x: 10, z: 12 } },
            { id: "bus_director", name: "Director", pay: 600, requirement: 100000, position: { x: 14, z: 7 } }
        ]
    },
    downtown: {
        name: "Downtown Luxury Zone",
        spawnPoint: { x: -5, z: 20 },
        properties: [
            { id: "dow_penthouse_1", name: "Sky Penthouse", price: 500000, rent: 25000, zone: "downtown", level: 4, position: { x: -5, z: 22 } },
            { id: "dow_penthouse_2", name: "Royal Suite", price: 1000000, rent: 50000, zone: "downtown", level: 4, position: { x: 0, z: 25 } },
            { id: "dow_mansion", name: "Beach Mansion", price: 2000000, rent: 100000, zone: "downtown", level: 4, position: { x: 5, z: 20 } }
        ],
        businesses: [
            { id: "dow_hotel", name: "7-Star Hotel", price: 500000, profit: 25000, workers: 10, demand: 0.9, position: { x: -8, z: 25 } },
            { id: "dow_mall", name: "Luxury Mall", price: 1000000, profit: 50000, workers: 15, demand: 0.95, position: { x: 8, z: 28 } }
        ],
        jobs: [
            { id: "dow_mogul", name: "Business Mogul", pay: 1000, requirement: 500000, position: { x: -8, z: 25 } },
            { id: "dow_ceo", name: "CEO", pay: 1500, requirement: 1000000, position: { x: 8, z: 28 } }
        ]
    }
};

class GameState {
    constructor() {
        this.players = new Map();
        this.playerData = new Map();
        this.npcs = this.initializeNPCs();
        this.time = Date.now();
        this.lastTick = Date.now();
        this.loadFromFile();
        this.startEconomyLoop();
    }

    initializeNPCs() {
        const npcs = [];
        const npcNames = ["Ahmed", "Fatima", "Mohammed", "Aisha", "Omar", "Layla", "Khalid", "Nadia", "Hassan", "Zara"];
        for (let i = 0; i < 50; i++) {
            npcs.push({
                id: `npc_${i}`,
                name: npcNames[i % npcNames.length],
                money: Math.floor(Math.random() * 20000) + 5000,
                job: ["worker", "manager", "executive"][Math.floor(Math.random() * 3)],
                needs: { housing: 0.5, shopping: 0.5, luxury: 0.2 }
            });
        }
        return npcs;
    }

    createPlayer(socketId, username) {
        const player = {
            id: socketId,
            username: username || `Player_${Math.floor(Math.random() * 1000)}`,
            position: CITY_ZONES.industrial.spawnPoint,
            rotation: { yaw: 0, pitch: 0 },
            money: 1000,
            job: null,
            properties: [],
            businesses: [],
            lastWork: 0,
            stats: { energy: 100, happiness: 80 }
        };
        
        this.players.set(socketId, player);
        this.playerData.set(socketId, { ...player });
        this.saveToFile();
        return player;
    }

    getPlayer(socketId) {
        return this.players.get(socketId);
    }

    updatePlayerPosition(socketId, position, rotation) {
        const player = this.players.get(socketId);
        if (player) {
            player.position = position;
            player.rotation = rotation;
        }
    }

    workJob(socketId) {
        const player = this.players.get(socketId);
        if (!player || !player.job) return { success: false, message: "No job equipped" };
        
        const now = Date.now();
        if (now - (player.lastWork || 0) < 5000) {
            return { success: false, message: "Wait before working again" };
        }
        
        player.money += player.job.pay;
        player.lastWork = now;
        this.saveToFile();
        return { success: true, newMoney: player.money, amount: player.job.pay };
    }

    buyProperty(socketId, propertyId) {
        const player = this.players.get(socketId);
        let foundProperty = null;
        let zoneKey = null;
        
        for (const [zoneName, zone] of Object.entries(CITY_ZONES)) {
            const prop = zone.properties.find(p => p.id === propertyId);
            if (prop) {
                foundProperty = prop;
                zoneKey = zoneName;
                break;
            }
        }
        
        if (!foundProperty) return { success: false, message: "Property not found" };
        if (player.properties.includes(propertyId)) return { success: false, message: "Already owned" };
        if (player.money < foundProperty.price) return { success: false, message: "Not enough money" };
        
        player.money -= foundProperty.price;
        player.properties.push(propertyId);
        this.saveToFile();
        return { success: true, newMoney: player.money, property: foundProperty };
    }

    buyBusiness(socketId, businessId) {
        const player = this.players.get(socketId);
        let foundBusiness = null;
        
        for (const [zoneName, zone] of Object.entries(CITY_ZONES)) {
            const biz = zone.businesses.find(b => b.id === businessId);
            if (biz) {
                foundBusiness = biz;
                break;
            }
        }
        
        if (!foundBusiness) return { success: false, message: "Business not found" };
        if (player.businesses.includes(businessId)) return { success: false, message: "Already owned" };
        if (player.money < foundBusiness.price) return { success: false, message: "Not enough money" };
        
        player.money -= foundBusiness.price;
        player.businesses.push(businessId);
        this.saveToFile();
        return { success: true, newMoney: player.money, business: foundBusiness };
    }

    changeJob(socketId, jobId) {
        const player = this.players.get(socketId);
        let foundJob = null;
        
        for (const [zoneName, zone] of Object.entries(CITY_ZONES)) {
            const job = zone.jobs.find(j => j.id === jobId);
            if (job && player.money >= job.requirement) {
                foundJob = job;
                break;
            }
        }
        
        if (!foundJob) return { success: false, message: "Cannot take this job" };
        
        player.job = foundJob;
        this.saveToFile();
        return { success: true, job: foundJob };
    }

    processEconomyTick() {
        const now = Date.now();
        if (now - this.lastTick < 30000) return; // Every 30 seconds
        this.lastTick = now;
        
        // Process player passive income
        for (const [id, player] of this.players) {
            let income = 0;
            
            // Property rent
            for (const propId of player.properties) {
                for (const [zoneName, zone] of Object.entries(CITY_ZONES)) {
                    const prop = zone.properties.find(p => p.id === propId);
                    if (prop) income += prop.rent;
                }
            }
            
            // Business profit
            for (const bizId of player.businesses) {
                for (const [zoneName, zone] of Object.entries(CITY_ZONES)) {
                    const biz = zone.businesses.find(b => b.id === bizId);
                    if (biz) {
                        const demandMultiplier = this.calculateDemand(biz);
                        income += Math.floor(biz.profit * demandMultiplier);
                    }
                }
            }
            
            if (income > 0) {
                player.money += income;
            }
        }
        
        // Process NPC economy (create demand)
        for (const npc of this.npcs) {
            const spending = Math.floor(Math.random() * 500) + 200;
            // NPC spending goes to business profits
        }
        
        this.saveToFile();
    }

    calculateDemand(business) {
        // Simulate market demand based on time and zone
        const hour = new Date().getHours();
        let demand = business.demand;
        if (hour > 18 || hour < 6) demand *= 0.5;
        if (hour > 11 && hour < 14) demand *= 1.3;
        return Math.min(1.5, Math.max(0.3, demand));
    }

    getAllPlayers() {
        const players = [];
        for (const [id, player] of this.players) {
            players.push({
                id: id,
                username: player.username,
                position: player.position,
                rotation: player.rotation
            });
        }
        return players;
    }

    getCityZones() {
        return CITY_ZONES;
    }

    saveToFile() {
        const saveData = {
            players: Array.from(this.players.entries()).map(([id, p]) => [id, p]),
            timestamp: Date.now()
        };
        fs.writeFileSync(SAVE_FILE, JSON.stringify(saveData, null, 2));
    }

    loadFromFile() {
        try {
            if (fs.existsSync(SAVE_FILE)) {
                const data = JSON.parse(fs.readFileSync(SAVE_FILE));
                this.players = new Map(data.players);
            }
        } catch (e) {
            console.log("No save file found, starting fresh");
        }
    }

    startEconomyLoop() {
        setInterval(() => this.processEconomyTick(), 30000);
    }
}

module.exports = { GameState, CITY_ZONES };
