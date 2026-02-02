import type { RouteObject } from "react-router-dom";
import NotFound from "../pages/NotFound";
import Login from "../pages/login/page";
import Dashboard from "../pages/dashboard/page";
import Calendario from "../pages/calendario/page";
import Admin from "../pages/admin/page";
import Andenes from "../pages/andenes/page";
import Reservas from "../pages/reservas/page";
import MatrizPermisos from "../pages/admin/matriz-permisos/page";
import AccessPending from "../pages/access-pending/page";
import { lazy } from "react";

const AdminPage = lazy(() => import('../pages/admin/page'));
const MatrizPermisosPage = lazy(() => import('../pages/admin/matriz-permisos/page'));
const UsuariosPage = lazy(() => import('../pages/admin/usuarios/page'));
const RolesPage = lazy(() => import('../pages/admin/roles/page'));
const CatalogosPage = lazy(() => import('../pages/admin/catalogos/page'));
const AlmacenesPage = lazy(() => import('../pages/admin/almacenes/page'));
const ManpowerPage = lazy(() => import('../pages/manpower/page'));
const CasetillaPage = lazy(() => import('../pages/casetilla/page'));

const routes: RouteObject[] = [
  { path: '/', element: <Dashboard /> },
  { path: '/dashboard', element: <Dashboard /> },
  { path: '/calendario', element: <Calendario /> },
  { path: '/reservas', element: <Reservas /> },
  { path: '/andenes', element: <Andenes /> },
  { path: '/manpower', element: <ManpowerPage /> },
  { path: '/casetilla', element: <CasetillaPage /> },
  { path: '/admin', element: <AdminPage /> },
  { path: '/admin/matriz-permisos', element: <MatrizPermisosPage /> },
  { path: '/admin/usuarios', element: <UsuariosPage /> },
  { path: '/admin/roles', element: <RolesPage /> },
  { path: '/admin/catalogos', element: <CatalogosPage /> },
  { path: '/admin/almacenes', element: <AlmacenesPage /> },
  { path: '/access-pending', element: <AccessPending /> },
  { path: '/login', element: <Login /> },
  { path: '*', element: <NotFound /> },
];

export default routes;
