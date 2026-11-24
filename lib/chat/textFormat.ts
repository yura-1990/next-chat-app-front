// A deliberately tiny markup scheme for message text — no new storage, no
// schema change: it's just plain text with a few literal markers, so it
// round-trips through the existing `body` column untouched and reads fine
// even somewhere that never parses it (a raw DB dump, a push notification).
//
//   - `**bold**`, `_italic_`, `++underline++` — inline spans
//   - a leading `[align:center]` / `[align:right]` marker — paragraph
//     alignment, stripped and applied as `text-align` on render; absent
//     means left (the default), so no marker is ever stored for that case

export type TextAlign = "left" | "center" | "right";

const ALIGN_PREFIX = /^\[align:(center|right)\]/;

/** Splits a leading alignment marker (if any) off the real message body. */
export function extractAlign(text: string): { align: TextAlign; body: string } {
	const match = text.match(ALIGN_PREFIX);
	if (!match) return { align: "left", body: text };
	return { align: match[1] as TextAlign, body: text.slice(match[0].length) };
}

/** Prepends the alignment marker back on, ready to send/store — the
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
};

const RUN_PATTERN = /(\*\*.+?\*\*|\+\+.+?\+\+|_.+?_)/g;

/** Splits already-align-stripped body text into runs for rendering. */
export function parseFormattedRuns(body: string): FormattedRun[] {
	return body
		.split(RUN_PATTERN)
		.filter((part) => part.length > 0)
		.map((part) => {
			if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
				return { text: part.slice(2, -2), bold: true };
			}
			if (part.startsWith("++") && part.endsWith("++") && part.length > 4) {
				return { text: part.slice(2, -2), underline: true };
			}
			if (part.startsWith("_") && part.endsWith("_") && part.length > 2) {
				return { text: part.slice(1, -1), italic: true };
			}
			return { text: part };
		});
}

/** Plain-text rendering for contexts that show a snippet rather than the
 * full message — sidebar previews, reply quotes, search matches — where
 * literal `**`/`_`/`++` markers or an alignment tag would just look broken. */
export function stripFormatting(text: string): string {
	const { body } = extractAlign(text);
	return body
		.replace(/\*\*(.+?)\*\*/g, "$1")
		.replace(/\+\+(.+?)\+\+/g, "$1")
		.replace(/_(.+?)_/g, "$1");
}
