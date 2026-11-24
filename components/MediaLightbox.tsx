"use client";

import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { useEffect } from "react";
import { mediaUrl } from "@/lib/chat/api";
import type { UIMedia } from "@/lib/chat/useChatSession";

export type LightboxItem = {
	id: string;
	media: UIMedia;
	fromMe: boolean;
	time: string;
};

type Props = {
	items: LightboxItem[]; // oldest-first, already-loaded image/round_video messages for this chat
	activeId: string;
	onClose: () => void;
	onNavigate: (id: string) => void;
	hasOlder: boolean;
	loadingOlder: boolean;
	onLoadOlder: () => void;
};

// Only the current slide's <img>/<video> is ever mounted — a chat can hold
// hundreds of photos, and a classic sliding-strip carousel would mean every
// one of them is downloading and decoding at once. The thumbnail rail below
// uses <img loading="lazy"> for photos (cheap, browsers defer these well)
// and a plain icon placeholder for round videos instead of N live <video>
// elements.
export function MediaLightbox({
	items,
	activeId,
	onClose,
	onNavigate,
	hasOlder,
	loadingOlder,
	onLoadOlder,
}: Props) {
	const index = items.findIndex((item) => item.id === activeId);
	const current = items[index];
	const atStart = index <= 0;
	const atEnd = index === items.length - 1;

	function goPrev() {
		if (index > 0) {
			onNavigate(items[index - 1].id);
		} else if (hasOlder && !loadingOlder) {
			onLoadOlder();
		}
	}

	function goNext() {
		if (index < items.length - 1) onNavigate(items[index + 1].id);
	}

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") onClose();
			else if (event.key === "ArrowLeft") goPrev();
			else if (event.key === "ArrowRight") goNext();
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	});

	if (!current) return null;
	const url = mediaUrl(current.media.url);

	return (
		<div className="lightbox-scrim" role="dialog" aria-modal="true">
			<button
				type="button"
				className="lightbox-close"
				onClick={onClose}
				aria-label="Close"
			>
				<X size={20} />
			</button>
			<a
				className="lightbox-download"
				href={url}
				download={current.media.name ?? undefined}
				aria-label="Download"
			>
				<Download size={18} />
			</a>

			<button
				type="button"
				className="lightbox-nav lightbox-nav-prev"
				onClick={goPrev}
				disabled={atStart && !hasOlder}
				aria-label="Previous"
			>
				<ChevronLeft size={22} />
			</button>
			<button
				type="button"
				className="lightbox-nav lightbox-nav-next"
				onClick={goNext}
				disabled={atEnd}
				aria-label="Next"
			>
				<ChevronRight size={22} />
			</button>

			<div className="lightbox-stage">
				{atStart && loadingOlder && (
					<p className="lightbox-loading">Loading older media…</p>
				)}
				{current.media.kind === "round_video" ? (
					// biome-ignore lint/a11y/useMediaCaption: user-recorded chat video, no transcript to provide
					<video
						key={current.id}
						src={url}
						controls
						autoPlay
						playsInline
						className="lightbox-video"
					/>
				) : (
					// biome-ignore lint/performance/noImgElement: remote, signed, short-lived URL — next/image's optimizer has no use here
					<img
						key={current.id}
						src={url}
						alt={current.media.name ?? "Photo"}
						className="lightbox-image"
					/>
				)}
			</div>

			<div className="lightbox-footer">
				<span className="lightbox-counter">
					{index + 1} / {items.length}
					{hasOlder && "+"}
				</span>
				<span className="lightbox-time">{current.time}</span>
			</div>

			{items.length > 1 && (
				<div className="lightbox-thumbs">
					{items.map((item) => (
						<button
							key={item.id}
							type="button"
							className={`lightbox-thumb ${item.id === activeId ? "lightbox-thumb-active" : ""}`}
							onClick={() => onNavigate(item.id)}
							aria-label="Jump to this media"
						>
							{item.media.kind === "round_video" ? (
								<span className="lightbox-thumb-video-placeholder" />
							) : (
								// biome-ignore lint/performance/noImgElement: tiny lazy thumbnail of a remote, signed URL
								<img src={mediaUrl(item.media.url)} alt="" loading="lazy" />
							)}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
