"use client";

import { Bookmark, Search, X } from "lucide-react";
import { useState } from "react";
import type { UIConversation } from "@/lib/chat/useChatSession";

type Props = {
	conversations: UIConversation[];
	busy: boolean;
	error: string | null;
	onPick: (chatId: string, comment: string) => void;
	onClose: () => void;
};

export function ForwardDialog({
	conversations,
	busy,
	error,
	onPick,
	onClose,
}: Props) {
	const [query, setQuery] = useState("");
	const [comment, setComment] = useState("");

	const trimmedQuery = query.trim().toLowerCase();
	const filtered = trimmedQuery
		? conversations.filter((conversation) =>
				(conversation.isSelf ? "saved messages" : conversation.name)
					.toLowerCase()
					.includes(trimmedQuery),
			)
		: conversations;

	return (
		<div className="modal-overlay">
			<div className="modal-card forward-card">
				<div className="forward-card-header">
					<h2>Forward to…</h2>
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
				<label className="search-field">
					<Search size={16} />
					<input
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Search chats"
					/>
					{query && (
						<button
							type="button"
							className="search-field-clear"
							onClick={() => setQuery("")}
							aria-label="Clear search"
						>
							<X size={15} />
						</button>
					)}
				</label>
				<ul className="forward-list">
					{filtered.map((conversation) => (
						<li key={conversation.id}>
							<button
								type="button"
								className="forward-list-item"
								disabled={busy}
								onClick={() => onPick(conversation.id, comment)}
							>
								<span
									className={`avatar avatar-${conversation.color} ${conversation.isSelf ? "avatar-saved" : ""}`}
								>
									{conversation.isSelf ? (
										<Bookmark size={15} />
									) : (
										conversation.avatar
									)}
								</span>
								<span className="forward-list-name">
									{conversation.isSelf ? "Saved Messages" : conversation.name}
								</span>
							</button>
						</li>
					))}
					{filtered.length === 0 && (
						<li className="forward-list-empty">
							{conversations.length === 0
								? "No chats to forward to yet."
								: "No chats found."}
						</li>
					)}
				</ul>
				<label className="forward-comment-field">
					<input
						value={comment}
						maxLength={2000}
						disabled={busy}
						onChange={(event) => setComment(event.target.value)}
						placeholder="Add a comment (optional)"
					/>
				</label>
			</div>
		</div>
	);
}
