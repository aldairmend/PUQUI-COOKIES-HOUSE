import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { useAuth } from './hooks/useApi';
import { acceso, ROLES } from './lib/roles';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PanelPropietario from './pages/PanelPropietario';
import MiTurno from './pages/MiTurno';
import MiRuta from './pages/MiRuta';
import Ventas from './pages/Ventas';
import Aplicador from './pages/Aplicador';
import Stock from './pages/Stock';
import Distribucion from './pages/Distribucion';
import Devoluciones from './pages/Devoluciones';
import Caja from './pages/Caja';
import Promociones from './pages/Promociones';
import Asistencia from './pages/Asistencia';
import Reportes from './pages/Reportes';

const PAGINAS = {
  '/dashboard': Dashboard,
  '/panel': PanelPropietario,
  '/mi-turno': MiTurno,
  '/mi-ruta': MiRuta,
  '/ventas': Ventas,
  '/aplicador': Aplicador,
  '/stock': Stock,
  '/distribucion': Distribucion,
  '/devoluciones': Devoluciones,
  '/caja': Caja,
  '/promociones': Promociones,
  '/asistencia': Asistencia,
  '/reportes': Reportes,
};

// Ruta protegida por rol: quien escriba la dirección de otra pantalla vuelve a su inicio.
function Protegida({ path, children }) {
  const { usuario } = useAuth();
  if (!acceso(usuario.rol, path)) return <Navigate to={ROLES[usuario.rol].inicio} replace />;
  return children;
}

export default function App() {
  const { usuario } = useAuth();
  if (!usuario) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }
  const inicio = ROLES[usuario.rol].inicio;
  return (
    <Routes>
      <Route element={<Layout />}>
        {Object.entries(PAGINAS).map(([path, Pagina]) => (
          <Route key={path} path={path} element={<Protegida path={path}><Pagina /></Protegida>} />
        ))}
        <Route path="*" element={<Navigate to={inicio} replace />} />
      </Route>
    </Routes>
  );
}
