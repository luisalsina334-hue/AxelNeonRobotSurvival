class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width = window.innerWidth;
        this.height = this.canvas.height = window.innerHeight;

        this.input = new InputHandler();
        this.player = new Player(this);
        this.enemies = [];
        this.bullets = [];
        this.particles = [];

        this.score = 0;
        this.currentLevelIndex = 0;
        this.level = 1;
        this.enemiesDefeated = 0;
        this.levelGoal = 10;
        this.gameOver = false;
        this.levelTransitioning = false;
        this.animationId = null;

        this.screenShake = new ScreenShake();
        this.soundManager = new SoundManager();

        // Level Configuration
        this.levels = [
            { goal: 10, spawnRate: 2000, enemySpeed: 2, enemyHp: 30, color: '#ff0066' }, // Level 1
            { goal: 15, spawnRate: 1500, enemySpeed: 3, enemyHp: 40, color: '#ff6600' }, // Level 2
            { goal: 20, spawnRate: 1200, enemySpeed: 4, enemyHp: 50, color: '#ffcc00' }, // Level 3
            { goal: 25, spawnRate: 1000, enemySpeed: 5, enemyHp: 60, color: '#ccff00' }, // Level 4
            { goal: 30, spawnRate: 800, enemySpeed: 6, enemyHp: 80, color: '#00ff66' }   // Level 5
        ];

        // UI Elements
        this.scoreUi = document.getElementById('score');
        this.levelUi = document.getElementById('level');
        this.enemiesLeftUi = document.getElementById('enemies-left');
        this.healthFill = document.getElementById('health-fill');
        this.startScreen = document.getElementById('start-screen');
        this.gameOverScreen = document.getElementById('game-over-screen');
        this.levelScreen = document.getElementById('level-screen');
        this.levelTitle = document.getElementById('level-title');
        this.finalScoreUi = document.getElementById('final-score');

        // Event Listeners for Resize
        window.addEventListener('resize', () => {
            this.width = this.canvas.width = window.innerWidth;
            this.height = this.canvas.height = window.innerHeight;
        });

        // Setup Buttons
        document.getElementById('start-btn').addEventListener('click', () => {
            this.startScreen.classList.add('hidden');
            this.startScreen.classList.remove('active');
            this.start();
        });

        document.getElementById('restart-btn').addEventListener('click', () => {
            this.gameOverScreen.classList.add('hidden');
            this.gameOverScreen.classList.remove('active');
            this.restart();
        });
    }

    start() {
        this.isRunning = true;
        this.level = this.currentLevelIndex + 1;
        const currentConfig = this.levels[Math.min(this.currentLevelIndex, this.levels.length - 1)];
        this.levelGoal = currentConfig.goal;
        this.enemiesDefeated = 0;

        this.gameLoop();
        this.startSpawner();
        this.updateUI();
    }

    startSpawner() {
        if (this.enemySpawner) clearInterval(this.enemySpawner);
        const currentConfig = this.levels[Math.min(this.currentLevelIndex, this.levels.length - 1)];
        // Spawning gets faster even after max defined levels
        let rate = currentConfig.spawnRate;
        if (this.currentLevelIndex >= this.levels.length) {
            rate = Math.max(200, rate - (this.currentLevelIndex - this.levels.length + 1) * 100);
        }

        this.enemySpawner = setInterval(() => this.spawnEnemy(), rate);
    }

    restart() {
        this.player = new Player(this);
        this.enemies = [];
        this.bullets = [];
        this.particles = [];
        this.score = 0;
        this.currentLevelIndex = 0;
        this.level = 1;
        this.gameOver = false;
        this.levelTransitioning = false;
        this.updateUI();
        this.start();
    }

    stop() {
        this.isRunning = false;
        clearInterval(this.enemySpawner);
        cancelAnimationFrame(this.animationId);
        this.gameOver = true;
        this.finalScoreUi.textContent = this.score;
        this.gameOverScreen.classList.remove('hidden');
        this.gameOverScreen.classList.add('active');
    }

    update(deltaTime) {
        if (!this.isRunning) return;

        this.screenShake.update(deltaTime);
        this.player.update(deltaTime);

        // Update Bullets
        this.bullets.forEach((bullet, index) => {
            bullet.update(deltaTime);
            if (bullet.markedForDeletion) this.bullets.splice(index, 1);
        });

        // Update Enemies
        this.enemies.forEach((enemy, index) => {
            enemy.update(deltaTime);
            if (enemy.markedForDeletion) this.enemies.splice(index, 1);

            // Collision with Player
            if (this.checkCollision(this.player, enemy)) {
                this.player.takeDamage(10);
                enemy.markedForDeletion = true;
                this.addExplosion(enemy.x, enemy.y);
                this.screenShake.trigger(10, 200);
            }

            // Collision with Bullets
            this.bullets.forEach((bullet, bIndex) => {
                if (this.checkCollision(bullet, enemy)) {
                    enemy.takeDamage(bullet.damage);
                    bullet.markedForDeletion = true;
                    this.addExplosion(bullet.x, bullet.y, 'small');
                    this.soundManager.play('hit');
                }
            });
        });

        // Update Particles
        this.particles.forEach((particle, index) => {
            particle.update(deltaTime);
            if (particle.markedForDeletion) this.particles.splice(index, 1);
        });

        if (this.player.hp <= 0) this.stop();

        this.checkLevelProgress();
        this.updateUI();
    }

    checkLevelProgress() {
        if (this.enemiesDefeated >= this.levelGoal && !this.levelTransitioning) {
            this.nextLevel();
        }
    }

    nextLevel() {
        this.levelTransitioning = true;
        this.currentLevelIndex++;

        // Show Level Screen
        this.levelTitle.textContent = `LEVEL ${this.currentLevelIndex + 1}`;
        this.levelScreen.classList.remove('hidden');
        this.levelScreen.classList.add('active');

        // Pause Spawning
        clearInterval(this.enemySpawner);

        // Wait then start next level
        setTimeout(() => {
            this.levelScreen.classList.add('hidden');
            this.levelScreen.classList.remove('active');

            this.level = this.currentLevelIndex + 1;
            const config = this.getParamForLevel();
            this.levelGoal = config.goal;
            this.enemiesDefeated = 0;
            this.levelTransitioning = false;

            this.player.hp = Math.min(this.player.hp + 20, this.player.maxHp); // Heal slightly
            this.startSpawner();
            this.soundManager.play('levelup');
        }, 2000);
    }

    getParamForLevel() {
        if (this.currentLevelIndex < this.levels.length) {
            return this.levels[this.currentLevelIndex];
        } else {
            // Procedural difficulty for levels beyond config
            const last = this.levels[this.levels.length - 1];
            const extra = this.currentLevelIndex - this.levels.length + 1;
            return {
                goal: last.goal + extra * 5,
                spawnRate: Math.max(200, last.spawnRate - extra * 50),
                enemySpeed: last.enemySpeed + extra * 0.5,
                enemyHp: last.enemyHp + extra * 10,
                color: `hsl(${Math.random() * 360}, 100%, 50%)`
            };
        }
    }

    draw() {
        // Clear Screen with trail effect
        this.ctx.fillStyle = 'rgba(13, 13, 21, 0.2)'; // Trail effect
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.save();
        this.ctx.translate(this.screenShake.x, this.screenShake.y);

        this.player.draw(this.ctx);
        this.bullets.forEach(bullet => bullet.draw(this.ctx));
        this.enemies.forEach(enemy => enemy.draw(this.ctx));
        this.particles.forEach(particle => particle.draw(this.ctx));

        this.ctx.restore();
    }

    gameLoop(timestamp) {
        if (!this.lastTime) this.lastTime = timestamp;
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;

        this.update(deltaTime);
        this.draw();

        if (this.isRunning) {
            this.animationId = requestAnimationFrame(this.gameLoop.bind(this));
        }
    }

    spawnEnemy() {
        if (!this.isRunning || this.levelTransitioning) return;
        // Spawn edges logic
        const edge = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left
        let x, y;
        switch (edge) {
            case 0: x = Math.random() * this.width; y = -50; break;
            case 1: x = this.width + 50; y = Math.random() * this.height; break;
            case 2: x = Math.random() * this.width; y = this.height + 50; break;
            case 3: x = -50; y = Math.random() * this.height; break;
        }

        const config = this.getParamForLevel();
        this.enemies.push(new Enemy(this, x, y, config));
    }

    checkCollision(rect1, rect2) {
        return (
            rect1.x < rect2.x + rect2.width &&
            rect1.x + rect1.width > rect2.x &&
            rect1.y < rect2.y + rect2.height &&
            rect1.y + rect1.height > rect2.y
        );
    }

    addExplosion(x, y, type = 'normal') {
        const count = type === 'small' ? 5 : 20;
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(this, x, y));
        }
        this.soundManager.play('explosion');
    }

    updateUI() {
        this.scoreUi.textContent = this.score;
        this.levelUi.textContent = this.level;
        this.enemiesLeftUi.textContent = Math.max(0, this.levelGoal - this.enemiesDefeated);
        const hpPercent = Math.max(0, (this.player.hp / this.player.maxHp) * 100);
        this.healthFill.style.width = `${hpPercent}%`;
    }
}

