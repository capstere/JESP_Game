/**
 * Enhanced Character module
 */
class Character {
    constructor(game) {
        this.game = game;
        this.element = document.getElementById('jesp');
        this.sighBubble = document.querySelector('.sigh-bubble');
        this.character = document.querySelector('.character');
        this.rainCloud = document.querySelector('.rain-cloud');
        
        // Get game boundary
        this.boundary = document.getElementById('game-boundary');
        this.boundaryRect = this.boundary.getBoundingClientRect();
        
        // Position state
        this.x = window.innerWidth / 2;
        this.y = window.innerHeight / 2;
        
        // Movement state
        this.speed = 3; // Slow movement to feel burdened
        this.isMoving = false;
        this.movingDirection = { x: 0, y: 0 };
        
        // Character state
        this.isSighing = false;
        
        // Step counter
        this.stepCount = 0;
        this.stepCountElement = document.getElementById('step-count');
        this.stepMessageElement = document.getElementById('step-message');
        this.stepMessages = [
            "Are you... proud?",
            "Is this fulfilling?",
            "Keep going. Or don't.",
            "What's the point?",
            "Not bad. Not good either.",
            "At least you're consistent.",
            "One step closer to... something?"
        ];
        
        // Initialize position
        this.updatePosition();
        
        // Create raindrops
        this.createRaindrops();
        
        // Set up periodic sighing
        this.setupPeriodicSighing();
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.handleResize();
        });
    }
    
    updatePosition() {
        // Get current boundary coordinates
        this.boundaryRect = this.boundary.getBoundingClientRect();
        
        // Ensure JESP stays within game boundary
        const characterWidth = 40;
        const characterHeight = 80;
        
        this.x = Math.max(
            this.boundaryRect.left + characterWidth/2, 
            Math.min(this.boundaryRect.right - characterWidth/2, this.x)
        );
        
        this.y = Math.max(
            this.boundaryRect.top + characterHeight/2, 
            Math.min(this.boundaryRect.bottom - characterHeight/2, this.y)
        );
        
        // Apply position
        this.element.style.left = `${this.x}px`;
        this.element.style.top = `${this.y}px`;
    }
    
    move(dirX, dirY) {
        // Update moving state
        const wasMoving = this.isMoving;
        this.isMoving = dirX !== 0 || dirY !== 0;
        this.movingDirection = { x: dirX, y: dirY };
        
        // Apply movement animation class if moving
        if (this.isMoving) {
            this.character.classList.add('moving');
            
            // If we just started moving, play footstep
            if (!wasMoving && this.game.audio) {
                this.game.audio.playFootstep();
            }
            
            // Increment step counter
            this.incrementStepCount();
            
            // Randomly play groan
            if (Math.random() < 0.05 && this.game.audio) {
                this.game.audio.playRandomGroan();
            }
        } else {
            this.character.classList.remove('moving');
        }
        
        // Move at appropriate speed
        this.x += dirX * this.speed;
        this.y += dirY * this.speed;
        
        // Update position (will handle boundary checking)
        this.updatePosition();
    }
    
    incrementStepCount() {
        this.stepCount++;
        this.stepCountElement.textContent = this.stepCount;
        
        // Update message occasionally
        if (this.stepCount % 50 === 0) {
            const randomMessage = this.stepMessages[Math.floor(Math.random() * this.stepMessages.length)];
            this.stepMessageElement.textContent = randomMessage;
        }
    }
    
    createRaindrops() {
        // Add a few raindrops under the cloud
        for (let i = 0; i < 3; i++) {
            const raindrop = document.createElement('div');
            raindrop.className = 'raindrop';
            raindrop.style.left = `${10 + i * 8}px`;
            raindrop.style.animationDelay = `${i * 0.5}s`;
            this.rainCloud.appendChild(raindrop);
        }
    }
    
    setupPeriodicSighing() {
        // JESP sighs randomly every 10-20 seconds
        setInterval(() => {
            if (!this.isSighing && Math.random() < 0.7) {
                this.sigh();
            }
        }, 10000);
    }
    
    sigh() {
        if (this.isSighing) return;
        
        this.isSighing = true;
        this.sighBubble.classList.remove('hidden');
        this.sighBubble.classList.add('visible');
        
        // Slightly slouch during sighing
        const arms = this.character.querySelector('.arms');
        arms.style.transform = 'rotate(8deg)';
        
        // Play groan sound
        if (this.game.audio) {
            this.game.audio.playRandomGroan();
        }
        
        // Remove sigh bubble after a few seconds
        setTimeout(() => {
            this.sighBubble.classList.remove('visible');
            setTimeout(() => {
                this.sighBubble.classList.add('hidden');
                arms.style.transform = 'rotate(0deg)';
                this.isSighing = false;
            }, 500);
        }, 2000);
    }
    
    handleResize() {
        // Update boundary rectangle
        this.boundaryRect = this.boundary.getBoundingClientRect();
        
        // Keep JESP in bounds
        this.updatePosition();
    }
    
    // Method to get current step count
    getStepCount() {
        return this.stepCount;
    }
    
    // Reset step count
    resetStepCount() {
        this.stepCount = 0;
        this.stepCountElement.textContent = "0";
        this.stepMessageElement.textContent = "Are you... proud?";
    }
}
