import { createGiphyClient } from './giphy.api';

export const giphyWebKey = process.env.NEXT_PUBLIC_GIPHY_API_KEY?.trim() ?? '';
export const giphyClient = createGiphyClient(giphyWebKey);
