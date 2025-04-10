/**
 * Expanded StressEvents module
 */
class StressEvents {
    constructor(game) {
        this.game = game;
        this.container = document.getElementById('stress-events-container');
        this.eventTypes = [
            {
                name: 'work-email',
                className: 'email-notification',
                text: 'New urgent work email: "Deadline: Yesterday"',
                probability: 0.2
            },
            {
                name: 'child-scream',
                className: 'child-scream',
                text: 'DAAAAAAD! I NEED SOMETHING! NOW!',
                probability: 0.15
            },
            {
                name: 'bank-alert',
                className: 'bank-alert',
                text: 'Bank Alert: Your account balance is -$3.48',
                probability: 0.15,
                soundEvent: 'bankAlert'
            },
            {
                name: 'coffee-spill',
                className: 'coffee-spill',
                text: 'Your coffee spilled on your last clean shirt',
                probability: 0.15,
                hasAnimation: true
            },
            {
                name: 'phone-ring',
                className: 'phone-ring',
                text: 'Your phone is ringing. It\'s that call you\'ve been avoiding.',
                probability: 0.15,
                soundEvent: 'phoneRing'
            },
            {
                name: 'anxiety-attack',
                className: 'anxiety-attack',
                text: 'You feel an anxiety attack coming. Deep breaths. Deep breaths.',
                probability: 0.1,
                hasAnimation: true,
                soundEvent: 'anxietyAttack'
            },
            {
                name: 'toast-smell',
                className: 'toast-smell',
                text: 'You smell burned toast. Is it real or just another hallucination?',
                probability: 0.1,
                hasAnimation: true,
                soundEvent: 'burnedToast'
            }
        ];
        
        // Start stress event loop
        this.setupRandomEvents();
    }
    
    setupRandomEvents() {
        // Create stress events randomly every 8-15 seconds
        setInterval(() => {
            // Determine if an event should happen based on random chance
            if (Math.random() < 0.7) {
                this.triggerRandomEvent();
            }
        }, 8000);
    }
    
    triggerRandomEvent() {
        // Select an event based on probability
        const random = Math.random();
        let cumulativeProbability = 0;
        
        for (const eventType of this.eventTypes) {
            cumulativeProbability += eventType.probability;
            
            if (random <= cumulativeProbability) {
                this.createEvent(eventType);
                break;
            }
        }
    }
    
    createEvent(eventType) {
        // Create the event element
        const eventElement = document.createElement('div');
        eventElement.className = `stress-event ${eventType.className}`;
        eventElement.textContent = eventType.text;
        
        // Position randomly on screen (within game boundary)
        const boundary = document.getElementById('game-boundary');
        const boundaryRect = boundary.getBoundingClientRect();
        
        const marginX = 30; // Keep away from edges
        const marginY = 20;
        const posX = boundaryRect.left + marginX + Math.random() * (boundaryRect.width - 2 * marginX);
        const posY = boundaryRect.top + marginY + Math.random() * (boundaryRect.height - 2 * marginY);
        
        eventElement.style.left = `${posX}px`;
        eventElement.style.top = `${posY}px`;
        
        // Add to container
        this.container.appendChild(eventElement);
        
        // Play sound if available
        if (eventType.soundEvent && this.game.audio) {
            this.game.audio.playEventSound(eventType.soundEvent);
        }
        
        // Handle special animations
        if (eventType.hasAnimation) {
            switch(eventType.name) {
                case 'coffee-spill':
                    this.createCoffeeSpill(posX, posY);
                    break;
                case 'anxiety-attack':
                    this.createAnxietyAttack();
                    break;
                case 'toast-smell':
                    this.createToastSmell(posX, posY);
                    break;
            }
        }
        
        // Remove after animation completes
        setTimeout(() => {
            if (eventElement.parentNode) {
                eventElement.parentNode.removeChild(eventElement);
            }
        }, 5000);
    }
    
    createCoffeeSpill(x, y) {
        const spillElement = document.createElement('div');
        spillElement.className = 'coffee-splash';
        
        // Position slightly below the notification
        spillElement.style.left = `${x - 20}px`;
        spillElement.style.top = `${y + 40}px`;
        
        // Add to container
        this.container.appendChild(spillElement);
        
        // Remove after animation completes
        setTimeout(() => {
            if (spillElement.parentNode) {
                spillElement.parentNode.removeChild(spillElement);
            }
        }, 3000);
    }
    
    createAnxietyAttack() {
        // Make JESP briefly collapse
        const jesp = document.getElementById('jesp');
        jesp.classList.add('anxiety-collapse');
        
        // Add screen shake effect
        document.getElementById('world').classList.add('screen-shake');
        
        // Remove effects after a short time
        setTimeout(() => {
            jesp.classList.remove('anxiety-collapse');
            document.getElementById('world').classList.remove('screen-shake');
        }, 2000);
    }
    
    createToastSmell(x, y) {
        // Create wavy stink lines
        for (let i = 0; i < 3; i++) {
            const stinkLine = document.createElement('div');
            stinkLine.className = 'stink-line';
            stinkLine.style.left = `${x + (i * 10)}px`;
            stinkLine.style.top = `${y - 20}px`;
            stinkLine.style.animationDelay = `${i * 0.2}s`;
            
            this.container.appendChild(stinkLine);
            
            // Remove after animation
            setTimeout(() => {
                if (stinkLine.parentNode) {
                    stinkLine.parentNode.removeChild(stinkLine);
                }
            }, 4000);
        }
    }
}
