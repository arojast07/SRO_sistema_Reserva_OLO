import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { supabase } from '../../lib/supabase';

interface MenuItem {
  path: string;
  label: string;
  icon: string;
  permission?: string;
  children?: MenuItem[];
}

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { orgId, can, loading: permsLoading } = usePermissions();
  
  // ✅ Estado para orgName (fetch desde organizations)
  const [orgName, setOrgName] = useState<string | null>(null);
  
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem(`sidebar-expanded-${user?.id}`);
    return saved ? JSON.parse(saved) : true;
  });
  
  const [expandedSubmenus, setExpandedSubmenus] = useState<Record<string, boolean>>({});
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // ✅ Fetch orgName cuando orgId existe
  useEffect(() => {
    if (orgId) {
      console.log('[Sidebar] Fetching org name for orgId:', orgId);
      supabase
        .from('organizations')
        .select('name')
        .eq('id', orgId)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) {
            console.error('[Sidebar] Error fetching org name:', error);
            setOrgName('Sin organización');
          } else {
            console.log('[Sidebar] Org name fetched:', data?.name || 'Sin organización');
            setOrgName(data?.name || 'Sin organización');
          }
        });
    } else {
      setOrgName('Sin organización');
    }
  }, [orgId]);

  // ✅ Log simple al render
  console.log('[Sidebar] render', { 
    collapsed: !isExpanded, 
    orgId: orgId || 'null', 
    orgName: orgName || 'Sin organización' 
  });

  useEffect(() => {
    if (user?.id) {
      localStorage.setItem(`sidebar-expanded-${user.id}`, JSON.stringify(isExpanded));
    }
  }, [isExpanded, user?.id]);

  const toggleSidebar = () => {
    setIsExpanded(!isExpanded);
  };

  const toggleSubmenu = (label: string) => {
    setExpandedSubmenus(prev => ({
      ...prev,
      [label]: !prev[label]
    }));
  };

  const menuItems = [
    { label: 'Dashboard', path: '/', icon: 'ri-dashboard-line' },
    { label: 'Calendario', path: '/calendario', icon: 'ri-calendar-line' },
    { label: 'Reservas', path: '/reservas', icon: 'ri-file-list-line' },
    { label: 'Andenes', path: '/andenes', icon: 'ri-truck-line' },
    { label: 'Manpower', path: '/manpower', icon: 'ri-team-line', permission: 'manpower.view' },
    { label: 'Casetilla', path: '/casetilla', icon: 'ri-door-open-line', permission: 'casetilla.view' },
    {
      label: 'Administración',
      path: '/admin',
      icon: 'ri-settings-3-line',
      children: [
        { label: 'Usuarios', path: '/admin/usuarios', icon: 'ri-user-line' },
        { label: 'Roles', path: '/admin/roles', icon: 'ri-shield-user-line' },
        { label: 'Matriz de Permisos', path: '/admin/matriz-permisos', icon: 'ri-key-line' },
        { label: 'Catálogos', path: '/admin/catalogos', icon: 'ri-database-2-line' },
        { label: 'Almacenes', path: '/admin/almacenes', icon: 'ri-building-2-line' },
      ],
    },
  ];

  const hasPermission = (permission?: string): boolean => {
    if (!permission) return true;
    if (permsLoading) return true;
    if (!orgId) return false;
    return can(permission);
  };

  const filterMenuItems = (items: MenuItem[]): MenuItem[] => {
    if (permsLoading) {
      return items.map(item => {
        if (item.children) {
          return { ...item, children: item.children };
        }
        return item;
      });
    }

    return items
      .filter(item => {
        if (item.children) {
          const visibleChildren = item.children.filter(child => hasPermission(child.permission));
          return visibleChildren.length > 0;
        }
        return hasPermission(item.permission);
      })
      .map(item => {
        if (item.children) {
          return {
            ...item,
            children: item.children.filter(child => hasPermission(child.permission)),
          };
        }
        return item;
      });
  };

  const handleNavigate = (path: string) => {
    if (permsLoading && path !== '/') {
      console.log('[Sidebar] Navegación bloqueada - permisos cargando');
      return;
    }

    console.log('[Sidebar] Navegando a:', path);
    navigate(path);
    if (window.innerWidth < 1024) {
      console.log('[Sidebar] Cerrando sidebar mobile');
      setIsMobileOpen(false);
    }
  };

  const isActive = (path: string): boolean => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  if (authLoading) {
    return (
      <aside className="fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <i className="ri-loader-4-line text-3xl text-teal-600 animate-spin"></i>
          <span className="text-sm text-gray-600">Cargando...</span>
        </div>
      </aside>
    );
  }

  const visibleMenuItems = filterMenuItems(menuItems);

  const renderMenuItem = (item: MenuItem, isChild = false) => {
    const active = isActive(item.path);
    const hasChildren = item.children && item.children.length > 0;
    const isSubmenuExpanded = expandedSubmenus[item.label];
    const isDisabled = permsLoading && item.path !== '/';

    if (hasChildren) {
      return (
        <div key={item.path}>
          <button
            onClick={() => toggleSubmenu(item.label)}
            disabled={isDisabled}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
              active
                ? 'bg-teal-50 text-teal-600'
                : 'text-gray-700 hover:bg-gray-50'
            } ${!isExpanded ? 'justify-center' : ''} ${
              isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            }`}
            title={!isExpanded ? item.label : ''}
          >
            <i className={`${item.icon} text-lg w-5 h-5 flex items-center justify-center flex-shrink-0`}></i>
            {isExpanded && (
              <>
                <span className="flex-1 text-left">{item.label}</span>
                {isDisabled ? (
                  <i className="ri-loader-4-line text-sm animate-spin"></i>
                ) : (
                  <i className={`ri-arrow-${isSubmenuExpanded ? 'up' : 'down'}-s-line text-lg`}></i>
                )}
              </>
            )}
          </button>
          
          {isExpanded && isSubmenuExpanded && !isDisabled && (
            <div className="bg-gray-50">
              {item.children?.map(child => renderMenuItem(child, true))}
            </div>
          )}
        </div>
      );
    }

    return (
      <button
        key={item.path}
        onClick={() => handleNavigate(item.path)}
        disabled={isDisabled}
        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
          active
            ? 'bg-teal-50 text-teal-600 border-r-2 border-teal-600'
            : 'text-gray-700 hover:bg-gray-50'
        } ${!isExpanded ? 'justify-center' : ''} ${isChild && isExpanded ? 'pl-12' : ''} ${
          isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
        title={!isExpanded ? item.label : ''}
      >
        <i className={`${item.icon} text-lg w-5 h-5 flex items-center justify-center flex-shrink-0`}></i>
        {isExpanded && (
          <>
            <span className="flex-1 text-left">{item.label}</span>
            {isDisabled && <i className="ri-loader-4-line text-sm animate-spin"></i>}
          </>
        )}
      </button>
    );
  };

  const sidebarContent = (
    <>
      {/* Header */}
      <div 
        className={`flex items-center gap-3 px-4 py-3 border-b border-gray-200 flex-shrink-0 ${!isExpanded ? 'justify-center' : ''}`}
      >
        {isExpanded ? (
          <>
            <img 
              src="https://public.readdy.ai/ai/img_res/0a1a11aa-fee5-4fab-a8a4-9e0219e8d44e.png" 
              alt="Logo" 
              className="h-8 w-auto flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="text-base font-semibold text-gray-900 truncate">Sistema de Andenes</div>
              <div className="text-xs text-gray-500 truncate">
                {orgName || 'Sin organización'}
              </div>
            </div>
          </>
        ) : (
          <img 
            src="https://public.readdy.ai/ai/img_res/0a1a11aa-fee5-4fab-a8a4-9e0219e8d44e.png" 
            alt="Logo" 
            className="h-8 w-auto"
          />
        )}
      </div>

      {/* Toggle Button */}
      <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title={isExpanded ? 'Colapsar menú' : 'Expandir menú'}
        >
          <i className={`ri-menu-${isExpanded ? 'fold' : 'unfold'}-line text-xl w-5 h-5 flex items-center justify-center`}></i>
        </button>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 overflow-y-auto py-4">
        {visibleMenuItems.map(item => renderMenuItem(item))}
      </nav>

      {/* User Info */}
      {isExpanded && user && (
        <div className="px-4 py-3 border-t border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-medium text-teal-600">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">{user.name}</div>
              <div className="text-xs text-gray-500 capitalize truncate">{user.role}</div>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && window.innerWidth < 1024 && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => {
            console.log('[Sidebar] Click en backdrop - cerrando sidebar');
            setIsMobileOpen(false);
          }}
          style={{
            pointerEvents: 'auto'
          }}
        />
      )}

      {/* Mobile Toggle Button */}
      <button
        onClick={() => {
          console.log('[Sidebar] Toggle mobile button clicked');
          setIsMobileOpen(true);
        }}
        className="fixed top-4 left-4 z-50 lg:hidden p-2 bg-white rounded-lg shadow-lg"
      >
        <i className="ri-menu-line text-xl w-5 h-5 flex items-center justify-center"></i>
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-screen bg-white border-r border-gray-200 z-50 transition-all duration-300 flex flex-col ${
          isExpanded ? 'w-64' : 'w-16'
        } ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
        style={{
          pointerEvents: 'auto'
        }}
      >
        {sidebarContent}
      </aside>

      {/* Spacer for content */}
      <div 
        className={`hidden lg:block transition-all duration-300 flex-shrink-0 ${isExpanded ? 'w-64' : 'w-16'}`}
        style={{
          pointerEvents: 'none'
        }}
      />
    </>
  );
}
