/**
 * Enhanced main game script
 */
class Game {
    constructor() {
        // Initialize sub-systems
        this.audio = new AudioSystem();
        this.leaderboard = new LeaderboardSystem();
        
        // Create menu system with reference to this game
        this.menu = new MenuSystem(this);
        
        // Show title screen initially
        this.menu.showScreen('title');
        
        // Initialize variables for game state
        this.isRunning = false;
        this.stepCounter = 0;
        
        // Set up in-game menu button
        document.getElementById('menu-btn').addEventListener('click', () => {
            if (this.isRunning) {
                this.menu.showScreen('title');
                this.isRunning = false;
            }
        });
        
        console.log('JESP - A Life Simulator initialized');
    }
    
    startGame() {
        console.log('Starting game');
        this.isRunning = true;
        
        // Initialize game components
        this.jesp = new Character(this);
        this.controls = new Controls(this.jesp);
        this.stressEvents = new StressEvents(this);
        
        // Create interactive objects
        this.setupInteractiveObjects();
        
        // Create spectators
        this.setupSpectators();
        
        // Start game loop
        this.startGameLoop();
    }
    
    setupInteractiveObjects() {
        // Set up soda can
        this.sodaCan = document.getElementById('soda-can');
        this.placeSodaCan();
        
        // Set up tumble bush
        this.tumbleBush = document.getElementById('tumble-bush');
        this.startBushAnimation();
        
        // Check for collisions with soda can
        setInterval(() => {
            if (this.isRunning && isColliding(this.jesp.element, this.sodaCan)) {
                this.kickCan();
            }
        }, 100);
    }
    
    placeSodaCan() {
        // Get boundary
        const boundary = document.getElementById('game-boundary');
        const boundaryRect = boundary.getBoundingClientRect();
        
        // Random position within boundary
        const x = boundaryRect.left + Math.random() * (boundaryRect.width - 20);
        const y = boundaryRect.top + Math.random() * (boundaryRect.height - 30);
        
        this.sodaCan.style.left = `${x}px`;
        this.sodaCan.style.top = `${y}px`;
    }
    
    kickCan() {
        // Current can position
        const canRect = this.sodaCan.getBoundingClientRect();
        
        // Random kick direction
        const angle = Math.random() * Math.PI * 2;
        const distance = 50 + Math.random() * 100;
        
        // Calculate new position
        let newX = canRect.left + Math.cos(angle) * distance;
        let newY = canRect.top + Math.sin(angle) * distance;
        
        // Get boundary
        const boundary = document.getElementById('game-boundary');
        const boundaryRect = boundary.getBoundingClientRect();
        
        // Keep within boundary
        newX = Math.max(boundaryRect.left + 5, Math.min(boundaryRect.right - 20, newX));
        newY = Math.max(boundaryRect.top + 5, Math.min(boundaryRect.bottom - 30, newY));
        
        // Apply new position
        this.sodaCan.style.left = `${newX}px`;
        this.sodaCan.style.top = `${newY}px`;
        
        // Play sound
        if (this.audio) {
            this.audio.playCanKick();
        }
    }
    
    startBushAnimation() {
        // Occasionally roll the bush across the screen
        setInterval(() => {
            if (this.isRunning && Math.random() < 0.2) {
                this.rollBush();
            }
        }, 10000);
    }
    
    rollBush() {
        // Get boundary
        const boundary = document.getElementById('game-boundary');
        const boundaryRect = boundary.getBoundingClientRect();
        
        // Start position (left or right of screen)
        const startFromLeft = Math.random() < 0.5;
        let startX, endX;
        
        if (startFromLeft) {
            startX = boundaryRect.left - 50;
            endX = boundaryRect.right + 50;
        } else {
            startX = boundaryRect.right + 50;
            endX = boundaryRect.left - 50;
        }
        
        // Random Y position
        const y = boundaryRect.top + Math.random() * (boundaryRect.height - 40);
        
        // Set initial position
        this.tumbleBush.style.left = `${startX}px`;
        this.tumbleBush.style.top = `${y}px`;
        
        // Add rolling class
        this.tumbleBush.classList.add('rolling');
        
        // Animate
        const duration = 8000 + Math.random() * 4000;
        
        this.tumbleBush.animate([
            { left: `${startX}px`, transform: 'rotate(0deg)' },
            { left: `${endX}px`, transform: 'rotate(1440deg)' }
        ], {
            duration: duration,
            easing: 'linear'
        });
        
        // Remove class after animation
        setTimeout(() => {
            this.tumbleBush.classList.remove('rolling');
        }, duration);
    }
    
    setupSpectators() {
        this.spectators = document.querySelectorAll('.spectator');
        
        // Occasionally have spectators react
        setInterval(() => {
            if (this.isRunning && Math.random() < 0.3) {
                this.spectatorReact();
            }
        }, 12000);
    }
    
    spectatorReact() {
        // Pick a random spectator
        const index = Math.floor(Math.random() * this.spectators.length);
        const spectator = this.spectators[index];
        
        // Laugh or clap
        if (Math.random() < 0.6) {
            spectator.classList.add('laughing');
            if (this.audio) this.audio.playRandomLaugh();
            setTimeout(() => spectator.classList.remove('laughing'), 3000);
        } else {
            spectator.classList.add('clapping');
            if (this.audio) this.audio.playRandomClap();
            setTimeout(() => spectator.classList.remove('clapping'), 3000);
        }
    }
    
    startGameLoop() {
        // Main game loop
        this.gameLoopInterval = setInterval(() => {
            // Update step counter
            if (this.jesp) {
                this.stepCounter = this.jesp.getStepCount();
            }
            
            // Any other recurring game logic updates
        }, 1000 / 60);
    }
    
    resetGame() {
        console.log('Resetting game');
        
        // Clear game loop
        if (this.gameLoopInterval) {
            clearInterval(this.gameLoopInterval);
        }
        
        // Reset step counter
        if (this.jesp) {
            this.jesp.resetStepCount();
        }
        
        this.stepCounter = 0;
        this.isRunning = false;
    }
}

// Initialize the game when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
});
