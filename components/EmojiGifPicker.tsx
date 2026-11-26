"use client";

import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { EMOJI_CATEGORIES } from "@/lib/chat/emojis";
import { type GifResult, searchGifs, trendingGifs } from "@/lib/chat/giphy";

type Tab = "emoji" | "gif";

type Props = {
	onPickEmoji: (emoji: string) => void;
	onPickGif: (gif: GifResult) => void;
	onClose: () => void;
};

export function EmojiGifPicker({ onPickEmoji, onPickGif, onClose }: Props) {
	const [tab, setTab] = useState<Tab>("emoji");
	const [categoryIndex, setCategoryIndex] = useState(0);
	const [gifQuery, setGifQuery] = useState("");
	const [gifs, setGifs] = useState<GifResult[]>([]);
	const [gifLoading, setGifLoading] = useState(false);
	const [gifError, setGifError] = useState<string | null>(null);

	useEffect(() => {
		if (tab !== "gif") return;
		let cancelled = false;
		setGifLoading(true);
		setGifError(null);
		const timer = setTimeout(() => {
			const fetchGifs = gifQuery.trim()
				? searchGifs(gifQuery.trim())
				: trendingGifs();
			fetchGifs
				.then((results) => {
					if (!cancelled) setGifs(results);
				})
				.catch(() => {
					if (!cancelled) setGifError("Could not load GIFs");
				})
				.finally(() => {
					if (!cancelled) setGifLoading(false);
				});
		}, 300);
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [tab, gifQuery]);

	return (
		<div className="picker-scrim">
			<button
				type="button"
				className="picker-backdrop"
				aria-label="Close"
				onClick={onClose}
			/>
			<div className="picker-popover">
				<div className="picker-tabs">
					<button
						type="button"
						className={`picker-tab ${tab === "emoji" ? "picker-tab-active" : ""}`}
						onClick={() => setTab("emoji")}
					>
						Emoji
					</button>
					<button
						type="button"
						className={`picker-tab ${tab === "gif" ? "picker-tab-active" : ""}`}
						onClick={() => setTab("gif")}
					>
						GIF
					</button>
				</div>

				{tab === "emoji" ? (
					<>
						<div className="picker-categories">
							{EMOJI_CATEGORIES.map((category, index) => (
								<button
									key={category.label}
									type="button"
									title={category.label}
									className={`picker-category ${index === categoryIndex ? "picker-category-active" : ""}`}
									onClick={() => setCategoryIndex(index)}
								>
									{category.icon}
								</button>
							))}
						</div>
						<div className="picker-emoji-grid">
							{EMOJI_CATEGORIES[categoryIndex].emojis.map((emoji, index) => (
								<button
									// biome-ignore lint/suspicious/noArrayIndexKey: EMOJI_CATEGORIES is a static, never-reordered constant
									key={`${emoji}-${index}`}
									type="button"
									className="picker-emoji"
									onClick={() => onPickEmoji(emoji)}
								>
									{emoji}
								</button>
							))}
						</div>
					</>
				) : (
					<>
						<label className="search-field picker-gif-search">
							<Search size={17} />
							<input
								value={gifQuery}
								onChange={(event) => setGifQuery(event.target.value)}
								placeholder="Search GIFs…"
								// biome-ignore lint/a11y/noAutofocus: an explicitly-opened search popover is expected to focus its search field
								autoFocus
							/>
							{gifQuery && (
								<button
									type="button"
									className="search-field-clear"
									onClick={() => setGifQuery("")}
									aria-label="Clear search"
								>
									<X size={15} />
								</button>
							)}
						</label>
						<div className="picker-gif-grid">
							{gifLoading && <p className="picker-gif-status">Loading…</p>}
							{!gifLoading && gifError && (
								<p className="picker-gif-status">{gifError}</p>
							)}
							{!gifLoading &&
								!gifError &&
								gifs.map((gif) => (
									<button
										key={gif.id}
										type="button"
										className="picker-gif"
										onClick={() => onPickGif(gif)}
									>
										{/* biome-ignore lint/performance/noImgElement: remote third-party thumbnail, next/image's optimizer has no use here */}
										<img src={gif.previewUrl} alt="" loading="lazy" />
									</button>
								))}
						</div>
					</>
				)}
			</div>
		</div>
	);
}
