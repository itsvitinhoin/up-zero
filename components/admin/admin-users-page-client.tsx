"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CellphoneInput from "@/components/form/CellphoneInput";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, MoreHorizontal, Search, Pencil, UserX, Users, ChevronDown, ChevronUp, Shield } from "lucide-react";
import { getUsersAction, createUserAction, updateUserAction, toggleUserActiveAction } from "@/lib/actions/settings";
import type { User } from "@/lib/types";
import { getPermissionsByCategory, type PermissionKey, type PermissionMap, type Permission, type RoleGroup } from "@/lib/permissions";
import { getUserPermissions, listPermissions, listRoleGroups, removeUserPermissionOverride, setUserPermissionOverride } from "@/lib/actions/permissions";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { tAdmin } from "@/lib/i18n/admin";
import { toast } from "sonner";

const DEFAULT_PERMISSION_MAP: PermissionMap = {
  canViewDashboard: true,
  canViewReports: true,
  canManageOrders: true,
  canManageCustomers: true,
  canManageProducts: true,
  canManageCategories: true,
  canManagePriceTables: true,
  canManageCoupons: true,
  canManageSettings: true,
  canManageUsers: true,
};

interface AdminUsersPageClientProps {
  initialUsers?: User[];
  locale?: string;
}

type AdminUser = User & {
  permissions?: PermissionMap | null;
};

