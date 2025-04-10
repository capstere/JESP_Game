/**
 * Menu System - Handles the game's menu interface
 */
class MenuSystem {
    constructor(game) {
        this.game = game;
        this.currentScreen = 'title'; // 'title', 'game', 'instructions', 'leaderboard', 'submit'
        
        // Cache DOM elements
        this.menuContainer = document.getElementById('menu-container');
        this.gameContainer = document.getElementById('game-container');
        this.titleScreen = document.getElementById('title-screen');
        this.instructionsScreen = document.getElementById('instructions-screen');
        this.leaderboardScreen = document.getElementById('leaderboard-screen');
        this.submitScoreScreen = document.getElementById('submit-score-screen');
        
        // Setup menu buttons
        this.setupMenuButtons();
    }
    
    setupMenuButtons() {
        // Start Game button
        document.getElementById('start-game-btn').addEventListener('click', () => {
            this.showScreen('game');
            this.game.startGame();
        });
        
        // Instructions button
        document.getElementById('instructions-btn').addEventListener('click', () => {
            this.showScreen('instructions');
        });
        
        // Submit Score button
        document.getElementById('submit-score-btn').addEventListener('click', () => {
            this.showScreen('submit');
            document.getElementById('final-score').textContent = this.game.stepCounter;
        });
        
        // View Leaderboard button
        document.getElementById('leaderboard-btn').addEventListener('click', () => {
            this.showScreen('leaderboard');
            this.game.leaderboard.displayLeaderboard();
        });
        
        // Exit button (just goes back to title screen)
        document.getElementById('exit-btn').addEventListener('click', () => {
            if (confirm('Are you sure you want to face reality? It\'s worse out there.')) {
                this.showScreen('title');
                this.game.resetGame();
            }
        });
        
        // Back buttons on all screens
        document.querySelectorAll('.back-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.showScreen('title');
            });
        });
        
        // Submit score form
        document.getElementById('score-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const playerName = document.getElementById('player-name').value || 'Anonymous Wanderer';
            this.game.leaderboard.submitScore(playerName, this.game.stepCounter);
            this.showScreen('leaderboard');
        });
    }
    
    showScreen(screenName) {
        // Hide all screens
        this.titleScreen.classList.add('hidden');
        this.gameContainer.classList.add('hidden');
        this.instructionsScreen.classList.add('hidden');
        this.leaderboardScreen.classList.add('hidden');
        this.submitScoreScreen.classList.add('hidden');
        
        // Show the requested screen
        this.currentScreen = screenName;
        
        switch(screenName) {
            case 'title':
                this.titleScreen.classList.remove('hidden');
                this.game.audio.playMenuMusic();
                break;
            case 'game':
                this.gameContainer.classList.remove('hidden');
                this.game.audio.playGameMusic();
                break;
            case 'instructions':
                this.instructionsScreen.classList.remove('hidden');
                break;
            case 'leaderboard':
                this.leaderboardScreen.classList.remove('hidden');
                break;
            case 'submit':
                this.submitScoreScreen.classList.remove('hidden');
                break;
        }
    }
}
