// Client-side avatar pre-resize, purely a bandwidth optimization — the
// gateway's own decode-and-re-encode step (see crates/gateway/src/media.rs,
// optimize_avatar) is the actual validation/correctness boundary, so this
// doesn't need to be perfect, just good enough to avoid uploading a raw
// multi-megapixel phone photo.

// A real decode, not just a declared Content-Type sniff — `file.type` is
// whatever the OS/browser guessed from the extension and is trivial to get
// wrong (or fake), so this is the fast client-side "is this actually
// openable as an image" check before even trying to upload it.
export async function isLikelyImage(file: File): Promise<boolean> {
	if (!file.type.startsWith("image/")) return false;
	try {
		const bitmap = await createImageBitmap(file);
		bitmap.close();
		return true;
	} catch {
		return false;
	}
}

/** Resizes (never upscales) to `maxEdge` on the longest side and re-encodes
 * as WebP, returning a Blob ready to upload. */
export async function resizeImageToBlob(
	file: File,
	maxEdge = 1024,
): Promise<Blob> {
	const bitmap = await createImageBitmap(file);
	try {
		const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
		const width = Math.max(1, Math.round(bitmap.width * scale));
		const height = Math.max(1, Math.round(bitmap.height * scale));
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("2D canvas context unavailable");
		ctx.drawImage(bitmap, 0, 0, width, height);
		return await new Promise<Blob>((resolve, reject) => {
			canvas.toBlob(
				(blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
				"image/webp",
				0.92,
			);
		});
	} finally {
		bitmap.close();
	}
}

/** Rotates an already-hosted image (given its URL) by a multiple of 90°
 * and returns the result as a Blob, ready to re-upload. Fetches the bytes
 * directly (rather than loading via an `<img>` tag) so drawing it to a
 * canvas never trips the cross-origin "tainted canvas" restriction — the
 * remote gateway origin doesn't need to send CORS headers for this to
 * work, since the pixels only ever pass through a same-origin blob. */
export async function rotateImageFromUrl(
	url: string,
	degrees: 90 | 180 | 270,
): Promise<Blob> {
	const response = await fetch(url);
	const sourceBlob = await response.blob();
	const bitmap = await createImageBitmap(sourceBlob);
	try {
		const swapped = degrees % 180 !== 0;
		const canvas = document.createElement("canvas");
		canvas.width = swapped ? bitmap.height : bitmap.width;
		canvas.height = swapped ? bitmap.width : bitmap.height;
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("2D canvas context unavailable");
		ctx.translate(canvas.width / 2, canvas.height / 2);
		ctx.rotate((degrees * Math.PI) / 180);
		ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
		return await new Promise<Blob>((resolve, reject) => {
			canvas.toBlob(
				(blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
				"image/webp",
				0.92,
			);
		});
	} finally {
		bitmap.close();
	}
}
