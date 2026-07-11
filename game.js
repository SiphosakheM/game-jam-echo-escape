const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const fogCanvas = document.createElement('canvas');
fogCanvas.width = 1280;
fogCanvas.height = 720;
const fogCtx = fogCanvas.getContext('2d');

const uiRoomNumber = document.getElementById('room-number');
const uiEchoLock = document.getElementById('echo-lock');
const uiScore = document.getElementById('score');
const uiLives = document.getElementById('lives');
const uiMessage = document.getElementById('message-display');
const uiPauseMenu = document.getElementById('pause-menu');
const uiInstructions = document.getElementById('dynamic-instructions');

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;
let lastTime = 0;
let rewardPoints = 0;
let currentRoomIndex = 0;
let isPaused = false;
let lives = 3;
let animationFrameId = null;

// --- AUDIO SYSTEM ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTone(freq, type, duration, vol=0.1) {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

const sfx = {
    jump: () => { playTone(300, 'square', 0.1); setTimeout(()=>playTone(400, 'square', 0.1), 50); },
    grav: () => { playTone(150, 'sawtooth', 0.2); },
    pill: () => { playTone(600, 'sine', 0.1); setTimeout(()=>playTone(800, 'sine', 0.2), 100); },
    echo: () => { playTone(400, 'triangle', 0.1); setTimeout(()=>playTone(300, 'triangle', 0.1), 100); },
    turret: () => { playTone(200, 'sawtooth', 0.3); },
    damage: () => { playTone(100, 'sawtooth', 0.4); },
    exit: () => { playTone(500, 'square', 0.1); setTimeout(()=>playTone(650, 'square', 0.1), 100); setTimeout(()=>playTone(800, 'square', 0.3), 200); }
};

// --- INPUT SYSTEM ---
const keys = {
    ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false,
    a: false, d: false, w: false, s: false,
    g: false, e: false, r: false,
    p: false, Escape: false
};
const justPressed = {};

window.addEventListener('keydown', (e) => {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    if (keys[e.key] !== undefined || e.key === 'Escape') {
        let key = e.key === 'Escape' ? 'Escape' : e.key;
        if (!keys[key]) justPressed[key] = true;
        keys[key] = true;
    }
});
window.addEventListener('keyup', (e) => {
    let key = e.key === 'Escape' ? 'Escape' : e.key;
    if (keys[key] !== undefined) {
        keys[key] = false;
    }
});

function bindTouch(btnId, mappedKeys) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('touchstart', (e) => { 
        e.preventDefault(); 
        if(audioCtx.state === 'suspended') audioCtx.resume();
        for(let k of mappedKeys) {
            if (!keys[k]) justPressed[k] = true;
            keys[k] = true; 
        }
    });
    btn.addEventListener('touchend', (e) => { 
        e.preventDefault(); 
        for(let k of mappedKeys) {
            keys[k] = false; 
        }
    });
}

bindTouch('btn-left', ['ArrowLeft', 'a']);
bindTouch('btn-right', ['ArrowRight', 'd']);
bindTouch('btn-jump', ['ArrowUp', 'w', 'ArrowDown', 's']);
bindTouch('btn-grav', ['g']);
bindTouch('btn-echo', ['e']);

function isJustPressed(key) {
    if (justPressed[key]) {
        justPressed[key] = false;
        return true;
    }
    return false;
}

function rectIntersect(r1, r2) {
    return r1.x < r2.x + r2.w &&
           r1.x + r1.w > r2.x &&
           r1.y < r2.y + r2.h &&
           r1.y + r1.h > r2.y;
}

function lineIntersectsRect(p1, p2, r) {
    for (let i = 0; i <= 20; i++) {
        let x = p1.x + (p2.x - p1.x) * (i / 20);
        let y = p1.y + (p2.y - p1.y) * (i / 20);
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return true;
    }
    return false;
}

