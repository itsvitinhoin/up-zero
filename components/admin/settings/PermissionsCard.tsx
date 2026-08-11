"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Plus, RefreshCw, Pencil, Check, X, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  assignPermissionToRole,
  createRoleGroup,
  deleteRoleGroup,
  getRoleWithPermissions,
  listPermissions,
  listRoleGroups,
  removePermissionFromRole,
  updateRoleGroup,
} from "@/lib/actions/permissions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Permission, RoleGroup } from "@/lib/permissions";
import { normalizeAdminLocale, tAdmin } from "@/lib/i18n/admin";

type RoleWithPermissions = {
  role: RoleGroup;
  permissions: Permission[];
  permission_count: number;
};

type PermissionsCardProps = {
  locale?: string;
  initialPermissions?: Permission[];
  initialRoleGroups?: RoleGroup[];
  initialSelectedRoleDetails?: RoleWithPermissions | null;
};

const COLOR_PALETTE = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#06b6d4",
  "#64748b",
  "#78716c",
];

const GROUP_LABELS: Record<"en" | "pt-BR", Record<string, string>> = {
  en: {
    products: "Products",
    orders: "Orders",
    customers: "Customers",
    offline: "Offline",
    reports: "Reports",
    settings: "Settings",
    inventory: "Inventory",
    custom_links: "Custom Links",
    messaging: "Messaging",
    assets: "Assets",
    users: "Users",
    prices: "Prices",
    pages: "Pages",
  },
  "pt-BR": {
    products: "Produtos",
    orders: "Pedidos",
    customers: "Clientes",
    offline: "Offline",
    reports: "Relatórios",
    settings: "Configurações",
    inventory: "Estoque",
    custom_links: "Links Personalizados",
    messaging: "Mensageria",
    assets: "Assets",
    users: "Usuários",
    prices: "Preços",
    pages: "Páginas",
  },
};

const GROUP_ORDER = [
  "products",
  "orders",
  "customers",
  "offline",
  "prices",
  "pages",
  "custom_links",
  "messaging",
  "assets",
  "users",
  "reports",
  "inventory",
  "settings",
];

const ACTION_LABELS: Record<"en" | "pt-BR", Record<string, string>> = {
  en: {
    view: "View",
    create: "Create",
    edit: "Edit",
    delete: "Delete",
    cancel: "Cancel",
    export: "Export",
    send: "Send",
    mark_paid: "Mark as paid",
    assigned_only: "View only assigned",
    manage_variants: "Manage variants",
    manage_images: "Manage images",
    manage_categories: "Manage categories",
    manage_shipping: "Manage shipping",
    manage_returns: "Manage returns",
    manage_addresses: "Manage addresses",
    manage_team: "Manage team",
    manage_roles: "Manage roles",
    manage_movements: "Manage movements",
    manage_templates: "Manage templates",
    manage_settings: "Manage settings",
    support: "Support",
    manage_support_tickets: "Manage support tickets",
    assign_seller: "Assign seller",
  },
  "pt-BR": {
    view: "Visualizar",
    create: "Criar",
    edit: "Editar",
    delete: "Excluir",
    cancel: "Cancelar",
    export: "Exportar",
    send: "Enviar",
    mark_paid: "Marcar como pago",
    assigned_only: "Ver apenas atribuídos",
    manage_variants: "Gerenciar variantes",
    manage_images: "Gerenciar imagens",
    manage_categories: "Gerenciar categorias",
    manage_shipping: "Gerenciar entrega",
    manage_returns: "Gerenciar devoluções",
    manage_addresses: "Gerenciar endereços",
    manage_team: "Gerenciar equipe",
    manage_roles: "Gerenciar perfis",
    manage_movements: "Gerenciar movimentações",
    manage_templates: "Gerenciar templates",
    manage_settings: "Gerenciar configurações",
    support: "Atendimento",
    manage_support_tickets: "Gerenciar chamados",
    assign_seller: "Atribuir vendedora",
  },
};

