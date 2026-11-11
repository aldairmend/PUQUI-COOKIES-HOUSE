import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const CLAVE = 'puqui-sesion';
const AuthContext = createContext(null);

function leerSesion() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE)) || null;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  constructor(status, mensaje, detalle) {
    super(mensaje);
    this.status = status;
    this.detalle = detalle;
  }
}

export function AuthProvider({ children }) {
  const [sesion, setSesion] = useState(leerSesion);

  const guardar = useCallback((s) => {
    setSesion(s);
    try {
      if (s) localStorage.setItem(CLAVE, JSON.stringify(s));
      else localStorage.removeItem(CLAVE);
    } catch {
      /* sin almacenamiento: la sesión dura mientras la pestaña esté abierta */
    }
  }, []);

  const request = useCallback(async (metodo, path, body) => {
    let res;
    try {
      res = await fetch(`/api${path}`, {
        method: metodo,
        headers: {
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(sesion ? { Authorization: `Bearer ${sesion.token}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError(0, 'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.');
    }
    const data = await res.json().catch(() => null);
    if (res.status === 401 && sesion) guardar(null);
    if (!res.ok) throw new ApiError(res.status, (data && data.error) || 'Ocurrió un error.', data && data.detalle);
    return data;
  }, [sesion, guardar]);

  const valor = useMemo(() => ({
    usuario: sesion ? sesion.usuario : null,
    async login(email, password) {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
      }).catch(() => null);
      if (!res) throw new ApiError(0, 'No hay conexión con el servidor.');
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new ApiError(res.status, (data && data.error) || 'No se pudo iniciar sesión.');
      guardar(data);
      return data.usuario;
    },
    logout: () => guardar(null),
    api: {
      get: (p) => request('GET', p),
      post: (p, b = {}) => request('POST', p, b),
      patch: (p, b = {}) => request('PATCH', p, b),
    },
  }), [sesion, request, guardar]);

  return createElement(AuthContext.Provider, { value: valor }, children);
}

export const useAuth = () => useContext(AuthContext);
export const useApi = () => useContext(AuthContext).api;

// Carga datos de la API y los vuelve a pedir cuando cambia la ruta. path = null no carga nada.
export function useFetch(path) {
  const api = useApi();
  const [estado, setEstado] = useState({ data: null, error: null, loading: !!path });
  const vez = useRef(0);

  const cargar = useCallback(async () => {
    if (!path) return;
    const mia = ++vez.current;
    setEstado((e) => ({ ...e, loading: true, error: null }));
    try {
      const data = await api.get(path);
      if (mia === vez.current) setEstado({ data, error: null, loading: false });
    } catch (error) {
      if (mia === vez.current) setEstado((e) => ({ ...e, error, loading: false }));
    }
  }, [api, path]);

  useEffect(() => { cargar(); }, [cargar]);
  return { ...estado, reload: cargar };
}