// --- ENTITIES ---
class Character {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.w = 20;
        this.h = 50;
        this.vx = 0;
        this.vy = 0;
        this.speed = 350;
        this.jumpForce = 600;
        this.gravity = 1500;
        this.gravityDir = 1; 
        this.facingDir = 1;  
        this.onGround = false;
        this.color = color;
        this.isActive = false;
    }

    update(dt, solids) {
        if (this.isActive) {
            this.vx = 0;
            if (keys['ArrowLeft'] || keys['a']) { this.vx = -this.speed; this.facingDir = -1; }
            if (keys['ArrowRight'] || keys['d']) { this.vx = this.speed; this.facingDir = 1; }

            let tryingToJump = false;
            if (this.gravityDir === 1 && (keys['ArrowUp'] || keys['w'])) tryingToJump = true;
            if (this.gravityDir === -1 && (keys['ArrowDown'] || keys['s'])) tryingToJump = true;

            if (tryingToJump && this.onGround) {
                this.vy = -this.jumpForce * this.gravityDir;
                this.onGround = false;
                sfx.jump();
            }

            if (isJustPressed('g')) {
                this.gravityDir *= -1;
                this.onGround = false;
                sfx.grav();
            }
        } else {
            this.vx *= 0.8;
        }

        this.vy += this.gravity * this.gravityDir * dt;
        if (this.vy > 1000) this.vy = 1000;
        if (this.vy < -1000) this.vy = -1000;

        this.x += this.vx * dt;
        let bounds = { x: this.x, y: this.y, w: this.w, h: this.h };
        for (let solid of solids) {
            if (rectIntersect(bounds, solid)) {
                if (this.vx > 0) this.x = solid.x - this.w;
                else if (this.vx < 0) this.x = solid.x + solid.w;
                this.vx = 0;
                bounds.x = this.x;
            }
        }

        this.y += this.vy * dt;
        bounds.y = this.y;
        this.onGround = false;
        for (let solid of solids) {
            if (rectIntersect(bounds, solid)) {
                if (this.vy > 0) {
                    this.y = solid.y - this.h;
                    if (this.gravityDir === 1) this.onGround = true;
                } else if (this.vy < 0) {
                    this.y = solid.y + solid.h;
                    if (this.gravityDir === -1) this.onGround = true;
                }
                this.vy = 0;
                bounds.y = this.y;
            }
        }

        if (this.x < 0) this.x = 0;
        if (this.x + this.w > GAME_WIDTH) this.x = GAME_WIDTH - this.w;
        if (this.y < 0) { this.y = 0; this.vy = 0; if (this.gravityDir === -1) this.onGround = true; }
        if (this.y + this.h > GAME_HEIGHT) { this.y = GAME_HEIGHT - this.h; this.vy = 0; if (this.gravityDir === 1) this.onGround = true; }
    }

    draw(ctx) {
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;

        ctx.beginPath();
        ctx.arc(this.x + this.w / 2, this.y + 10, 10, 0, Math.PI * 2);
        
        ctx.moveTo(this.x + this.w / 2, this.y + 20);
        ctx.lineTo(this.x + this.w / 2, this.y + 35);

        let legOffset = Math.sin(Date.now() / 100) * 10 * (Math.abs(this.vx) > 10 ? 1 : 0);
        if (!this.onGround) legOffset = 5;

        let groundY = this.gravityDir === 1 ? this.y + this.h : this.y;
        let pelvisY = this.gravityDir === 1 ? this.y + 35 : this.y + 15;

        ctx.moveTo(this.x + this.w / 2, pelvisY);
        ctx.lineTo(this.x + this.w / 2 - 10 + legOffset, groundY);
        ctx.moveTo(this.x + this.w / 2, pelvisY);
        ctx.lineTo(this.x + this.w / 2 + 10 - legOffset, groundY);

        let armY = this.gravityDir === 1 ? this.y + 25 : this.y + 25;
        ctx.moveTo(this.x + this.w / 2, armY);
        ctx.lineTo(this.x - 5, armY + 10);
        ctx.moveTo(this.x + this.w / 2, armY);
        ctx.lineTo(this.x + this.w + 5, armY + 10);

        ctx.stroke();

        if (this.isActive) {
            ctx.beginPath();
            ctx.moveTo(this.x + this.w / 2 - 5, this.y - 15);
            ctx.lineTo(this.x + this.w / 2 + 5, this.y - 15);
            ctx.lineTo(this.x + this.w / 2, this.y - 5);
            ctx.fillStyle = this.color;
            ctx.fill();
        }
        ctx.shadowBlur = 0; 
    }

    getBounds() {
        return { x: this.x, y: this.y, w: this.w, h: this.h };
    }
}

