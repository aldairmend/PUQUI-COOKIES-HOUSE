import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useApi';
import { ROLES } from '../lib/roles';
import { Aviso, Icono, Logo } from '../components/ui';

// Usuarios del script de datos de demostración (npm run db:seed).
const DEMO = [
  ['propietaria@puqui.pe', 'Rosa Mendoza', 'Propietario'],
  ['admin@puqui.pe', 'Aldair Mendoza', 'Administrador'],
  ['ana@puqui.pe', 'Ana Torres', 'Vendedor · San Isidro'],
  ['diego@puqui.pe', 'Diego León', 'Vendedor · La Molina'],
  ['repartidor@puqui.pe', 'Luis Pardo', 'Repartidor'],
];
const esLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [estado, setEstado] = useState({ enviando: false, error: null });
  // Los usuarios de prueba se muestran en local o cuando el servidor tiene los datos de demostración activos.
  const [verDemo, setVerDemo] = useState(esLocal);
  useEffect(() => {
    fetch('/api/salud').then((r) => r.json()).then((d) => d.demo && setVerDemo(true)).catch(() => {});
  }, []);

  async function entrar(e) {
    e.preventDefault();
    setEstado({ enviando: true, error: null });
    try {
      const u = await login(email, password);
      navigate(ROLES[u.rol].inicio, { replace: true });
    } catch (error) {
      setEstado({ enviando: false, error });
    }
  }

  return (
    <div className="login">
      <section className="login__marca">
        <Logo size={84} />
        <h1>Puqui Cookies House</h1>
        <p>Gestión y trazabilidad de ventas y stock por sabor y día, en un solo sistema.</p>
        <div className="login__puntos">
          {[
            'Ventas por producto y sabor, con descuento automático de stock (FIFO).',
            'Historial de rotación por turno y día, sin hojitas ni cuadernos.',
            'Caja, devoluciones, asistencia y promociones en un solo lugar.',
          ].map((t) => <div key={t}><Icono nombre="check" size={22} /><span>{t}</span></div>)}
        </div>
      </section>

      <section className="login__form">
        <div className="login__caja">
          <h2>Ingresar</h2>
          <p className="muted" style={{ margin: '6px 0 20px' }}>Usa tu cuenta para abrir tu módulo.</p>
          <form className="tarjeta" onSubmit={entrar} noValidate>
            <label className="campo">
              <span>Correo</span>
              <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="campo">
              <span>Contraseña</span>
              <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            {estado.error && <Aviso tono="error">{estado.error.message}</Aviso>}
            <button className="boton boton--primario boton--bloque" type="submit" disabled={estado.enviando || !email || !password}>
              {estado.enviando ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>
          {verDemo && (
            <details className="demo-usuarios">
              <summary>Usuarios de demostración (contraseña «puqui2026»)</summary>
              {DEMO.map(([correo, nombre, rol]) => (
                <button type="button" key={correo} onClick={() => { setEmail(correo); setPassword('puqui2026'); }}>
                  <strong>{rol}</strong> · {nombre} <span className="muted">({correo})</span>
                </button>
              ))}
            </details>
          )}
        </div>
      </section>
    </div>
  );
}
