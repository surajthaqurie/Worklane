export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('x-user-id', '11111111-1111-1111-1111-111111111111');
  
  return fetch(url, {
    ...options,
    headers,
  });
}