const PERMISSION_LABEL_OVERRIDES: Record<"en" | "pt-BR", Record<string, string>> = {
  en: {
    "orders.view_assigned_only": "View Assigned Only Orders",
    "customers.view_assigned_only": "View Assigned Only Customers",
    "customers.assign_seller": "Assign Seller to Customers",
    "offline.view_customers": "View Customers",
    "offline.view_sellers": "View Sellers",
    "offline.view_orders": "View Orders",
    "offline.view_assignment": "View Assignment",
  },
  "pt-BR": {
    "orders.view_assigned_only": "Ver apenas pedidos atribuídos",
    "customers.view_assigned_only": "Ver apenas clientes atribuídos",
    "customers.assign_seller": "Atribuir vendedora ao cliente",
    "offline.view_customers": "Visualizar Clientes",
    "offline.view_sellers": "Visualizar Vendedoras",
    "offline.view_orders": "Visualizar Pedidos",
    "offline.view_assignment": "Visualizar Atribuição",
  },
};

const PERMISSION_DESCRIPTION_OVERRIDES: Record<"en" | "pt-BR", Record<string, string>> = {
  en: {
    "offline.view_customers": "View offline customers",
    "offline.view_sellers": "View offline sellers",
    "offline.view_orders": "View offline orders",
    "offline.view_assignment": "View offline seller assignment",
  },
  "pt-BR": {
    "customers.assign_seller": "Atribuir vendedora aos clientes",
    "offline.view_customers": "Visualizar clientes offline",
    "offline.view_sellers": "Visualizar vendedoras offline",
    "offline.view_orders": "Visualizar pedidos offline",
    "offline.view_assignment": "Visualizar atribuição de vendedoras offline",
  },
};

const PERMISSION_ORDER_BY_GROUP: Record<string, string[]> = {
  customers: [
    "customers.view",
    "customers.create",
    "customers.edit",
    "customers.delete",
    "customers.assign_seller",
    "customers.manage_addresses",
    "customers.support",
    "customers.manage_support_tickets",
  ],
  offline: [
    "offline.view_customers",
    "offline.view_sellers",
    "offline.view_orders",
    "offline.view_assignment",
  ],
};

const LOGGED_USER_PERMISSION_CODES = new Set([
  "orders.view_assigned_only",
  "customers.view_assigned_only",
]);

function formatGroupLabel(group: string, locale: "en" | "pt-BR"): string {
  return GROUP_LABELS[locale][group] || group.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatPermissionLabel(code: string, locale: "en" | "pt-BR"): string {
  const overrideLabel = PERMISSION_LABEL_OVERRIDES[locale][code];
  if (overrideLabel) return overrideLabel;

  const [rawGroup, rawAction] = code.split(".");
  const groupLabel = formatGroupLabel(rawGroup || "", locale);
  const actionLabel = ACTION_LABELS[locale][rawAction || ""] || (rawAction || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

  if (!rawGroup || !rawAction) return code;
  return `${actionLabel} ${groupLabel}`;
}

function formatPermissionDescription(
  permission: Permission,
  locale: "en" | "pt-BR",
): string | null {
  const overrideDescription = PERMISSION_DESCRIPTION_OVERRIDES[locale][permission.code];
  if (overrideDescription) return overrideDescription;
  return permission.description ?? null;
}

function sortPermissionsInGroup(group: string, permissions: Permission[]): Permission[] {
  const order = PERMISSION_ORDER_BY_GROUP[group];
  if (!order) {
    return [...permissions].sort((a, b) => a.code.localeCompare(b.code));
  }

  const orderIndex = new Map(order.map((code, index) => [code, index]));
  return [...permissions].sort((a, b) => {
    const indexA = orderIndex.get(a.code) ?? Number.MAX_SAFE_INTEGER;
    const indexB = orderIndex.get(b.code) ?? Number.MAX_SAFE_INTEGER;
    if (indexA !== indexB) return indexA - indexB;
    return a.code.localeCompare(b.code);
  });
}

function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {COLOR_PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            title={color}
            onClick={() => onChange(color)}
            className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
            style={{
              backgroundColor: color,
              borderColor: value === color ? "white" : color,
              outline: value === color ? `2px solid ${color}` : "none",
              outlineOffset: "1px",
            }}
          />
        ))}
        <label
          title="Cor personalizada"
          className="relative h-6 w-6 cursor-pointer overflow-hidden rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center text-[10px] text-muted-foreground hover:border-primary transition-colors"
        >
          <span>+</span>
          <input
            type="color"
            value={value || "#6366f1"}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </label>
      </div>
      {value && (
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full border" style={{ backgroundColor: value }} />
          <span className="text-xs text-muted-foreground">{value}</span>
        </div>
      )}
    </div>
  );
}

