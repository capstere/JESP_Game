/**
 * Controls module - Handles user input for both keyboard and touch
 */
class Controls {
    constructor(character) {
        // Store reference to character
        this.character = character;
        
        // State tracking
        this.keyStates = {
            w: false,
            a: false,
            s: false,
            d: false
        };
        
        // Flag to determine if we're on mobile
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Show mobile controls based on detection
        this.toggleMobileControls();
    }
    
    /**
     * Sets up all event listeners
     */
    setupEventListeners() {
        // Keyboard events
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
        
        // Touch events for mobile
        if (this.isMobile) {
            this.setupTouchControls();
        }
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.character.handleResize();
            this.toggleMobileControls();
        });
    }
    
    /**
     * Handles keydown event
     * @param {KeyboardEvent} event - The keyboard event
     */
    handleKeyDown(event) {
        switch(event.key.toLowerCase()) {
            case 'w':
                this.keyStates.w = true;
                break;
            case 'a':
                this.keyStates.a = true;
                break;
            case 's':
                this.keyStates.s = true;
                break;
            case 'd':
                this.keyStates.d = true;
                break;
        }
        
        this.updateMovement();
    }
    
    /**
     * Handles keyup event
     * @param {KeyboardEvent} event - The keyboard event
     */
    handleKeyUp(event) {
        switch(event.key.toLowerCase()) {
            case 'w':
                this.keyStates.w = false;
                break;
            case 'a':
                this.keyStates.a = false;
                break;
            case 's':
                this.keyStates.s = false;
                break;
            case 'd':
                this.keyStates.d = false;
                break;
        }
        
        this.updateMovement();
    }
    
    /**
     * Updates character movement based on current key states
     */
    updateMovement() {
        // Calculate direction based on keys pressed
        let dirX = 0;
        let dirY = 0;
        
        if (this.keyStates.a) dirX -= 1;
        if (this.keyStates.d) dirX += 1;
        if (this.keyStates.w) dirY -= 1;
        if (this.keyStates.s) dirY += 1;
        
        // Normalize diagonal movement
        if (dirX !== 0 && dirY !== 0) {
            dirX *= 0.7071; // Approximately 1/sqrt(2)
            dirY *= 0.7071;
        }
        
        // Update character movement
        this.character.move(dirX, dirY);
    }
    
    /**
     * Sets up touch controls for mobile devices
     */
    setupTouchControls() {
        // Get button elements
        const upBtn = document.getElementById('up-btn');
        const leftBtn = document.getElementById('left-btn');
        const rightBtn = document.getElementById('right-btn');
        const downBtn = document.getElementById('down-btn');
        
        // Helper function to handle button events
        const setupButtonEvents = (button, key) => {
            // Touch start and mouse down
            const startHandler = (e) => {
                e.preventDefault();
                this.keyStates[key] = true;
                this.updateMovement();
            };
            
            // Touch end and mouse up
            const endHandler = (e) => {
                e.preventDefault();
                this.keyStates[key] = false;
                this.updateMovement();
            };
            
            // Add event listeners
            button.addEventListener('touchstart', startHandler, { passive: false });
            button.addEventListener('mousedown', startHandler);
            
            button.addEventListener('touchend', endHandler);
            button.addEventListener('mouseup', endHandler);
            
            // Handle touch cancel
            button.addEventListener('touchcancel', endHandler);
            
            // Handle cases where finger moves off button while pressed
            button.addEventListener('touchleave', endHandler);
        };
        
        // Setup each direction button
        setupButtonEvents(upBtn, 'w');
        setupButtonEvents(leftBtn, 'a');
        setupButtonEvents(downBtn, 's');
        setupButtonEvents(rightBtn, 'd');
    }
    
    /**
     * Toggles visibility of mobile controls based on device detection
     */
    toggleMobileControls() {
        const mobileControls = document.getElementById('mobile-controls');
        
        if (this.isMobile || window.innerWidth < 768) {
            mobileControls.style.display = 'flex';
        } else {
            mobileControls.style.display = 'none';
        }
    }
}
