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
