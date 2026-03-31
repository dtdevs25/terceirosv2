// ============================================================
// Cliente HTTP centralizado — substitui Firebase SDK
// Todos os dados são buscados via REST API com JWT
// ============================================================

const API_BASE = '/api';

export interface ApiError {
  error: string;
  status: number;
}

// ============================================================
// Fetch com autenticação JWT automática
// ============================================================
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('ronda_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  // Token expirado ou inválido → logout automático
  if (response.status === 401) {
    localStorage.removeItem('ronda_token');
    localStorage.removeItem('ronda_user');
    window.location.href = '/';
    throw { error: 'Sessão expirada. Faça login novamente.', status: 401 } as ApiError;
  }

  if (!response.ok) {
    let errorMsg = `Erro HTTP ${response.status}`;
    try {
      const body = await response.json();
      errorMsg = body.error || errorMsg;
    } catch {
      // ignora se não for JSON
    }
    throw { error: errorMsg, status: response.status } as ApiError;
  }

  const text = await response.text();
  if (!text) return null as T;
  return JSON.parse(text) as T;
}

// ============================================================
// Métodos HTTP simplificados
// ============================================================
export const api = {
  get<T>(path: string) {
    return apiFetch<T>(path, { method: 'GET' });
  },

  post<T>(path: string, body: unknown) {
    return apiFetch<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  put<T>(path: string, body: unknown) {
    return apiFetch<T>(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  delete<T>(path: string) {
    return apiFetch<T>(path, { method: 'DELETE' });
  },
};

// ============================================================
// Auth helpers
// ============================================================
export function getStoredToken(): string | null {
  return localStorage.getItem('ronda_token');
}

export function getStoredUser(): any | null {
  const raw = localStorage.getItem('ronda_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: any) {
  localStorage.setItem('ronda_token', token);
  localStorage.setItem('ronda_user', JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem('ronda_token');
  localStorage.removeItem('ronda_user');
}
