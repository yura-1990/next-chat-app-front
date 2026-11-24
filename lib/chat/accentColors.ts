// Reuses the same six names as the per-contact avatar colors
// (lib/chat/presentation.ts) so the palette reads as one consistent design
// language, not two unrelated color systems.

export type AccentColor = "teal" | "blue" | "coral" | "plum" | "gold" | "sage";

export const ACCENT_COLORS: AccentColor[] = [
	"teal",
	"blue",
	"coral",
	"plum",
	"gold",
	"sage",
];

type Palette = { accent: string; accentDark: string; accentWash: string };

export const ACCENT_PALETTES: Record<
	AccentColor,
	{ light: Palette; dark: Palette }
> = {
	teal: {
		light: { accent: "#237b68", accentDark: "#1c6859", accentWash: "#e6f3ee" },
		dark: { accent: "#76c3aa", accentDark: "#93d4bd", accentWash: "#30473f" },
	},
	blue: {
		light: { accent: "#2563a8", accentDark: "#1d4f85", accentWash: "#e3edf7" },
		dark: { accent: "#6fa8dc", accentDark: "#8fc0e8", accentWash: "#27394a" },
	},
	coral: {
		light: { accent: "#c0564a", accentDark: "#a4453a", accentWash: "#fbeae7" },
		dark: { accent: "#e08a7d", accentDark: "#e8a398", accentWash: "#4a332e" },
	},
	plum: {
		light: { accent: "#7c4a9e", accentDark: "#653c82", accentWash: "#f1e8f7" },
		dark: { accent: "#b58bd1", accentDark: "#c7a3dd", accentWash: "#3a2f45" },
	},
	gold: {
		light: { accent: "#a37a1f", accentDark: "#8a6519", accentWash: "#f8f0dc" },
		dark: { accent: "#d4b24f", accentDark: "#ddc272", accentWash: "#473c22" },
	},
	sage: {
		light: { accent: "#5a7d52", accentDark: "#486644", accentWash: "#eaf1e7" },
		dark: { accent: "#9bc08f", accentDark: "#aecaa4", accentWash: "#33402f" },
	},
};
