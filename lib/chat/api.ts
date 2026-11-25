const HTTP_URL =
	process.env.NEXT_PUBLIC_GATEWAY_HTTP_URL ?? "http://127.0.0.1:8080";

// Media URLs come back from the gateway as paths relative to it
// (/media/:chat_id/:media_id?exp=...&sig=...), never a full origin — this
// just resolves that against the configured gateway for <img>/<video>/<a> src.
export function mediaUrl(path: string): string {
	return path.startsWith("http") ? path : `${HTTP_URL}${path}`;
}

export class ApiError extends Error {
	constructor(
		public status: number,
		message: string,
	) {
		super(message);
	}
}

type RawMedia = {
	media_id: string;
	kind: string;
	mime: string;
	name: string | null;
	size: number;
	duration_ms: number | null;
	url: string;
};

type RawChatSummary = {
	chat_id: string;
	other_user_id: string;
	other_username: string;
	last_message: {
		text: string;
		created_at_ms: number;
		media_kind: string | null;
		deleted: boolean;
	} | null;
	is_self: boolean;
	is_archived: boolean;
};

type RawReplyPreview = {
	message_id: string;
	author_id: string;
	text: string;
	media_kind: string | null;
	deleted: boolean;
};

type RawForwardedFrom = {
	user_id: string;
	username: string;
};

type RawMessage = {
	id: string;
	chat_id: string;
	author_id: string;
	text: string;
	created_at_ms: number;
	media: RawMedia | null;
	reply_to_id: string | null;
	reply_preview: RawReplyPreview | null;
	forwarded_from: RawForwardedFrom | null;
	edited_at_ms: number | null;
	deleted: boolean;
};

export type ChatSummary = {
	chatId: string;
	otherUserId: string;
	otherUsername: string;
	lastMessage: {
		text: string;
		createdAtMs: number;
		mediaKind: string | null;
		deleted: boolean;
	} | null;
	isSelf: boolean;
	isArchived: boolean;
};

export type ApiMedia = {
	mediaId: string;
	kind: string;
	mime: string;
	name: string | null;
	size: number;
	durationMs: number | null;
	url: string;
};

export type ApiReplyPreview = {
	messageId: string;
	authorId: string;
	text: string;
	mediaKind: string | null;
	deleted: boolean;
};

export type ApiForwardedFrom = {
	userId: string;
	username: string;
};

export type ApiMessage = {
	id: string;
	chatId: string;
	authorId: string;
	text: string;
	createdAtMs: number;
	media: ApiMedia | null;
	replyToId: string | null;
	replyPreview: ApiReplyPreview | null;
	forwardedFrom: ApiForwardedFrom | null;
	editedAtMs: number | null;
	deleted: boolean;
};

function mediaFromRaw(media: RawMedia | null): ApiMedia | null {
	if (!media) return null;
	return {
		mediaId: media.media_id,
		kind: media.kind,
		mime: media.mime,
		name: media.name,
		size: media.size,
		durationMs: media.duration_ms,
		url: media.url,
	};
}

export const MESSAGE_PAGE_SIZE = 50;

async function request(
	path: string,
	init: (RequestInit & { token?: string }) | undefined = undefined,
) {
	const { token, headers, ...rest } = init ?? {};
	const res = await fetch(`${HTTP_URL}${path}`, {
		...rest,
		headers: {
			...(rest.body ? { "Content-Type": "application/json" } : {}),
			...(token ? { Authorization: `Bearer ${token}` } : {}),
			...headers,
		},
	});
	const text = await res.text();
	const body = text ? safeJsonParse(text) : null;
	if (!res.ok) {
		throw new ApiError(
			res.status,
			typeof body === "string" ? body : text || res.statusText,
		);
	}
	return body;
}

function safeJsonParse(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}

export async function register(username: string, password: string) {
	const body = (await request("/auth/register", {
		method: "POST",
		body: JSON.stringify({ username, password }),
	})) as { user_id: string; token: string };
	return { userId: body.user_id, token: body.token };
}

export async function login(username: string, password: string) {
	const body = (await request("/auth/login", {
		method: "POST",
		body: JSON.stringify({ username, password }),
	})) as { user_id: string; token: string };
	return { userId: body.user_id, token: body.token };
}

export async function listChats(token: string): Promise<ChatSummary[]> {
	const body = (await request("/chats", { token })) as RawChatSummary[];
	return body.map((c) => ({
		chatId: c.chat_id,
		otherUserId: c.other_user_id,
		otherUsername: c.other_username,
		lastMessage: c.last_message
			? {
					text: c.last_message.text,
					createdAtMs: c.last_message.created_at_ms,
					mediaKind: c.last_message.media_kind,
					deleted: c.last_message.deleted,
				}
			: null,
		isSelf: c.is_self,
		isArchived: c.is_archived,
	}));
}

export async function listMessages(
	token: string,
	chatId: string,
	options: { limit?: number; before?: string } = {},
): Promise<ApiMessage[]> {
	const params = new URLSearchParams({
		limit: String(options.limit ?? MESSAGE_PAGE_SIZE),
	});
	if (options.before) params.set("before", options.before);
	const body = (await request(`/chats/${chatId}/messages?${params}`, {
		token,
	})) as RawMessage[];
	return body.map((m) => ({
		id: m.id,
		chatId: m.chat_id,
		authorId: m.author_id,
		text: m.text,
		createdAtMs: m.created_at_ms,
		media: mediaFromRaw(m.media),
		replyToId: m.reply_to_id,
		replyPreview: m.reply_preview
			? {
					messageId: m.reply_preview.message_id,
					authorId: m.reply_preview.author_id,
					text: m.reply_preview.text,
					mediaKind: m.reply_preview.media_kind,
					deleted: m.reply_preview.deleted,
				}
			: null,
		forwardedFrom: m.forwarded_from
			? {
					userId: m.forwarded_from.user_id,
					username: m.forwarded_from.username,
				}
			: null,
		editedAtMs: m.edited_at_ms,
		deleted: m.deleted,
	}));
}