class InputHandler {
    constructor() {
        this.keys = {};
        this.mouse = { x: 0, y: 0, down: false };

        window.addEventListener('keydown', e => this.keys[e.key.toLowerCase()] = true);
        window.addEventListener('keyup', e => this.keys[e.key.toLowerCase()] = false);
        window.addEventListener('mousemove', e => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
        window.addEventListener('mousedown', () => this.mouse.down = true);
        window.addEventListener('mouseup', () => this.mouse.down = false);
    }
}

class Player {
    constructor(game) {
        this.game = game;
        this.width = 40;
        this.height = 40;
        this.x = game.width / 2 - this.width / 2;
        this.y = game.height / 2 - this.height / 2;
        this.speed = 0.5;
        this.maxSpeed = 5;
        this.vx = 0;
        this.vy = 0;
        this.friction = 0.9;
        this.angle = 0;

        this.maxHp = 100;
        this.hp = this.maxHp;

        this.shootTimer = 0;
        this.shootInterval = 150; // ms
        this.color = '#00ffcc';
    }

    update(deltaTime) {
        // Movement Physics
        if (this.game.input.keys['w']) this.vy -= this.speed;
        if (this.game.input.keys['s']) this.vy += this.speed;
        if (this.game.input.keys['a']) this.vx -= this.speed;
        if (this.game.input.keys['d']) this.vx += this.speed;

        this.x += this.vx;
        this.y += this.vy;

        this.vx *= this.friction;
        this.vy *= this.friction;

        // Boundary constrained
        if (this.x < 0) this.x = 0;
        if (this.x > this.game.width - this.width) this.x = this.game.width - this.width;
        if (this.y < 0) this.y = 0;
        if (this.y > this.game.height - this.height) this.y = this.game.height - this.height;

        // Rotation
        const dx = this.game.input.mouse.x - (this.x + this.width / 2);
        const dy = this.game.input.mouse.y - (this.y + this.height / 2);
        this.angle = Math.atan2(dy, dx);

        // Shooting
        if (this.game.input.mouse.down) {
            if (this.shootTimer > this.shootInterval) {
                this.shoot();
                this.shootTimer = 0;
            } else {
                this.shootTimer += deltaTime;
            }
        } else {
            this.shootTimer = this.shootInterval; // Reset so first click is instant
        }
    }

