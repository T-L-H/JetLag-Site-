// Synthesized Audio Engine using Web Audio API to play real sci-fi feedback
// without loading heavy and fragile external audio files.

class AudioEngine {
  private ctx: AudioContext | null = null;

  private initCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playClick() {
    try {
      this.initCtx();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.exponentialRampToValueAtTime(150, t + 0.08);

      gain.gain.setValueAtTime(0.15, t);
      gain.gain.linearRampToValueAtTime(0.01, t + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.08);
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  }

  playSuccess() {
    try {
      this.initCtx();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, t); // C5
      osc.frequency.setValueAtTime(659.25, t + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, t + 0.2); // G5
      osc.frequency.setValueAtTime(1046.50, t + 0.3); // C6

      gain.gain.setValueAtTime(0.15, t);
      gain.gain.linearRampToValueAtTime(0.15, t + 0.35);
      gain.gain.linearRampToValueAtTime(0.01, t + 0.45);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.45);
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  }

  playCurse() {
    try {
      this.initCtx();
      if (!this.ctx) return;
      // Eerie, dual-oscillator alarm siren
      const t = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(220, t);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(223, t); // slightly detuned

      // Modulate frequency like a siren
      osc1.frequency.linearRampToValueAtTime(330, t + 0.3);
      osc1.frequency.linearRampToValueAtTime(220, t + 0.6);
      osc1.frequency.linearRampToValueAtTime(330, t + 0.9);
      osc1.frequency.linearRampToValueAtTime(220, t + 1.2);

      osc2.frequency.linearRampToValueAtTime(333, t + 0.3);
      osc2.frequency.linearRampToValueAtTime(223, t + 0.6);
      osc2.frequency.linearRampToValueAtTime(333, t + 0.9);
      osc2.frequency.linearRampToValueAtTime(223, t + 1.2);

      gain.gain.setValueAtTime(0.12, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 1.0);
      gain.gain.linearRampToValueAtTime(0.01, t + 1.3);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 1.3);
      osc2.stop(t + 1.3);
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  }

  playSonar() {
    try {
      this.initCtx();
      if (!this.ctx) return;
      // Submarine style sonar ping
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, t);
      osc.frequency.exponentialRampToValueAtTime(800, t + 1.5);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.005, t + 1.5);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 1.5);
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  }

  playMapCut() {
    try {
      this.initCtx();
      if (!this.ctx) return;
      // Low rumble whoosh
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.linearRampToValueAtTime(60, t + 0.5);

      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.6);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.6);
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  }

  playCurseDismissed() {
    try {
      this.initCtx();
      if (!this.ctx) return;
      // Joyous magical chime
      const t = this.ctx.currentTime;
      const notes = [587.33, 783.99, 987.77, 1174.66]; // D5, G5, B5, D6
      
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + idx * 0.08);

        gain.gain.setValueAtTime(0.08, t + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.01, t + idx * 0.08 + 0.4);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t + idx * 0.08);
        osc.stop(t + idx * 0.08 + 0.4);
      });
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  }
}

export const audio = new AudioEngine();
export default audio;
