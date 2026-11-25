"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "@/lib/chat/api";
import {
	avatarForUsername,
	colorForUsername,
	compareSnowflakeIds,
} from "@/lib/chat/presentation";
import {
	clearSession,
	loadSession,
	type Session,
	saveSession,
} from "@/lib/chat/session";
import {
	playNotificationSound,
	playRingtone,
	RINGTONE_INTERVAL_MS,
	SOUND_THEMES,
	type SoundTheme,
} from "@/lib/chat/sound";
import { stripFormatting } from "@/lib/chat/textFormat";
import { Op } from "@/lib/proto/chat";
import { GatewayClient } from "@/lib/ws/client";

export type UIMedia = {
	mediaId: string;
	kind: string;
	mime: string;
	name: string | null;
	size: number;
	durationMs: number | null;
	url: string;
};

export type UIReplyPreview = {
	messageId: string;
	authorId: string;
	text: string;
	mediaKind: string | null;
	deleted: boolean;
};

export type UIForwardedFrom = {
	userId: string;
	username: string;
};

export type UIMessage = {
	id: string;
	text: string;
	time: string;
	fromMe: boolean;
	media?: UIMedia;
	replyTo?: UIReplyPreview;
	forwardedFrom?: UIForwardedFrom;
	editedAtMs?: number;
	deleted?: boolean;
	isCallEvent?: boolean;
	// Only meaningful when isCallEvent is true: did the two of you actually
	// connect at any point during this call, regardless of how it ended?
	callAnswered?: boolean;
};

function mediaFromProto(media: {
	mediaId: bigint;
	kind: string;
	mime: string;
	name: string;
	size: bigint;
	durationMs: bigint;
	url: string;
}): UIMedia {
	return {
		mediaId: String(media.mediaId),
		kind: media.kind,
		mime: media.mime,
		name: media.name || null,
		size: Number(media.size),
		durationMs: media.durationMs ? Number(media.durationMs) : null,
		url: media.url,
	};
}

function mediaFromApi(media: api.ApiMedia | null): UIMedia | undefined {
	if (!media) return undefined;
	return {
		mediaId: media.mediaId,
		kind: media.kind,
		mime: media.mime,
		name: media.name,
		size: media.size,
		durationMs: media.durationMs,
		url: media.url,
	};
}

function replyToFromProto(
	preview:
		| { messageId: bigint; authorId: bigint; text: string; mediaKind: string }
		| undefined,
): UIReplyPreview | undefined {
	if (!preview) return undefined;
	return {
		messageId: String(preview.messageId),
		authorId: String(preview.authorId),
		text: preview.text,
		mediaKind: preview.mediaKind || null,
		deleted: false,
	};
}

function replyToFromApi(
	preview: api.ApiReplyPreview | null,
): UIReplyPreview | undefined {
	if (!preview) return undefined;
	return {
		messageId: preview.messageId,
		authorId: preview.authorId,
		text: preview.text,
		mediaKind: preview.mediaKind,
		deleted: preview.deleted,
	};
}

function forwardedFromFromProto(
	forwardedFrom: { userId: bigint; username: string } | undefined,
): UIForwardedFrom | undefined {
	if (!forwardedFrom) return undefined;
	return {
		userId: String(forwardedFrom.userId),
		username: forwardedFrom.username,
	};
}

function forwardedFromFromApi(
	forwardedFrom: api.ApiForwardedFrom | null,
): UIForwardedFrom | undefined {
	if (!forwardedFrom) return undefined;
	return { userId: forwardedFrom.userId, username: forwardedFrom.username };
}

export type UIConversation = {
	id: string; // chat_id
	name: string; // other participant's username
	otherUserId: string;
	avatar: string;
	color: string;
	preview: string;
	time: string;
	status: "online";
	messages: UIMessage[];
	partnerTyping: boolean;
	hasMoreHistory: boolean;
	unreadCount: number;
	// "Saved Messages" — a chat with no second member, used as a personal
	// notes-to-self space. `otherUserId`/`name` are the caller's own
	// identity in this case; the UI labels it distinctly rather than
	// showing it as if it were a chat with another person.
	isSelf: boolean;
	archived: boolean;
};

export type CallStatus =
	| "idle"
	| "outgoing" // we invited, waiting for their answer
	| "incoming" // they invited, waiting for us to accept/decline
	| "connecting" // accepted, negotiating WebRTC
	| "active";

export type CallState = {
	status: CallStatus;
	callId: string | null;
	chatId: string | null;
	video: boolean;
	remoteUsername: string | null;
	localStream: MediaStream | null;
	remoteStream: MediaStream | null;
	muted: boolean;
	videoOff: boolean;
	connectedAt: number | null;
	amICaller: boolean;
	error: string | null;
};

const IDLE_CALL: CallState = {
	status: "idle",
	callId: null,
	chatId: null,
	video: false,
	remoteUsername: null,
	localStream: null,
	remoteStream: null,
	muted: false,
	videoOff: false,
	connectedAt: null,
	amICaller: false,
	error: null,
};

const SNOWFLAKE_EPOCH_MS = 1_704_067_200_000;

// A display-only ID for synthetic "call ended" entries in the message list
// — never sent anywhere, so it doesn't need real uniqueness. It copies the
// server's Snowflake bit layout (see chat-common::snowflake on the backend)
// just enough that it sorts correctly alongside real message IDs, which
// also encode time in the same high bits.
function fakeSnowflakeId(atMs: number): string {
	return (BigInt(Math.max(0, atMs - SNOWFLAKE_EPOCH_MS)) << 22n).toString();
}

