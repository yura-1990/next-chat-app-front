"use client";

import {
	AlignCenter,
	AlignLeft,
	AlignRight,
	Bold,
	Check,
	Italic,
	Strikethrough,
	Underline,
	X,
} from "lucide-react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import {
	RichTextEditor,
	type RichTextEditorHandle,
} from "@/components/RichTextEditor";
import type { MyAvatar } from "@/lib/chat/api";
import { isLikelyImage, resizeImageToBlob } from "@/lib/chat/imageOptimize";
import { type TextAlign, trimFormattedText } from "@/lib/chat/textFormat";

type AsyncResult = { ok: true } | { ok: false; error: string };

const BIO_MAX_CHARS = 500;

type Props = {
	username: string;
	handle: string | null;
	bio: string | null;
	avatarUrl: string | null;
	listAvatars: () => Promise<MyAvatar[]>;
	onUpload: (blob: Blob) => Promise<AsyncResult>;
	onSetHandle: (handle: string | null) => Promise<AsyncResult>;
	onSetBio: (bio: string) => Promise<AsyncResult>;
	// The carousel itself lives as a top-level sibling in app/page.tsx (see
	// MediaLightbox for the same convention) — a position:fixed overlay
	// nested inside this dialog's own scrollable container gets its paint
	// clipped to that container in some browsers, so this dialog only asks
	// the parent to open it rather than rendering it itself.
	onOpenCarousel: (mediaId: string) => void;
	onClose: () => void;
};

