"use client";

import {
	AlignCenter,
	AlignLeft,
	AlignRight,
	Bold,
	Camera,
	Italic,
	Strikethrough,
	Underline,
	X,
} from "lucide-react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { MemberPicker, type SearchUser } from "@/components/MemberPicker";
import {
	RichTextEditor,
	type RichTextEditorHandle,
} from "@/components/RichTextEditor";
import { isLikelyImage, resizeImageToBlob } from "@/lib/chat/imageOptimize";
import { avatarForUsername, colorForUsername } from "@/lib/chat/presentation";
import { type TextAlign, trimFormattedText } from "@/lib/chat/textFormat";
import type { UIConversation } from "@/lib/chat/useChatSession";

type Props = {
	conversations: UIConversation[];
	searchUsers: (query: string) => Promise<SearchUser[]>;
	busy: boolean;
	error: string | null;
	onCreate: (input: {
		title: string;
		description: string;
		avatarBlob: Blob | null;
		handle: string;
		memberUserIds: string[];
	}) => void;
	onClose: () => void;
};

const DESCRIPTION_MAX_CHARS = 500;
const TITLE_MAX_CHARS = 100;

export function CreateChannelDialog({
	conversations,
	searchUsers,
	busy,
	error,
	onCreate,
	onClose,
}: Props) {
	const [title, setTitle] = useState("");
	const [handle, setHandle] = useState("");
	const [description, setDescription] = useState("");
	const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
	const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
	const [avatarError, setAvatarError] = useState<string | null>(null);
	const [selected, setSelected] = useState<SearchUser[]>([]);
	const [descriptionLength, setDescriptionLength] = useState(0);
	const [descriptionAlign, setDescriptionAlign] = useState<TextAlign>("left");
	const avatarInputRef = useRef<HTMLInputElement>(null);
	const descriptionEditorRef = useRef<RichTextEditorHandle>(null);

	// Revokes the preview object URL whenever it's replaced or the dialog
	// unmounts — same lifecycle rule as the composer's own pendingMedia
	// previews in app/page.tsx.
	useEffect(() => {
		return () => {
			if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
		};
	}, [avatarPreviewUrl]);

	async function handleAvatarPicked(event: ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) return;
		if (!(await isLikelyImage(file))) {
			setAvatarError("Please choose an image file.");
			return;
		}
		try {
			const resized = await resizeImageToBlob(file);
			if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
			setAvatarBlob(resized);
			setAvatarPreviewUrl(URL.createObjectURL(resized));
			setAvatarError(null);
		} catch {
			setAvatarError("Could not read that image.");
		}
	}

	function toggleMember(user: SearchUser) {
		setSelected((current) =>
			current.some((m) => m.userId === user.userId)
				? current.filter((m) => m.userId !== user.userId)
				: [...current, user],
		);
	}

	function removeMember(userId: string) {
		setSelected((current) => current.filter((m) => m.userId !== userId));
	}

	// Unlike a group, a channel can be created with zero initial
	// subscribers — public ones are meant to be found and joined later via
	// their handle, not necessarily seeded with people up front.
	const canCreate = title.trim().length > 0 && !busy;

	function handleCreate() {
		if (!canCreate) return;
		onCreate({
			title: title.trim(),
			description: trimFormattedText(description),
			avatarBlob,
			handle: handle.trim().replace(/^@/, ""),
			memberUserIds: selected.map((m) => m.userId),
		});
	}

	return (
		<div className="modal-overlay">
			<div className="modal-card create-group-card">
				<div className="forward-card-header">
					<h2>New channel</h2>
					<button
						type="button"
						className="icon-button"
						onClick={onClose}
						aria-label="Close"
					>
						<X size={18} />
					</button>
				</div>

				{error && <p className="modal-error">{error}</p>}
				{avatarError && <p className="modal-error">{avatarError}</p>}

				<div className="create-group-identity">
					<button
						type="button"
						className="create-group-avatar-picker"
						onClick={() => avatarInputRef.current?.click()}
						aria-label="Choose a channel photo"
					>
						{avatarPreviewUrl ? (
							// biome-ignore lint/performance/noImgElement: local blob preview, next/image's optimizer has no use here
							<img src={avatarPreviewUrl} alt="" />
						) : (
							<span
								className={`avatar avatar-${colorForUsername(title || "channel")}`}
							>
								{title ? avatarForUsername(title) : <Camera size={18} />}
							</span>
						)}
						<span className="create-group-avatar-badge">
							<Camera size={12} />
						</span>
					</button>
					<input
						ref={avatarInputRef}
						type="file"
						accept="image/*"
						hidden
						onChange={handleAvatarPicked}
					/>
					<input
						type="text"
						className="create-group-title-input"
						placeholder="Channel name"
						value={title}
						maxLength={TITLE_MAX_CHARS}
						onChange={(event) => setTitle(event.target.value)}
					/>
				</div>

				<div className="account-dialog-handle-row">
					<span className="account-dialog-handle-at">@</span>
					<input
						type="text"
						placeholder="e.g. daily_news (optional, public)"
						value={handle}
						onChange={(event) =>
							setHandle(event.target.value.toLowerCase().replace(/^@/, ""))
						}
					/>
				</div>

				<div className="create-group-description">
					<div className="create-group-format-bar">
						<button
							type="button"
							className="icon-button"
							title="Bold"
							aria-label="Bold"
							onMouseDown={(event) => event.preventDefault()}
							onClick={() => descriptionEditorRef.current?.toggleMark("bold")}
						>
							<Bold size={14} />
						</button>
						<button
							type="button"
							className="icon-button"
							title="Italic"
							aria-label="Italic"
							onMouseDown={(event) => event.preventDefault()}
							onClick={() => descriptionEditorRef.current?.toggleMark("italic")}
						>
							<Italic size={14} />
						</button>
						<button
							type="button"
							className="icon-button"
							title="Underline"
							aria-label="Underline"
							onMouseDown={(event) => event.preventDefault()}
							onClick={() =>
								descriptionEditorRef.current?.toggleMark("underline")
							}
						>
							<Underline size={14} />
						</button>
						<button
							type="button"
							className="icon-button"
							title="Strikethrough"
							aria-label="Strikethrough"
							onMouseDown={(event) => event.preventDefault()}
							onClick={() =>
								descriptionEditorRef.current?.toggleMark("strikethrough")
							}
						>
							<Strikethrough size={14} />
						</button>
						<span className="composer-format-divider" />
						<button
							type="button"
							className={`icon-button ${descriptionAlign === "left" ? "format-tool-active" : ""}`}
							title="Align left"
							aria-label="Align left"
							onMouseDown={(event) => event.preventDefault()}
							onClick={() => descriptionEditorRef.current?.setAlign("left")}
						>
							<AlignLeft size={14} />
						</button>
						<button
							type="button"
							className={`icon-button ${descriptionAlign === "center" ? "format-tool-active" : ""}`}
							title="Align center"
							aria-label="Align center"
							onMouseDown={(event) => event.preventDefault()}
							onClick={() => descriptionEditorRef.current?.setAlign("center")}
						>
							<AlignCenter size={14} />
						</button>
						<button
							type="button"
							className={`icon-button ${descriptionAlign === "right" ? "format-tool-active" : ""}`}
							title="Align right"
							aria-label="Align right"
							onMouseDown={(event) => event.preventDefault()}
							onClick={() => descriptionEditorRef.current?.setAlign("right")}
						>
							<AlignRight size={14} />
						</button>
						<span className="create-group-char-count">
							{descriptionLength}/{DESCRIPTION_MAX_CHARS}
						</span>
					</div>
					<RichTextEditor
						ref={descriptionEditorRef}
						className="create-group-description-input"
						placeholder="Description (optional)"
						value={description}
						onChange={setDescription}
						maxLength={DESCRIPTION_MAX_CHARS}
						onLengthChange={setDescriptionLength}
						onAlignChange={setDescriptionAlign}
					/>
				</div>

				<MemberPicker
					conversations={conversations}
					searchUsers={searchUsers}
					selected={selected}
					onToggle={toggleMember}
					onRemove={removeMember}
					placeholder="Add subscribers…"
				/>

				<div className="modal-actions">
					<button
						type="button"
						className="modal-cancel"
						onClick={onClose}
						disabled={busy}
					>
						Cancel
					</button>
					<button
						type="button"
						className="modal-submit"
						onClick={handleCreate}
						disabled={!canCreate}
					>
						{busy ? "Creating…" : "Create channel"}
					</button>
				</div>
			</div>
		</div>
	);
}