export function PermissionsCard({
  locale = "en",
  initialPermissions = [],
  initialRoleGroups = [],
  initialSelectedRoleDetails = null,
}: PermissionsCardProps) {
  const normalizedLocale = normalizeAdminLocale(locale);
  const permissionLabelLocale: "en" | "pt-BR" = normalizedLocale === "pt-BR" ? "pt-BR" : "en";

  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshingRole, setIsRefreshingRole] = useState(false);
  const [roles, setRoles] = useState<RoleGroup[]>(initialRoleGroups);
  const [permissions, setPermissions] = useState<Permission[]>(initialPermissions);

  const visibleRoles = useMemo(() => roles.filter((role) => !role.is_system), [roles]);
  const initialVisibleRoleId = initialRoleGroups.find((role) => !role.is_system)?.id ?? null;
  const initialSelectedVisibleRoleId =
    initialSelectedRoleDetails && !initialSelectedRoleDetails.role.is_system
      ? initialSelectedRoleDetails.role.id
      : null;

  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(
    initialSelectedVisibleRoleId ?? initialVisibleRoleId
  );
  const [selectedRoleDetails, setSelectedRoleDetails] = useState<RoleWithPermissions | null>(
    initialSelectedRoleDetails && !initialSelectedRoleDetails.role.is_system ? initialSelectedRoleDetails : null
  );
  const [savingPermissionId, setSavingPermissionId] = useState<number | null>(null);
  const [savingGroupKey, setSavingGroupKey] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");

  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [newRoleColor, setNewRoleColor] = useState("#6366f1");
  const [isCreatingRole, setIsCreatingRole] = useState(false);

  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editColor, setEditColor] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<RoleGroup | null>(null);
  const [isDeletingRole, setIsDeletingRole] = useState(false);

  const loggedUserPermissions = useMemo(() => {
    return permissions
      .filter((permission) => LOGGED_USER_PERMISSION_CODES.has(permission.code))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [permissions]);

  const permissionsByGroup = useMemo(() => {
    return permissions.reduce<Record<string, Permission[]>>((acc, permission) => {
      if (LOGGED_USER_PERMISSION_CODES.has(permission.code)) {
        return acc;
      }

      const group = permission.group || "geral";
      if (!acc[group]) acc[group] = [];
      acc[group].push(permission);
      return acc;
    }, {});
  }, [permissions]);

  const orderedPermissionGroups = useMemo(() => {
    const entries = Object.entries(permissionsByGroup);
    return entries.sort(([groupA], [groupB]) => {
      const indexA = GROUP_ORDER.indexOf(groupA);
      const indexB = GROUP_ORDER.indexOf(groupB);
      if (indexA === -1 && indexB === -1) return groupA.localeCompare(groupB);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [permissionsByGroup]);

  const selectedPermissionIds = useMemo(() => {
    return new Set((selectedRoleDetails?.permissions || []).map((permission) => permission.id));
  }, [selectedRoleDetails]);

  async function loadBaseData() {
    setIsLoading(true);
    setStatusMessage("");
    try {
      const [allPermissions, allRoles] = await Promise.all([listPermissions(), listRoleGroups()]);
      setPermissions(allPermissions);
      setRoles(allRoles);
      if (!selectedRoleId) {
        const firstVisibleRole = allRoles.find((role) => !role.is_system);
        if (firstVisibleRole) {
          setSelectedRoleId(firstVisibleRole.id);
        }
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : tAdmin(locale, "admin.permissions.errors.loadPermissions", "Failed to load permissions"));
    } finally {
      setIsLoading(false);
    }
  }

  async function loadRoleDetails(roleId: number) {
    setIsRefreshingRole(true);
    setStatusMessage("");
    try {
      const details = await getRoleWithPermissions(roleId);
      setSelectedRoleDetails(details);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : tAdmin(locale, "admin.permissions.errors.loadRoleDetails", "Failed to load role details"));
    } finally {
      setIsRefreshingRole(false);
    }
  }

  useEffect(() => {
    if (permissions.length > 0 && roles.length > 0) {
      return;
    }
    void loadBaseData();
  }, [permissions.length, roles.length]);

  useEffect(() => {
    if (selectedRoleId && !visibleRoles.some((role) => role.id === selectedRoleId)) {
      setSelectedRoleId(visibleRoles[0]?.id ?? null);
      setSelectedRoleDetails(null);
      return;
    }

    if (!selectedRoleId) {
      setSelectedRoleDetails(null);
      return;
    }
    if (selectedRoleDetails?.role.id === selectedRoleId) {
      return;
    }
    void loadRoleDetails(selectedRoleId);
  }, [selectedRoleId, selectedRoleDetails, visibleRoles]);

  async function handleCreateRole() {
    const trimmedName = newRoleName.trim();
    if (!trimmedName) return;

    setIsCreatingRole(true);
    setStatusMessage("");
    try {
      const role = await createRoleGroup({
        name: trimmedName,
        description: newRoleDescription.trim() || undefined,
        color: newRoleColor || undefined,
      });
      setRoles((previous) => [...previous, role]);
      setSelectedRoleId(role.id);
      setNewRoleName("");
      setNewRoleDescription("");
      setNewRoleColor("#6366f1");
      setStatusMessage(tAdmin(locale, "admin.permissions.success.created", "Role created successfully"));
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : tAdmin(locale, "admin.permissions.errors.createRole", "Failed to create role"));
    } finally {
      setIsCreatingRole(false);
    }
  }

  function startEditing(role: RoleGroup, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingRoleId(role.id);
    setEditName(role.name);
    setEditDescription(role.description || "");
    setEditColor(role.color || "#6366f1");
  }

  function cancelEditing() {
    setEditingRoleId(null);
  }

  async function handleSaveEdit(roleId: number, e: React.MouseEvent) {
    e.stopPropagation();
    setIsSavingEdit(true);
    setStatusMessage("");
    try {
      const updated = await updateRoleGroup(roleId, {
        name: editName.trim() || undefined,
        description: editDescription.trim() || undefined,
        color: editColor || undefined,
      });
      setRoles((prev) => prev.map((r) => (r.id === roleId ? updated : r)));
      if (selectedRoleId === roleId) {
        setSelectedRoleDetails((prev) => (prev ? { ...prev, role: updated } : prev));
      }
      setEditingRoleId(null);
      setStatusMessage("Perfil atualizado com sucesso");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Erro ao atualizar perfil");
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleTogglePermission(permissionId: number, enabled: boolean) {
    if (!selectedRoleId) return;

    setSavingPermissionId(permissionId);
    setStatusMessage("");
    try {
      if (enabled) {
        await assignPermissionToRole(selectedRoleId, permissionId);
      } else {
        await removePermissionFromRole(selectedRoleId, permissionId);
      }
      await loadRoleDetails(selectedRoleId);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : tAdmin(locale, "admin.permissions.errors.savePermission", "Failed to save permission"));
    } finally {
      setSavingPermissionId(null);
    }
  }

  async function handleToggleGroupPermissions(group: string, groupedPermissions: Permission[], enabled: boolean) {
    if (!selectedRoleId || groupedPermissions.length === 0) return;

    const permissionIdsToUpdate = groupedPermissions
      .filter((permission) => selectedPermissionIds.has(permission.id) !== enabled)
      .map((permission) => permission.id);

    if (permissionIdsToUpdate.length === 0) return;

    setSavingGroupKey(group);
    setStatusMessage("");

    try {
      await Promise.all(
        permissionIdsToUpdate.map((permissionId) =>
          enabled ? assignPermissionToRole(selectedRoleId, permissionId) : removePermissionFromRole(selectedRoleId, permissionId)
        )
      );
      await loadRoleDetails(selectedRoleId);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : tAdmin(locale, "admin.permissions.errors.savePermission", "Failed to save permission"));
    } finally {
      setSavingGroupKey(null);
    }
  }

  async function handleDeleteRole() {
    if (!roleToDelete) return;

    setIsDeletingRole(true);
    setStatusMessage("");
    try {
      await deleteRoleGroup(roleToDelete.id);

      const removedRoleId = roleToDelete.id;
      setRoles((previous) => {
        const nextRoles = previous.filter((role) => role.id !== removedRoleId);
        if (selectedRoleId === removedRoleId) {
          setSelectedRoleId(nextRoles[0]?.id ?? null);
        }
        return nextRoles;
      });

      if (selectedRoleDetails?.role.id === removedRoleId) {
        setSelectedRoleDetails(null);
      }

      setRoleToDelete(null);
      setStatusMessage("Perfil removido com sucesso");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Erro ao remover perfil");
    } finally {
      setIsDeletingRole(false);
    }
  }

  return (
    <Card id="store-permissions">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          {tAdmin(locale, "admin.permissions.title")}
        </CardTitle>
        <CardDescription>{tAdmin(locale, "admin.permissions.subtitle")}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={() => void loadBaseData()} disabled={isLoading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {tAdmin(locale, "admin.permissions.refresh")}
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-4 rounded-lg border p-4">
            <div className="space-y-3">
              <Label htmlFor="newRoleName">{tAdmin(locale, "admin.permissions.newRole", "Novo perfil")}</Label>
              <Input
                id="newRoleName"
                value={newRoleName}
                onChange={(event) => setNewRoleName(event.target.value)}
                placeholder={tAdmin(locale, "admin.permissions.newRolePlaceholder", "Nome do perfil")}
              />
              <Input
                value={newRoleDescription}
                onChange={(event) => setNewRoleDescription(event.target.value)}
                placeholder={tAdmin(locale, "admin.permissions.newRoleDescription", "Descrição (opcional)")}
              />
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Cor do perfil</p>
                <ColorPicker value={newRoleColor} onChange={setNewRoleColor} />
              </div>
              <Button
                type="button"
                onClick={() => void handleCreateRole()}
                disabled={isCreatingRole || !newRoleName.trim()}
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                {isCreatingRole ? tAdmin(locale, "admin.permissions.creatingRole", "Criando...") : tAdmin(locale, "admin.permissions.createRole", "Criar perfil")}
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">{tAdmin(locale, "admin.permissions.rolesInStore", "Perfis desta loja")}</p>

              {visibleRoles.length === 0 && (
                <p className="text-sm text-muted-foreground">{tAdmin(locale, "admin.permissions.noRoles", "Nenhum perfil criado")}</p>
              )}

              {visibleRoles.map((role) => {
                const selected = role.id === selectedRoleId;
                const isEditing = editingRoleId === role.id;

                if (isEditing) {
                  return (
                    <div key={role.id} className="rounded-md border border-primary/40 bg-primary/5 p-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nome" className="h-7 text-sm" />
                      <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Descrição" className="h-7 text-sm" />
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Cor</p>
                        <ColorPicker value={editColor} onChange={setEditColor} />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          className="h-7 flex-1 text-xs"
                          disabled={isSavingEdit || !editName.trim()}
                          onClick={(e) => void handleSaveEdit(role.id, e)}
                        >
                          <Check className="mr-1 h-3 w-3" />
                          Salvar
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" onClick={cancelEditing} disabled={isSavingEdit}>
                          <X className="mr-1 h-3 w-3" />
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={role.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={selected}
                    onClick={() => setSelectedRoleId(role.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedRoleId(role.id);
                      }
                    }}
                    className={`group w-full rounded-md border p-3 text-left transition cursor-pointer ${selected ? "border-primary bg-primary/5" : "hover:border-primary/40"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {role.color && <span className="h-3 w-3 shrink-0 rounded-full border" style={{ backgroundColor: role.color, borderColor: role.color }} />}
                        <span className="font-medium truncate">{role.name}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {role.is_system && <Badge variant="secondary" className="text-[10px] h-4 px-1">{tAdmin(locale, "admin.permissions.system", "sistema")}</Badge>}
                        {!role.is_system && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRoleToDelete(role);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 hover:bg-muted"
                            title="Remover perfil"
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => startEditing(role, e)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 hover:bg-muted"
                          title="Editar perfil"
                        >
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                    {role.description && <p className="mt-1 text-xs text-muted-foreground">{role.description}</p>}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 rounded-lg border p-4">
            {!selectedRoleId && (
              <p className="text-sm text-muted-foreground">{tAdmin(locale, "admin.permissions.selectRole", "Selecione um perfil à esquerda")}</p>
            )}

            {selectedRoleDetails && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {selectedRoleDetails.role.color && (
                      <span className="h-3 w-3 rounded-full border" style={{ backgroundColor: selectedRoleDetails.role.color, borderColor: selectedRoleDetails.role.color }} />
                    )}
                    <div>
                      <p className="font-semibold">{selectedRoleDetails.role.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedRoleDetails.permission_count} {tAdmin(locale, "admin.permissions.assignedCount", "permissões atribuídas")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {loggedUserPermissions.length > 0 && (
                    <div className="space-y-2 rounded-md border p-3">
                      <div className="px-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {locale === "pt-BR" ? "Usuário logado" : "Logged user"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {locale === "pt-BR"
                            ? "Permissões que restringem visualização apenas ao responsável autenticado."
                            : "Permissions that restrict visibility to the authenticated owner only."}
                        </p>
                      </div>

                      <div className="space-y-2">
                        {loggedUserPermissions.map((permission) => {
                          const checked = selectedPermissionIds.has(permission.id);
                          const disabled = savingPermissionId === permission.id || isRefreshingRole;

                          return (
                            <div key={permission.id} className="flex items-center justify-between gap-4 rounded-md bg-muted/20 p-2">
                              <div className="space-y-0.5">
                                <p className="text-sm font-medium">{formatPermissionLabel(permission.code, permissionLabelLocale)}</p>
                                <p className="text-xs text-muted-foreground">{permission.code}</p>
                                {permission.description && <p className="text-xs text-muted-foreground">{permission.description}</p>}
                              </div>

                              <Switch
                                checked={checked}
                                disabled={disabled}
                                onCheckedChange={(value) => {
                                  void handleTogglePermission(permission.id, value);
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {orderedPermissionGroups.map(([group, groupedPermissions]) => {
                    const sortedPermissions = sortPermissionsInGroup(group, groupedPermissions);
                    const enabledCount = sortedPermissions.filter((permission) => selectedPermissionIds.has(permission.id)).length;
                    const allEnabled = sortedPermissions.length > 0 && enabledCount === sortedPermissions.length;
                    const isSavingGroup = savingGroupKey === group || isRefreshingRole;

                    return (
                    <div key={group} className="space-y-2 rounded-md border p-3">
                      <div className="flex items-center justify-between gap-3 px-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {formatGroupLabel(group, permissionLabelLocale)}
                        </p>

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center">
                                <Switch
                                  checked={allEnabled}
                                  disabled={isSavingGroup}
                                  className="border border-zinc-400/70 data-[state=unchecked]:bg-zinc-300 data-[state=checked]:bg-zinc-900"
                                  aria-label={allEnabled
                                    ? tAdmin(locale, "admin.permissions.disableAll", "Desativar tudo")
                                    : tAdmin(locale, "admin.permissions.enableAll", "Ativar tudo")}
                                  onCheckedChange={(value) => {
                                    void handleToggleGroupPermissions(group, sortedPermissions, value);
                                  }}
                                />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {allEnabled
                                ? tAdmin(locale, "admin.permissions.disableAll", "Desativar tudo")
                                : tAdmin(locale, "admin.permissions.enableAll", "Ativar tudo")}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>

                      <div className="space-y-2">
                        {sortedPermissions.map((permission) => {
                          const checked = selectedPermissionIds.has(permission.id);
                          const disabled = savingPermissionId === permission.id || isRefreshingRole;
                          const description = formatPermissionDescription(permission, permissionLabelLocale);

                          return (
                            <div key={permission.id} className="flex items-center justify-between gap-4 rounded-md bg-muted/20 p-2">
                              <div className="space-y-0.5">
                                <p className="text-sm font-medium">{formatPermissionLabel(permission.code, permissionLabelLocale)}</p>
                                <p className="text-xs text-muted-foreground">{permission.code}</p>
                                {description && <p className="text-xs text-muted-foreground">{description}</p>}
                              </div>

                              <Switch
                                checked={checked}
                                disabled={disabled}
                                onCheckedChange={(value) => {
                                  void handleTogglePermission(permission.id, value);
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )})}
                </div>
              </>
            )}
          </div>
        </div>

        {statusMessage && <p className="text-sm text-muted-foreground">{statusMessage}</p>}
      </CardContent>

      <AlertDialog open={Boolean(roleToDelete)} onOpenChange={(open) => !open && setRoleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover perfil?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação fará exclusão lógica (soft delete) do perfil
              {roleToDelete?.name ? ` "${roleToDelete.name}"` : ""}
              . Esta operação não pode ser desfeita pela interface.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingRole}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteRole();
              }}
              disabled={isDeletingRole}
            >
              {isDeletingRole ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
