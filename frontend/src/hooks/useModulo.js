import { useEffect, useState } from 'react';
import { useAuth, useFetch } from './useApi';

const CLAVE = 'puqui-modulo';

// Módulo con el que trabaja la pantalla. El vendedor siempre usa el suyo; el resto lo elige (y se recuerda).
// conTodos = true permite «Todos los módulos» (valor '').
export function useModulo({ conTodos = false } = {}) {
  const { usuario } = useAuth();
  const { data: modulos } = useFetch('/modulos');
  const fijo = usuario && usuario.rol === 'vendedor' ? String(usuario.modulo_id) : null;
  const [elegido, setElegido] = useState(() => {
    try {
      return localStorage.getItem(CLAVE) || '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    if (fijo || !modulos || !modulos.length) return;
    if (!conTodos && (!elegido || !modulos.some((m) => String(m.id) === elegido))) setElegido(String(modulos[0].id));
  }, [modulos, elegido, conTodos, fijo]);

  const cambiar = (v) => {
    setElegido(v);
    try {
      if (v) localStorage.setItem(CLAVE, v);
    } catch {
      /* preferencia opcional */
    }
  };

  const moduloId = fijo || elegido;
  const modulo = (modulos || []).find((m) => String(m.id) === String(moduloId)) || null;
  return { moduloId, setModuloId: cambiar, modulos: modulos || [], modulo, fijo: !!fijo };
}
