/**
 * Leaderboard System - Handles storing and displaying scores
 */
class LeaderboardSystem {
    constructor() {
        this.leaderboardEntries = [];
        this.sandwichTypes = [
            "Regret on Rye",
            "Invisible Panini",
            "Bread of Sorrow",
            "Two Crumbs and a Memory",
            "Despair & Cheese",
            "Failed Dreams Club",
            "Existential Crisis Wrap",
            "Empty Promises on Wheat",
            "Void Burger",
            "The 'Why Bother' Special"
        ];
        
        // Load existing leaderboard from localStorage
        this.loadLeaderboard();
        
        // Set up reset button
        document.getElementById('reset-leaderboard').addEventListener('click', () => {
            this.resetLeaderboard();
        });
    }
    
    loadLeaderboard() {
        const savedLeaderboard = localStorage.getItem('jespLeaderboard');
        if (savedLeaderboard) {
            try {
                this.leaderboardEntries = JSON.parse(savedLeaderboard);
            } catch (e) {
                console.error('Error loading leaderboard:', e);
                this.leaderboardEntries = [];
            }
        }
    }
    
    saveLeaderboard() {
        try {
            localStorage.setItem('jespLeaderboard', JSON.stringify(this.leaderboardEntries));
        } catch (e) {
            console.error('Error saving leaderboard:', e);
        }
    }
    
    submitScore(playerName, steps) {
        // Generate a random sandwich type
        const randomSandwich = this.sandwichTypes[Math.floor(Math.random() * this.sandwichTypes.length)];
        
        // Create new entry
        const newEntry = {
            name: playerName,
            steps: steps,
            sandwich: randomSandwich,
            date: new Date().toISOString()
        };
        
        // Add to leaderboard
        this.leaderboardEntries.push(newEntry);
        
        // Sort by steps (highest first)
        this.leaderboardEntries.sort((a, b) => b.steps - a.steps);
        
        // Keep only top 10 entries
        if (this.leaderboardEntries.length > 10) {
            this.leaderboardEntries = this.leaderboardEntries.slice(0, 10);
        }
        
        // Save to localStorage
        this.saveLeaderboard();
        
        // Display updated leaderboard
        this.displayLeaderboard();
    }
    
    displayLeaderboard() {
        const leaderboardContainer = document.getElementById('leaderboard-entries');
        leaderboardContainer.innerHTML = '';
        
        if (this.leaderboardEntries.length === 0) {
            leaderboardContainer.innerHTML = '<p class="empty-leaderboard">No one has wandered nowhere yet. Be the first!</p>';
            return;
        }
        
        // Create leaderboard entries
        this.leaderboardEntries.forEach((entry, index) => {
            const entryElement = document.createElement('div');
            entryElement.className = 'leaderboard-entry';
            
            entryElement.innerHTML = `
                <div class="entry-rank">#${index + 1}</div>
                <div class="entry-name">${entry.name}</div>
                <div class="entry-steps">${entry.steps} steps</div>
                <div class="entry-sandwich">"${entry.sandwich}"</div>
            `;
            
            leaderboardContainer.appendChild(entryElement);
        });
    }
    
    resetLeaderboard() {
        if (confirm('This will erase all your pointless achievements. Continue?')) {
            this.leaderboardEntries = [];
            this.saveLeaderboard();
            this.displayLeaderboard();
        }
    }
}
