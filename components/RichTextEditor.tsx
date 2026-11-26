"use client";

import {
	forwardRef,
	type ClipboardEvent as ReactClipboardEvent,
	type FormEvent as ReactFormEvent,
	type KeyboardEvent as ReactKeyboardEvent,
	useCallback,
	useEffect,
	useImperativeHandle,
	useRef,
} from "react";
import {
	extractAlign,
	type FormattedRun,
	parseFormattedRuns,
	type TextAlign,
	withAlign,
} from "@/lib/chat/textFormat";

export type RichTextMark = "bold" | "italic" | "underline" | "strikethrough";

export type RichTextEditorHandle = {
	focus: () => void;
	toggleMark: (mark: RichTextMark) => void;
	setAlign: (align: TextAlign) => void;
	insertText: (text: string) => void;
};

type Props = {
	value: string;
	onChange: (next: string) => void;
	className: string;
	placeholder?: string;
	ariaLabel?: string;
	maxLength?: number;
	onTyping?: () => void;
	onLengthChange?: (length: number) => void;
	onAlignChange?: (align: TextAlign) => void;
	/** Enter (without Shift) calls this instead of inserting a line break —
	 * the composer's "Enter sends" convention. Omitted means Enter always
	 * inserts a new line, which is what every other formatted field wants. */
	onEnterSubmit?: () => void;
	/** Mirrors the composer's auto-grow-to-fit-content textarea behavior. */
	autoGrow?: { maxHeight: number };
};

// Any tag a browser might use for a given mark — execCommand's exact tag
// choice is a long-settled Chromium/Firefox convention (bold -> <b>, italic
// -> <i>, underline -> <u>, strikethrough -> <strike>), but older content or
// a different engine could use <strong>/<em>/<del>, so both are recognized
// on the way back out.
const MARK_READ_TAGS: Record<RichTextMark, string[]> = {
	bold: ["B", "STRONG"],
	italic: ["I", "EM"],
	underline: ["U"],
	strikethrough: ["S", "STRIKE", "DEL"],
};

function closestLine(node: Node, container: HTMLElement): HTMLElement | null {
	let el: HTMLElement | null =
		node.nodeType === Node.ELEMENT_NODE
			? (node as HTMLElement)
			: node.parentElement;
	while (el && el !== container) {
		if (el.parentElement === container) return el;
		el = el.parentElement;
	}
	return null;
}

function lineAlign(line: HTMLElement): TextAlign {
	const value = line.style.textAlign;
	return value === "center" || value === "right" ? value : "left";
}

function serializeLineBody(line: HTMLElement): string {
	function walk(node: Node, active: Omit<FormattedRun, "text">): string {
		if (node.nodeType === Node.TEXT_NODE) {
			const text = node.textContent ?? "";
			if (!text) return "";
			let out = text;
			if (active.strikethrough) out = `~~${out}~~`;
			if (active.underline) out = `++${out}++`;
			if (active.italic) out = `_${out}_`;
			if (active.bold) out = `**${out}**`;
			return out;
		}
		if (node.nodeType !== Node.ELEMENT_NODE) return "";
		const el = node as HTMLElement;
		if (el.tagName === "BR") return "";
		const next = { ...active };
		for (const mark of Object.keys(MARK_READ_TAGS) as RichTextMark[]) {
			if (MARK_READ_TAGS[mark].includes(el.tagName)) next[mark] = true;
		}
		let out = "";
		for (const child of Array.from(el.childNodes)) out += walk(child, next);
		return out;
	}
	let out = "";
	for (const child of Array.from(line.childNodes)) out += walk(child, {});
	return out;
}

function serializeEditor(container: HTMLElement): string {
	return Array.from(container.children)
		.map((child) =>
			withAlign(
				serializeLineBody(child as HTMLElement),
				lineAlign(child as HTMLElement),
			),
		)
		.join("\n");
}

function plainTextLength(container: HTMLElement): number {
	let total = 0;
	for (const line of Array.from(container.children)) {
		total += (line.textContent ?? "").length;
	}
	// One implicit newline between each line, not after the last.
	return total + Math.max(0, container.children.length - 1);
}

