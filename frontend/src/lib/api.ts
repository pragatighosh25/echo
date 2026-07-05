const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

export const getTokens = () => {
  if (typeof window === 'undefined') return { accessToken: null, refreshToken: null };
  const accessToken = localStorage.getItem('echo_access_token');
  const refreshToken = localStorage.getItem('echo_refresh_token');
  return { accessToken, refreshToken };
};

export const setTokens = (accessToken: string, refreshToken: string) => {
  localStorage.setItem('echo_access_token', accessToken);
  localStorage.setItem('echo_refresh_token', refreshToken);
};

export const clearTokens = () => {
  localStorage.removeItem('echo_access_token');
  localStorage.removeItem('echo_refresh_token');
  localStorage.removeItem('echo_user');
};

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const subscribeTokenRefresh = (cb: (token: string) => void) => {
  refreshSubscribers.push(cb);
};

const onRefreshed = (token: string) => {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
};

export const apiFetch = async (path: string, options: RequestOptions = {}): Promise<any> => {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  
  const headers = new Headers(options.headers || {});
  if (!options.skipAuth) {
    const { accessToken } = getTokens();
    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }
  }

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const finalOptions: RequestInit = {
    ...options,
    headers,
  };

  const response = await fetch(url, finalOptions);

  if (response.status === 401 && !options.skipAuth && !isRefreshing) {
    // Attempt token refresh
    isRefreshing = true;
    const { refreshToken } = getTokens();

    if (!refreshToken) {
      clearTokens();
      if (typeof window !== 'undefined') window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    try {
      const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!refreshResponse.ok) {
        // The server rejected the refresh token (session expired)
        clearTokens();
        if (typeof window !== 'undefined') window.location.href = '/login';
        throw new Error('Session expired');
      }

      const data = await refreshResponse.json();
      setTokens(data.accessToken, data.refreshToken);
      isRefreshing = false;
      onRefreshed(data.accessToken);

      // Retry original request
      headers.set('Authorization', `Bearer ${data.accessToken}`);
      const retryResponse = await fetch(url, finalOptions);
      if (!retryResponse.ok) {
        const errorData = await retryResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Request failed after refresh');
      }
      return await retryResponse.json();
    } catch (err) {
      isRefreshing = false;
      // If it is a network connection error (TypeError like "Failed to fetch" or offline), do NOT log out!
      if (err instanceof TypeError || (err as Error).message === 'Failed to fetch' || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        throw err;
      }
      // Otherwise, clear tokens and redirect to login
      clearTokens();
      if (typeof window !== 'undefined') window.location.href = '/login';
      throw new Error('Unauthorized: Session expired');
    }
  } else if (response.status === 401 && !options.skipAuth && isRefreshing) {
    // Wait for the active refresh to finish
    return new Promise((resolve, reject) => {
      subscribeTokenRefresh(async (newToken) => {
        try {
          headers.set('Authorization', `Bearer ${newToken}`);
          const retryResponse = await fetch(url, finalOptions);
          if (!retryResponse.ok) {
            const errorData = await retryResponse.json().catch(() => ({}));
            reject(new Error(errorData.error || 'Request failed after refresh'));
            return;
          }
          resolve(await retryResponse.json());
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return await response.json();
};