function formatCallDuration(totalSeconds: number): string {
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function callOutcomeLabel(call: CallState): string {
	if (call.status === "active" && call.connectedAt) {
		const seconds = Math.max(
			0,
			Math.round((Date.now() - call.connectedAt) / 1000),
		);
		return `Call ended · ${formatCallDuration(seconds)}`;
	}
	if (call.status === "incoming") return "Missed call";
	return "Call ended";
}

// No TURN server — only Google's public STUN. Fine on the same network or
// behind simple NATs; calls across stricter/symmetric NATs can fail to
// connect. A TURN relay is the Phase 2 fix, not something to fake here.
const RTC_CONFIG: RTCConfiguration = {
	iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};
const CALL_RING_TIMEOUT_MS = 30_000;

const TYPING_EXPIRY_MS = 4_000;
const TYPING_SEND_THROTTLE_MS = 1_500;
const SOUND_STORAGE_KEY = "chat-sound-theme";
const RINGTONE_STORAGE_KEY = "chat-ringtone-enabled";

function loadSoundTheme(): SoundTheme {
	try {
		const stored = localStorage.getItem(SOUND_STORAGE_KEY);
		if (SOUND_THEMES.includes(stored as SoundTheme))
			return stored as SoundTheme;
	} catch {
		// ignored — falls through to the default
	}
	return "chime";
}

function loadRingtoneEnabled(): boolean {
	try {
		const stored = localStorage.getItem(RINGTONE_STORAGE_KEY);
		if (stored !== null) return stored === "true";
	} catch {
		// ignored — falls through to the default
	}
	return true;
}

const WS_URL =
	process.env.NEXT_PUBLIC_GATEWAY_WS_URL ?? "ws://127.0.0.1:8080/ws";

function formatTime(createdAtMs: number): string {
	return new Date(createdAtMs).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	});
}

// The sidebar preview for a message: a deleted one always wins (there's
// nothing left to show), then the media kind's icon/label with any caption
// appended rather than replacing it, then plain text.
function previewTextFor(
	rawText: string,
	mediaKind: string | null,
	deleted: boolean,
): string {
	if (deleted) return "🚫 Message deleted";
	const text = stripFormatting(rawText);
	const label =
		mediaKind === "image"
			? "📷 Photo"
			: mediaKind === "round_video"
				? "⏺ Round video"
				: mediaKind === "file"
					? "📎 File"
					: mediaKind === "voice"
						? "🎤 Voice message"
						: null;
	if (!label) return text;
	return text ? `${label.split(" ")[0]} ${text}` : label;
}