function buildLine(align: TextAlign, body: string): HTMLDivElement {
	const line = document.createElement("div");
	line.className = "rte-line";
	if (align !== "left") line.style.textAlign = align;
	const runs = parseFormattedRuns(body);
	if (runs.length === 0) {
		line.appendChild(document.createElement("br"));
		return line;
	}
	for (const run of runs) {
		if (!run.text) continue;
		let node: Node = document.createTextNode(run.text);
		if (run.strikethrough) node = wrapTag("s", node);
		if (run.underline) node = wrapTag("u", node);
		if (run.italic) node = wrapTag("i", node);
		if (run.bold) node = wrapTag("b", node);
		line.appendChild(node);
	}
	if (!line.hasChildNodes()) line.appendChild(document.createElement("br"));
	return line;
}

function wrapTag(tag: string, child: Node): HTMLElement {
	const el = document.createElement(tag);
	el.appendChild(child);
	return el;
}

function renderValueIntoContainer(container: HTMLElement, value: string) {
	container.innerHTML = "";
	for (const line of value.split("\n")) {
		const { align, body } = extractAlign(line);
		container.appendChild(buildLine(align, body));
	}
}

export const RichTextEditor = forwardRef<RichTextEditorHandle, Props>(
	function RichTextEditor(
		{
			value,
			onChange,
			className,
			placeholder,
			ariaLabel,
			maxLength,
			onTyping,
			onLengthChange,
			onAlignChange,
			onEnterSubmit,
			autoGrow,
		},
		ref,
	) {
		const containerRef = useRef<HTMLDivElement>(null);
		const lastEmittedRef = useRef<string | null>(null);
		const savedRangeRef = useRef<Range | null>(null);

		const autoGrowIfNeeded = useCallback(() => {
			if (!autoGrow || !containerRef.current) return;
			const el = containerRef.current;
			el.style.height = "auto";
			el.style.height = `${Math.min(el.scrollHeight, autoGrow.maxHeight)}px`;
		}, [autoGrow]);

		useEffect(() => {
			const container = containerRef.current;
			if (!container) return;
			if (lastEmittedRef.current === value) return;
			renderValueIntoContainer(container, value);
			lastEmittedRef.current = value;
			autoGrowIfNeeded();
			onLengthChange?.(plainTextLength(container));
			// Re-synced only when `value` changes out from under us (switching
			// conversations, clearing after send, loading a message into edit) —
			// never on every keystroke, since rebuilding the DOM on each input
			// would blow away the live caret position.
		}, [value, autoGrowIfNeeded, onLengthChange]);

		function emitChange() {
			const container = containerRef.current;
			if (!container) return;
			const next = serializeEditor(container);
			lastEmittedRef.current = next;
			onChange(next);
			onLengthChange?.(plainTextLength(container));
			autoGrowIfNeeded();
		}

		function syncSelectionState() {
			const container = containerRef.current;
			if (!container) return;
			const selection = window.getSelection();
			if (!selection || selection.rangeCount === 0) return;
			const range = selection.getRangeAt(0);
			if (!container.contains(range.startContainer)) return;
			savedRangeRef.current = range.cloneRange();
			const line = closestLine(range.startContainer, container);
			if (line) onAlignChange?.(lineAlign(line));
		}

		function currentRange(): Range | null {
			const container = containerRef.current;
			const selection = window.getSelection();
			if (
				container &&
				selection &&
				selection.rangeCount > 0 &&
				container.contains(selection.getRangeAt(0).startContainer)
			) {
				return selection.getRangeAt(0);
			}
			return savedRangeRef.current;
		}

		function insertLineBreakAtCaret() {
			const container = containerRef.current;
			const selection = window.getSelection();
			if (!container || !selection || selection.rangeCount === 0) return;
			const range = selection.getRangeAt(0);
			const line = closestLine(range.startContainer, container);
			if (!line) return;

			range.deleteContents();
			const afterRange = document.createRange();
			afterRange.setStart(range.startContainer, range.startOffset);
			afterRange.setEndAfter(line.lastChild ?? line);
			const afterFragment = afterRange.extractContents();

			const newLine = document.createElement("div");
			newLine.className = "rte-line";
			newLine.style.textAlign = line.style.textAlign;
			if (afterFragment.childNodes.length === 0) {
				newLine.appendChild(document.createElement("br"));
			} else {
				newLine.appendChild(afterFragment);
			}
			line.after(newLine);
			if (!line.hasChildNodes()) line.appendChild(document.createElement("br"));

			const caretRange = document.createRange();
			caretRange.setStart(newLine, 0);
			caretRange.collapse(true);
			selection.removeAllRanges();
			selection.addRange(caretRange);
			savedRangeRef.current = caretRange.cloneRange();
		}

		function insertRawText(text: string) {
			const selection = window.getSelection();
			if (!selection || selection.rangeCount === 0) return;
			const range = selection.getRangeAt(0);
			range.deleteContents();
			const node = document.createTextNode(text);
			range.insertNode(node);
			range.setStartAfter(node);
			range.collapse(true);
			selection.removeAllRanges();
			selection.addRange(range);
			savedRangeRef.current = range.cloneRange();
		}

		function insertPlainTextAtCaret(text: string) {
			const segments = text.split("\n");
			segments.forEach((segment, index) => {
				if (index > 0) insertLineBreakAtCaret();
				if (segment) insertRawText(segment);
			});
		}

		function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
			if (event.key !== "Enter") return;
			if (onEnterSubmit && !event.shiftKey) {
				event.preventDefault();
				onEnterSubmit();
				return;
			}
			event.preventDefault();
			insertLineBreakAtCaret();
			emitChange();
		}

		function handleBeforeInput(
			event: ReactFormEvent<HTMLDivElement> & {
				nativeEvent: InputEvent;
			},
		) {
			if (!maxLength || !containerRef.current) return;
			const inputType = event.nativeEvent.inputType ?? "";
			if (inputType.startsWith("delete")) return;
			if (plainTextLength(containerRef.current) >= maxLength) {
				event.preventDefault();
			}
		}

		function handlePaste(event: ReactClipboardEvent<HTMLDivElement>) {
			event.preventDefault();
			const container = containerRef.current;
			if (!container) return;
			const text = event.clipboardData.getData("text/plain");
			if (!text) return;
			const remaining = maxLength
				? Math.max(0, maxLength - plainTextLength(container))
				: text.length;
			const toInsert = text.slice(0, remaining);
			if (!toInsert) return;
			insertPlainTextAtCaret(toInsert);
			emitChange();
		}

		useImperativeHandle(ref, () => ({
			focus: () => containerRef.current?.focus(),
			toggleMark: (mark) => {
				const container = containerRef.current;
				if (!container) return;
				const range = currentRange();
				container.focus();
				if (range) {
					const selection = window.getSelection();
					selection?.removeAllRanges();
					selection?.addRange(range);
				}
				document.execCommand(
					mark === "strikethrough" ? "strikeThrough" : mark,
					false,
				);
				emitChange();
			},
			setAlign: (align) => {
				const container = containerRef.current;
				if (!container) return;
				const range = currentRange();
				if (!range) return;
				const startLine = closestLine(range.startContainer, container);
				const endLine = closestLine(range.endContainer, container);
				if (!startLine) return;
				let node: HTMLElement | null = startLine;
				while (node) {
					node.style.textAlign = align === "left" ? "" : align;
					if (!endLine || node === endLine) break;
					node = node.nextElementSibling as HTMLElement | null;
				}
				onAlignChange?.(align);
				emitChange();
				container.focus();
			},
			insertText: (text) => {
				const container = containerRef.current;
				if (!container) return;
				const range = currentRange();
				container.focus();
				if (range) {
					const selection = window.getSelection();
					selection?.removeAllRanges();
					selection?.addRange(range);
				}
				insertRawText(text);
				emitChange();
			},
		}));

		return (
			<div className="rte-wrap">
				{/* biome-ignore lint/a11y/useSemanticElements: a real rich-text
				    surface — per-line alignment and inline bold/italic/underline/
				    strikethrough marks aren't representable in a plain textarea */}
				<div
					ref={containerRef}
					className={className}
					contentEditable
					suppressContentEditableWarning
					tabIndex={0}
					aria-label={ariaLabel}
					role="textbox"
					aria-multiline="true"
					onInput={() => {
						emitChange();
						onTyping?.();
					}}
					onBeforeInput={handleBeforeInput}
					onKeyDown={handleKeyDown}
					onKeyUp={syncSelectionState}
					onMouseUp={syncSelectionState}
					onBlur={syncSelectionState}
					onPaste={handlePaste}
				/>
				{value.length === 0 && placeholder && (
					<div className={`rte-placeholder ${className}`} aria-hidden="true">
						{placeholder}
					</div>
				)}
			</div>
		);
	},
);
