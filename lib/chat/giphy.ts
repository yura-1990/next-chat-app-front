// Giphy's long-published public beta key — works out of the box for
// development/testing with no signup, rate-limited and watermark-free but
// not meant for production traffic. Set NEXT_PUBLIC_GIPHY_API_KEY to your
// own key (from developers.giphy.com) before shipping this for real.
const GIPHY_API_KEY = process.env.NEXT_PUBLIC_GIPHY_API_KEY ?? "dc6zaTOxFJmzC";
const GIPHY_BASE = "https://api.giphy.com/v1/gifs";

export type GifResult = {
	id: string;
	previewUrl: string; // small, for the picker grid
	sendUrl: string; // "downsized" — small enough to upload without re-encoding
	width: number;
	height: number;
};

type RawGiphyResponse = {
	data: {
		id: string;
		images: {
			fixed_width_small: { url: string; width: string; height: string };
			downsized: { url: string };
		};
	}[];
};

function mapResults(body: RawGiphyResponse): GifResult[] {
	return body.data.map((g) => ({
		id: g.id,
		previewUrl: g.images.fixed_width_small.url,
		sendUrl: g.images.downsized.url,
		width: Number(g.images.fixed_width_small.width),
		height: Number(g.images.fixed_width_small.height),
	}));
}

export async function trendingGifs(): Promise<GifResult[]> {
	const res = await fetch(
		`${GIPHY_BASE}/trending?api_key=${GIPHY_API_KEY}&limit=24&rating=pg`,
	);
	if (!res.ok) throw new Error(`giphy trending failed: ${res.status}`);
	return mapResults(await res.json());
}

export async function searchGifs(query: string): Promise<GifResult[]> {
	const res = await fetch(
		`${GIPHY_BASE}/search?api_key=${GIPHY_API_KEY}&limit=24&rating=pg&q=${encodeURIComponent(query)}`,
	);
	if (!res.ok) throw new Error(`giphy search failed: ${res.status}`);
	return mapResults(await res.json());
}