export default function AdminUsersPageClient({ initialUsers = [], locale }: AdminUsersPageClientProps) {
  const [users, setUsers] = useState<AdminUser[]>(initialUsers as AdminUser[]);
  const [roleGroups, setRoleGroups] = useState<RoleGroup[]>([]);
  const [rbacPermissions, setRbacPermissions] = useState<Permission[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    roleId: "",
    isActive: true,
  });
  const [useCustomPermissions, setUseCustomPermissions] = useState(false);
  const [customPermissions, setCustomPermissions] = useState<PermissionMap | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const tr = (key: string, fallback: string) => tAdmin(locale, key, fallback);
  const selectedRoleGroupName = roleGroups.find((group) => String(group.id) === formData.roleId)?.name;

  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  useEffect(() => {
    void loadRbacCatalog();
  }, []);

  async function loadRbacCatalog() {
    try {
      const [roles, permissions] = await Promise.all([listRoleGroups(), listPermissions()]);
      setRoleGroups(roles);
      setRbacPermissions(permissions);
    } catch {
      // Fallback silencioso: mantém fluxo legado caso RBAC esteja indisponível.
    }
  }

  async function loadUsers() {
    setIsLoading(true);
    const result = await getUsersAction();
    if (result.success && result.data) {
      setUsers(result.data.filter((u) => !["B2B_CUSTOMER", "PENDING"].includes(u.role)));
    }
    setIsLoading(false);
  }

  function openCreateDialog() {
    setEditingUser(null);
    setFormData({
      name: "",
      email: "",
      phone: "",
      password: "",
      roleId: roleGroups[0] ? String(roleGroups[0].id) : "",
      isActive: true,
    });
    setUseCustomPermissions(false);
    setCustomPermissions(null);
    setExpandedCategories([]);
    setIsDialogOpen(true);
  }

  function openEditDialog(user: AdminUser) {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      password: "",
      roleId: user.roleId ? String(user.roleId) : "",
      isActive: user.isActive,
    });
    setUseCustomPermissions(!!user.permissions);
    setCustomPermissions(user.permissions || null);
    setExpandedCategories([]);
    setIsDialogOpen(true);
    void loadUserOverrides(user);
  }

  function mapPermissionCodeToLegacyKey(code: string): PermissionKey | null {
    if (code === "reports.view") return "canViewDashboard";
    if (code === "reports.export") return "canViewReports";
    if (code.startsWith("orders.")) return "canManageOrders";
    if (code.startsWith("customers.")) return "canManageCustomers";
    if (code === "products.manage_categories") return "canManageCategories";
    if (code.startsWith("products.")) return "canManageProducts";
    if (code.startsWith("prices.")) return "canManagePriceTables";
    if (code.startsWith("coupons.")) return "canManageCoupons";
    if (code === "settings.manage_team") return "canManageUsers";
    if (code.startsWith("settings.")) return "canManageSettings";
    return null;
  }

  async function loadUserOverrides(user: AdminUser) {
    const userId = Number(user.id);
    if (!Number.isInteger(userId) || userId <= 0 || rbacPermissions.length === 0) return;

    try {
      const summary = await getUserPermissions(userId);
      const rolePermissionIds = new Set(summary.permissions_from_role.map((permission) => Number(permission.id)));
      const overrideMap = new Map<number, boolean>();

      for (const [permission, granted] of summary.permission_overrides) {
        overrideMap.set(Number(permission.id), Boolean(granted));
      }

      const effectiveForPermission = (permissionId: number): boolean => {
        if (overrideMap.has(permissionId)) return overrideMap.get(permissionId) ?? false;
        return rolePermissionIds.has(permissionId);
      };

      const mappedPermissions = new Map<PermissionKey, number[]>();
      for (const permission of rbacPermissions) {
        const legacyKey = mapPermissionCodeToLegacyKey(permission.code);
        if (!legacyKey) continue;
        const list = mappedPermissions.get(legacyKey) || [];
        list.push(Number(permission.id));
        mappedPermissions.set(legacyKey, list);
      }

      const derived: PermissionMap = { ...DEFAULT_PERMISSION_MAP };
      for (const [legacyKey, permissionIds] of mappedPermissions.entries()) {
        if (permissionIds.length === 0) continue;
        derived[legacyKey] = permissionIds.every((permissionId) => effectiveForPermission(permissionId));
      }

      setUseCustomPermissions(summary.permission_overrides.length > 0);
      setCustomPermissions(derived);
    } catch {
      // Sem bloqueio de UI.
    }
  }

  async function syncUserOverrides(
    userIdRaw: string,
    useCustom: boolean,
    nextPermissions: PermissionMap | null,
  ) {
    const userId = Number(userIdRaw);
    if (!Number.isInteger(userId) || userId <= 0) return;

    const summary = await getUserPermissions(userId);
    await Promise.all(
      summary.permission_overrides.map(([permission]) =>
        removeUserPermissionOverride(userId, Number(permission.id))
      )
    );

    if (!useCustom || !nextPermissions) return;

    const mutations: Promise<void>[] = [];
    for (const permission of rbacPermissions) {
      const legacyKey = mapPermissionCodeToLegacyKey(permission.code);
      if (!legacyKey) continue;
      const granted = Boolean(nextPermissions[legacyKey]);
      mutations.push(setUserPermissionOverride(userId, Number(permission.id), granted));
    }

    await Promise.all(mutations);
  }

  function toggleCategory(category: string) {
    setExpandedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  }

  function handleToggleCustomPermissions(useCustom: boolean) {
    setUseCustomPermissions(useCustom);
    if (useCustom && !customPermissions) {
      setCustomPermissions({ ...DEFAULT_PERMISSION_MAP });
    }
    if (useCustom) {
      setExpandedCategories(Object.keys(getPermissionsByCategory(locale)));
    } else {
      setExpandedCategories([]);
    }
  }

  function handlePermissionChange(key: keyof PermissionMap, value: boolean) {
    if (customPermissions) {
      setCustomPermissions({ ...customPermissions, [key]: value });
    }
  }

  function resetToRoleDefaults() {
    setCustomPermissions({ ...DEFAULT_PERMISSION_MAP });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const fd = new FormData();
    fd.append("name", formData.name);
    fd.append("email", formData.email);
    fd.append("phone", formData.phone);
    fd.append("roleId", formData.roleId || "");
    fd.append("isActive", formData.isActive.toString());

    if (useCustomPermissions && customPermissions) {
      fd.append("permissions", JSON.stringify(customPermissions));
    } else {
      fd.append("permissions", "null");
    }

    let persistedId: string | null = null;

    if (editingUser) {
      const result = await updateUserAction(editingUser.id, fd);
      if (!result.success || !result.data) {
        toast.error(result.error || tr("admin.users.saveError", "Erro ao salvar usuário"));
        return;
      }
      persistedId = String(result.data.id);
    } else {
      fd.append("password", formData.password);
      const result = await createUserAction(fd);
      if (!result.success || !result.data) {
        toast.error(result.error || tr("admin.users.saveError", "Erro ao criar usuário"));
        return;
      }
      persistedId = String(result.data.id);
    }

    if (persistedId) {
      try {
        await syncUserOverrides(persistedId, useCustomPermissions, customPermissions);
      } catch (err) {
        // Overrides sync falhou mas os dados principais foram salvos
        toast.warning(tr("admin.users.overrideSyncWarning", "Usuário salvo, mas houve um problema ao sincronizar permissões individuais."));
      }
    }

    toast.success(tr("admin.users.saveSuccess", "Usuário salvo com sucesso"));
    setIsDialogOpen(false);
    loadUsers();
  }

  async function handleToggleStatus(id: string) {
    await toggleUserActiveAction(id);
    loadUsers();
  }

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const userStatusBadgeClass = (isActive: boolean) => {
    if (isActive) return 'bg-emerald-50 text-emerald-600 border border-emerald-100 text-xs font-medium'
    return 'bg-amber-50 text-amber-600 border border-amber-100 text-xs font-medium'
  }

  function getRoleChipStyle(color?: string): React.CSSProperties {
    if (!color) return {}
    // converte cor hex para background translúcido
    const hex = color.replace('#', '')
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    if (isNaN(r) || isNaN(g) || isNaN(b)) return {}
    return {
      backgroundColor: `rgba(${r},${g},${b},0.12)`,
      color: color,
      borderColor: `rgba(${r},${g},${b},0.3)`,
    }
  }

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {tr("admin.users.title", "Users")}
          </h1>
          <p className="text-sm text-muted-foreground">{tr("admin.users.subtitle", "Manage internal system users")}</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} className="cursor-pointer">
              <Plus className="mr-2 h-4 w-4" />
              {tr("admin.users.newUser", "New User")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>
                {editingUser ? tr("admin.users.editUser", "Edit User") : tr("admin.users.newUser", "New User")}
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh] pr-4">
              <form onSubmit={handleSubmit} className="space-y-6 px-1 py-1">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">{tr("admin.users.fields.name", "Name")}</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">{tr("admin.users.fields.email", "Email")}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">{tr("admin.users.fields.phone", "Telefone")}</Label>
                  <CellphoneInput
                    name="phone"
                    value={formData.phone}
                    onChange={(value) => setFormData({ ...formData, phone: value })}
                  />
                </div>

                {!editingUser && (
                  <div className="space-y-2">
                    <Label htmlFor="password">{tr("admin.users.fields.password", "Password")}</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      minLength={6}
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      {tr(
                        "admin.users.roleVsProfileHint",
                        "O perfil global abaixo define a base das permissões."
                      )}
                    </p>

                    <div className="mt-3 space-y-2">
                      <Label htmlFor="roleGroup">{tr("admin.users.globalProfile", "Global Permission Profile")}</Label>
                      <Select
                        value={formData.roleId || "none"}
                        onValueChange={(value) => setFormData({ ...formData, roleId: value === "none" ? "" : value })}
                      >
                        <SelectTrigger id="roleGroup">
                          <SelectValue placeholder={tr("admin.users.selectProfile", "Select profile")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{tr("admin.users.noProfile", "No profile")}</SelectItem>
                          {roleGroups.map((group) => (
                            <SelectItem key={group.id} value={String(group.id)}>{group.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {editingUser && (
                    <div className="flex items-center gap-2 pt-8">
                      <Switch
                        id="isActive"
                        checked={formData.isActive}
                        onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                      />
                      <Label htmlFor="isActive">{tr("admin.users.activeUser", "Active User")}</Label>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-muted-foreground" />
                      <Label className="text-base font-medium">{tr("admin.users.permissions", "Permissions")}</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="useCustomPermissions"
                        checked={useCustomPermissions}
                        onCheckedChange={handleToggleCustomPermissions}
                      />
                      <Label htmlFor="useCustomPermissions" className="text-sm">
                        {tr("admin.users.customPermissions", "Customize permissions")}
                      </Label>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {tr(
                      "admin.users.customizationWhereHint",
                      "Para permissão individual: ative 'Personalizar permissões' e marque/desmarque os itens por categoria abaixo."
                    )}
                  </p>

                  {!useCustomPermissions ? (
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        {tr("admin.users.usingDefaultsForRole", "Using default permissions for role")} <strong>{selectedRoleGroupName || tr("admin.users.noProfile", "No profile")}</strong>. {tr("admin.users.enableCustomPermissionsHint", "Enable the option above to customize.")}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-muted-foreground">
                          {tr("admin.users.selectPermissions", "Select permissions for this user")}
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={resetToRoleDefaults}
                        >
                          {tr("admin.users.restoreDefault", "Restore Default")}
                        </Button>
                      </div>

                      <div className="space-y-2 border rounded-lg">
                        {Object.entries(getPermissionsByCategory(locale)).map(([category, permissions]) => (
                          <Collapsible
                            key={category}
                            open={expandedCategories.includes(category)}
                            onOpenChange={() => toggleCategory(category)}
                          >
                            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-muted/50 transition-colors">
                              <span className="font-medium text-sm">{category}</span>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {permissions.filter((permission) => customPermissions?.[permission.key]).length}/{permissions.length}
                                </Badge>
                                {expandedCategories.includes(category) ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="px-3 pb-3 space-y-2">
                                {permissions.map((permission) => (
                                  <div
                                    key={permission.key}
                                    className="flex items-center gap-3 p-2 rounded hover:bg-muted/30"
                                  >
                                    <Checkbox
                                      id={permission.key}
                                      checked={customPermissions?.[permission.key] || false}
                                      onCheckedChange={(checked) =>
                                        handlePermissionChange(permission.key, checked as boolean)
                                      }
                                    />
                                    <Label
                                      htmlFor={permission.key}
                                      className="text-sm cursor-pointer flex-1"
                                    >
                                      {permission.label}
                                    </Label>
                                  </div>
                                ))}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="cursor-pointer">
                    {tr("admin.common.cancel", "Cancel")}
                  </Button>
                  <Button type="submit" className="cursor-pointer">
                    {editingUser ? tr("admin.users.save", "Save") : tr("admin.users.create", "Create")}
                  </Button>
                </div>
              </form>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border border-border/20 bg-card p-3">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={tr("admin.users.searchPlaceholder", "Search users...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="rounded-xl border border-border/20 bg-card shadow-none overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border/20">
              <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground/90 uppercase">{tr("admin.users.table.user", "User")}</TableHead>
              <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground/90 uppercase">{tr("admin.users.table.email", "Email")}</TableHead>
              <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground/90 uppercase">{tr("admin.users.table.phone", "Telefone")}</TableHead>
              <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground/90 uppercase">{tr("admin.users.table.role", "Perfil")}</TableHead>
              <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground/90 uppercase">{tr("admin.users.table.status", "Status")}</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  {tr("admin.users.loading", "Loading...")}
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Users className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">{tr("admin.users.empty", "No users found")}</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id} className="border-border/20 hover:bg-muted/40">
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell className="text-muted-foreground">{user.phone || <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    {(() => {
                      const group = roleGroups.find((g) => String(g.id) === String(user.roleId))
                      if (!group) return <span className="text-xs text-muted-foreground">—</span>
                      const style = getRoleChipStyle(group.color)
                      const hasColor = !!group.color
                      return (
                        <Badge
                          variant="outline"
                          className="text-xs font-medium gap-1"
                          style={hasColor ? style : {}}
                        >
                          <Shield className="h-3 w-3" />
                          {group.name}
                        </Badge>
                      )
                    })()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={userStatusBadgeClass(user.isActive)}>
                      {user.isActive ? tr("admin.users.active", "Active") : tr("admin.users.inactive", "Inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="cursor-pointer">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(user)} className="cursor-pointer">
                          <Pencil className="mr-2 h-4 w-4" />
                          {tr("admin.users.edit", "Edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleStatus(user.id)} className="cursor-pointer">
                          <UserX className="mr-2 h-4 w-4" />
                          {user.isActive ? tr("admin.users.deactivate", "Deactivate") : tr("admin.users.activate", "Activate")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
