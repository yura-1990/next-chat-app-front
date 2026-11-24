export type Session = {
	token: string;
	userId: string;
	username: string;
};

const KEY = "chat-session";

export function loadSession(): Session | null {
	try {
		const raw = localStorage.getItem(KEY);
		return raw ? (JSON.parse(raw) as Session) : null;
	} catch {
		return null;
	}
}

export function saveSession(session: Session) {
	try {
		localStorage.setItem(KEY, JSON.stringify(session));
	} catch {
		// localStorage can throw (private browsing, blocked storage) — the
		// session just won't survive a reload, which is an acceptable
		// degradation rather than a crash.
	}
}

export function clearSession() {
	try {
		localStorage.removeItem(KEY);
	} catch {
		// see saveSession
	}
}
