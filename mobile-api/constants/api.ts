const normalizeUrl = (url: string) => url.replace(/\/+$/, '');

export const BASE_URL = normalizeUrl(
  process.env.EXPO_PUBLIC_API_URL?.trim() || 'http://localhost:3000',
);
