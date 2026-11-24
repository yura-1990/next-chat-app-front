import { Envelope, Op } from "@/lib/proto/chat";

type EnvelopePayload = Envelope["payload"];

type Listener = (envelope: Envelope) => void;

export type OutgoingMediaRef = {
	mediaId: bigint;
	kind: string;
	mime: string;
	name: string;
	size: bigint;
	durationMs: bigint;
};

export type OutgoingForwardedFrom = {
	userId: bigint;
	username: string;
};

export type GatewayClientOptions = {
	url: string;
	token: string;
	deviceId: string;
	onOpen?: () => void;
	onClose?: () => void;
};

/**
 * Thin reconnecting client for the Rust gateway's WebSocket protocol.
 * Phase-0 scope: hello handshake, heartbeat, send/receive one chat message.
 * No E2EE, no multiplexed subscriptions yet — those land with Phase 1 once
 * the gateway has real auth and fan-out.
 */
export class GatewayClient {
	private socket: WebSocket | null = null;
	private reconnectAttempt = 0;
	private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	private closedByUser = false;
	private readonly listeners = new Set<Listener>();

	constructor(private readonly opts: GatewayClientOptions) {}

	connect() {
		this.closedByUser = false;
		this.open();
	}

	close() {
		this.closedByUser = true;
		this.stopHeartbeat();
		this.socket?.close();
	}

	onMessage(listener: Listener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	sendMessage(
		chatId: bigint,
		text: string,
		clientNonce: string,
		media?: OutgoingMediaRef,
		replyToId?: bigint,
		forwardedFrom?: OutgoingForwardedFrom,
	) {
		this.send({
			op: Op.OP_SEND_MESSAGE,
			seq: 0n,
			payload: {
				$case: "sendMessage",
				sendMessage: {
					chatId,
					text,
					clientNonce,
					media: media && { ...media, url: "" },
					replyToId: replyToId ?? 0n,
					forwardedFrom,
				},
			},
		});
	}

	editMessage(chatId: bigint, messageId: bigint, text: string) {
		this.send({
			op: Op.OP_EDIT_MESSAGE,
			seq: 0n,
			payload: {
				$case: "editMessage",
				editMessage: { chatId, messageId, text },
			},
		});
	}

	deleteMessage(chatId: bigint, messageId: bigint) {
		this.send({
			op: Op.OP_DELETE_MESSAGE,
			seq: 0n,
			payload: {
				$case: "deleteMessage",
				deleteMessage: { chatId, messageId },
			},
		});
	}

	sendTyping(chatId: bigint) {
		this.send({
			op: Op.OP_TYPING,
			seq: 0n,
			payload: {
				$case: "typing",
				typing: { chatId, userId: 0n },
			},
		});
	}

	sendCallInvite(chatId: bigint, callId: string, video: boolean) {
		this.send({
			op: Op.OP_CALL_INVITE,
			seq: 0n,
			payload: {
				$case: "callInvite",
				callInvite: { chatId, callId, video, userId: 0n },
			},
		});
	}

	sendCallAnswer(chatId: bigint, callId: string, accepted: boolean) {
		this.send({
			op: Op.OP_CALL_ANSWER,
			seq: 0n,
			payload: {
				$case: "callAnswer",
				callAnswer: { chatId, callId, accepted, userId: 0n },
			},
		});
	}

	sendCallSignal(chatId: bigint, callId: string, kind: string, data: string) {
		this.send({
			op: Op.OP_CALL_SIGNAL,
			seq: 0n,
			payload: {
				$case: "callSignal",
				callSignal: { chatId, callId, kind, data, userId: 0n },
			},
		});
	}

	sendCallEnd(chatId: bigint, callId: string) {
		this.send({
			op: Op.OP_CALL_END,
			seq: 0n,
			payload: {
				$case: "callEnd",
				callEnd: { chatId, callId, userId: 0n },
			},
		});
	}

	private open() {
		const socket = new WebSocket(this.opts.url);
		socket.binaryType = "arraybuffer";
		this.socket = socket;

		socket.addEventListener("open", () => {
			this.reconnectAttempt = 0;
			this.send({
				op: Op.OP_HELLO,
				seq: 0n,
				payload: {
					$case: "hello",
					hello: { token: this.opts.token, deviceId: this.opts.deviceId },
				},
			});
			this.startHeartbeat();
			this.opts.onOpen?.();
		});

		socket.addEventListener("message", (event) => {
			const bytes = new Uint8Array(event.data as ArrayBuffer);
			const envelope = Envelope.decode(bytes);
			for (const listener of this.listeners) listener(envelope);
		});

		socket.addEventListener("close", () => {
			this.stopHeartbeat();
			this.opts.onClose?.();
			if (!this.closedByUser) this.scheduleReconnect();
		});

		socket.addEventListener("error", () => socket.close());
	}

	private scheduleReconnect() {
		const delayMs = Math.min(30_000, 500 * 2 ** this.reconnectAttempt);
		this.reconnectAttempt += 1;
		setTimeout(() => {
			if (!this.closedByUser) this.open();
		}, delayMs);
	}

	private startHeartbeat() {
		this.heartbeatTimer = setInterval(() => {
			this.send({
				op: Op.OP_HEARTBEAT,
				seq: 0n,
				payload: {
					$case: "heartbeat",
					heartbeat: { clientTimeMs: BigInt(Date.now()) },
				},
			});
		}, 15_000);
	}

	private stopHeartbeat() {
		if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
		this.heartbeatTimer = null;
	}

	private send(envelope: { op: Op; seq: bigint; payload: EnvelopePayload }) {
		if (this.socket?.readyState !== WebSocket.OPEN) return;
		const bytes = Envelope.encode(envelope as Envelope).finish();
		this.socket.send(bytes);
	}
}