class Projectile {
    constructor(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.w = 10;
        this.h = 10;
        this.vx = vx;
        this.vy = vy;
        this.active = true;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        if (this.x < 0 || this.x > GAME_WIDTH || this.y < 0 || this.y > GAME_HEIGHT) {
            this.active = false;
        }
    }
    draw(ctx) {
        ctx.fillStyle = '#ff3366';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ff3366';
        ctx.beginPath();
        ctx.arc(this.x + this.w/2, this.y + this.h/2, 5, 0, Math.PI*2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

class Turret {
    constructor(x, y, range) {
        this.x = x;
        this.y = y;
        this.w = 30;
        this.h = 30;
        this.range = range;
        this.lockTimer = 0;
        this.cooldown = 0;
        this.targetPos = null;
    }
    
    update(dt, target, activeSolids) {
        if (this.cooldown > 0) {
            this.cooldown -= dt;
            this.lockTimer = 0;
            this.targetPos = null;
            return;
        }

        let p1 = { x: this.x + this.w/2, y: this.y + this.h/2 };
        let p2 = { x: target.x + target.w/2, y: target.y + target.h/2 };
        
        let dx = p2.x - p1.x;
        let dy = p2.y - p1.y;
        let dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist <= this.range) {
            let blocked = false;
            for (let solid of activeSolids) {
                if (lineIntersectsRect(p1, p2, solid)) {
                    blocked = true;
                    break;
                }
            }
            
            if (!blocked) {
                this.targetPos = p2;
                this.lockTimer += dt;
                
                if (this.lockTimer >= 2.0) {
                    let dirX = dx / dist;
                    let dirY = dy / dist;
                    projectiles.push(new Projectile(p1.x, p1.y, dirX * 400, dirY * 400));
                    sfx.turret();
                    this.cooldown = 1.0;
                    this.lockTimer = 0;
                    this.targetPos = null;
                }
            } else {
                this.lockTimer = Math.max(0, this.lockTimer - dt);
                this.targetPos = null;
            }
        } else {
            this.lockTimer = Math.max(0, this.lockTimer - dt);
            this.targetPos = null;
        }
    }
    
    draw(ctx) {
        ctx.fillStyle = '#444';
        ctx.strokeStyle = '#ff3366';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff3366';
        ctx.fillRect(this.x, this.y, this.w, this.h);
        ctx.strokeRect(this.x, this.y, this.w, this.h);
        
        ctx.fillStyle = this.lockTimer > 0 ? '#ff0000' : '#880000';
        ctx.beginPath();
        ctx.arc(this.x + this.w/2, this.y + this.h/2, 5, 0, Math.PI*2);
        ctx.fill();
        ctx.shadowBlur = 0;

        if (this.targetPos && this.lockTimer > 0) {
            ctx.beginPath();
            ctx.moveTo(this.x + this.w/2, this.y + this.h/2);
            ctx.lineTo(this.targetPos.x, this.targetPos.y);
            ctx.strokeStyle = `rgba(255, 0, 0, ${this.lockTimer / 2})`;
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }
}

// --- LEVEL SETUP ---
let player, echo;
let echoUnlocked = false;
let echoSpawned = false;
let solids = [];
let spikes = [];
let turrets = [];
let projectiles = [];
let plates = [];
let doors = [];
let echoPickup = null;
let originalEchoPickup = null;
let exitZone = null;
let spawnPoint = {x: 80, y: 550};

const levels = [
    {
        instruction: "ROOM 1 (Tutorial - Movement): Jump over the spikes to reach the door.",
        setup: () => {
            solids = [
                {x: 0, y: 650, w: 500, h: 70}, 
                {x: 700, y: 650, w: 580, h: 70},
                {x: 0, y: 0, w: 1280, h: 70},   
                {x: 0, y: 0, w: 50, h: 720},    
                {x: 1230, y: 0, w: 50, h: 720}, 
            ];
            spikes = [
                {x: 500, y: 690, w: 200, h: 30}, // Pit
                {x: 300, y: 630, w: 100, h: 20}  // Jump spikes
            ];
            plates = []; doors = []; turrets = []; projectiles = [];
            echoPickup = null;
            spawnPoint = {x: 100, y: 550};
            exitZone = {x: 1100, y: 500, w: 50, h: 150};
        }
    },
    {
        instruction: "ROOM 2 (Tutorial - The Echo): Touch the Pill to unlock the Echo clone. Stand on the plate, spawn your Echo [E], then leave it to hold the door open!",
        setup: () => {
            solids = [
                {x: 0, y: 650, w: 1280, h: 70}, 
                {x: 0, y: 0, w: 1280, h: 70},   
                {x: 0, y: 0, w: 50, h: 720},    
                {x: 1230, y: 0, w: 50, h: 720}, 
                {x: 700, y: 70, w: 50, h: 300}, 
            ];
            spikes = [];
            plates = [{x: 300, y: 630, w: 60, h: 20, active: false, targetId: 'door1'}];
            doors = [{id: 'door1', x: 700, y: 370, w: 50, h: 280, open: false}];
            turrets = []; projectiles = [];
            echoPickup = {x: 200, y: 550, w: 20, h: 40};
            spawnPoint = {x: 100, y: 550};
            exitZone = {x: 1100, y: 500, w: 50, h: 150};
        }
    },
    {
        instruction: "ROOM 3 (Normal - Gravity): Obstacles too high? Press GRAV [G] to invert gravity and walk safely on the ceiling.",
        setup: () => {
            solids = [
                {x: 0, y: 650, w: 1280, h: 70}, 
                {x: 0, y: 0, w: 1280, h: 70},   
                {x: 0, y: 0, w: 50, h: 720},    
                {x: 1230, y: 0, w: 50, h: 720}, 
                {x: 600, y: 250, w: 50, h: 400}, 
                {x: 600, y: 70, w: 50, h: 80},   
            ];
            spikes = [
                {x: 400, y: 70, w: 150, h: 20},  
                {x: 400, y: 630, w: 150, h: 20}  
            ];
            plates = []; doors = []; turrets = []; projectiles = [];
            echoPickup = null;
            spawnPoint = {x: 100, y: 550};
            exitZone = {x: 1100, y: 500, w: 50, h: 150};
        }
    },
    {
        instruction: "ROOM 4 (Hard - Threats): Turrets lock onto the Active character. Hide behind cover or use the Echo to distract them.",
        setup: () => {
            solids = [
                {x: 0, y: 650, w: 400, h: 70},   
                {x: 800, y: 650, w: 480, h: 70}, 
                {x: 0, y: 0, w: 1280, h: 70},    
                {x: 0, y: 0, w: 50, h: 720},    
                {x: 1230, y: 0, w: 50, h: 720}, 
                {x: 1000, y: 70, w: 50, h: 430}, 
                {x: 400, y: 70, w: 50, h: 150},  
                {x: 700, y: 70, w: 50, h: 150},  
            ];
            spikes = [
                {x: 400, y: 690, w: 400, h: 30} 
            ];
            plates = [{x: 500, y: 70, w: 60, h: 20, active: false, targetId: 'door2'}];
            doors = [{id: 'door2', x: 1000, y: 500, w: 50, h: 150, open: false}];
            turrets = [new Turret(550, 600, 800)];
            projectiles = [];
            echoPickup = {x: 150, y: 550, w: 20, h: 40};
            spawnPoint = {x: 100, y: 550};
            exitZone = {x: 1150, y: 500, w: 50, h: 150};
        }
    },
    {
        instruction: "ROOM 5 (The Gauntlet): Combine Gravity and Turret dodging. The Echo can be spawned on the ceiling too!",
        setup: () => {
            solids = [
                {x: 0, y: 650, w: 1280, h: 70}, 
                {x: 0, y: 0, w: 1280, h: 70},   
                {x: 0, y: 0, w: 50, h: 720},    
                {x: 1230, y: 0, w: 50, h: 720}, 
                {x: 300, y: 200, w: 50, h: 450}, 
                {x: 600, y: 70, w: 50, h: 450},  
                {x: 900, y: 200, w: 50, h: 450}, 
            ];
            spikes = [
                {x: 350, y: 630, w: 250, h: 20}, 
                {x: 650, y: 70, w: 250, h: 20},  
            ];
            plates = [{x: 100, y: 630, w: 60, h: 20, active: false, targetId: 'door_5'}];
            doors = [{id: 'door_5', x: 1100, y: 70, w: 50, h: 580, open: false}];
            turrets = [new Turret(450, 100, 400), new Turret(750, 600, 400)];
            projectiles = [];
            echoPickup = {x: 1000, y: 550, w: 20, h: 40}; 
            spawnPoint = {x: 100, y: 550};
            exitZone = {x: 1150, y: 500, w: 50, h: 150};
        }
    },
    {
        instruction: "ROOM 6 (Drop Zone): A tight vertical maze. Use gravity drops mid-air to fall past laser sights before they fire.",
        setup: () => {
            solids = [
                {x: 0, y: 650, w: 1280, h: 70}, 
                {x: 0, y: 0, w: 1280, h: 70},   
                {x: 0, y: 0, w: 50, h: 720},    
                {x: 1230, y: 0, w: 50, h: 720}, 
                {x: 300, y: 70, w: 50, h: 400}, 
                {x: 600, y: 250, w: 50, h: 400}, 
                {x: 900, y: 70, w: 50, h: 400}, 
            ];
            spikes = [];
            plates = []; doors = [];
            turrets = [
                new Turret(450, 600, 600), 
                new Turret(750, 100, 600)
            ];
            projectiles = [];
            echoPickup = null; 
            spawnPoint = {x: 100, y: 550};
            exitZone = {x: 1150, y: 500, w: 50, h: 150};
        }
    },
    {
        instruction: "ROOM 7 (The Fake Out): Two pressure plates, but only one Echo? Figure out which plate you actually need to stand on.",
        setup: () => {
            solids = [
                {x: 0, y: 650, w: 1280, h: 70}, 
                {x: 0, y: 0, w: 1280, h: 70},   
                {x: 0, y: 0, w: 50, h: 720},    
                {x: 1230, y: 0, w: 50, h: 720}, 
                {x: 500, y: 70, w: 50, h: 300}, 
                {x: 500, y: 500, w: 50, h: 150},
                {x: 900, y: 70, w: 50, h: 580},
            ];
            spikes = [{x: 300, y: 630, w: 100, h: 20}];
            plates = [
                {x: 200, y: 630, w: 60, h: 20, active: false, targetId: 'door_7b'},
                {x: 400, y: 630, w: 60, h: 20, active: false, targetId: 'door_7a'}
            ];
            doors = [
                {id: 'door_7a', x: 500, y: 370, w: 50, h: 130, open: false},
                {id: 'door_7b', x: 900, y: 70, w: 50, h: 580, open: false}
            ];
            turrets = []; projectiles = [];
            echoPickup = {x: 100, y: 150, w: 20, h: 40}; 
            spawnPoint = {x: 100, y: 550};
            exitZone = {x: 1150, y: 500, w: 50, h: 150};
        }
    },
    {
        instruction: "ROOM 8 (The Floor is Lava): The floor is entirely spikes. You must complete this room entirely on the ceiling.",
        setup: () => {
            solids = [
                {x: 0, y: 650, w: 1280, h: 70}, 
                {x: 0, y: 0, w: 1280, h: 70},   
                {x: 0, y: 0, w: 50, h: 720},    
                {x: 1230, y: 0, w: 50, h: 720}, 
                {x: 400, y: 70, w: 50, h: 300}, 
                {x: 800, y: 70, w: 50, h: 300}, 
            ];
            spikes = [{x: 50, y: 630, w: 1180, h: 20}]; // Massive floor spikes
            plates = []; doors = [];
            turrets = [
                new Turret(600, 100, 400) // Watches the ceiling
            ];
            projectiles = [];
            echoPickup = null; 
            spawnPoint = {x: 100, y: 550};
            exitZone = {x: 1150, y: 70, w: 50, h: 150}; // Exit on the ceiling
        }
    },
    {
        instruction: "ROOM 9 (No Man's Land): A massive open room guarded by Turrets. Keep moving or hide behind floating blocks.",
        setup: () => {
            solids = [
                {x: 0, y: 650, w: 1280, h: 70}, 
                {x: 0, y: 0, w: 1280, h: 70},   
                {x: 0, y: 0, w: 50, h: 720},    
                {x: 1230, y: 0, w: 50, h: 720}, 
                {x: 300, y: 300, w: 100, h: 50}, // Floating cover
                {x: 700, y: 400, w: 100, h: 50}, // Floating cover
                {x: 900, y: 200, w: 100, h: 50}, // Floating cover
            ];
            spikes = [];
            plates = []; doors = [];
            turrets = [
                new Turret(400, 100, 800),
                new Turret(800, 600, 800),
                new Turret(1000, 100, 800)
            ];
            projectiles = [];
            echoPickup = null; 
            spawnPoint = {x: 100, y: 550};
            exitZone = {x: 1150, y: 500, w: 50, h: 150};
        }
    },
    {
        instruction: "ROOM 10 (The Finale): The ultimate test of Gravity, Echo manipulation, and Turret dodging. Good luck.",
        setup: () => {
            solids = [
                {x: 0, y: 650, w: 1280, h: 70}, 
                {x: 0, y: 0, w: 1280, h: 70},   
                {x: 0, y: 0, w: 50, h: 720},    
                {x: 1230, y: 0, w: 50, h: 720}, 
                {x: 200, y: 70, w: 50, h: 400}, 
                {x: 400, y: 250, w: 50, h: 400}, 
                {x: 600, y: 70, w: 50, h: 400}, 
                {x: 800, y: 250, w: 50, h: 400}, 
                {x: 1000, y: 70, w: 50, h: 580}, 
            ];
            spikes = [
                {x: 50, y: 630, w: 150, h: 20}, // Start trap
                {x: 450, y: 70, w: 150, h: 20},
                {x: 650, y: 630, w: 150, h: 20},
            ];
            plates = [
                {x: 300, y: 630, w: 60, h: 20, active: false, targetId: 'door_10'}
            ];
            doors = [
                {id: 'door_10', x: 1000, y: 70, w: 50, h: 580, open: false}
            ];
            turrets = [
                new Turret(300, 100, 500),
                new Turret(500, 600, 500),
                new Turret(700, 100, 500),
                new Turret(900, 600, 500)
            ];
            projectiles = [];
            echoPickup = {x: 100, y: 70, w: 20, h: 40}; // Ceiling pickup
            spawnPoint = {x: 100, y: 550};
            exitZone = {x: 1150, y: 300, w: 50, h: 150};
        }
    }
];

function loadRoom(index) {
    if (index >= levels.length) {
        showMessage("YOU WIN!");
        sfx.exit();
        setTimeout(() => {
            lives = 3;
            rewardPoints = 0;
            currentRoomIndex = 0;
            loadRoom(0);
        }, 3000);
        return;
    }
    
    currentRoomIndex = index;
    uiRoomNumber.innerText = currentRoomIndex + 1;
    
    let lvl = levels[index];
    uiInstructions.innerText = lvl.instruction;
    lvl.setup();
    
    originalEchoPickup = echoPickup ? {...echoPickup} : null; 
    
    // Hard reset arrays and keys
    for (let k in keys) keys[k] = false;
    for (let k in justPressed) justPressed[k] = false;
    
    respawnPlayer();
    updateUI();
}

function respawnPlayer() {
    player = new Character(spawnPoint.x, spawnPoint.y, '#00ffff');
    player.isActive = true;
    echoUnlocked = false;
    echoSpawned = false;
    echo = null;
    if (originalEchoPickup) echoPickup = {...originalEchoPickup};
    projectiles = [];
    for (let t of turrets) {
        t.lockTimer = 0;
        t.targetPos = null;
        t.cooldown = 0;
    }
}

function updateUI() {
    uiScore.innerText = rewardPoints;
    uiLives.innerText = lives;
    if (echoUnlocked) {
        uiEchoLock.className = 'highlight-cyan';
        uiEchoLock.innerText = 'READY [E]';
    } else {
        uiEchoLock.className = 'locked';
        uiEchoLock.innerText = 'LOCKED';
    }
}

function showMessage(msg) {
    uiMessage.innerText = msg;
    uiMessage.style.opacity = 1;
    setTimeout(() => {
        uiMessage.style.opacity = 0;
    }, 2000);
}

function handleDeath(entity) {
    sfx.damage();
    projectiles = [];
    for (let t of turrets) {
        t.lockTimer = 0;
        t.targetPos = null;
        t.cooldown = 0;
    }
    for (let k in keys) keys[k] = false;
    for (let k in justPressed) justPressed[k] = false;

    if (entity === player) {
        lives--;
        updateUI();
        if (lives <= 0) {
            showMessage("GAME OVER");
            setTimeout(() => {
                lives = 3;
                rewardPoints = 0;
                currentRoomIndex = 0;
                loadRoom(0);
            }, 1000);
        } else {
            showMessage("DEATH");
            respawnPlayer();
        }
    } else if (entity === echo) {
        showMessage("ECHO DESTROYED");
        echoSpawned = false;
        echo = null;
        echoUnlocked = false;
        if (originalEchoPickup) echoPickup = {...originalEchoPickup}; 
        player.isActive = true;
        updateUI();
    }
}

function update(time) {
    let rawDt = (time - lastTime) / 1000;
    lastTime = time;
    
    if (rawDt > 0.1) rawDt = 0.1; 

    if (isJustPressed('p') || isJustPressed('Escape')) {
        isPaused = !isPaused;
        uiPauseMenu.style.display = isPaused ? 'block' : 'none';
    }

    let dt = isPaused ? 0 : rawDt;

    if (!isPaused) {
        if (isJustPressed('r')) {
            handleDeath(player); 
        }

        if (echoUnlocked && isJustPressed('e')) {
            if (!echoSpawned) {
                echo = new Character(player.x, player.y, '#cc00ff');
                echo.gravityDir = player.gravityDir;
                echoSpawned = true;
            }
            player.isActive = !player.isActive;
            echo.isActive = !echo.isActive;
            sfx.echo();
        }

        let activeSolids = [...solids];
        for (let d of doors) {
            if (!d.open) activeSolids.push(d);
        }

        player.update(dt, activeSolids);
        
        let echoSolids = [...activeSolids];
        if (exitZone) echoSolids.push(exitZone); // Exit is solid wall for Echo
        if (echoSpawned) echo.update(dt, echoSolids);

        let activeTarget = (echoSpawned && echo.isActive) ? echo : player;

        for (let t of turrets) {
            t.update(dt, activeTarget, activeSolids);
        }

        for (let i = projectiles.length - 1; i >= 0; i--) {
            let proj = projectiles[i];
            proj.update(dt);
            
            for (let s of activeSolids) {
                if (rectIntersect(proj, s)) proj.active = false;
            }
            
            let pBounds = player.getBounds();
            
            if (rectIntersect(proj, pBounds)) {
                proj.active = false;
                handleDeath(player);
            } else if (echoSpawned && rectIntersect(proj, echo.getBounds())) {
                proj.active = false;
                handleDeath(echo);
            }
            
            if (!proj.active) projectiles.splice(i, 1);
        }

        let pBounds = player.getBounds();
        let eBounds = echoSpawned ? echo.getBounds() : null;

        for (let s of spikes) {
            if (rectIntersect(pBounds, s)) {
                handleDeath(player);
            } else if (eBounds && rectIntersect(eBounds, s)) {
                handleDeath(echo);
            }
        }

        if (echoPickup && rectIntersect(pBounds, echoPickup)) {
            echoUnlocked = true;
            echoPickup = null;
            updateUI();
            sfx.pill();
            showMessage("ECHO UNLOCKED!");
        }

        for (let p of plates) {
            p.active = false;
            if (rectIntersect(pBounds, p)) p.active = true;
            if (eBounds && rectIntersect(eBounds, p)) p.active = true;
        }

        for (let d of doors) {
            let linkedPlate = plates.find(p => p.targetId === d.id);
            if (linkedPlate) {
                d.open = linkedPlate.active;
            }
        }

        if (exitZone && rectIntersect(pBounds, exitZone)) {
            rewardPoints += 100;
            if (!echoSpawned) rewardPoints += 50; 
            updateUI();
            sfx.exit();
            
            projectiles = [];
            for (let t of turrets) {
                t.lockTimer = 0;
                t.targetPos = null;
                t.cooldown = 0;
            }

            loadRoom(currentRoomIndex + 1);
        }
    }

    draw();
    if (!animationFrameId) {
        animationFrameId = requestAnimationFrame(update);
    } else {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = requestAnimationFrame(update);
    }
}

function drawFogOfWar() {
    fogCtx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    fogCtx.globalCompositeOperation = 'source-over';
    fogCtx.fillStyle = 'rgba(0, 0, 0, 0.95)';
    fogCtx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    fogCtx.globalCompositeOperation = 'destination-out';
    
    let activeChar = (echoSpawned && echo.isActive) ? echo : player;
    if (activeChar) {
        let cx = activeChar.x + activeChar.w/2;
        let cy = activeChar.y + activeChar.h/2;
        
        let grad = fogCtx.createRadialGradient(cx, cy, 0, cx, cy, 250);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        fogCtx.fillStyle = grad;
        fogCtx.beginPath();
        fogCtx.arc(cx, cy, 250, 0, Math.PI*2);
        fogCtx.fill();
        
        let coneLength = 400;
        let coneAngle = Math.PI / 4; 
        let baseAngle = activeChar.facingDir === 1 ? 0 : Math.PI;
        
        let coneGrad = fogCtx.createRadialGradient(cx, cy, 0, cx, cy, coneLength);
        coneGrad.addColorStop(0, 'rgba(255,255,255,0.8)');
        coneGrad.addColorStop(1, 'rgba(255,255,255,0)');
        fogCtx.fillStyle = coneGrad;
        fogCtx.beginPath();
        fogCtx.moveTo(cx, cy);
        fogCtx.arc(cx, cy, coneLength, baseAngle - coneAngle, baseAngle + coneAngle);
        fogCtx.lineTo(cx, cy);
        fogCtx.fill();
    }
}

function draw() {
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.strokeStyle = '#111122';
    ctx.lineWidth = 1;
    for(let i=0; i<GAME_WIDTH; i+=40) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, GAME_HEIGHT); ctx.stroke();
    }
    for(let i=0; i<GAME_HEIGHT; i+=40) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(GAME_WIDTH, i); ctx.stroke();
    }

