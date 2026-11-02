/**
 * Ses dosyası gerektirmeyen sentezlenmiş mırlama (Web Audio).
 * Kahverengi gürültü → alçak geçiren filtre → ~24 Hz genlik modülasyonu.
 * Tarayıcı kısıtı nedeniyle AudioContext ilk kullanıcı dokunuşunda oluşturulur.
 */
export class PetAudio {
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor() as AudioContext;

    const length = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    return this.ctx;
  }

  purr(durationSec = 3.0) {
    const ctx = this.ensureContext();
    if (!ctx || !this.noise) return;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 260;

    // Mırlamanın "titreşimi": genliği 24 Hz ile modüle et
    const tremolo = ctx.createGain();
    tremolo.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 24;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.5;
    lfo.connect(lfoDepth).connect(tremolo.gain);

    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(0.9, now + 0.35);
    envelope.gain.setValueAtTime(0.9, now + durationSec - 0.6);
    envelope.gain.linearRampToValueAtTime(0, now + durationSec);

    src.connect(lowpass).connect(tremolo).connect(envelope).connect(ctx.destination);
    src.start(now);
    lfo.start(now);
    src.stop(now + durationSec);
    lfo.stop(now + durationSec);
  }

  dispose() {
    this.ctx?.close();
    this.ctx = null;
  }
}