    shoot() {
        const bulletSpeed = 10;
        const vx = Math.cos(this.angle) * bulletSpeed;
        const vy = Math.sin(this.angle) * bulletSpeed;
        this.game.bullets.push(new Projectile(
            this.game,
            this.x + this.width / 2,
            this.y + this.height / 2,
            vx, vy
        ));
        this.game.soundManager.play('shoot');
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.rotate(this.angle);

        // Body
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);

        // Turret/Cannon
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, -5, 30, 10);

        ctx.restore();
    }

    takeDamage(amount) {
        this.hp -= amount;
        this.game.addExplosion(this.x, this.y, 'small');
    }
}

class Enemy {
    constructor(game, x, y, config) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 30;
        this.speed = (config.enemySpeed || 2) + Math.random();
        this.hp = config.enemyHp || 30;
        this.color = config.color || '#ff0066';
        this.markedForDeletion = false;
        this.angle = 0;
    }

    update(deltaTime) {
        const dx = this.game.player.x - this.x;
        const dy = this.game.player.y - this.y;
        this.angle = Math.atan2(dy, dx);

        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;

        if (this.hp <= 0) {
            this.markedForDeletion = true;
            this.game.score += 100;
            this.game.enemiesDefeated++;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.rotate(this.angle);

        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        // Eye
        ctx.fillStyle = '#fff';
        ctx.fillRect(5, -5, 10, 10);

        ctx.restore();
    }

    takeDamage(amount) {
        this.hp -= amount;
    }
}

