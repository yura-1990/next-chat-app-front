// Notification sounds are synthesized with the Web Audio API rather than
// shipped as audio files — no assets to license or fetch, and it keeps the
// bundle at zero extra bytes for something this small.

export type SoundTheme = "chime" | "pop" | "ding" | "blip" | "none";

export const SOUND_THEMES: SoundTheme[] = [
	"chime",
	"pop",
	"ding",
	"blip",
	"none",
];

export const SOUND_THEME_LABELS: Record<SoundTheme, string> = {
	chime: "Chime",
	pop: "Pop",
	ding: "Ding",
	blip: "Blip",
	none: "Off",
};

type Note = { freq: number; start: number; duration: number; gain?: number };

const NOTES: Record<Exclude<SoundTheme, "none">, Note[]> = {
	chime: [
		{ freq: 880, start: 0, duration: 0.14 },
		{ freq: 1318.5, start: 0.08, duration: 0.22 },
	],
	pop: [{ freq: 480, start: 0, duration: 0.07, gain: 0.5 }],
	ding: [{ freq: 1046.5, start: 0, duration: 0.3 }],
	blip: [
		{ freq: 660, start: 0, duration: 0.05 },
		{ freq: 990, start: 0.05, duration: 0.06 },
	],
};

let sharedContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
	if (typeof window === "undefined") return null;
	const Ctor = window.AudioContext;
	if (!Ctor) return null;
	if (!sharedContext) sharedContext = new Ctor();
	if (sharedContext.state === "suspended") void sharedContext.resume();
	return sharedContext;
}

function scheduleNotes(ctx: AudioContext, notes: Note[]) {
	const now = ctx.currentTime;
	for (const note of notes) {
		const oscillator = ctx.createOscillator();
		const gain = ctx.createGain();
		oscillator.type = "sine";
		oscillator.frequency.value = note.freq;

		const peak = note.gain ?? 0.35;
		const startAt = now + note.start;
		const endAt = startAt + note.duration;
		gain.gain.setValueAtTime(0, startAt);
		gain.gain.linearRampToValueAtTime(peak, startAt + 0.012);
		gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

		oscillator.connect(gain).connect(ctx.destination);
		oscillator.start(startAt);
		oscillator.stop(endAt + 0.02);
	}
}

export function playNotificationSound(theme: SoundTheme) {
	if (theme === "none") return;
	const ctx = getAudioContext();
	if (!ctx) return;
	scheduleNotes(ctx, NOTES[theme]);
}

// A two-note "ring ring" — the caller/callee UI replays this on an
// interval (see useChatSession) for as long as a call is ringing, rather
// than this function looping internally, so it's trivial to stop instantly.
const RINGTONE_NOTES: Note[] = [
	{ freq: 480, start: 0, duration: 0.35, gain: 0.3 },
	{ freq: 600, start: 0.4, duration: 0.35, gain: 0.3 },
];
export const RINGTONE_INTERVAL_MS = 1_500;

export function playRingtone() {
	const ctx = getAudioContext();
	if (!ctx) return;
	scheduleNotes(ctx, RINGTONE_NOTES);
}