    ctx.fillStyle = '#0f0f1a';
    ctx.strokeStyle = '#0055ff';
    ctx.lineWidth = 2;
    for (let s of solids) {
        ctx.fillRect(s.x, s.y, s.w, s.h);
        ctx.strokeRect(s.x, s.y, s.w, s.h);
    }

    if (echoSpawned) echo.draw(ctx);
    if (player) player.draw(ctx);

    drawFogOfWar();
    ctx.drawImage(fogCanvas, 0, 0);

    ctx.fillStyle = '#ff0033';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ff0033';
    for (let s of spikes) {
        ctx.beginPath();
        for (let x = s.x; x < s.x + s.w; x += 10) {
            ctx.moveTo(x, s.y + s.h);
            ctx.lineTo(x + 5, s.y);
            ctx.lineTo(x + 10, s.y + s.h);
        }
        ctx.fill();
    }
    ctx.shadowBlur = 0;

    for (let p of plates) {
        ctx.fillStyle = p.active ? '#00ffcc' : '#333';
        ctx.shadowBlur = p.active ? 15 : 0;
        ctx.shadowColor = '#00ffcc';
        ctx.fillRect(p.x, p.y + (p.active ? 10 : 0), p.w, p.h - (p.active ? 10 : 0));
        ctx.shadowBlur = 0;
    }