class Projectile {
    constructor(game, x, y, vx, vy) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.width = 10;
        this.height = 10;
        this.damage = 10;
        this.markedForDeletion = false;
        this.color = '#ffff00';
    }

    update(deltaTime) {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0 || this.x > this.game.width ||
            this.y < 0 || this.y > this.game.height) {
            this.markedForDeletion = true;
        }
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 5;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Particle {
    constructor(game, x, y) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = (Math.random() - 0.5) * 10;
        this.life = 1.0;
        this.decay = Math.random() * 0.05 + 0.02;
        this.markedForDeletion = false;
        this.color = `hsl(${Math.random() * 60 + 10}, 100%, 50%)`; // Fire colors
        this.size = Math.random() * 5 + 2;
    }

    update(deltaTime) {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
        if (this.life <= 0) this.markedForDeletion = true;
    }

    draw(ctx) {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

class SoundManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }

    play(type) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        switch (type) {
            case 'shoot':
                osc.type = 'square';
                osc.frequency.setValueAtTime(440, this.ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(110, this.ctx.currentTime + 0.1);
                gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
                osc.start();
                osc.stop(this.ctx.currentTime + 0.1);
                break;
            case 'explosion':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(100, this.ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + 0.3);
                gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
                osc.start();
                osc.stop(this.ctx.currentTime + 0.3);
                break;
            case 'hit':
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(200, this.ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.1);
                gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
                osc.start();
                osc.stop(this.ctx.currentTime + 0.1);
                break;
            case 'levelup':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(400, this.ctx.currentTime);
                osc.frequency.linearRampToValueAtTime(800, this.ctx.currentTime + 0.2);
                osc.frequency.linearRampToValueAtTime(1200, this.ctx.currentTime + 0.4);
                gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
                gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.6);
                osc.start();
                osc.stop(this.ctx.currentTime + 0.6);
                break;
        }
    }
}

class ScreenShake {
    constructor() {
        this.intensity = 0;
        this.duration = 0;
        this.x = 0;
        this.y = 0;
    }

    trigger(intensity, duration) {
        this.intensity = intensity;
        this.duration = duration;
    }

    update(deltaTime) {
        if (this.duration > 0) {
            this.duration -= deltaTime;
            const magnitude = (this.duration > 0) ? this.intensity : 0;
            this.x = (Math.random() - 0.5) * magnitude;
            this.y = (Math.random() - 0.5) * magnitude;
        } else {
            this.x = 0;
            this.y = 0;
        }
    }
}

// Start Game
const game = new Game();
