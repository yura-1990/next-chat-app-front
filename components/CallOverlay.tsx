"use client";

import {
	Mic,
	MicOff,
	Phone,
	PhoneOff,
	Video,
	VideoOff,
	Volume2,
	VolumeX,
	X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CallState } from "@/lib/chat/useChatSession";

type Props = {
	call: CallState;
	minimized: boolean;
	onAccept: () => void;
	onDecline: () => void;
	onEnd: () => void;
	onToggleMute: () => void;
	onToggleVideo: () => void;
	onMinimize: () => void;
	onMuteRing: () => void;
};

function useElapsedSeconds(running: boolean): number {
	const [seconds, setSeconds] = useState(0);
	useEffect(() => {
		if (!running) {
			setSeconds(0);
			return;
		}
		const start = Date.now();
		const interval = setInterval(
			() => setSeconds(Math.floor((Date.now() - start) / 1000)),
			1000,
		);
		return () => clearInterval(interval);
	}, [running]);
	return seconds;
}

function formatDuration(totalSeconds: number): string {
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function CallOverlay({
	call,
	minimized,
	onAccept,
	onDecline,
	onEnd,
	onToggleMute,
	onToggleVideo,
	onMinimize,
	onMuteRing,
}: Props) {
	const localVideoRef = useRef<HTMLVideoElement>(null);
	const remoteVideoRef = useRef<HTMLVideoElement>(null);
	const remoteAudioRef = useRef<HTMLAudioElement>(null);
	const elapsed = useElapsedSeconds(call.status === "active");
	// Browsers can silently refuse to actually start playback when
	// `srcObject` is assigned programmatically (the `autoplay` attribute
	// alone isn't reliable for that) — this tracks whether that happened so
	// we can offer a one-tap fallback instead of a silently dead call.
	const [playbackBlocked, setPlaybackBlocked] = useState(false);

	useEffect(() => {
		const el = localVideoRef.current;
		if (!el) return;
		el.srcObject = call.localStream;
		if (call.localStream) void el.play().catch(() => {});
	}, [call.localStream]);

	useEffect(() => {
		let blocked = false;
		const videoEl = remoteVideoRef.current;
		if (videoEl) {
			videoEl.srcObject = call.remoteStream;
			if (call.remoteStream) {
				videoEl.play().catch(() => {
					blocked = true;
					setPlaybackBlocked(true);
				});
			}
		}
		const audioEl = remoteAudioRef.current;
		if (audioEl) {
			audioEl.srcObject = call.remoteStream;
			if (call.remoteStream) {
				audioEl.play().catch(() => {
					blocked = true;
					setPlaybackBlocked(true);
				});
			}
		}
		if (!blocked) setPlaybackBlocked(false);
	}, [call.remoteStream]);

	if (call.status === "idle") return null;

	function retryPlayback() {
		void remoteVideoRef.current?.play().catch(() => {});
		void remoteAudioRef.current?.play().catch(() => {});
		setPlaybackBlocked(false);
	}

	const name = call.remoteUsername ?? "Unknown";
	const isRinging = call.status === "outgoing" || call.status === "incoming";

	if (call.status === "incoming") {
		// Minimizing an unanswered call is safe to fully unmount — there's no
		// stream yet to keep alive. The ringtone itself keeps playing
		// regardless (it's driven by call state in the hook, not by this
		// component being on screen), and the sidebar row / chat header pill
		// are what let the user come back and answer it.
		if (minimized) return null;
		return (
			<div className="call-overlay">
				<div className="call-card">
					<button
						type="button"
						className="call-minimize"
						onClick={onMinimize}
						aria-label="Minimize"
						title="Minimize"
					>
						<X size={16} />
					</button>
					<button
						type="button"
						className="call-mute-ring"
						onClick={onMuteRing}
						aria-label="Silence ringtone"
						title="Silence ringtone"
					>
						<VolumeX size={14} />
					</button>
					<p className="call-status-label">
						{call.video ? "Incoming video call" : "Incoming call"}
					</p>
					<h2 className="call-name">{name}</h2>
					<div className="call-incoming-actions">
						<button
							type="button"
							className="call-action call-decline"
							onClick={onDecline}
							aria-label="Decline"
						>
							<PhoneOff size={22} />
						</button>
						<button
							type="button"
							className="call-action call-accept"
							onClick={onAccept}
							aria-label="Accept"
						>
							<Phone size={22} />
						</button>
					</div>
				</div>
			</div>
		);
	}

	const statusLabel =
		call.status === "outgoing"
			? "Calling…"
			: call.status === "connecting"
				? "Connecting…"
				: formatDuration(elapsed);

	return (
		<div
			className={`call-overlay ${minimized ? "call-overlay-minimized" : ""}`}
		>
			<div className={`call-card ${call.video ? "call-card-video" : ""}`}>
				<button
					type="button"
					className="call-minimize"
					onClick={onMinimize}
					aria-label="Minimize"
					title="Minimize"
				>
					<X size={16} />
				</button>
				{isRinging && (
					<button
						type="button"
						className="call-mute-ring"
						onClick={onMuteRing}
						aria-label="Silence ringtone"
						title="Silence ringtone"
					>
						<VolumeX size={14} />
					</button>
				)}
				{call.video ? (
					<div className="call-video-stage">
						<video
							ref={localVideoRef}
							className="call-video-local"
							autoPlay
							muted
							playsInline
						/>
						{/* biome-ignore lint/a11y/useMediaCaption: live WebRTC stream, there is no caption track to provide */}
						<video
							ref={remoteVideoRef}
							className="call-video-remote"
							autoPlay
							playsInline
						/>
						<p className="call-video-name">
							{name} · {statusLabel}
						</p>
					</div>
				) : (
					<>
						<p className="call-status-label">{statusLabel}</p>
						<h2 className="call-name">{name}</h2>
						{/* biome-ignore lint/a11y/useMediaCaption: live WebRTC stream, there is no caption track to provide */}
						<audio ref={remoteAudioRef} autoPlay />
					</>
				)}
				{playbackBlocked && (
					<button
						type="button"
						className="call-enable-sound"
						onClick={retryPlayback}
					>
						<Volume2 size={14} />
						Tap to enable sound
					</button>
				)}
				<div className="call-active-actions">
					<button
						type="button"
						className="call-action call-mute"
						onClick={onToggleMute}
						aria-label={call.muted ? "Unmute" : "Mute"}
					>
						{call.muted ? <MicOff size={20} /> : <Mic size={20} />}
					</button>
					{call.video && (
						<button
							type="button"
							className="call-action call-mute"
							onClick={onToggleVideo}
							aria-label={call.videoOff ? "Turn camera on" : "Turn camera off"}
						>
							{call.videoOff ? <VideoOff size={20} /> : <Video size={20} />}
						</button>
					)}
					<button
						type="button"
						className="call-action call-decline"
						onClick={onEnd}
						aria-label="End call"
					>
						<PhoneOff size={22} />
					</button>
				</div>
				{call.error && <p className="call-error">{call.error}</p>}
			</div>
		</div>
	);
}
