/**
 * Trình phát âm thanh chuông báo tin nhắn thời gian thực (Ting ting synthesizer)
 * Sử dụng Web Audio API để tổng hợp sóng âm thanh trong trẻo, không phụ thuộc file mp3 ngoài.
 */

let audioCtx: AudioContext | null = null;
let soundEnabled = true;

// Khôi phục cài đặt âm thanh từ LocalStorage nếu có
try {
  const saved = localStorage.getItem('cusc_crm_sound_enabled');
  if (saved !== null) {
    soundEnabled = saved === 'true';
  }
} catch {
  // Bỏ qua nếu môi trường không có localStorage
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }

  // Tự động resume context nếu trình duyệt tạm khóa (autoplay policy)
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  return audioCtx;
}

/**
 * Phát chuông báo 2 nốt "Ting ting" thánh thót đặc trưng khi có tin nhắn từ FB/Zalo
 */
export function playTingTingSound(): void {
  if (!soundEnabled) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // NỐT 1: "Ting" thứ nhất (Tần số ~1318.5 Hz - E6, thanh thoát)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1318.5, now);
    osc1.frequency.exponentialRampToValueAtTime(1325, now + 0.15);

    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.28, now + 0.015);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.36);

    // NỐT 2: "Ting" thứ hai (Tần số ~1975.5 Hz - B6, ngân vang cao hơn sau 110ms)
    const delay = 0.11;
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1975.5, now + delay);
    osc2.frequency.exponentialRampToValueAtTime(1980, now + delay + 0.25);

    gain2.gain.setValueAtTime(0.001, now + delay);
    gain2.gain.linearRampToValueAtTime(0.35, now + delay + 0.015);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.55);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start(now + delay);
    osc2.stop(now + delay + 0.56);
  } catch (err) {
    // Trình duyệt có thể chặn âm thanh nếu người dùng chưa tương tác lần nào
    console.debug('[Audio] Could not play notification chime:', err);
  }
}

/**
 * Kiểm tra trạng thái bật/tắt âm thanh
 */
export function isSoundEnabled(): boolean {
  return soundEnabled;
}

/**
 * Thay đổi trạng thái bật/tắt âm thanh chuông báo
 */
export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled;
  try {
    localStorage.setItem('cusc_crm_sound_enabled', String(enabled));
  } catch {
    // ignore
  }
}
