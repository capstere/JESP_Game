/**
 * Interactive Objects - Handles the soda can and tumble bush
 */
class InteractiveObjects {
    constructor(game) {
        this.game = game;
        
        // Get DOM elements
        this.sodaCan = document.getElementById('soda-can');
        this.tumbleBush = document.getElementById('tumble-bush');
        
        // Set initial positions
        this.canPosition = {
            x: Math.random() * 60 + 20,
            y: Math.random() * 60 + 20
        };
        
        this.bushPosition = {
            x: Math.random() * 60 + 20,
            y: Math.random() * 60 + 20
        };
        
        // Set can initial position
        this.updateCanPosition();
        
        // Set up can interaction
        this.setupCanInteraction();
        
        // Start bush animation
        this.animateTumbleweed();
    }
    
    updateCanPosition() {
        // Convert percentage to pixels based on boundary
        const boundary = document.getElementById('game-boundary');
        const boundaryRect = boundary.getBoundingClientRect();
        
        const xPos = boundaryRect.left + (boundaryRect.width * (this.canPosition.x / 100));
        const yPos = boundaryRect.top + (boundaryRect.height * (this.canPosition.y / 100));
        
        this.sodaCan.style.left = `${xPos}px`;
        this.sodaCan.style.top = `${yPos}px`;
    }
    
    setupCanInteraction() {
        // Check for collision with JESP
        setInterval(() => {
            const canRect = this.sodaCan.getBoundingClientRect();
            const jespRect = document.getElementById('jesp').getBoundingClientRect();
            
            // Detect collision
            if (this.isColliding(canRect, jespRect)) {
                this.kickCan();
            }
        }, 100);
    }
    
    kickCan() {
        // Calculate new random direction
        const angle = Math.random() * Math.PI * 2;
        const distance = 15 + Math.random() * 10; // Distance to kick
        
        // Update position
        this.canPosition.x += Math.cos(angle) * distance;
        this.canPosition.y += Math.sin(angle) * distance;
        
        // Keep within boundary
        this.canPosition.x = Math.max(5, Math.min(95, this.canPosition.x));
        this.canPosition.y = Math.max(5, Math.min(95, this.canPosition.y));
        
        // Update visual position
        this.updateCanPosition();
        
        // Play sound
        this.game.audio.playCanKick();
    }
    
    animateTumbleweed() {
        // Animate the bush rolling across the screen occasionally
        setInterval(() => {
            if (Math.random() < 0.2) { // 20% chance every 5 seconds
                this.rollBush();
            }
        }, 5000);
    }
    
    rollBush() {
        // Generate random start and end points
        const startX = -50; // Start off-screen
        const endX = window.innerWidth + 50; // End off-screen
        const yPos = Math.random() * 60 + 20; // Random y position
        
        // Position the bush
        this.tumbleBush.style.left = `${startX}px`;
        
        const boundary = document.getElementById('game-boundary');
        const boundaryRect = boundary.getBoundingClientRect();
        const yPosPixels = boundaryRect.top + (boundaryRect.height * (yPos / 100));
        
        this.tumbleBush.style.top = `${yPosPixels}px`;
        
        // Add rolling animation class
        this.tumbleBush.classList.add('rolling');
        
        // Animate from left to right
        const duration = 8000 + Math.random() * 4000; // 8-12 seconds
        
        // Create animation
        this.tumbleBush.animate([
            { left: `${startX}px`, transform: 'rotate(0deg)' },
            { left: `${endX}px`, transform: 'rotate(1440deg)' } // Four full rotations
        ], {
            duration: duration,
            easing: 'linear'
        });
        
        // Remove class after animation
        setTimeout(() => {
            this.tumbleBush.classList.remove('rolling');
        }, duration);
    }
    
    isColliding(rect1, rect2) {
        return !(
            rect1.right < rect2.left || 
            rect1.left > rect2.right || 
            rect1.bottom < rect2.top || 
            rect1.top > rect2.bottom
        );
    }
}
