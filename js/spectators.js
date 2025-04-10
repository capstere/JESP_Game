/**
 * Spectators - Handles the people watching JESP from windows
 */
class Spectators {
    constructor(game) {
        this.game = game;
        this.spectators = document.querySelectorAll('.spectator');
        
        // Start occasional reactions
        this.setupReactions();
    }
    
    setupReactions() {
        // Every 10-20 seconds, a spectator might react
        setInterval(() => {
            if (Math.random() < 0.4) { // 40% chance
                this.triggerRandomReaction();
            }
        }, 15000);
    }
    
    triggerRandomReaction() {
        // Pick a random spectator
        const randomIndex = Math.floor(Math.random() * this.spectators.length);
        const spectator = this.spectators[randomIndex];
        
        // Decide between laugh or clap
        if (Math.random() < 0.6) {
            this.laugh(spectator);
        } else {
            this.clap(spectator);
        }
    }
    
    laugh(spectator) {
        // Visual indication
        spectator.classList.add('laughing');
        
        // Play laugh sound
        this.game.audio.playRandomLaugh();
        
        // Remove after animation
        setTimeout(() => {
            spectator.classList.remove('laughing');
        }, 3000);
    }
    
    clap(spectator) {
        // Visual indication
        spectator.classList.add('clapping');
        
        // Play clap sound
        this.game.audio.playRandomClap();
        
        // Remove after animation
        setTimeout(() => {
            spectator.classList.remove('clapping');
        }, 3000);
    }
}
