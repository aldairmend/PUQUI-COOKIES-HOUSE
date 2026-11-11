import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useApi';
import { menuDe, ROLES, tituloPara } from '../lib/roles';
import { Icono, Logo } from './ui';

// Menú lateral según el rol: solo aparecen las pantallas con acceso.
export default function Layout() {
  const { usuario, logout } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setAbierto(false), [pathname]);

  const menu = menuDe(usuario.rol);
  const grupos = [...new Set(menu.map((p) => p.grupo))];

  return (
    <div className="app">
      <header className="barra-movil">
        <div className="marca"><Logo size={32} /><span>Puqui Cookies House</span></div>
        <button type="button" className="boton-icono" aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={abierto}
          aria-controls="menu-lateral" onClick={() => setAbierto(!abierto)}>
          <Icono nombre={abierto ? 'cerrar' : 'menu'} size={24} />
        </button>
      </header>

      <aside id="menu-lateral" className={`lateral ${abierto ? 'lateral--abierto' : ''}`}>
        <div className="marca marca--lateral"><Logo size={38} /><span>Puqui Cookies House</span></div>
        <nav aria-label="Principal">
          {grupos.map((g) => (
            <div key={g} className="nav-grupo">
              <div className="nav-grupo__titulo">{g}</div>
              {menu.filter((p) => p.grupo === g).map((p) => (
                <NavLink key={p.path} to={p.path} className="nav-item">
                  <Icono nombre={p.icono} />
                  <span>{tituloPara(p, usuario.rol)}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="usuario">
          <div className="usuario__nombre">{usuario.nombre}</div>
          <div className="usuario__rol">
            {ROLES[usuario.rol].nombre}{usuario.modulo_nombre ? ` · ${usuario.modulo_nombre}` : ''}
          </div>
          <button type="button" className="boton boton--enlace" onClick={logout}>
            <Icono nombre="salir" size={18} /> Cerrar sesión
          </button>
        </div>
      </aside>
      {abierto && <div className="velo" onClick={() => setAbierto(false)} aria-hidden="true" />}

      <main className="contenido" id="contenido">
        <div className="contenido__ancho">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