export async function lookupUser(token: string, username: string) {
	const body = (await request(
		`/users/lookup?username=${encodeURIComponent(username)}`,
		{
			token,
		},
	)) as { user_id: string; username: string };
	return { userId: body.user_id, username: body.username };
}

export async function searchUsers(token: string, query: string) {
	const body = (await request(`/users/search?q=${encodeURIComponent(query)}`, {
		token,
	})) as { user_id: string; username: string }[];
	return body.map((u) => ({ userId: u.user_id, username: u.username }));
}

export async function createDirectChat(token: string, withUserId: string) {
	const body = (await request("/chats/direct", {
		method: "POST",
		token,
		body: JSON.stringify({ with_user_id: withUserId }),
	})) as { chat_id: string };
	return body.chat_id;
}

// Idempotent, like createDirectChat — always resolves to the same chat_id
// for this user, creating their "Saved Messages" the first time it's asked
// for.
export async function getOrCreateSavedMessages(token: string): Promise<string> {
	const body = (await request("/chats/saved", {
		method: "POST",
		token,
	})) as { chat_id: string };
	return body.chat_id;
}

export type MediaUploadKind = "image" | "file" | "round_video" | "voice";

export type UploadedMedia = {
	mediaId: string;
	kind: string;
	mime: string;
	name: string | null;
	size: number;
};

// POSTs the raw bytes directly (not multipart/JSON) — the gateway reads the
// body as-is and takes kind/name from the query string, mime from
// Content-Type. Returns just the bits needed to reference it in a
// SendMessage; the server mints the actual signed URL when the message is
// broadcast, not here.
export async function uploadMedia(
	token: string,
	chatId: string,
	kind: MediaUploadKind,
	mime: string,
	bytes: Blob | ArrayBuffer | Uint8Array,
	name?: string,
): Promise<UploadedMedia> {
	const params = new URLSearchParams({ kind });
	if (name) params.set("name", name);
	const res = await fetch(`${HTTP_URL}/chats/${chatId}/media?${params}`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": mime,
		},
		body: bytes as BodyInit,
	});
	const text = await res.text();
	const body = text ? safeJsonParse(text) : null;
	if (!res.ok) {
		throw new ApiError(
			res.status,
			typeof body === "string" ? body : text || res.statusText,
		);
	}
	const raw = body as {
		media_id: string;
		kind: string;
		mime: string;
		name: string | null;
		size: number;
	};
	return {
		mediaId: raw.media_id,
		kind: raw.kind,
		mime: raw.mime,
		name: raw.name,
		size: raw.size,
	};
}

// Clears the caller's own view of this chat's history. The other
// participant's copy is untouched.
export async function clearChat(token: string, chatId: string): Promise<void> {
	await request(`/chats/${chatId}/clear`, { method: "POST", token });
}

export async function archiveChat(
	token: string,
	chatId: string,
): Promise<void> {
	await request(`/chats/${chatId}/archive`, { method: "POST", token });
}

export async function unarchiveChat(
	token: string,
	chatId: string,
): Promise<void> {
	await request(`/chats/${chatId}/unarchive`, { method: "POST", token });
}

// "Deletes" the chat for the caller only — it drops out of their list and
// they stop receiving it over the WebSocket, but the other participant's
// copy and every message are untouched. Messaging the same person again
// later starts a brand new chat.
export async function leaveChat(token: string, chatId: string): Promise<void> {
	await request(`/chats/${chatId}`, { method: "DELETE", token });
}

export async function blockUser(token: string, userId: string): Promise<void> {
	await request(`/users/${userId}/block`, { method: "POST", token });
}

export async function unblockUser(
	token: string,
	userId: string,
): Promise<void> {
	await request(`/users/${userId}/unblock`, { method: "POST", token });
}

export type BlockedUser = { userId: string; username: string };

export async function listBlocked(token: string): Promise<BlockedUser[]> {
	const body = (await request("/blocks", { token })) as {
		user_id: string;
		username: string;
	}[];
	return body.map((b) => ({ userId: b.user_id, username: b.username }));
}

// Records a spam report and always blocks the reported user. Pass chatId
// to also leave that chat for the caller — the common "block, report, and
// get rid of the conversation" single action for unwanted contacts.
export async function reportSpam(
	token: string,
	userId: string,
	chatId?: string,
): Promise<void> {
	await request(`/users/${userId}/report-spam`, {
		method: "POST",
		token,
		body: JSON.stringify({ chat_id: chatId }),
	});
}

// Copies a media attachment server-side into another chat, returning a new
// media_id scoped to that chat — forwarding a photo/file/round-video never
// round-trips the bytes through the client. The caller must be a member of
// both chats. Still a two-step dance like upload: call this, then send a
// SendMessage in the destination chat referencing the returned media_id.
export async function forwardMedia(
	token: string,
	sourceChatId: string,
	destChatId: string,
	mediaId: string,
): Promise<UploadedMedia> {
	const raw = (await request(`/chats/${destChatId}/media/forward`, {
		method: "POST",
		token,
		body: JSON.stringify({ source_chat_id: sourceChatId, media_id: mediaId }),
	})) as {
		media_id: string;
		kind: string;
		mime: string;
		name: string | null;
		size: number;
	};
	return {
		mediaId: raw.media_id,
		kind: raw.kind,
		mime: raw.mime,
		name: raw.name,
		size: raw.size,
	};
}