    for (let d of doors) {
        if (!d.open) {
            ctx.fillStyle = '#444';
            ctx.strokeStyle = '#00ffcc';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#00ffcc';
            ctx.fillRect(d.x, d.y, d.w, d.h);
            ctx.strokeRect(d.x, d.y, d.w, d.h);
            ctx.shadowBlur = 0;
        }
    }

    for (let t of turrets) t.draw(ctx);
    for (let p of projectiles) p.draw(ctx);

    if (echoPickup) {
        ctx.fillStyle = '#cc00ff';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#cc00ff';
        
        let py = echoPickup.y + Math.sin(Date.now()/200)*5;
        let r = echoPickup.w / 2;
        ctx.beginPath();
        ctx.arc(echoPickup.x + r, py + r, r, Math.PI, 0);
        ctx.lineTo(echoPickup.x + echoPickup.w, py + echoPickup.h - r);
        ctx.arc(echoPickup.x + r, py + echoPickup.h - r, r, 0, Math.PI);
        ctx.closePath();
        ctx.fill();
        
        ctx.shadowBlur = 0;
    }

    if (exitZone) {
        ctx.strokeStyle = '#ffff00';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ffff00';
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(exitZone.x, exitZone.y, exitZone.w, exitZone.h);
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255, 255, 0, 0.2)';
        ctx.fillRect(exitZone.x, exitZone.y, exitZone.w, exitZone.h);
        ctx.shadowBlur = 0;
    }
}

// Start Game
window.addEventListener('click', () => {
    if(audioCtx.state === 'suspended') audioCtx.resume();
}, {once:true}); // Ensure audio context can start on first click

loadRoom(0);
animationFrameId = requestAnimationFrame((time) => {
    lastTime = time;
    update(time);
});