export function AccountDialog({
	username,
	handle,
	bio,
	avatarUrl,
	listAvatars,
	onUpload,
	onSetHandle,
	onSetBio,
	onOpenCarousel,
	onClose,
}: Props) {
	const [photoError, setPhotoError] = useState<string | null>(null);
	const [uploading, setUploading] = useState(false);
	const [handleInput, setHandleInput] = useState(handle ?? "");
	const [handleCopied, setHandleCopied] = useState(false);
	const originalBio = bio ?? "";
	const [bioInput, setBioInput] = useState(originalBio);
	const [bioLength, setBioLength] = useState(0);
	const [bioAlign, setBioAlign] = useState<TextAlign>("left");
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const bioEditorRef = useRef<RichTextEditorHandle>(null);

	async function handleAvatarClick() {
		const avatars = await listAvatars();
		if (avatars.length > 0) {
			onOpenCarousel(
				avatars.find((a) => a.isActive)?.mediaId ?? avatars[0].mediaId,
			);
		} else {
			fileInputRef.current?.click();
		}
	}

	async function handleFilePicked(event: ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) return;
		if (!(await isLikelyImage(file))) {
			setPhotoError("Please choose an image file.");
			return;
		}
		setUploading(true);
		setPhotoError(null);
		try {
			const resized = await resizeImageToBlob(file);
			const result = await onUpload(resized);
			if (!result.ok) setPhotoError(result.error);
		} catch {
			setPhotoError("Could not read that image.");
		} finally {
			setUploading(false);
		}
	}

	async function handleCopyHandle() {
		const shareable = handleInput.trim().replace(/^@/, "") || username;
		try {
			await navigator.clipboard.writeText(`@${shareable}`);
			setHandleCopied(true);
			setTimeout(() => setHandleCopied(false), 1500);
		} catch {
			// Clipboard access can be denied/unavailable — nothing useful to
			// fall back to beyond the text already being visible in the input.
		}
	}

	// Shared by the explicit Save button, the close button, and Escape —
	// whichever way you leave a changed field, it saves the same way.
	// Returns whether it's now safe to close (nothing pending/failed).
	async function performSave(): Promise<boolean> {
		const trimmedHandle = handleInput.trim().replace(/^@/, "");
		const trimmedBio = trimFormattedText(bioInput);
		const handleChanged = trimmedHandle !== (handle ?? "");
		const bioChanged = trimmedBio !== originalBio;

		if (!handleChanged && !bioChanged) return true;

		setSaving(true);
		setSaveError(null);

		if (handleChanged) {
			const result = await onSetHandle(trimmedHandle || null);
			if (!result.ok) {
				setSaving(false);
				setSaveError(result.error);
				return false;
			}
		}
		if (bioChanged) {
			const result = await onSetBio(trimmedBio);
			if (!result.ok) {
				setSaving(false);
				setSaveError(result.error);
				return false;
			}
		}

		setSaving(false);
		return true;
	}

	async function handleSaveClick() {
		if (await performSave()) {
			setSaved(true);
			setTimeout(() => setSaved(false), 1500);
		}
	}

	async function handleRequestClose() {
		if (await performSave()) onClose();
	}

	// Registered once for the component's whole lifetime (empty deps) — see
	// the identical note in AvatarCarouselDialog for why a per-render
	// resubscribe is the wrong pattern when another dialog can be layered
	// on top, also listening on `window`.
	const handleRequestCloseRef = useRef(handleRequestClose);
	handleRequestCloseRef.current = handleRequestClose;
	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") void handleRequestCloseRef.current();
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	return (
		<div className="modal-overlay">
			<div className="modal-card account-dialog-card">
				<div className="forward-card-header">
					<button
						type="button"
						className="settings-account-trigger"
						onClick={() => void handleAvatarClick()}
						disabled={uploading}
					>
						<span className="avatar avatar-profile">
							{avatarUrl ? (
								// biome-ignore lint/performance/noImgElement: server-optimized, cache-friendly avatar URL — next/image's optimizer has no use here
								<img src={avatarUrl} alt="" />
							) : (
								username.slice(0, 2).toUpperCase()
							)}
						</span>
						<strong>{username}</strong>
					</button>
					<button
						type="button"
						className="icon-button"
						onClick={() => void handleRequestClose()}
						disabled={saving}
						aria-label="Close"
					>
						<X size={18} />
					</button>
				</div>
				{photoError && <p className="modal-error">{photoError}</p>}
				{saveError && <p className="modal-error">{saveError}</p>}
				<input
					ref={fileInputRef}
					type="file"
					accept="image/*"
					hidden
					onChange={handleFilePicked}
				/>

				<section className="account-dialog-section">
					<div className="account-dialog-handle-row">
						<button
							type="button"
							className="account-dialog-handle-at"
							onClick={() => void handleCopyHandle()}
							title="Copy to clipboard to share"
							aria-label="Copy handle to clipboard"
						>
							{handleCopied ? <Check size={14} /> : "@"}
						</button>
						<input
							type="text"
							placeholder="e.g. alice_design"
							value={handleInput}
							onChange={(event) =>
								setHandleInput(event.target.value.toLowerCase())
							}
						/>
					</div>
				</section>

				<section className="account-dialog-section">
					<div className="create-group-description">
						<div className="create-group-format-bar">
							<button
								type="button"
								className="icon-button format-tool"
								title="Bold"
								aria-label="Bold"
								onMouseDown={(event) => event.preventDefault()}
								onClick={() => bioEditorRef.current?.toggleMark("bold")}
							>
								<Bold size={14} />
							</button>
							<button
								type="button"
								className="icon-button format-tool"
								title="Italic"
								aria-label="Italic"
								onMouseDown={(event) => event.preventDefault()}
								onClick={() => bioEditorRef.current?.toggleMark("italic")}
							>
								<Italic size={14} />
							</button>
							<button
								type="button"
								className="icon-button format-tool"
								title="Underline"
								aria-label="Underline"
								onMouseDown={(event) => event.preventDefault()}
								onClick={() => bioEditorRef.current?.toggleMark("underline")}
							>
								<Underline size={14} />
							</button>
							<button
								type="button"
								className="icon-button format-tool"
								title="Strikethrough"
								aria-label="Strikethrough"
								onMouseDown={(event) => event.preventDefault()}
								onClick={() =>
									bioEditorRef.current?.toggleMark("strikethrough")
								}
							>
								<Strikethrough size={14} />
							</button>
							<span className="composer-format-divider" />
							<button
								type="button"
								className={`icon-button format-tool ${bioAlign === "left" ? "format-tool-active" : ""}`}
								title="Align left"
								aria-label="Align left"
								onMouseDown={(event) => event.preventDefault()}
								onClick={() => bioEditorRef.current?.setAlign("left")}
							>
								<AlignLeft size={14} />
							</button>
							<button
								type="button"
								className={`icon-button format-tool ${bioAlign === "center" ? "format-tool-active" : ""}`}
								title="Align center"
								aria-label="Align center"
								onMouseDown={(event) => event.preventDefault()}
								onClick={() => bioEditorRef.current?.setAlign("center")}
							>
								<AlignCenter size={14} />
							</button>
							<button
								type="button"
								className={`icon-button format-tool ${bioAlign === "right" ? "format-tool-active" : ""}`}
								title="Align right"
								aria-label="Align right"
								onMouseDown={(event) => event.preventDefault()}
								onClick={() => bioEditorRef.current?.setAlign("right")}
							>
								<AlignRight size={14} />
							</button>
							<span className="create-group-char-count">
								{bioLength}/{BIO_MAX_CHARS}
							</span>
						</div>
						<RichTextEditor
							ref={bioEditorRef}
							className="create-group-description-input"
							placeholder="e.g. Product designer. Portfolio: example.com"
							value={bioInput}
							onChange={setBioInput}
							maxLength={BIO_MAX_CHARS}
							onLengthChange={setBioLength}
							onAlignChange={setBioAlign}
						/>
					</div>
				</section>

				<div className="modal-actions">
					<button
						type="button"
						className="modal-submit"
						onClick={() => void handleSaveClick()}
						disabled={saving}
					>
						{saving ? "Saving…" : saved ? "Saved" : "Save"}
					</button>
				</div>
			</div>
		</div>
	);
}
