"use client";

import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { avatarForUsername, colorForUsername } from "@/lib/chat/presentation";
import type { UIConversation } from "@/lib/chat/useChatSession";

export type SearchUser = { userId: string; username: string };

type Props = {
	conversations: UIConversation[];
	searchUsers: (query: string) => Promise<SearchUser[]>;
	selected: SearchUser[];
	onToggle: (user: SearchUser) => void;
	onRemove: (userId: string) => void;
	placeholder: string;
};

/** Debounced global-user search plus a people-you-already-talk-to list
 * (Telegram-style "existing chats first, then global results"), selection
 * chips, and dedup against both. Shared by CreateGroupDialog and
 * CreateChannelDialog — the only difference between them is the
 * placeholder copy ("Add people…" vs "Add subscribers…"). */
export function MemberPicker({
	conversations,
	searchUsers,
	selected,
	onToggle,
	onRemove,
	placeholder,
}: Props) {
	const [query, setQuery] = useState("");
	const [globalResults, setGlobalResults] = useState<SearchUser[]>([]);
	const [searching, setSearching] = useState(false);

	useEffect(() => {
		const q = query.trim();
		if (!q) {
			setGlobalResults([]);
			return;
		}
		let cancelled = false;
		setSearching(true);
		const timeout = setTimeout(async () => {
			const results = await searchUsers(q);
			if (!cancelled) {
				setGlobalResults(results);
				setSearching(false);
			}
		}, 250);
		return () => {
			cancelled = true;
			clearTimeout(timeout);
		};
	}, [query, searchUsers]);

	const existingPartnerIds = new Set(
		conversations.map((c) => c.otherUserId).filter(Boolean),
	);
	const selectedIds = new Set(selected.map((s) => s.userId));
	const trimmedQuery = query.trim().toLowerCase();

	const candidateConversations = conversations.filter(
		(c) =>
			!c.isSelf &&
			!c.isGroup &&
			!c.isChannel &&
			c.otherUserId &&
			!selectedIds.has(c.otherUserId) &&
			(!trimmedQuery || c.name.toLowerCase().includes(trimmedQuery)),
	);
	const candidateGlobalResults = globalResults.filter(
		(u) => !existingPartnerIds.has(u.userId) && !selectedIds.has(u.userId),
	);

	return (
		<>
			{selected.length > 0 && (
				<div className="create-group-chips">
					{selected.map((member) => (
						<button
							type="button"
							key={member.userId}
							className="create-group-chip"
							onClick={() => onRemove(member.userId)}
						>
							{member.username}
							<X size={12} />
						</button>
					))}
				</div>
			)}

			<label className="search-field">
				<Search size={17} />
				<input
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder={placeholder}
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

			<ul className="forward-list create-group-member-list">
				{candidateConversations.map((conversation) => (
					<li key={conversation.id}>
						<button
							type="button"
							className="forward-list-item"
							onClick={() =>
								onToggle({
									userId: conversation.otherUserId,
									username: conversation.name,
								})
							}
						>
							<span className={`avatar avatar-${conversation.color}`}>
								{conversation.avatar}
							</span>
							<span className="forward-list-name">{conversation.name}</span>
						</button>
					</li>
				))}
				{candidateGlobalResults.length > 0 && (
					<>
						<li className="list-kicker">Other users</li>
						{candidateGlobalResults.map((user) => (
							<li key={user.userId}>
								<button
									type="button"
									className="forward-list-item"
									onClick={() => onToggle(user)}
								>
									<span
										className={`avatar avatar-${colorForUsername(user.username)}`}
									>
										{avatarForUsername(user.username)}
									</span>
									<span className="forward-list-name">{user.username}</span>
								</button>
							</li>
						))}
					</>
				)}
				{!searching &&
					candidateConversations.length === 0 &&
					candidateGlobalResults.length === 0 && (
						<li className="forward-list-empty">
							{trimmedQuery
								? "No matching users."
								: "No chats yet — search to find people."}
						</li>
					)}
			</ul>
		</>
	);
}
