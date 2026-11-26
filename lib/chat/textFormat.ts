// A deliberately tiny markup scheme for message text — no new storage, no
// schema change: it's just plain text with a few literal markers, so it
// round-trips through the existing `body` column untouched and reads fine
// even somewhere that never parses it (a raw DB dump, a push notification).
//
//   - `**bold**`, `_italic_`, `++underline++`, `~~strikethrough~~` — inline
//     spans, freely nestable (e.g. `**_text_**` is bold+italic together)
//   - each individual LINE (split on "\n") may carry its own leading
//     `[align:center]` / `[align:right]` marker — alignment is a per-line/
//     per-paragraph property, like in any real document editor, not a
//     whole-text flag; absent means left (the default), so no marker is
//     ever stored for that case
//
// This file is the read side (parsing stored/sent text for display) and the
// shared per-line primitives also used by RichTextEditor's DOM<->text
// serialization. RichTextEditor is the only place that *produces* this text
// now — nobody hand-types raw marker characters anymore.

export type TextAlign = "left" | "center" | "right";

const ALIGN_PREFIX = /^\[align:(center|right)\]/;

/** Splits a leading alignment marker (if any) off one line's real text. */
export function extractAlign(line: string): { align: TextAlign; body: string } {
	const match = line.match(ALIGN_PREFIX);
	if (!match) return { align: "left", body: line };
	return { align: match[1] as TextAlign, body: line.slice(match[0].length) };
}

/** Prepends the alignment marker back onto one line, ready to store — the
 * inverse of `extractAlign`. A no-op for "left". */
export function withAlign(body: string, align: TextAlign): string {
	if (align === "left") return body;
	return `[align:${align}]${body}`;
}

export type FormattedRun = {
	text: string;
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	strikethrough?: boolean;
};

export type FormattedLine = {
	align: TextAlign;
	runs: FormattedRun[];
};

const MARKERS: Array<{
	token: string;
	flag: keyof Omit<FormattedRun, "text">;
}> = [
	// Checked longest-first so "**" is never mistaken for two "_"-less
	// matches, etc. — order here only affects which marker wins when two
	// tokens could start at the same position, which never actually happens
	// since they don't share a prefix character.
	{ token: "**", flag: "bold" },
	{ token: "++", flag: "underline" },
	{ token: "~~", flag: "strikethrough" },
	{ token: "_", flag: "italic" },
];

/** Parses one line's already-align-stripped body into runs, honoring
 * nested/combined marks (bold+italic etc.) — a proper recursive-descent
 * walk rather than the old flat regex split, since a real rich text editor
 * produces nested spans the moment two toggles are active at once. A
 * marker is only treated as an opener when a matching closer actually
 * exists later in the line; otherwise it's left as literal text, same as
 * the old regex's non-greedy-but-required-pair behavior. */
export function parseFormattedRuns(body: string): FormattedRun[] {
	const runs: FormattedRun[] = [];
	let i = 0;

	function parseUntil(
		active: Omit<FormattedRun, "text">,
		closer: string | null,
	): void {
		let buffer = "";
		const flush = () => {
			if (buffer) runs.push({ text: buffer, ...active });
			buffer = "";
		};
		while (i < body.length) {
			if (closer && body.startsWith(closer, i)) {
				i += closer.length;
				flush();
				return;
			}
			const opener = MARKERS.find(
				(m) =>
					!active[m.flag] &&
					body.startsWith(m.token, i) &&
					body.indexOf(m.token, i + m.token.length) !== -1,
			);
			if (opener) {
				flush();
				i += opener.token.length;
				parseUntil({ ...active, [opener.flag]: true }, opener.token);
				continue;
			}
			buffer += body[i];
			i++;
		}
		flush();
	}

	parseUntil({}, null);
	return runs;
}

/** Splits a full stored/sent text blob into its per-line alignment + runs —
 * what every read-only renderer (message bubbles, group theme, bios) should
 * use instead of treating the whole blob as one paragraph. */
export function parseFormattedText(text: string): FormattedLine[] {
	return text.split("\n").map((line) => {
		const { align, body } = extractAlign(line);
		return { align, runs: parseFormattedRuns(body) };
	});
}

/** Drops leading/trailing blank lines and leading/trailing whitespace on
 * the remaining first/last line, like `.trim()` but line-aware so it never
 * eats a meaningful blank paragraph in the middle of the text. Alignment
 * markers on kept lines are preserved. */
export function trimFormattedText(text: string): string {
	const lines = text.split("\n");
	const blank = (line: string) => extractAlign(line).body.trim() === "";
	let start = 0;
	let end = lines.length - 1;
	while (start <= end && blank(lines[start])) start++;
	while (end >= start && blank(lines[end])) end--;
	if (start > end) return "";
	const kept = lines.slice(start, end + 1);
	const first = extractAlign(kept[0]);
	kept[0] = withAlign(first.body.replace(/^\s+/, ""), first.align);
	const lastIndex = kept.length - 1;
	const last = extractAlign(kept[lastIndex]);
	kept[lastIndex] = withAlign(last.body.replace(/\s+$/, ""), last.align);
	return kept.join("\n");
}

