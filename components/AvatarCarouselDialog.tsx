"use client";

import {
	ChevronLeft,
	ChevronRight,
	Download,
	Plus,
	RotateCw,
	Star,
	Trash2,
	X,
} from "lucide-react";
import {
	type ChangeEvent,
	type PointerEvent as ReactPointerEvent,
	useEffect,
	useRef,
	useState,
} from "react";
import type { MyAvatar } from "@/lib/chat/api";
import {
	isLikelyImage,
	resizeImageToBlob,
	rotateImageFromUrl,
} from "@/lib/chat/imageOptimize";

type AsyncResult = { ok: true } | { ok: false; error: string };

// How far (px) a drag has to travel horizontally before it counts as a
// swipe rather than an incidental wobble/click.
const SWIPE_THRESHOLD = 50;

type Props = {
	initialMediaId: string;
	onActivate: (mediaId: string, avatarUrl: string) => Promise<AsyncResult>;
	onDelete: (mediaId: string) => Promise<AsyncResult>;
	onUpload: (blob: Blob) => Promise<AsyncResult>;
	onRefresh: () => Promise<MyAvatar[]>;
	onClose: () => void;
};

export function AvatarCarouselDialog({
	initialMediaId,
	onActivate,
	onDelete,
	onUpload,
	onRefresh,
	onClose,
}: Props) {
	// Fetches its own gallery rather than taking it as a prop snapshot —
	// this dialog is rendered as a top-level sibling (see app/page.tsx),
	// not nested inside whatever triggered it, the same way MediaLightbox
	// is — nesting a position:fixed overlay inside another dialog's
	// scrollable container clips its paint in some browsers even though
	// its layout geometry still reports full-viewport.
	const [items, setItems] = useState<MyAvatar[]>([]);
	const [currentId, setCurrentId] = useState(initialMediaId);
	const [busy, setBusy] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [rotating, setRotating] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const dragStartXRef = useRef<number | null>(null);
	const dragDeltaXRef = useRef(0);

	useEffect(() => {
		void onRefresh().then(setItems);
	}, [onRefresh]);

	const index = items.findIndex((item) => item.mediaId === currentId);
	const current = items[index];
	const atStart = index <= 0;
	const atEnd = index === items.length - 1;

	function goPrev() {
		if (index > 0) setCurrentId(items[index - 1].mediaId);
	}

	function goNext() {
		if (index < items.length - 1) setCurrentId(items[index + 1].mediaId);
	}

	function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
		dragStartXRef.current = event.clientX;
		dragDeltaXRef.current = 0;
	}

	function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
		if (dragStartXRef.current === null) return;
		dragDeltaXRef.current = event.clientX - dragStartXRef.current;
	}

	function handlePointerUp() {
		if (dragStartXRef.current === null) return;
		const delta = dragDeltaXRef.current;
		dragStartXRef.current = null;
		dragDeltaXRef.current = 0;
		if (delta > SWIPE_THRESHOLD) goPrev();
		else if (delta < -SWIPE_THRESHOLD) goNext();
	}

	// Registered once for the component's whole lifetime (empty deps), not
	// torn down and rebuilt on every render — this dialog and AccountDialog
	// both listen on `window`, and re-subscribing on every render opened a
	// real race where a keydown could land in the gap between one listener's
	// cleanup and its own next setup, silently swallowing it. The ref keeps
	// the handler reading current state without needing to resubscribe for
	// that.
	const latestRef = useRef({ onClose, goPrev, goNext });
	latestRef.current = { onClose, goPrev, goNext };
	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") latestRef.current.onClose();
			else if (event.key === "ArrowLeft") latestRef.current.goPrev();
			else if (event.key === "ArrowRight") latestRef.current.goNext();
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	async function handleSetActive() {
		if (!current || current.isActive || busy) return;
		setBusy(true);
		setError(null);
		const result = await onActivate(current.mediaId, current.avatarUrl);
		if (result.ok) {
			setItems(await onRefresh());
		} else {
			setError(result.error);
		}
		setBusy(false);
	}

	async function handleDelete() {
		if (!current || busy) return;
		setBusy(true);
		setError(null);
		const result = await onDelete(current.mediaId);
		if (!result.ok) {
			setError(result.error);
			setBusy(false);
			return;
		}
		const refreshed = await onRefresh();
		setItems(refreshed);
		if (refreshed.length === 0) {
			onClose();
			return;
		}
		// Stay on the same position in the list rather than snapping back
		// to the first photo — the next photo slides into the spot the
		// deleted one occupied, same as the sidebar's own list behavior.
		const nextIndex = Math.min(index, refreshed.length - 1);
		setCurrentId(refreshed[nextIndex].mediaId);
		setBusy(false);
	}

	// There's no "update this photo's bytes in place" endpoint, so a rotate
	// is really "upload the rotated version, then remove the original" —
	// uploading always makes the new one active server-side, which is the
	// natural outcome here anyway (you just edited it).
	async function handleRotate() {
		if (!current || busy || rotating) return;
		setRotating(true);
		setError(null);
		try {
			const rotated = await rotateImageFromUrl(current.avatarUrl, 90);
			const oldMediaId = current.mediaId;
			const uploadResult = await onUpload(rotated);
			if (!uploadResult.ok) {
				setError(uploadResult.error);
				return;
			}
			await onDelete(oldMediaId);
			const refreshed = await onRefresh();
			setItems(refreshed);
			const newActive = refreshed.find((a) => a.isActive);
			if (newActive) setCurrentId(newActive.mediaId);
		} catch {
			setError("Could not rotate that image.");
		} finally {
			setRotating(false);
		}
	}

	async function handleFilePicked(event: ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) return;
		if (!(await isLikelyImage(file))) {
			setError("Please choose an image file.");
			return;
		}
		setUploading(true);
		setError(null);
		try {
			const resized = await resizeImageToBlob(file);
			const result = await onUpload(resized);
			if (result.ok) {
				const refreshed = await onRefresh();
				setItems(refreshed);
				// A fresh upload always becomes the active photo server-side
				// — jump the carousel straight to it.
				const newActive = refreshed.find((a) => a.isActive);
				if (newActive) setCurrentId(newActive.mediaId);
			} else {
				setError(result.error);
			}
		} catch {
			setError("Could not read that image.");
		} finally {
			setUploading(false);
		}
	}

	if (!current) return null;

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

			<button
				type="button"
				className="lightbox-nav lightbox-nav-prev"
				onClick={goPrev}
				disabled={atStart}
				aria-label="Previous photo"
			>
				<ChevronLeft size={22} />
			</button>
			<button
				type="button"
				className="lightbox-nav lightbox-nav-next"
				onClick={goNext}
				disabled={atEnd}
				aria-label="Next photo"
			>
				<ChevronRight size={22} />
			</button>

			<div className="lightbox-footer avatar-carousel-counter">
				<span className="lightbox-counter">
					{index + 1} / {items.length}
				</span>
			</div>

			<div
				className="lightbox-stage avatar-carousel-swipe-stage"
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
				onPointerCancel={handlePointerUp}
			>
				{/* biome-ignore lint/performance/noImgElement: remote, signed-origin avatar URL — next/image's optimizer has no use here */}
				<img
					key={current.mediaId}
					src={current.avatarUrl}
					alt=""
					className="lightbox-image"
					draggable={false}
				/>
			</div>

			{error && <p className="avatar-carousel-error">{error}</p>}

			<div className="avatar-carousel-actions">
				<button
					type="button"
					className={`icon-button avatar-carousel-action ${current.isActive ? "avatar-carousel-action-active" : ""}`}
					onClick={() => void handleSetActive()}
					disabled={busy || current.isActive}
					aria-label={
						current.isActive ? "Current profile photo" : "Set as active photo"
					}
					aria-pressed={current.isActive}
					title={
						current.isActive ? "Current profile photo" : "Set as active photo"
					}
				>
					<Star size={22} fill={current.isActive ? "currentColor" : "none"} />
				</button>
				<button
					type="button"
					className="icon-button avatar-carousel-action"
					onClick={() => void handleRotate()}
					disabled={busy || rotating}
					aria-label="Rotate photo"
					title="Rotate photo"
				>
					<RotateCw size={20} />
				</button>
				<a
					className="icon-button avatar-carousel-action"
					href={current.avatarUrl}
					download
					aria-label="Save photo"
					title="Save photo"
				>
					<Download size={20} />
				</a>
				<button
					type="button"
					className="icon-button avatar-carousel-action avatar-carousel-delete"
					onClick={() => void handleDelete()}
					disabled={busy}
					aria-label="Delete photo"
					title="Delete photo"
				>
					<Trash2 size={20} />
				</button>
				<button
					type="button"
					className="icon-button avatar-carousel-action"
					onClick={() => fileInputRef.current?.click()}
					disabled={uploading}
					aria-label="Upload a new photo"
					title="Upload a new photo"
				>
					<Plus size={22} />
				</button>
				<input
					ref={fileInputRef}
					type="file"
					accept="image/*"
					hidden
					onChange={handleFilePicked}
				/>
			</div>

			{items.length > 1 && (
				<div className="lightbox-thumbs">
					{items.map((item) => (
						<button
							key={item.mediaId}
							type="button"
							className={`lightbox-thumb ${item.mediaId === currentId ? "lightbox-thumb-active" : ""}`}
							onClick={() => setCurrentId(item.mediaId)}
							aria-label={
								item.isActive ? "Current profile photo" : "Jump to this photo"
							}
						>
							{/* biome-ignore lint/performance/noImgElement: tiny thumbnail of a remote avatar URL */}
							<img src={item.avatarUrl} alt="" loading="lazy" />
							{item.isActive && (
								<span className="avatar-carousel-thumb-badge">
									<Star size={9} fill="currentColor" />
								</span>
							)}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
