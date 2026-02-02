
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { usePermissions } from '../../../hooks/usePermissions';

interface Role {
  id: string;
  name: string;
  description: string;
  created_at: string;
  user_count?: number;
}

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface RolePermission {
  permission_id: string;
}

export default function RolesPage() {
  const { can, loading: permissionsLoading, orgId } = usePermissions();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);

  const canCreate = can('roles:create');
  const canEdit = can('roles:update');
  const canDelete = can('roles:delete');

  useEffect(() => {
    if (!permissionsLoading && orgId) {
      loadRoles();
      loadPermissions();
    }
  }, [permissionsLoading, orgId]);

  // ✅ Guard: Si está cargando permisos o no hay orgId, mostrar loading
  if (permissionsLoading || !orgId) {
    console.log('[RolesPage] Guard triggered', { permissionsLoading, orgId });
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {permissionsLoading ? 'Cargando permisos...' : 'Verificando organización...'}
          </p>
        </div>
      </div>
    );
  }

  const loadRoles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('roles')
        .select(`
          *,
          user_org_roles(count)
        `)
        .order('name');

      if (error) throw error;

      const formattedRoles = data?.map((role: any) => ({
        ...role,
        user_count: role.user_org_roles?.[0]?.count || 0
      })) || [];

      setRoles(formattedRoles);
    } catch (error) {
      console.error('[RolesPage] Error loading roles:', error);
      setRoles([]); // ✅ Fallback a array vacío
    } finally {
      setLoading(false);
    }
  };

  const loadPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from('permissions')
        .select('*')
        .order('category')
        .order('name');

      if (error) throw error;
      setPermissions(data || []);
    } catch (error) {
      console.error('[RolesPage] Error loading permissions:', error);
      setPermissions([]); // ✅ Fallback a array vacío
    }
  };

  const loadRolePermissions = async (roleId: string) => {
    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('permission_id')
        .eq('role_id', roleId);

      if (error) throw error;
      setSelectedPermissions(data?.map((rp: RolePermission) => rp.permission_id) || []);
    } catch (error) {
      console.error('[RolesPage] Error loading role permissions:', error);
      setSelectedPermissions([]); // ✅ Fallback a array vacío
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingRole) {
        const { error } = await supabase
          .from('roles')
          .update({
            name: formData.name,
            description: formData.description
          })
          .eq('id', editingRole.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('roles')
          .insert({
            name: formData.name,
            description: formData.description
          });

        if (error) throw error;
      }

      setShowModal(false);
      setEditingRole(null);
      setFormData({ name: '', description: '' });
      loadRoles();
    } catch (error: any) {
      console.error('[RolesPage] Error saving role:', error);
      alert(error.message || 'Error al guardar el rol');
    }
  };

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description
    });
    setShowModal(true);
  };

  const confirmDelete = (role: Role) => {
    setRoleToDelete(role);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!roleToDelete) return;

    try {
      const { error } = await supabase
        .from('roles')
        .delete()
        .eq('id', roleToDelete.id);

      if (error) throw error;
      
      setShowDeleteModal(false);
      setRoleToDelete(null);
      loadRoles();
    } catch (error) {
      console.error('[RolesPage] Error deleting role:', error);
      alert('Error al eliminar el rol');
    }
  };

  const handleManagePermissions = async (role: Role) => {
    setSelectedRole(role);
    await loadRolePermissions(role.id);
    setShowPermissionsModal(true);
  };

  const handlePermissionToggle = (permissionId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permissionId)
        ? prev.filter((id) => id !== permissionId)
        : [...prev, permissionId]
    );
  };

  const handleSavePermissions = async () => {
    if (!selectedRole) return;

    try {
      // Eliminar permisos existentes
      await supabase
        .from('role_permissions')
        .delete()
        .eq('role_id', selectedRole.id);

      // Insertar nuevos permisos
      if (selectedPermissions.length > 0) {
        const { error } = await supabase
          .from('role_permissions')
          .insert(
            selectedPermissions.map((permissionId) => ({
              role_id: selectedRole.id,
              permission_id: permissionId
            }))
          );

        if (error) throw error;
      }

      setShowPermissionsModal(false);
      setSelectedRole(null);
      setSelectedPermissions([]);
    } catch (error) {
      console.error('[RolesPage] Error saving permissions:', error);
      alert('Error al guardar los permisos');
    }
  };

  // ✅ Fallback arrays seguros
  const safePermissions = permissions ?? [];
  const safeRoles = roles ?? [];

  const groupedPermissions = safePermissions.reduce((acc, perm) => {
    const category = perm.category || 'Sin categoría';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Roles</h1>
          <p className="text-sm text-gray-600 mt-1">Administra los roles y sus permisos</p>
        </div>
        {canCreate && (
          <button
            onClick={() => {
              setEditingRole(null);
              setFormData({ name: '', description: '' });
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap"
          >
            <i className="ri-add-line"></i>
            Nuevo Rol
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {safeRoles.map((role) => (
          <div
            key={role.id}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-teal-100 flex items-center justify-center">
                <i className="ri-shield-user-line text-teal-600 text-xl"></i>
              </div>
              <div className="flex gap-1">
                {canEdit && (
                  <button
                    onClick={() => handleEdit(role)}
                    className="w-8 h-8 flex items-center justify-center text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <i className="ri-edit-line"></i>
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => confirmDelete(role)}
                    className="w-8 h-8 flex items-center justify-center text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar"
                  >
                    <i className="ri-delete-bin-line"></i>
                  </button>
                )}
              </div>
            </div>

            <h3 className="text-lg font-bold text-gray-900 mb-2">{role.name}</h3>
            <p className="text-sm text-gray-600 mb-4 line-clamp-2">{role.description}</p>

            <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
              <span className="flex items-center gap-1">
                <i className="ri-user-line"></i>
                {role.user_count} usuarios
              </span>
              <span>{formatDate(role.created_at)}</span>
            </div>

            {canEdit && (
              <button
                onClick={() => handleManagePermissions(role)}
                className="w-full px-4 py-2 border border-teal-600 text-teal-600 rounded-lg hover:bg-teal-50 transition-colors whitespace-nowrap"
              >
                <i className="ri-key-line mr-2"></i>
                Gestionar Permisos
              </button>
            )}
          </div>
        ))}
      </div>

      {safeRoles.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <i className="ri-shield-user-line text-4xl text-gray-300 mb-3"></i>
          <p className="text-gray-500">No hay roles registrados</p>
        </div>
      )}

      {/* Modal Crear/Editar Rol */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {editingRole ? 'Editar Rol' : 'Nuevo Rol'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del Rol
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  rows={3}
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap"
                >
                  {editingRole ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Gestionar Permisos */}
      {showPermissionsModal && selectedRole && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Permisos de {selectedRole.name}</h2>
                <p className="text-sm text-gray-600 mt-1">Selecciona los permisos para este rol</p>
              </div>
              <button
                onClick={() => setShowPermissionsModal(false)}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {Object.entries(groupedPermissions).map(([category, perms]) => (
                  <div key={category} className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-3 capitalize">{category}</h3>
                    <div className="space-y-2">
                      {perms.map((perm) => (
                        <label
                          key={perm.id}
                          className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedPermissions.includes(perm.id)}
                            onChange={() => handlePermissionToggle(perm.id)}
                            className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{perm.name}</div>
                            {perm.description && (
                              <div className="text-sm text-gray-600">{perm.description}</div>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setShowPermissionsModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePermissions}
                className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap"
              >
                Guardar Permisos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminación */}
      {showDeleteModal && roleToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <i className="ri-alert-line text-red-600 text-2xl"></i>
              </div>
              <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
                ¿Eliminar rol?
              </h3>
              <p className="text-gray-600 text-center mb-6">
                ¿Estás seguro de eliminar el rol <strong>{roleToDelete.name}</strong>? Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setRoleToDelete(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