// Deliberately excludes a trailing run of common sentence/bracket
// punctuation from the match itself, so "see https://example.com." or
// "(https://example.com)" link just the URL, not the closing character
// that's clearly part of the surrounding sentence rather than the URL.
const URL_PATTERN = /https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]}]/g;

// Single-backtick inline code span — `like this`. Excludes newlines so a
// stray unmatched backtick can't swallow the rest of the message.
const INLINE_CODE_PATTERN = /`([^`\n]+)`/g;

export type TextPart = { text: string; url?: string; code?: boolean };

/** Splits text into plain-text, URL, and inline-code parts, in order. A
 * code part is never linkified or run through URL matching — it's shown
 * verbatim (as plain text content, never interpreted/evaluated) with a
 * click-to-copy affordance, same as a fenced code block. */
export function splitLinks(text: string): TextPart[] {
	const parts: TextPart[] = [];
	let lastIndex = 0;
	for (const match of text.matchAll(INLINE_CODE_PATTERN)) {
		const index = match.index ?? 0;
		if (index > lastIndex) {
			parts.push(...splitUrls(text.slice(lastIndex, index)));
		}
		parts.push({ text: match[1], code: true });
		lastIndex = index + match[0].length;
	}
	if (lastIndex < text.length) parts.push(...splitUrls(text.slice(lastIndex)));
	return parts;
}

function splitUrls(text: string): TextPart[] {
	const parts: TextPart[] = [];
	let lastIndex = 0;
	for (const match of text.matchAll(URL_PATTERN)) {
		const index = match.index ?? 0;
		if (index > lastIndex) parts.push({ text: text.slice(lastIndex, index) });
		parts.push({ text: match[0], url: match[0] });
		lastIndex = index + match[0].length;
	}
	if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex) });
	return parts;
}

// Triple-backtick fenced code block, with an optional language tag on the
// opening fence — ```js\n...\n``` — same convention as GitHub/Telegram.
// The language group only matches when it's followed by a real newline
// (a dedicated first line), so a single-line fence like ```salom``` with
// nothing before the closing backticks is never misread as "language
// salom, empty body" — it's just the code "salom" with no language.
const FENCE_PATTERN = /```(?:([^\n`]*)\n)?([\s\S]*?)```/g;

export type FormattedSegment =
	| { type: "text"; text: string }
	| { type: "code"; code: string; lang: string | null };

/** Splits a whole message blob into plain-text segments (further parsed
 * line-by-line for alignment/bold/italic/links/inline-code) and fenced
 * code-block segments, which are rendered verbatim and never re-parsed —
 * a `**bold**` marker or a URL sitting inside someone's pasted code stays
 * literal text, exactly as typed. */
export function splitCodeBlocks(text: string): FormattedSegment[] {
	const segments: FormattedSegment[] = [];
	let lastIndex = 0;
	for (const match of text.matchAll(FENCE_PATTERN)) {
		const index = match.index ?? 0;
		if (index > lastIndex) {
			segments.push({ type: "text", text: text.slice(lastIndex, index) });
		}
		segments.push({
			type: "code",
			code: match[2].replace(/\n$/, ""),
			lang: match[1]?.trim() || null,
		});
		lastIndex = index + match[0].length;
	}
	if (lastIndex < text.length) {
		segments.push({ type: "text", text: text.slice(lastIndex) });
	}
	return segments;
}

/** First URL found in text, or null — used to decide whether a message is
 * worth fetching a link preview card for. Skips over fenced/inline code so
 * a URL someone pasted into a code block never triggers a preview card. */
export function extractFirstUrl(text: string): string | null {
	const withoutCode = text
		.replace(FENCE_PATTERN, " ")
		.replace(INLINE_CODE_PATTERN, " ");
	const match = withoutCode.match(URL_PATTERN);
	return match ? match[0] : null;
}

/** Plain-text rendering for contexts that show a snippet rather than the
 * full message — sidebar previews, reply quotes, search matches — where
 * literal `**`/`_`/`++`/`~~` markers or an alignment tag would just look
 * broken. Markers are stripped outside-in to match the fixed nesting order
 * RichTextEditor serializes with (bold > italic > underline > strikethrough). */
export function stripFormatting(text: string): string {
	return text
		.split("\n")
		.map((line) => extractAlign(line).body)
		.join("\n")
		.replace(/\*\*(.+?)\*\*/g, "$1")
		.replace(/_(.+?)_/g, "$1")
		.replace(/\+\+(.+?)\+\+/g, "$1")
		.replace(/~~(.+?)~~/g, "$1");
}
