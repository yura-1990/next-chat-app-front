"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Op } from "@/lib/proto/chat";
import { GatewayClient } from "@/lib/ws/client";

type LogLine = { id: number; text: string };

const HTTP_URL =
	process.env.NEXT_PUBLIC_GATEWAY_HTTP_URL ?? "http://127.0.0.1:8080";
const WS_URL =
	process.env.NEXT_PUBLIC_GATEWAY_WS_URL ?? "ws://127.0.0.1:8080/ws";

/**
 * Phase-1 diagnostic page only — drives real register/login, direct-chat
 * creation, and the WS send/receive round trip against the Rust gateway.
 * Not part of the product UI; safe to delete once the real chat screen is
 * wired up to the gateway.
 */
export default function WsTestPage() {
	const [status, setStatus] = useState<
		"idle" | "connecting" | "open" | "closed"
	>("idle");
	const [log, setLog] = useState<LogLine[]>([]);
	const [username, setUsername] = useState("alice");
	const [password, setPassword] = useState("correcthorse");
	const [token, setToken] = useState<string | null>(null);
	const [userId, setUserId] = useState<string | null>(null);
	const [withUserId, setWithUserId] = useState("");
	const [chatId, setChatId] = useState("");
	const [draft, setDraft] = useState("hello from next.js");
	const clientRef = useRef<GatewayClient | null>(null);
	const nextLogId = useRef(0);

	const appendLog = useCallback((text: string) => {
		setLog((current) =>
			[...current, { id: nextLogId.current++, text }].slice(-50),
		);
	}, []);

	async function callAuth(path: "register" | "login") {
		const res = await fetch(`${HTTP_URL}/auth/${path}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ username, password }),
		});
		const body = await res.json();
		if (!res.ok) {
			appendLog(`${path} failed: ${JSON.stringify(body)}`);
			return;
		}
		setToken(body.token);
		setUserId(String(body.user_id));
		appendLog(`${path} ok, user_id=${body.user_id}`);
	}

	async function createDirectChat() {
		if (!token) return;
		const res = await fetch(`${HTTP_URL}/chats/direct`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({ with_user_id: Number(withUserId) }),
		});
		const body = await res.json();
		if (!res.ok) {
			appendLog(`create chat failed: ${JSON.stringify(body)}`);
			return;
		}
		setChatId(String(body.chat_id));
		appendLog(`chat ready, chat_id=${body.chat_id}`);
	}

	useEffect(() => {
		if (!token) return;

		setStatus("connecting");
		const client = new GatewayClient({
			url: WS_URL,
			token,
			deviceId: "web-dev",
			onOpen: () => setStatus("open"),
			onClose: () => setStatus("closed"),
		});
		clientRef.current = client;

		const unsubscribe = client.onMessage((envelope) => {
			switch (envelope.op) {
				case Op.OP_HELLO_ACK:
					appendLog(
						`hello_ack session=${envelope.payload?.$case === "helloAck" ? envelope.payload.helloAck.sessionId : "?"}`,
					);
					break;
				case Op.OP_HEARTBEAT_ACK:
					appendLog("heartbeat_ack");
					break;
				case Op.OP_MESSAGE_CREATED:
					if (envelope.payload?.$case === "messageCreated") {
						const m = envelope.payload.messageCreated;
						appendLog(
							`message_created id=${m.id} author=${m.authorId} text="${m.text}"`,
						);
					}
					break;
				case Op.OP_ERROR:
					if (envelope.payload?.$case === "error") {
						appendLog(
							`error ${envelope.payload.error.code}: ${envelope.payload.error.message}`,
						);
					}
					break;
				default:
					appendLog(`unhandled op=${envelope.op}`);
			}
		});

		client.connect();
		return () => {
			unsubscribe();
			client.close();
		};
	}, [token, appendLog]);

	return (
		<main style={{ padding: 24, fontFamily: "monospace", maxWidth: 640 }}>
			<h1>gateway ws test</h1>

			<section
				style={{
					marginBottom: 16,
					display: "flex",
					flexDirection: "column",
					gap: 8,
				}}
			>
				<div style={{ display: "flex", gap: 8 }}>
					<input
						value={username}
						onChange={(event) => setUsername(event.target.value)}
						placeholder="username"
						style={{ flex: 1, padding: 8 }}
					/>
					<input
						value={password}
						onChange={(event) => setPassword(event.target.value)}
						placeholder="password"
						type="password"
						style={{ flex: 1, padding: 8 }}
					/>
					<button
						type="button"
						onClick={() => callAuth("register")}
						style={{ padding: "8px 16px" }}
					>
						register
					</button>
					<button
						type="button"
						onClick={() => callAuth("login")}
						style={{ padding: "8px 16px" }}
					>
						login
					</button>
				</div>
				<p>
					status: {status} {userId ? `· user_id=${userId}` : null}
				</p>
			</section>

			<section style={{ marginBottom: 16, display: "flex", gap: 8 }}>
				<input
					value={withUserId}
					onChange={(event) => setWithUserId(event.target.value)}
					placeholder="other user_id"
					style={{ flex: 1, padding: 8 }}
				/>
				<button
					type="button"
					onClick={createDirectChat}
					disabled={!token}
					style={{ padding: "8px 16px" }}
				>
					create/get direct chat
				</button>
				<input
					value={chatId}
					onChange={(event) => setChatId(event.target.value)}
					placeholder="chat_id"
					style={{ flex: 1, padding: 8 }}
				/>
			</section>

			<form
				onSubmit={(event) => {
					event.preventDefault();
					if (!chatId) return;
					clientRef.current?.sendMessage(
						BigInt(chatId),
						draft,
						crypto.randomUUID(),
					);
				}}
				style={{ display: "flex", gap: 8, marginBottom: 16 }}
			>
				<input
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
					style={{ flex: 1, padding: 8 }}
				/>
				<button
					type="submit"
					disabled={!chatId}
					style={{ padding: "8px 16px" }}
				>
					send
				</button>
			</form>
			<pre
				style={{
					background: "#111",
					color: "#0f0",
					padding: 12,
					minHeight: 200,
				}}
			>
				{log.map((line) => `${line.text}\n`)}
			</pre>
		</main>
	);
}