export function useChatSession() {
	const [session, setSession] = useState<Session | null>(null);
	const [sessionLoaded, setSessionLoaded] = useState(false);
	const [authBusy, setAuthBusy] = useState(false);
	const [authError, setAuthError] = useState<string | null>(null);
	const [wsStatus, setWsStatus] = useState<"connecting" | "open" | "closed">(
		"closed",
	);
	const [conversations, setConversations] = useState<
		Record<string, UIConversation>
	>({});
	const [order, setOrder] = useState<string[]>([]);
	const [soundTheme, setSoundThemeState] = useState<SoundTheme>("chime");
	const [call, setCall] = useState<CallState>(IDLE_CALL);
	const [ringtoneEnabled, setRingtoneEnabledState] = useState(true);
	const [ringtoneMutedForCall, setRingtoneMutedForCall] = useState(false);
	const [uploadingMedia, setUploadingMedia] = useState<Record<string, boolean>>(
		{},
	);
	const [blockedUsers, setBlockedUsers] = useState<api.BlockedUser[]>([]);

	const clientRef = useRef<GatewayClient | null>(null);
	const loadedChatsRef = useRef<Set<string>>(new Set());
	const conversationsRef = useRef<Record<string, UIConversation>>({});
	const soundThemeRef = useRef<SoundTheme>(soundTheme);
	const typingTimeoutsRef = useRef<
		Record<string, ReturnType<typeof setTimeout>>
	>({});
	const lastTypingSentRef = useRef<Record<string, number>>({});
	const activeChatIdRef = useRef<string | null>(null);
	const callRef = useRef<CallState>(call);
	const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
	const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
	const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const ringtoneIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
		null,
	);

	useEffect(() => {
		conversationsRef.current = conversations;
	}, [conversations]);

	useEffect(() => {
		soundThemeRef.current = soundTheme;
	}, [soundTheme]);

	useEffect(() => {
		callRef.current = call;
	}, [call]);

	useEffect(() => {
		setSession(loadSession());
		setSoundThemeState(loadSoundTheme());
		setRingtoneEnabledState(loadRingtoneEnabled());
		setSessionLoaded(true);
	}, []);

	// Rings for as long as the call is outgoing/incoming, stopping the
	// instant it connects, ends, or the user mutes/disables it — replaying
	// the two-note pattern on an interval rather than looping it internally
	// keeps "stop ringing" a plain clearInterval.
	useEffect(() => {
		const shouldRing =
			(call.status === "outgoing" || call.status === "incoming") &&
			ringtoneEnabled &&
			!ringtoneMutedForCall;

		if (shouldRing && !ringtoneIntervalRef.current) {
			playRingtone();
			ringtoneIntervalRef.current = setInterval(
				playRingtone,
				RINGTONE_INTERVAL_MS,
			);
		}
		if (!shouldRing && ringtoneIntervalRef.current) {
			clearInterval(ringtoneIntervalRef.current);
			ringtoneIntervalRef.current = null;
		}
	}, [call.status, ringtoneEnabled, ringtoneMutedForCall]);

	useEffect(() => {
		if (call.status === "idle") setRingtoneMutedForCall(false);
	}, [call.status]);

	const setSoundTheme = useCallback((theme: SoundTheme) => {
		setSoundThemeState(theme);
		try {
			localStorage.setItem(SOUND_STORAGE_KEY, theme);
		} catch {
			// per-viewer convenience only — fine if it doesn't persist
		}
	}, []);

	const setRingtoneEnabled = useCallback((enabled: boolean) => {
		setRingtoneEnabledState(enabled);
		try {
			localStorage.setItem(RINGTONE_STORAGE_KEY, String(enabled));
		} catch {
			// per-viewer convenience only — fine if it doesn't persist
		}
	}, []);

	const muteRing = useCallback(() => {
		setRingtoneMutedForCall(true);
	}, []);

	const upsertConversation = useCallback(
		(chatId: string, patch: Partial<UIConversation> & { name: string }) => {
			setConversations((current) => {
				const existing = current[chatId];
				const next: UIConversation = {
					id: chatId,
					otherUserId: existing?.otherUserId ?? "",
					avatar: existing?.avatar ?? avatarForUsername(patch.name),
					color: existing?.color ?? colorForUsername(patch.name),
					status: "online",
					preview: existing?.preview ?? "",
					time: existing?.time ?? "",
					messages: existing?.messages ?? [],
					partnerTyping: existing?.partnerTyping ?? false,
					hasMoreHistory: existing?.hasMoreHistory ?? true,
					unreadCount: existing?.unreadCount ?? 0,
					isSelf: existing?.isSelf ?? false,
					archived: existing?.archived ?? false,
					...patch,
				};
				return { ...current, [chatId]: next };
			});
			setOrder((current) => [chatId, ...current.filter((id) => id !== chatId)]);
		},
		[],
	);

	const refreshChats = useCallback(async () => {
		if (!session) return;
		const chats = await api.listChats(session.token);
		for (const chat of chats) {
			upsertConversation(chat.chatId, {
				name: chat.otherUsername,
				otherUserId: chat.otherUserId,
				isSelf: chat.isSelf,
				archived: chat.isArchived,
				preview: previewTextFor(
					chat.lastMessage?.text ?? "",
					chat.lastMessage?.mediaKind ?? null,
					chat.lastMessage?.deleted ?? false,
				),
				time: chat.lastMessage ? formatTime(chat.lastMessage.createdAtMs) : "",
			});
		}
	}, [session, upsertConversation]);

	// Saved Messages always exists, the same way it does in Telegram — this
	// just makes sure it's been created (idempotent) and present in the
	// sidebar from the moment the session loads, not only after the user
	// first opens it.
	const ensureSavedMessages = useCallback(async () => {
		if (!session) return;
		try {
			const chatId = await api.getOrCreateSavedMessages(session.token);
			upsertConversation(chatId, {
				name: session.username,
				otherUserId: session.userId,
				isSelf: true,
			});
		} catch {
			// non-critical — it'll show up next time refreshChats runs anyway
			// if it already existed, or on the next successful call otherwise
		}
	}, [session, upsertConversation]);

	const refreshBlocked = useCallback(async () => {
		if (!session) return;
		try {
			setBlockedUsers(await api.listBlocked(session.token));
		} catch {
			// non-critical — the list just stays stale until the next refresh
		}
	}, [session]);

	// Patches a single already-loaded message in place (used for edit/delete
	// broadcasts) and, when that message happens to be the chat's latest,
	// refreshes the sidebar preview/time to match — a no-op if the message
	// isn't currently loaded for this chat.
	const updateMessageInPlace = useCallback(
		(
			chatId: string,
			messageId: string,
			updater: (message: UIMessage) => UIMessage,
		) => {
			setConversations((current) => {
				const existing = current[chatId];
				if (!existing) return current;
				let changed = false;
				const messages = existing.messages.map((m) => {
					if (m.id !== messageId) return m;
					changed = true;
					return updater(m);
				});
				if (!changed) return current;
				const last = messages[messages.length - 1];
				const isLatest = last?.id === messageId;
				return {
					...current,
					[chatId]: {
						...existing,
						messages,
						...(isLatest
							? {
									preview: previewTextFor(
										last.text,
										last.media?.kind ?? null,
										last.deleted ?? false,
									),
									time: last.time,
								}
							: {}),
					},
				};
			});
		},
		[],
	);

	const setPartnerTyping = useCallback((chatId: string, typing: boolean) => {
		setConversations((current) => {
			const existing = current[chatId];
			if (!existing || existing.partnerTyping === typing) return current;
			return { ...current, [chatId]: { ...existing, partnerTyping: typing } };
		});
	}, []);

	// Tells the hook which chat the user is currently looking at, so the
	// message dispatcher knows not to bump its unread badge, and clears
	// whatever badge that chat already had — opening a chat is "I've seen
	// this" regardless of exact scroll position within it.
	const setActiveChatId = useCallback((chatId: string | null) => {
		activeChatIdRef.current = chatId;
		if (!chatId) return;
		setConversations((current) => {
			const existing = current[chatId];
			if (!existing || existing.unreadCount === 0) return current;
			return { ...current, [chatId]: { ...existing, unreadCount: 0 } };
		});
	}, []);

	const appendMessage = useCallback((chatId: string, message: UIMessage) => {
		setConversations((current) => {
			const existing = current[chatId];
			if (!existing) return current;
			if (existing.messages.some((m) => m.id === message.id)) return current;
			return {
				...current,
				[chatId]: {
					...existing,
					messages: [...existing.messages, message].sort((a, b) =>
						compareSnowflakeIds(a.id, b.id),
					),
					preview: previewTextFor(
						message.text,
						message.media?.kind ?? null,
						message.deleted ?? false,
					),
					time: message.time,
				},
			};
		});
		setOrder((current) =>
			current.includes(chatId)
				? [chatId, ...current.filter((id) => id !== chatId)]
				: current,
		);
	}, []);

	// Call outcomes (ended/missed/declined) show up as entries in the chat
	// thread itself, just like messages — and since appendMessage also
	// updates preview/time, the sidebar's "last activity" reflects the call
	// too. This is purely client-side (never sent to or stored by the
	// server), so it won't survive a reload or appear for the other
	// participant unless their own client logs the same outcome.
	const logCallEvent = useCallback(
		(chatId: string, label: string, answered: boolean, fromMe: boolean) => {
			const atMs = Date.now();
			appendMessage(chatId, {
				id: fakeSnowflakeId(atMs),
				text: label,
				time: formatTime(atMs),
				fromMe,
				isCallEvent: true,
				callAnswered: answered,
			});
		},
		[appendMessage],
	);

	const resetCall = useCallback(() => {
		peerConnectionRef.current?.close();
		peerConnectionRef.current = null;
		pendingIceRef.current = [];
		if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
		ringTimeoutRef.current = null;
		for (const track of callRef.current.localStream?.getTracks() ?? []) {
			track.stop();
		}
		setCall(IDLE_CALL);
	}, []);

	// Both sides build the connection identically once a call is accepted;
	// only who creates the SDP offer vs. answer differs.
	const createPeerConnection = useCallback(
		(chatId: string, callId: string): RTCPeerConnection => {
			const pc = new RTCPeerConnection(RTC_CONFIG);
			pc.onicecandidate = (event) => {
				if (event.candidate) {
					clientRef.current?.sendCallSignal(
						BigInt(chatId),
						callId,
						"ice",
						JSON.stringify(event.candidate),
					);
				}
			};
			pc.ontrack = (event) => {
				setCall((current) =>
					current.callId === callId
						? { ...current, remoteStream: event.streams[0] }
						: current,
				);
			};
			pc.onconnectionstatechange = () => {
				if (pc.connectionState === "connected") {
					setCall((current) =>
						current.callId === callId
							? {
									...current,
									status: "active",
									connectedAt: current.connectedAt ?? Date.now(),
								}
							: current,
					);
				}
			};
			return pc;
		},
		[],
	);

	// (Re)connects the gateway WebSocket. The server snapshots chat
	// membership at `Hello` time, so this also doubles as "pick up any chat
	// created since the last connect" — see README's Phase 1 limitations.
	const connectGateway = useCallback(
		(current: Session) => {
			clientRef.current?.close();
			const client = new GatewayClient({
				url: WS_URL,
				token: current.token,
				deviceId: "web",
				onOpen: () => setWsStatus("open"),
				onClose: () => setWsStatus("closed"),
			});
			clientRef.current = client;
			setWsStatus("connecting");

			client.onMessage((envelope) => {
				if (
					envelope.op === Op.OP_MESSAGE_CREATED &&
					envelope.payload?.$case === "messageCreated"
				) {
					const m = envelope.payload.messageCreated;
					const chatId = String(m.chatId);
					const message: UIMessage = {
						id: String(m.id),
						text: m.text,
						time: formatTime(Number(m.createdAtMs)),
						fromMe: String(m.authorId) === current.userId,
						media: m.media && mediaFromProto(m.media),
						replyTo: replyToFromProto(m.replyPreview),
						forwardedFrom: forwardedFromFromProto(m.forwardedFrom),
					};

					if (!conversationsRef.current[chatId]) {
						// A chat we don't know about yet (someone just
						// started one with us) — pull the chat list and
						// reconnect to subscribe to it; its history already
						// has this message.
						void refreshChats().then(() => connectGateway(current));
						return;
					}
					setPartnerTyping(chatId, false);
					clearTimeout(typingTimeoutsRef.current[chatId]);
					appendMessage(chatId, message);
					if (!message.fromMe) {
						playNotificationSound(soundThemeRef.current);
						if (chatId !== activeChatIdRef.current) {
							setConversations((conversationsState) => {
								const existing = conversationsState[chatId];
								if (!existing) return conversationsState;
								return {
									...conversationsState,
									[chatId]: {
										...existing,
										unreadCount: existing.unreadCount + 1,
									},
								};
							});
						}
					}
					return;
				}

				if (
					envelope.op === Op.OP_MESSAGE_EDITED &&
					envelope.payload?.$case === "messageEdited"
				) {
					const e = envelope.payload.messageEdited;
					updateMessageInPlace(String(e.chatId), String(e.id), (m) => ({
						...m,
						text: e.text,
						editedAtMs: Number(e.editedAtMs),
					}));
					return;
				}

				if (
					envelope.op === Op.OP_MESSAGE_DELETED &&
					envelope.payload?.$case === "messageDeleted"
				) {
					const e = envelope.payload.messageDeleted;
					updateMessageInPlace(String(e.chatId), String(e.id), (m) => ({
						...m,
						text: "",
						media: undefined,
						deleted: true,
					}));
					return;
				}

				if (
					envelope.op === Op.OP_TYPING &&
					envelope.payload?.$case === "typing"
				) {
					const t = envelope.payload.typing;
					const chatId = String(t.chatId);
					if (String(t.userId) === current.userId) return;
					if (!conversationsRef.current[chatId]) return;

					setPartnerTyping(chatId, true);
					clearTimeout(typingTimeoutsRef.current[chatId]);
					typingTimeoutsRef.current[chatId] = setTimeout(() => {
						setPartnerTyping(chatId, false);
					}, TYPING_EXPIRY_MS);
					return;
				}

				if (
					envelope.op === Op.OP_CALL_INVITE &&
					envelope.payload?.$case === "callInvite"
				) {
					const invite = envelope.payload.callInvite;
					if (String(invite.userId) === current.userId) return;
					if (callRef.current.status !== "idle") {
						// Already on a call (or calling someone) — decline
						// automatically instead of silently dropping it.
						clientRef.current?.sendCallAnswer(
							invite.chatId,
							invite.callId,
							false,
						);
						return;
					}
					const chatId = String(invite.chatId);
					if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
					setCall({
						...IDLE_CALL,
						status: "incoming",
						callId: invite.callId,
						chatId,
						video: invite.video,
						remoteUsername: conversationsRef.current[chatId]?.name ?? null,
					});
					ringTimeoutRef.current = setTimeout(() => {
						if (
							callRef.current.callId === invite.callId &&
							callRef.current.status === "incoming"
						) {
							logCallEvent(
								chatId,
								"Missed call",
								false,
								callRef.current.amICaller,
							);
							resetCall();
						}
					}, CALL_RING_TIMEOUT_MS);
					return;
				}

				if (
					envelope.op === Op.OP_CALL_ANSWER &&
					envelope.payload?.$case === "callAnswer"
				) {
					const answer = envelope.payload.callAnswer;
					if (String(answer.userId) === current.userId) return;
					if (callRef.current.callId !== answer.callId) return;
					if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);

					if (!answer.accepted) {
						if (callRef.current.chatId) {
							logCallEvent(
								callRef.current.chatId,
								"Call declined",
								false,
								callRef.current.amICaller,
							);
						}
						resetCall();
						return;
					}
					// They accepted — we're the caller, so we create the offer.
					const { chatId, localStream } = callRef.current;
					if (!chatId || !localStream) return;
					const pc = createPeerConnection(chatId, answer.callId);
					peerConnectionRef.current = pc;
					for (const track of localStream.getTracks()) {
						pc.addTrack(track, localStream);
					}
					setCall((c) => ({ ...c, status: "connecting" }));
					void (async () => {
						const offer = await pc.createOffer();
						await pc.setLocalDescription(offer);
						clientRef.current?.sendCallSignal(
							BigInt(chatId),
							answer.callId,
							"offer",
							JSON.stringify(offer),
						);
					})();
					return;
				}

				if (
					envelope.op === Op.OP_CALL_SIGNAL &&
					envelope.payload?.$case === "callSignal"
				) {
					const signal = envelope.payload.callSignal;
					if (String(signal.userId) === current.userId) return;
					if (callRef.current.callId !== signal.callId) return;
					const pc = peerConnectionRef.current;
					if (!pc) return;

					if (signal.kind === "offer") {
						void (async () => {
							await pc.setRemoteDescription(JSON.parse(signal.data));
							for (const candidate of pendingIceRef.current) {
								await pc.addIceCandidate(candidate);
							}
							pendingIceRef.current = [];
							const answer = await pc.createAnswer();
							await pc.setLocalDescription(answer);
							clientRef.current?.sendCallSignal(
								signal.chatId,
								signal.callId,
								"answer",
								JSON.stringify(answer),
							);
						})();
					} else if (signal.kind === "answer") {
						void pc
							.setRemoteDescription(JSON.parse(signal.data))
							.then(async () => {
								for (const candidate of pendingIceRef.current) {
									await pc.addIceCandidate(candidate);
								}
								pendingIceRef.current = [];
							});
					} else if (signal.kind === "ice") {
						const candidate = JSON.parse(signal.data);
						if (pc.remoteDescription) {
							void pc.addIceCandidate(candidate);
						} else {
							pendingIceRef.current.push(candidate);
						}
					}
					return;
				}

				if (
					envelope.op === Op.OP_CALL_END &&
					envelope.payload?.$case === "callEnd"
				) {
					const end = envelope.payload.callEnd;
					if (String(end.userId) === current.userId) return;
					if (callRef.current.callId !== end.callId) return;
					if (callRef.current.chatId) {
						logCallEvent(
							callRef.current.chatId,
							callOutcomeLabel(callRef.current),
							callRef.current.connectedAt !== null,
							callRef.current.amICaller,
						);
					}
					resetCall();
				}
			});

			client.connect();
		},
		[
			appendMessage,
			refreshChats,
			setPartnerTyping,
			resetCall,
			createPeerConnection,
			logCallEvent,
			updateMessageInPlace,
		],
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reconnect is driven by session identity, not these callbacks' identities
	useEffect(() => {
		if (!session) return;
		void refreshChats();
		void refreshBlocked();
		// The gateway snapshots chat membership at Hello time, so the very
		// first-ever creation of Saved Messages has to resolve *before*
		// connecting — otherwise this connection never subscribes to it,
		// and a message sent into it in this same session would silently
		// never echo back (no optimistic local append exists for any
		// message, so it would just appear to do nothing).
		void ensureSavedMessages().then(() => connectGateway(session));
		return () => {
			clientRef.current?.close();
			clientRef.current = null;
		};
	}, [session]);

	const ensureMessagesLoaded = useCallback(
		async (chatId: string) => {
			if (!session || loadedChatsRef.current.has(chatId)) return;
			loadedChatsRef.current.add(chatId);
			const history = await api.listMessages(session.token, chatId);
			setConversations((current) => {
				const existing = current[chatId];
				if (!existing) return current;
				const byId = new Map(existing.messages.map((m) => [m.id, m]));
				for (const m of history) {
					byId.set(m.id, {
						id: m.id,
						text: m.text,
						time: formatTime(m.createdAtMs),
						fromMe: m.authorId === session.userId,
						media: mediaFromApi(m.media),
						replyTo: replyToFromApi(m.replyPreview),
						forwardedFrom: forwardedFromFromApi(m.forwardedFrom),
						editedAtMs: m.editedAtMs ?? undefined,
						deleted: m.deleted,
					});
				}
				const messages = [...byId.values()].sort((a, b) =>
					compareSnowflakeIds(a.id, b.id),
				);
				return {
					...current,
					[chatId]: {
						...existing,
						messages,
						hasMoreHistory: history.length >= api.MESSAGE_PAGE_SIZE,
					},
				};
			});
		},
		[session],
	);

	const loadingOlderRef = useRef<Set<string>>(new Set());

	// Infinite scroll upward: fetches the page older than the earliest
	// message currently held for this chat and prepends it. No-op if the
	// initial page hasn't loaded yet, a fetch is already in flight, or the
	// chat has already told us there's nothing older.
	const loadOlderMessages = useCallback(
		async (chatId: string) => {
			if (!session || loadingOlderRef.current.has(chatId)) return;
			const conversation = conversationsRef.current[chatId];
			const oldest = conversation?.messages[0];
			if (!conversation || !oldest || !conversation.hasMoreHistory) return;

			loadingOlderRef.current.add(chatId);
			try {
				const older = await api.listMessages(session.token, chatId, {
					before: oldest.id,
				});
				setConversations((current) => {
					const existing = current[chatId];
					if (!existing) return current;
					const byId = new Map(existing.messages.map((m) => [m.id, m]));
					for (const m of older) {
						byId.set(m.id, {
							id: m.id,
							text: m.text,
							time: formatTime(m.createdAtMs),
							fromMe: m.authorId === session.userId,
							media: mediaFromApi(m.media),
							replyTo: replyToFromApi(m.replyPreview),
							forwardedFrom: forwardedFromFromApi(m.forwardedFrom),
							editedAtMs: m.editedAtMs ?? undefined,
							deleted: m.deleted,
						});
					}
					const messages = [...byId.values()].sort((a, b) =>
						compareSnowflakeIds(a.id, b.id),
					);
					return {
						...current,
						[chatId]: {
							...existing,
							messages,
							hasMoreHistory: older.length >= api.MESSAGE_PAGE_SIZE,
						},
					};
				});
			} finally {
				loadingOlderRef.current.delete(chatId);
			}
		},
		[session],
	);

	const register = useCallback(async (username: string, password: string) => {
		setAuthBusy(true);
		setAuthError(null);
		try {
			const { userId, token } = await api.register(username, password);
			const next: Session = { token, userId, username };
			saveSession(next);
			setSession(next);
		} catch (err) {
			setAuthError(
				err instanceof api.ApiError ? err.message : "registration failed",
			);
		} finally {
			setAuthBusy(false);
		}
	}, []);

	const login = useCallback(async (username: string, password: string) => {
		setAuthBusy(true);
		setAuthError(null);
		try {
			const { userId, token } = await api.login(username, password);
			const next: Session = { token, userId, username };
			saveSession(next);
			setSession(next);
		} catch (err) {
			setAuthError(err instanceof api.ApiError ? err.message : "login failed");
		} finally {
			setAuthBusy(false);
		}
	}, []);

	const logout = useCallback(() => {
		clientRef.current?.close();
		clientRef.current = null;
		clearSession();
		setSession(null);
		setConversations({});
		setOrder([]);
		setBlockedUsers([]);
		loadedChatsRef.current.clear();
		loadingOlderRef.current.clear();
		for (const timeout of Object.values(typingTimeoutsRef.current))
			clearTimeout(timeout);
		typingTimeoutsRef.current = {};
		lastTypingSentRef.current = {};
		activeChatIdRef.current = null;
		resetCall();
	}, [resetCall]);

	const startChat = useCallback(
		async (
			username: string,
		): Promise<{ ok: true; chatId: string } | { ok: false; error: string }> => {
			if (!session) return { ok: false, error: "not signed in" };
			try {
				const other = await api.lookupUser(session.token, username);
				const chatId = await api.createDirectChat(session.token, other.userId);
				upsertConversation(chatId, {
					name: other.username,
					otherUserId: other.userId,
				});
				connectGateway(session);
				return { ok: true, chatId };
			} catch (err) {
				return {
					ok: false,
					error:
						err instanceof api.ApiError ? err.message : "could not start chat",
				};
			}
		},
		[session, upsertConversation, connectGateway],
	);

	const searchUsers = useCallback(
		async (query: string) => {
			if (!session || !query.trim()) return [];
			try {
				return await api.searchUsers(session.token, query.trim());
			} catch {
				return [];
			}
		},
		[session],
	);

	const sendMessage = useCallback(
		(chatId: string, text: string, replyToId?: string) => {
			clientRef.current?.sendMessage(
				BigInt(chatId),
				text,
				crypto.randomUUID(),
				undefined,
				replyToId ? BigInt(replyToId) : undefined,
			);
		},
		[],
	);

	// Uploads the bytes over HTTP first (POST /chats/:id/media), then sends a
	// SendMessage referencing the resulting media_id — the two-step dance the
	// backend expects (see docs/API.md). `kind` drives both the server's
	// mime allow-list and how the bubble renders once it comes back.
	const sendMediaMessage = useCallback(
		async (
			chatId: string,
			kind: api.MediaUploadKind,
			blob: Blob,
			options: {
				caption?: string;
				name?: string;
				durationMs?: number;
				replyToId?: string;
			} = {},
		): Promise<{ ok: true } | { ok: false; error: string }> => {
			if (!session) return { ok: false, error: "not signed in" };
			setUploadingMedia((current) => ({ ...current, [chatId]: true }));
			try {
				const uploaded = await api.uploadMedia(
					session.token,
					chatId,
					kind,
					blob.type || "application/octet-stream",
					blob,
					options.name,
				);
				clientRef.current?.sendMessage(
					BigInt(chatId),
					options.caption ?? "",
					crypto.randomUUID(),
					{
						mediaId: BigInt(uploaded.mediaId),
						kind: uploaded.kind,
						mime: uploaded.mime,
						name: uploaded.name ?? "",
						size: BigInt(uploaded.size),
						durationMs: BigInt(Math.round(options.durationMs ?? 0)),
					},
					options.replyToId ? BigInt(options.replyToId) : undefined,
				);
				return { ok: true };
			} catch (err) {
				return {
					ok: false,
					error: err instanceof api.ApiError ? err.message : "upload failed",
				};
			} finally {
				setUploadingMedia((current) => {
					const next = { ...current };
					delete next[chatId];
					return next;
				});
			}
		},
		[session],
	);

	// Forwards a message the client already has loaded to another chat.
	// Text copies straight over; media is copied server-side (never
	// downloaded and re-uploaded through the client) via
	// POST /chats/:dest/media/forward, which mints it a fresh media_id in
	// the destination chat. Forwarding a message that's itself already a
	// forward keeps attribution to the *original* sender, matching how
	// Telegram/WhatsApp forwards never chain through intermediaries.
	const forwardMessage = useCallback(
		async (
			sourceChatId: string,
			message: UIMessage,
			destChatId: string,
		): Promise<{ ok: true } | { ok: false; error: string }> => {
			if (!session) return { ok: false, error: "not signed in" };
			const sourceConversation = conversationsRef.current[sourceChatId];
			const forwardedFrom = message.forwardedFrom
				? {
						userId: BigInt(message.forwardedFrom.userId),
						username: message.forwardedFrom.username,
					}
				: message.fromMe
					? { userId: BigInt(session.userId), username: session.username }
					: {
							userId: BigInt(sourceConversation?.otherUserId || "0"),
							username: sourceConversation?.name ?? "",
						};

			try {
				let media: Parameters<GatewayClient["sendMessage"]>[3];
				if (message.media) {
					const forwarded = await api.forwardMedia(
						session.token,
						sourceChatId,
						destChatId,
						message.media.mediaId,
					);
					media = {
						mediaId: BigInt(forwarded.mediaId),
						kind: forwarded.kind,
						mime: forwarded.mime,
						name: forwarded.name ?? "",
						size: BigInt(forwarded.size),
						durationMs: BigInt(message.media.durationMs ?? 0),
					};
				}
				clientRef.current?.sendMessage(
					BigInt(destChatId),
					message.text,
					crypto.randomUUID(),
					media,
					undefined,
					forwardedFrom,
				);
				return { ok: true };
			} catch (err) {
				return {
					ok: false,
					error: err instanceof api.ApiError ? err.message : "forward failed",
				};
			}
		},
		[session],
	);

	// Edit/delete are fire-and-forget over the WebSocket, same as
	// sendMessage — the UI updates once the broadcast comes back (even for
	// the sender's own tab), not optimistically.
	const editMessage = useCallback(
		(chatId: string, messageId: string, text: string) => {
			clientRef.current?.editMessage(BigInt(chatId), BigInt(messageId), text);
		},
		[],
	);

	const deleteMessage = useCallback((chatId: string, messageId: string) => {
		clientRef.current?.deleteMessage(BigInt(chatId), BigInt(messageId));
	}, []);

	// Clears the caller's own view only — the conversation stays in the
	// list (so the chat isn't surprise-deleted), just with empty history
	// until new messages arrive.
	const clearChat = useCallback(
		async (
			chatId: string,
		): Promise<{ ok: true } | { ok: false; error: string }> => {
			if (!session) return { ok: false, error: "not signed in" };
			try {
				await api.clearChat(session.token, chatId);
				setConversations((current) => {
					const existing = current[chatId];
					if (!existing) return current;
					return {
						...current,
						[chatId]: {
							...existing,
							messages: [],
							preview: "",
							time: "",
							hasMoreHistory: false,
						},
					};
				});
				return { ok: true };
			} catch (err) {
				return {
					ok: false,
					error:
						err instanceof api.ApiError ? err.message : "failed to clear chat",
				};
			}
		},
		[session],
	);

	// Toggles this chat's visibility in the caller's own main list — never
	// touches membership or the other member's view (see
	// `ChatService::archive_chat`/`unarchive_chat` on the backend).
	const setChatArchived = useCallback(
		async (
			chatId: string,
			archived: boolean,
		): Promise<{ ok: true } | { ok: false; error: string }> => {
			if (!session) return { ok: false, error: "not signed in" };
			try {
				if (archived) await api.archiveChat(session.token, chatId);
				else await api.unarchiveChat(session.token, chatId);
				setConversations((current) => {
					const existing = current[chatId];
					if (!existing) return current;
					return { ...current, [chatId]: { ...existing, archived } };
				});
				return { ok: true };
			} catch (err) {
				return {
					ok: false,
					error:
						err instanceof api.ApiError
							? err.message
							: `failed to ${archived ? "archive" : "unarchive"} chat`,
				};
			}
		},
		[session],
	);

	// "Deletes" the chat for the caller only — it disappears from their own
	// list; the other participant's copy and every message are untouched.
	const deleteChat = useCallback(
		async (
			chatId: string,
		): Promise<{ ok: true } | { ok: false; error: string }> => {
			if (!session) return { ok: false, error: "not signed in" };
			try {
				await api.leaveChat(session.token, chatId);
				setConversations((current) => {
					const next = { ...current };
					delete next[chatId];
					return next;
				});
				setOrder((current) => current.filter((id) => id !== chatId));
				loadedChatsRef.current.delete(chatId);
				return { ok: true };
			} catch (err) {
				return {
					ok: false,
					error:
						err instanceof api.ApiError ? err.message : "failed to delete chat",
				};
			}
		},
		[session],
	);

	const blockUser = useCallback(
		async (
			userId: string,
			username: string,
		): Promise<{ ok: true } | { ok: false; error: string }> => {
			if (!session) return { ok: false, error: "not signed in" };
			try {
				await api.blockUser(session.token, userId);
				setBlockedUsers((current) =>
					current.some((b) => b.userId === userId)
						? current
						: [...current, { userId, username }],
				);
				return { ok: true };
			} catch (err) {
				return {
					ok: false,
					error:
						err instanceof api.ApiError ? err.message : "failed to block user",
				};
			}
		},
		[session],
	);

	const unblockUser = useCallback(
		async (
			userId: string,
		): Promise<{ ok: true } | { ok: false; error: string }> => {
			if (!session) return { ok: false, error: "not signed in" };
			try {
				await api.unblockUser(session.token, userId);
				setBlockedUsers((current) =>
					current.filter((b) => b.userId !== userId),
				);
				return { ok: true };
			} catch (err) {
				return {
					ok: false,
					error:
						err instanceof api.ApiError
							? err.message
							: "failed to unblock user",
				};
			}
		},
		[session],
	);

	// Always blocks the reported user — reporting spam and continuing to
	// receive their messages isn't a real use case this exposes.
	// `chatId`, when given, also leaves that chat (see `deleteChat`).
	const reportSpam = useCallback(
		async (
			userId: string,
			username: string,
			chatId?: string,
		): Promise<{ ok: true } | { ok: false; error: string }> => {
			if (!session) return { ok: false, error: "not signed in" };
			try {
				await api.reportSpam(session.token, userId, chatId);
				setBlockedUsers((current) =>
					current.some((b) => b.userId === userId)
						? current
						: [...current, { userId, username }],
				);
				if (chatId) {
					setConversations((current) => {
						const next = { ...current };
						delete next[chatId];
						return next;
					});
					setOrder((current) => current.filter((id) => id !== chatId));
					loadedChatsRef.current.delete(chatId);
				}
				return { ok: true };
			} catch (err) {
				return {
					ok: false,
					error:
						err instanceof api.ApiError ? err.message : "failed to report spam",
				};
			}
		},
		[session],
	);

	const notifyTyping = useCallback((chatId: string) => {
		const now = Date.now();
		const last = lastTypingSentRef.current[chatId] ?? 0;
		if (now - last < TYPING_SEND_THROTTLE_MS) return;
		lastTypingSentRef.current[chatId] = now;
		clientRef.current?.sendTyping(BigInt(chatId));
	}, []);

	// Rings the other participant. Grabs local media up front (rather than
	// waiting for them to accept) so the caller can see/hear themselves
	// while it's ringing, and so the offer can include tracks immediately
	// once accepted.
	const startCall = useCallback(
		async (chatId: string, video: boolean) => {
			if (callRef.current.status !== "idle") return;
			let localStream: MediaStream;
			try {
				localStream = await navigator.mediaDevices.getUserMedia({
					audio: true,
					video,
				});
			} catch {
				setCall((c) => ({ ...c, error: "Could not access microphone/camera" }));
				return;
			}
			const callId = crypto.randomUUID();
			setCall({
				...IDLE_CALL,
				status: "outgoing",
				callId,
				chatId,
				video,
				remoteUsername: conversationsRef.current[chatId]?.name ?? null,
				localStream,
				amICaller: true,
			});
			clientRef.current?.sendCallInvite(BigInt(chatId), callId, video);
			ringTimeoutRef.current = setTimeout(() => {
				if (
					callRef.current.callId === callId &&
					callRef.current.status === "outgoing"
				) {
					clientRef.current?.sendCallEnd(BigInt(chatId), callId);
					logCallEvent(chatId, "No answer", false, true);
					resetCall();
				}
			}, CALL_RING_TIMEOUT_MS);
		},
		[resetCall, logCallEvent],
	);

	const acceptCall = useCallback(async () => {
		const { callId, chatId, video, status } = callRef.current;
		if (!callId || !chatId || status !== "incoming") return;
		if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);

		let localStream: MediaStream;
		try {
			localStream = await navigator.mediaDevices.getUserMedia({
				audio: true,
				video,
			});
		} catch {
			clientRef.current?.sendCallAnswer(BigInt(chatId), callId, false);
			resetCall();
			return;
		}

		const pc = createPeerConnection(chatId, callId);
		peerConnectionRef.current = pc;
		for (const track of localStream.getTracks())
			pc.addTrack(track, localStream);
		setCall((c) => ({ ...c, status: "connecting", localStream }));
		clientRef.current?.sendCallAnswer(BigInt(chatId), callId, true);
		// The caller's SDP offer arrives as a CallSignal and is handled in
		// the dispatcher above — nothing more to do here.
	}, [resetCall, createPeerConnection]);

	const declineCall = useCallback(() => {
		const { callId, chatId } = callRef.current;
		if (callId && chatId) {
			clientRef.current?.sendCallAnswer(BigInt(chatId), callId, false);
			logCallEvent(chatId, "Declined call", false, false);
		}
		resetCall();
	}, [resetCall, logCallEvent]);

	const endCall = useCallback(() => {
		const { callId, chatId } = callRef.current;
		if (callId && chatId) {
			clientRef.current?.sendCallEnd(BigInt(chatId), callId);
			logCallEvent(
				chatId,
				callOutcomeLabel(callRef.current),
				callRef.current.connectedAt !== null,
				callRef.current.amICaller,
			);
		}
		resetCall();
	}, [resetCall, logCallEvent]);

	const toggleMute = useCallback(() => {
		setCall((current) => {
			const nextMuted = !current.muted;
			for (const track of current.localStream?.getAudioTracks() ?? []) {
				track.enabled = !nextMuted;
			}
			return { ...current, muted: nextMuted };
		});
	}, []);

	const toggleVideo = useCallback(() => {
		setCall((current) => {
			const nextOff = !current.videoOff;
			for (const track of current.localStream?.getVideoTracks() ?? []) {
				track.enabled = !nextOff;
			}
			return { ...current, videoOff: nextOff };
		});
	}, []);

	return {
		sessionLoaded,
		session,
		authBusy,
		authError,
		wsStatus,
		conversations: order
			.map((id) => conversations[id])
			.filter((c): c is UIConversation => Boolean(c)),
		register,
		login,
		logout,
		startChat,
		searchUsers,
		sendMessage,
		sendMediaMessage,
		forwardMessage,
		editMessage,
		deleteMessage,
		clearChat,
		setChatArchived,
		deleteChat,
		blockUser,
		unblockUser,
		reportSpam,
		blockedUsers,
		uploadingMedia,
		notifyTyping,
		ensureMessagesLoaded,
		loadOlderMessages,
		setActiveChatId,
		soundTheme,
		setSoundTheme,
		call,
		startCall,
		acceptCall,
		declineCall,
		endCall,
		toggleMute,
		toggleVideo,
		ringtoneEnabled,
		setRingtoneEnabled,
		muteRing,
	};
}
