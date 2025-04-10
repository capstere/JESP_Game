/**
 * Utility functions for the game
 */

// Utility to generate a random number between min and max
function getRandomNumber(min, max) {
    return Math.random() * (max - min) + min;
}

// Utility to check if mobile device
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
}

// Utility to preload images
function preloadImage(url) {
    const img = new Image();
    img.src = url;
    return img;
}

// Utility for collision detection between elements
function isColliding(element1, element2) {
    const rect1 = element1.getBoundingClientRect();
    const rect2 = element2.getBoundingClientRect();
    
    return !(
        rect1.right < rect2.left || 
        rect1.left > rect2.right || 
        rect1.bottom < rect2.top || 
        rect1.top > rect2.bottom
    );
}

// Utility to generate a funny sandwich name
function getRandomSandwich() {
    const breads = ["Rye", "White", "Wheat", "Sourdough", "Stale", "Invisible", "Metaphorical"];
    const fillings = ["Regret", "Sorrow", "Emptiness", "Despair", "Lost Dreams", "Void", "Broken Promises"];
    
    const bread = breads[Math.floor(Math.random() * breads.length)];
    const filling = fillings[Math.floor(Math.random() * fillings.length)];
    
    return `${filling} on ${bread}`;
}
