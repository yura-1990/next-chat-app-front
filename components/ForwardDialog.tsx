"use client";

import { Bookmark, X } from "lucide-react";
import type { UIConversation } from "@/lib/chat/useChatSession";

type Props = {
	conversations: UIConversation[];
	busy: boolean;
	error: string | null;
	onPick: (chatId: string) => void;
	onClose: () => void;
};

export function ForwardDialog({
	conversations,
	busy,
	error,
	onPick,
	onClose,
}: Props) {
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
				<ul className="forward-list">
					{conversations.map((conversation) => (
						<li key={conversation.id}>
							<button
								type="button"
								className="forward-list-item"
								disabled={busy}
								onClick={() => onPick(conversation.id)}
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
					{conversations.length === 0 && (
						<li className="forward-list-empty">No chats to forward to yet.</li>
					)}
				</ul>
			</div>
		</div>
	);
}
