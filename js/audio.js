/**
 * Audio System - Handles all game audio
 */
class AudioSystem {
    constructor() {
        this.sounds = {
            menuMusic: null,
            gameMusic: null,
            footsteps: [],
            groans: [],
            canKick: null,
            laughs: [],
            claps: [],
            events: {}
        };
        
        this.currentMusic = null;
        this.isMuted = false;
        
        // Load all sounds
        this.loadSounds();
        
        // Setup mute toggle
        document.getElementById('mute-btn').addEventListener('click', () => {
            this.toggleMute();
        });
    }
    
    loadSounds() {
        // Note about audio: This creates placeholder Audio objects
        // In a real implementation, you would need to:
        // 1. Create audio files and place them in an assets/audio directory
        // 2. Set the correct paths to those files below
        
        // Create menu music
        this.sounds.menuMusic = new Audio();
        // this.sounds.menuMusic.src = 'assets/audio/music/menu_music.mp3';
        this.sounds.menuMusic.loop = true;
        
        // Create game music
        this.sounds.gameMusic = new Audio();
        // this.sounds.gameMusic.src = 'assets/audio/music/game_music.mp3';
        this.sounds.gameMusic.loop = true;
        
        // Create footstep sounds (multiple variations)
        for (let i = 1; i <= 4; i++) {
            const footstep = new Audio();
            // footstep.src = `assets/audio/sfx/footstep${i}.mp3`;
            this.sounds.footsteps.push(footstep);
        }
        
        // Create groan sounds
        const groanTexts = ['ugh', 'sigh', 'huh', 'ow'];
        groanTexts.forEach((text, i) => {
            const groan = new Audio();
            // groan.src = `assets/audio/sfx/groan${i+1}.mp3`;
            this.sounds.groans.push(groan);
        });
        
        // Can kick sound
        this.sounds.canKick = new Audio();
        // this.sounds.canKick.src = 'assets/audio/sfx/can_kick.mp3';
        
        // Laugh sounds
        for (let i = 1; i <= 3; i++) {
            const laugh = new Audio();
            // laugh.src = `assets/audio/sfx/laugh${i}.mp3`;
            this.sounds.laughs.push(laugh);
        }
        
        // Clap sounds
        for (let i = 1; i <= 2; i++) {
            const clap = new Audio();
            // clap.src = `assets/audio/sfx/clap${i}.mp3`;
            this.sounds.claps.push(clap);
        }
        
        // Event sounds
        this.sounds.events.email = new Audio();
        // this.sounds.events.email.src = 'assets/audio/sfx/email_alert.mp3';
        
        this.sounds.events.bankAlert = new Audio();
        // this.sounds.events.bankAlert.src = 'assets/audio/sfx/bank_alert.mp3';
        
        this.sounds.events.phoneRing = new Audio();
        // this.sounds.events.phoneRing.src = 'assets/audio/sfx/phone_ring.mp3';
        
        this.sounds.events.anxietyAttack = new Audio();
        // this.sounds.events.anxietyAttack.src = 'assets/audio/sfx/anxiety.mp3';
        
        this.sounds.events.burnedToast = new Audio();
        // this.sounds.events.burnedToast.src = 'assets/audio/sfx/toast.mp3';
    }
    
    playMenuMusic() {
        this.stopAllMusic();
        if (this.isMuted) return;
        
        this.currentMusic = this.sounds.menuMusic;
        this.currentMusic.volume = 0.7;
        this.currentMusic.play().catch(() => {
            console.log('Audio playback prevented by browser. User interaction needed first.');
        });
    }
    
    playGameMusic() {
        this.stopAllMusic();
        if (this.isMuted) return;
        
        this.currentMusic = this.sounds.gameMusic;
        this.currentMusic.volume = 0.4;
        this.currentMusic.play().catch(() => {
            console.log('Audio playback prevented by browser. User interaction needed first.');
        });
    }
    
    stopAllMusic() {
        if (this.currentMusic) {
            this.currentMusic.pause();
            this.currentMusic.currentTime = 0;
        }
    }
    
    playFootstep() {
        if (this.isMuted) return;
        
        const randomIndex = Math.floor(Math.random() * this.sounds.footsteps.length);
        const sound = this.sounds.footsteps[randomIndex];
        
        // Clone the audio to allow overlapping sounds
        const clone = sound.cloneNode();
        clone.volume = 0.3 + (Math.random() * 0.2);
        clone.play().catch(() => {});
    }
    
    playRandomGroan() {
        if (this.isMuted || Math.random() > 0.3) return; // Only play occasionally
        
        const randomIndex = Math.floor(Math.random() * this.sounds.groans.length);
        const sound = this.sounds.groans[randomIndex];
        
        const clone = sound.cloneNode();
        clone.volume = 0.4;
        clone.play().catch(() => {});
    }
    
    playCanKick() {
        if (this.isMuted) return;
        
        const clone = this.sounds.canKick.cloneNode();
        clone.volume = 0.6;
        clone.play().catch(() => {});
    }
    
    playRandomLaugh() {
        if (this.isMuted) return;
        
        const randomIndex = Math.floor(Math.random() * this.sounds.laughs.length);
        const sound = this.sounds.laughs[randomIndex];
        
        const clone = sound.cloneNode();
        clone.volume = 0.5;
        clone.play().catch(() => {});
    }
    
    playRandomClap() {
        if (this.isMuted) return;
        
        const randomIndex = Math.floor(Math.random() * this.sounds.claps.length);
        const sound = this.sounds.claps[randomIndex];
        
        const clone = sound.cloneNode();
        clone.volume = 0.5;
        clone.play().catch(() => {});
    }
    
    playEventSound(eventName) {
        if (this.isMuted || !this.sounds.events[eventName]) return;
        
        const sound = this.sounds.events[eventName];
        const clone = sound.cloneNode();
        clone.volume = 0.5;
        clone.play().catch(() => {});
    }
    
    toggleMute() {
        this.isMuted = !this.isMuted;
        
        if (this.isMuted) {
            this.stopAllMusic();
            document.getElementById('mute-btn').textContent = '🔇';
        } else {
            if (this.currentScreen === 'game') {
                this.playGameMusic();
            } else {
                this.playMenuMusic();
            }
            document.getElementById('mute-btn').textContent = '🔊';
        }
    }
}