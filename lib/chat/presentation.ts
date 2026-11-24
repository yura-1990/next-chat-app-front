// The backend only knows usernames — avatar initials and the accent color
// are purely a client-side presentation choice, derived deterministically
// so the same user always renders the same way across sessions/devices.

const COLORS = ["coral", "sage", "blue", "gold", "plum", "teal"] as const;

export function colorForUsername(username: string): string {
	let hash = 0;
	for (let i = 0; i < username.length; i++) {
		hash = (hash * 31 + username.charCodeAt(i)) | 0;
	}
	return COLORS[Math.abs(hash) % COLORS.length];
}

export function avatarForUsername(username: string): string {
	return username.slice(0, 2).toUpperCase();
}

export function compareSnowflakeIds(a: string, b: string): number {
	const diff = BigInt(a) - BigInt(b);
	return diff < 0n ? -1 : diff > 0n ? 1 : 0;
}

export function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	const units = ["KB", "MB", "GB"];
	let value = bytes / 1024;
	let unitIndex = 0;
	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex += 1;
	}
	return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unitIndex]}`;
}

export function formatDuration(totalSeconds: number): string {
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = Math.floor(totalSeconds % 60);
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
