"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, MoreHorizontal, Search, Pencil, UserX, Users, Shield, BellRing, Smartphone, SlidersHorizontal, FilterX, CheckCircle2, AlertCircle } from "lucide-react";
import { ExternalLink } from "lucide-react";
import { createUserAction, updateUserAction, toggleUserActiveAction, sendTestPushToAdminAction, type UsersPageData } from "@/lib/actions/settings";
import type { User } from "@/lib/types";
import { type PermissionKey, type PermissionMap, type Permission, type RoleGroup } from "@/lib/permissions";
import { getUserPermissions, listPermissions, removeUserPermissionOverride, setUserPermissionOverride } from "@/lib/actions/permissions";
import { ScrollArea } from "@/components/ui/scroll-area";
import AdminPaginationControls from "@/components/admin/admin-pagination-controls";
import { tAdmin } from "@/lib/i18n/admin";
import { toast } from "sonner";
import { useAdminStore } from "@/contexts/admin-store-context";
import { buildStorefrontUrl } from "@/lib/storefront-url";
import { usePaginationMeta } from "@/hooks/use-paginated-list";

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

interface UsersPageSummary {
  total: number
  active: number
  inactive: number
  withDevices: number
}

interface AdminUsersPageClientProps {
  initialData?: UsersPageData;
  initialRoleGroups?: RoleGroup[];
  initialSummary?: UsersPageSummary;
  initialStatus?: string;
  locale?: string;
}

const USERS_PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

function parseUsersPageLimit(value?: string | number | null): number {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return USERS_PAGE_SIZE_OPTIONS.includes(parsed as (typeof USERS_PAGE_SIZE_OPTIONS)[number]) ? parsed : 20
}

function parseUsersStatusFilter(value?: string): 'all' | 'active' | 'inactive' {
  const normalized = String(value || 'all').trim().toLowerCase()
  if (normalized === 'active' || normalized === 'inactive') return normalized
  return 'all'
}

type AdminUser = User & {
  permissions?: PermissionMap | null;
};

const USERS_PER_PAGE_DEFAULT = 20;

export default function AdminUsersPageClient({
  initialData,
  initialRoleGroups = [],
  initialSummary,
  initialStatus = 'all',
  locale,
}: AdminUsersPageClientProps) {
  const { storefrontUrl, session } = useAdminStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [users, setUsers] = useState<AdminUser[]>((initialData?.items || []) as AdminUser[]);
  const [currentPage, setCurrentPage] = useState(initialData?.page || 1);
  const [totalPages, setTotalPages] = useState(initialData?.totalPages || 0);
  const [totalUsers, setTotalUsers] = useState(initialData?.total || 0);
  const [roleGroups, setRoleGroups] = useState<RoleGroup[]>(initialRoleGroups);
  const [rbacPermissions, setRbacPermissions] = useState<Permission[]>([]);
  const [search, setSearch] = useState(() => String(searchParams.get('q') || ''));
  const [appliedSearch, setAppliedSearch] = useState(() => String(searchParams.get('q') || '').trim());
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>(() => parseUsersStatusFilter(initialStatus || searchParams.get('status') || 'all'));
  const [appliedStatusFilter, setAppliedStatusFilter] = useState<'all' | 'active' | 'inactive'>(() => parseUsersStatusFilter(initialStatus || searchParams.get('status') || 'all'));
  const [selectedLimit, setSelectedLimit] = useState<number>(parseUsersPageLimit(initialData?.perPage ?? USERS_PER_PAGE_DEFAULT));
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [pushingUserId, setPushingUserId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    sellerSlug: "",
    password: "",
    roleId: "",
    isActive: true,
  });
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [useCustomPermissions, setUseCustomPermissions] = useState(false);
  const [customPermissions, setCustomPermissions] = useState<PermissionMap | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const permissionsCatalogPromiseRef = useRef<Promise<Permission[]> | null>(null);
  const tr = (key: string, fallback: string) => tAdmin(locale, key, fallback);
  const pageSize = selectedLimit;
  const totalItems = Math.max(0, Number(totalUsers) || 0);
  const totalPagesSafe = Math.max(1, Number(totalPages) || Math.ceil(totalItems / pageSize) || 1);
  const stats: UsersPageSummary = initialSummary ?? {
    total: totalItems,
    active: users.filter((user) => user.isActive).length,
    inactive: users.filter((user) => !user.isActive).length,
    withDevices: users.filter((user) => Boolean(user.hasDevices)).length,
  };
  const hasActiveFilter = appliedSearch.length > 0 || appliedStatusFilter !== 'all';
  const hasAppliedFilter = hasActiveFilter;
  const {
    safeCurrentPage,
    pageStart,
    pageEnd,
  } = usePaginationMeta({
    currentPage,
    pageSize,
    totalItems,
    currentPageItemCount: users.length,
  });
  const assignableRoleGroups = roleGroups.filter((group) => !group.is_system);
  const permissionSet = useMemo(
    () => new Set(
      Array.isArray(session?.permissionCodes)
        ? session.permissionCodes.map((code) => String(code || '').trim().toLowerCase()).filter(Boolean)
        : [],
    ),
    [session?.permissionCodes],
  )
  const hasPermissionContext = Array.isArray(session?.permissionCodes)
  const canCreateUsers = !hasPermissionContext || permissionSet.has('users.create')
  const canEditUsers = !hasPermissionContext || permissionSet.has('users.edit')
  const canDeleteUsers = !hasPermissionContext || permissionSet.has('users.delete')
  const systemRoleIds = new Set(
    roleGroups.filter((group) => group.is_system).map((group) => String(group.id))
  );

  useEffect(() => {
    setUsers((initialData?.items || []) as AdminUser[]);
    setCurrentPage(initialData?.page || 1);
    setTotalPages(initialData?.totalPages || 0);
    setTotalUsers(initialData?.total || 0);
    setRoleGroups(initialRoleGroups);
    setSelectedLimit(parseUsersPageLimit(initialData?.perPage ?? USERS_PER_PAGE_DEFAULT));
  }, [
    initialData?.items,
    initialData?.page,
    initialData?.totalPages,
    initialData?.total,
    initialData?.perPage,
    initialRoleGroups,
  ]);

  function buildUsersQuery(input?: {
    page?: number
    limit?: number
    q?: string
    status?: 'all' | 'active' | 'inactive'
  }) {
    const params = new URLSearchParams()
    const nextPage = Math.max(1, Number(input?.page ?? currentPage) || 1)
    const nextLimit = parseUsersPageLimit(input?.limit ?? selectedLimit)
    const nextSearch = (input?.q ?? appliedSearch).trim()
    const nextStatus = input?.status ?? appliedStatusFilter

    if (nextPage > 1) params.set('page', String(nextPage))
    if (nextLimit !== 20) params.set('limit', String(nextLimit))
    if (nextSearch.length > 0) params.set('q', nextSearch)
    if (nextStatus !== 'all') params.set('status', nextStatus)

    return params
  }

  function navigateWithParams(input?: {
    page?: number
    limit?: number
    q?: string
    status?: 'all' | 'active' | 'inactive'
  }) {
    const params = buildUsersQuery(input)
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  async function ensurePermissionsCatalogLoaded(): Promise<Permission[]> {
    if (rbacPermissions.length > 0) {
      return rbacPermissions;
    }

    if (!permissionsCatalogPromiseRef.current) {
      permissionsCatalogPromiseRef.current = listPermissions()
        .then((permissions) => {
          setRbacPermissions(permissions);
          return permissions;
        })
        .finally(() => {
          permissionsCatalogPromiseRef.current = null;
        });
    }

    try {
      return await permissionsCatalogPromiseRef.current;
    } catch {
      return [];
    }
  }

  function submitSearchFilters() {
    const normalizedSearch = search.trim()
    setCurrentPage(1)
    setAppliedSearch(normalizedSearch)
    setAppliedStatusFilter(statusFilter)
    setMobileFiltersOpen(false)
    navigateWithParams({ page: 1, q: normalizedSearch, status: statusFilter })
  }

  function handleSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    submitSearchFilters()
  }

  function handleStatusFilterChange(value: 'all' | 'active' | 'inactive') {
    setStatusFilter(value)
    setCurrentPage(1)
    setAppliedStatusFilter(value)
    navigateWithParams({ page: 1, status: value })
  }

  function applyPageLimit(nextLimit: number) {
    setSelectedLimit(nextLimit)
    setCurrentPage(1)
    navigateWithParams({ page: 1, limit: nextLimit })
  }

  function clearFilters() {
    setSearch('')
    setStatusFilter('all')

    if (!appliedSearch && appliedStatusFilter === 'all' && currentPage === 1) {
      return
    }

    setCurrentPage(1)
    setAppliedSearch('')
    setAppliedStatusFilter('all')
    setMobileFiltersOpen(false)
    navigateWithParams({ page: 1, q: '', status: 'all' })
  }

  function openCreateDialog() {
    if (!canCreateUsers) {
      toast.error(tr("admin.users.noCreatePermission", "Você não tem permissão para criar usuários"));
      return;
    }

    void ensurePermissionsCatalogLoaded();
    setEditingUser(null);
    setFormData({
      name: "",
      email: "",
      phone: "",
      sellerSlug: "",
      password: "",
      roleId: assignableRoleGroups[0] ? String(assignableRoleGroups[0].id) : "",
      isActive: true,
    });
    setShowChangePassword(false);
    setUseCustomPermissions(false);
    setCustomPermissions(null);
    setExpandedCategories([]);
    setIsDialogOpen(true);
  }

  function openEditDialog(user: AdminUser) {
    if (!canEditUsers) {
      toast.error(tr("admin.users.noEditPermission", "Você não tem permissão para editar usuários"));
      return;
    }

    void ensurePermissionsCatalogLoaded();
    const selectedRole = roleGroups.find((group) => String(group.id) === String(user.roleId));
    const selectedRoleId = selectedRole && !selectedRole.is_system && user.roleId ? String(user.roleId) : "";

    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      sellerSlug: user.sellerSlug || "",
      password: "",
      roleId: selectedRoleId,
      isActive: user.isActive,
    });
    setShowChangePassword(false);
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
    if (code.startsWith("users.")) return "canManageUsers";
    if (code.startsWith("settings.")) return "canManageSettings";
    return null;
  }

  async function loadUserOverrides(user: AdminUser) {
    const userId = Number(user.id);
    if (!Number.isInteger(userId) || userId <= 0) return;

    const permissionsCatalog = await ensurePermissionsCatalogLoaded();
    if (permissionsCatalog.length === 0) return;

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
      for (const permission of permissionsCatalog) {
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

    const permissionsCatalog = await ensurePermissionsCatalogLoaded();
    if (permissionsCatalog.length === 0) return;

    const mutations: Promise<void>[] = [];
    for (const permission of permissionsCatalog) {
      const legacyKey = mapPermissionCodeToLegacyKey(permission.code);
      if (!legacyKey) continue;
      const granted = Boolean(nextPermissions[legacyKey]);
      mutations.push(setUserPermissionOverride(userId, Number(permission.id), granted));
    }

    await Promise.all(mutations);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (formData.roleId) {
      const selectedRole = roleGroups.find((group) => String(group.id) === String(formData.roleId));
      if (selectedRole?.is_system) {
        toast.error("Não é permitido atribuir perfil de sistema")
        return
      }
    }

    const fd = new FormData();
    fd.append("name", formData.name);
    fd.append("email", formData.email);
    fd.append("phone", formData.phone);
    fd.append("sellerSlug", formData.sellerSlug);
    fd.append("roleId", formData.roleId || "");
    fd.append("isActive", formData.isActive.toString());

    if (useCustomPermissions && customPermissions) {
      fd.append("permissions", JSON.stringify(customPermissions));
    } else {
      fd.append("permissions", "null");
    }

    let persistedId: string | null = null;

    if (editingUser) {
      // Se está editando e marcou para alterar senha, inclui a senha
      if (showChangePassword && formData.password && formData.password.trim().length > 0) {
        fd.append("password", formData.password);
      }
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
    router.refresh();
  }

  async function handleToggleStatus(id: string) {
    if (!canDeleteUsers) {
      toast.error(tr("admin.users.noDeletePermission", "Você não tem permissão para desativar usuários"));
      return;
    }

    await toggleUserActiveAction(id);
    router.refresh();
  }

  async function handleSendTestPush(user: AdminUser) {
    setPushingUserId(user.id)
    const result = await sendTestPushToAdminAction(user.id)
    if (!result.success || !result.data) {
      toast.error(result.error || tr('admin.users.pushTestError', 'Não foi possível disparar push de teste'))
      setPushingUserId(null)
      return
    }

    toast.success(result.data.message || tr('admin.users.pushTestSuccess', 'Push de teste disparado'))
    setPushingUserId(null)
  }

  function renderDeviceInfo(user: AdminUser) {
    const hasDevices = Boolean(user.hasDevices)
    const count = Number(user.deviceCount || 0)
    const normalizedPlatforms = Array.from(
      new Set(
        (user.devicePlatforms || [])
          .map((entry) => String(entry || '').trim().toLowerCase())
          .filter((entry) => entry.length > 0)
      )
    )

    const platformLabel = (platform: string) => {
      if (platform === 'ios') return 'iOS'
      if (platform === 'android') return 'Android'
      return platform.toUpperCase()
    }

    if (!hasDevices || count <= 0) {
      return <span className="text-xs text-muted-foreground">Sem devices</span>
    }

    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="text-xs">{count} device{count > 1 ? 's' : ''}</Badge>
        {normalizedPlatforms.length > 0 ? (
          normalizedPlatforms.map((platform) => (
            <Badge key={platform} variant="secondary" className="text-xs">
              {platformLabel(platform)}
            </Badge>
          ))
        ) : (
          <Badge variant="secondary" className="text-xs">UNKNOWN</Badge>
        )}
      </div>
    )
  }

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

  function renderRoleBadge(user: AdminUser) {
    const group = roleGroups.find((g) => String(g.id) === String(user.roleId))
    if (!group) return <span className="text-xs text-muted-foreground">-</span>
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
  }

  function getSellerPublicUrl(user: AdminUser): string | null {
    const rawSlug = String(user.sellerSlug || '').trim();
    if (!rawSlug) return null;
    return buildStorefrontUrl(storefrontUrl, `/v/${encodeURIComponent(rawSlug)}`);
  }

  return (
    <div className="space-y-6 p-6 lg:p-8 [&_button:not(:disabled)]:cursor-pointer [&_select:not(:disabled)]:cursor-pointer [&_[role='button']:not([aria-disabled='true'])]:cursor-pointer">
      <div className="rounded-2xl border border-border/40 bg-linear-to-br from-card via-card to-muted/30 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Shield className="h-3.5 w-3.5" />
              Equipe
            </div>
            <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
              <Users className="h-6 w-6 text-primary" />
              {tr("admin.users.title", "Usuários")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {hasAppliedFilter
                ? `${totalItems} usuários encontrados com os filtros atuais.`
                : `${stats.total} usuários internos cadastrados no sistema.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full md:hidden"
              onClick={() => setMobileFiltersOpen(true)}
              aria-label="Abrir filtros"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
            {canCreateUsers ? (
              <Button size="sm" className="h-10 gap-2 rounded-full px-5" onClick={openCreateDialog}>
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">{tr("admin.users.newUser", "Novo Usuário")}</span>
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <Drawer open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen} direction="right">
        <DrawerContent className="max-w-none flex flex-col data-[vaul-drawer-direction=right]:w-[80vw] sm:data-[vaul-drawer-direction=right]:w-[80vw]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Filtros</DrawerTitle>
            <DrawerDescription>Refine a lista de usuários no mobile.</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 px-4 pb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={tr("admin.users.searchPlaceholder", "Buscar por nome ou e-mail...")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    submitSearchFilters()
                  }
                }}
                className="h-10 rounded-full pl-10 pr-24"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="absolute right-1 top-1/2 h-8 -translate-y-1/2 rounded-full"
                onClick={submitSearchFilters}
              >
                Buscar
              </Button>
            </div>

            <Select value={statusFilter} onValueChange={(value) => handleStatusFilterChange(value as 'all' | 'active' | 'inactive')}>
              <SelectTrigger className="h-10 w-full rounded-full">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="active">{tr("admin.users.active", "Ativo")}</SelectItem>
                <SelectItem value="inactive">{tr("admin.users.inactive", "Inativo")}</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={String(selectedLimit)}
              onValueChange={(value) => {
                const nextLimit = Number.parseInt(value, 10)
                if (!Number.isFinite(nextLimit)) return
                applyPageLimit(nextLimit)
              }}
            >
              <SelectTrigger className="h-10 w-full rounded-full">
                <SelectValue placeholder="Itens/pagina" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20 por pagina</SelectItem>
                <SelectItem value="50">50 por pagina</SelectItem>
                <SelectItem value="100">100 por pagina</SelectItem>
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={clearFilters}
              className="h-10 w-10 rounded-full self-end"
              aria-label="Limpar filtros"
              disabled={!hasActiveFilter}
            >
              <FilterX className="h-4 w-4" />
            </Button>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button type="button" className="w-full cursor-pointer bg-black text-white hover:bg-black/90">
                Fechar
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Usuários</p>
              <p className="mt-2 text-2xl font-semibold leading-none">{stats.total}</p>
            </div>
            <div className="rounded-full bg-slate-100 p-2 text-slate-700">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-slate-300 to-slate-500" />
        </div>
        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Ativos</p>
              <p className="mt-2 text-2xl font-semibold leading-none">{stats.active}</p>
            </div>
            <div className="rounded-full bg-emerald-100 p-2 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-emerald-300 to-emerald-500" />
        </div>
        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Inativos</p>
              <p className="mt-2 text-2xl font-semibold leading-none">{stats.inactive}</p>
            </div>
            <div className="rounded-full bg-amber-100 p-2 text-amber-700">
              <AlertCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-amber-300 to-amber-500" />
        </div>
        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Com app</p>
              <p className="mt-2 text-2xl font-semibold leading-none">{stats.withDevices}</p>
            </div>
            <div className="rounded-full bg-sky-100 p-2 text-sky-700">
              <Smartphone className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-linear-to-r from-sky-300 to-sky-500" />
        </div>
      </div>

      <form
        className="hidden rounded-2xl border border-border/40 bg-card p-4 shadow-sm md:block"
        onSubmit={handleSearchSubmit}
      >
        <div className="flex w-full flex-col items-stretch gap-3 xl:flex-row xl:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2 xl:max-w-xl">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={tr("admin.users.searchPlaceholder", "Buscar por nome ou e-mail...")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 rounded-full pl-10"
              />
            </div>
            <Button type="submit" size="sm" variant="outline" className="h-10 shrink-0 rounded-full px-5">
              Buscar
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Select value={statusFilter} onValueChange={(value) => handleStatusFilterChange(value as 'all' | 'active' | 'inactive')}>
              <SelectTrigger className="h-10 w-full rounded-full sm:w-auto xl:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="active">{tr("admin.users.active", "Ativo")}</SelectItem>
                <SelectItem value="inactive">{tr("admin.users.inactive", "Inativo")}</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={String(selectedLimit)}
              onValueChange={(value) => {
                const nextLimit = Number.parseInt(value, 10)
                if (!Number.isFinite(nextLimit)) return
                applyPageLimit(nextLimit)
              }}
            >
              <SelectTrigger className="h-10 w-full rounded-full sm:w-auto xl:w-40">
                <SelectValue placeholder="Itens/pagina" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20 por pagina</SelectItem>
                <SelectItem value="50">50 por pagina</SelectItem>
                <SelectItem value="100">100 por pagina</SelectItem>
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={clearFilters}
              className="h-10 w-10 shrink-0 rounded-full"
              aria-label="Limpar filtros"
              disabled={!hasActiveFilter}
            >
              <FilterX className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </form>

      <div className="rounded-2xl border border-border/40 bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-4">
          <span className="font-medium">Status do Usuário:</span>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:justify-start sm:gap-x-4">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />Ativo</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-300" />Inativo</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-sky-300" />Com app</span>
          </div>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {users.length === 0 ? (
          <div className="rounded-xl border border-border/20 bg-card px-6 py-10 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{tr("admin.users.empty", "No users found")}</p>
          </div>
        ) : (
          users.map((user) => (
            <Card key={user.id} className="overflow-hidden gap-0 border-border/60 py-0 shadow-sm">
              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>
                    {user.sellerSlug ? (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="truncate text-muted-foreground">{user.sellerSlug}</span>
                      </div>
                    ) : null}
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.phone || "-"}</p>
                  </div>
                  <Badge variant="outline" className={userStatusBadgeClass(user.isActive)}>
                    {user.isActive ? tr("admin.users.active", "Active") : tr("admin.users.inactive", "Inactive")}
                  </Badge>
                </div>

                <div>{renderRoleBadge(user)}</div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Smartphone className="h-3.5 w-3.5" />
                  {renderDeviceInfo(user)}
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Button variant="outline" size="sm" className="w-full cursor-pointer" onClick={() => openEditDialog(user)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    {tr("admin.users.edit", "Edit")}
                  </Button>
                  <Button variant="secondary" size="sm" className="w-full cursor-pointer" onClick={() => handleToggleStatus(user.id)}>
                    <UserX className="mr-2 h-4 w-4" />
                    {user.isActive ? tr("admin.users.deactivate", "Deactivate") : tr("admin.users.activate", "Activate")}
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full cursor-pointer"
                    disabled={pushingUserId === user.id || !user.hasDevices}
                    onClick={() => handleSendTestPush(user)}
                  >
                    <BellRing className="mr-2 h-4 w-4" />
                    {pushingUserId === user.id ? 'Enviando...' : 'Push teste'}
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <Card className="hidden overflow-hidden rounded-xl border border-border/20 p-0 shadow-none md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-border/20">
              <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground/90 uppercase">{tr("admin.users.table.user", "User")}</TableHead>
              <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground/90 uppercase">{tr("admin.users.table.email", "Email")}</TableHead>
              <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground/90 uppercase">{tr("admin.users.table.phone", "Telefone")}</TableHead>
              <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground/90 uppercase">{tr("admin.users.table.role", "Perfil")}</TableHead>
              <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground/90 uppercase">Devices</TableHead>
              <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground/90 uppercase">{tr("admin.users.table.status", "Status")}</TableHead>
              <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground/90 uppercase">Push</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <Users className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">{tr("admin.users.empty", "No users found")}</p>
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id} className="border-border/20 hover:bg-muted/40">
                  <TableCell className="font-medium">
                    <div className="space-y-1">
                      <p>{user.name}</p>
                      {user.sellerSlug ? (
                        <div className="flex items-center gap-2 text-xs font-normal">
                          <span className="text-muted-foreground">{user.sellerSlug}</span>
                        </div>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell className="text-muted-foreground">{user.phone || <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                  <TableCell>{renderRoleBadge(user)}</TableCell>
                  <TableCell>{renderDeviceInfo(user)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={userStatusBadgeClass(user.isActive)}>
                      {user.isActive ? tr("admin.users.active", "Active") : tr("admin.users.inactive", "Inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      className="cursor-pointer"
                      disabled={pushingUserId === user.id || !user.hasDevices}
                      onClick={() => handleSendTestPush(user)}
                    >
                      <BellRing className="mr-2 h-4 w-4" />
                      {pushingUserId === user.id ? 'Enviando...' : 'Push teste'}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="cursor-pointer">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {getSellerPublicUrl(user) ? (
                          <DropdownMenuItem asChild>
                            <Link
                              href={getSellerPublicUrl(user) || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="cursor-pointer"
                            >
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Link do Usuário
                            </Link>
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem onClick={() => openEditDialog(user)} className="cursor-pointer">
                          <Pencil className="mr-2 h-4 w-4" />
                          {tr("admin.users.edit", "Edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleStatus(user.id)} className="cursor-pointer">
                          <UserX className="mr-2 h-4 w-4" />
                          {user.isActive ? tr("admin.users.deactivate", "Deactivate") : tr("admin.users.activate", "Activate")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleSendTestPush(user)}
                          className="cursor-pointer"
                          disabled={pushingUserId === user.id || !user.hasDevices}
                        >
                          <BellRing className="mr-2 h-4 w-4" />
                          {pushingUserId === user.id ? 'Enviando push...' : 'Disparar push teste'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {totalItems > 0 ? (
        <AdminPaginationControls
          currentPage={safeCurrentPage}
          totalPages={totalPagesSafe}
          onPageChange={(page) => {
            setCurrentPage(page)
            navigateWithParams({ page })
          }}
          showing={{
            start: pageStart,
            end: pageEnd,
            total: totalItems,
          }}
        />
      ) : null}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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

              <div className="space-y-2">
                <Label htmlFor="sellerSlug">{tr("admin.users.fields.sellerSlug", "Slug da vendedora")}</Label>
                <Input
                  id="sellerSlug"
                  value={formData.sellerSlug}
                  onChange={(e) => setFormData({ ...formData, sellerSlug: e.target.value })}
                  placeholder={tr("admin.users.fields.sellerSlugPlaceholder", "Ex: suporte-rg")}
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

              {editingUser && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="changePassword"
                      checked={showChangePassword}
                      onCheckedChange={setShowChangePassword}
                      className="cursor-pointer"
                    />
                    <Label htmlFor="changePassword" className="font-medium cursor-pointer">
                      {tr("admin.users.fields.changePassword", "Alterar Senha")}
                    </Label>
                  </div>

                  {showChangePassword && (
                    <div className="space-y-2 pl-6 border-l-2 border-muted">
                      <Label htmlFor="newPassword">{tr("admin.users.fields.newPassword", "Nova Senha")}</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        placeholder="Deixe em branco para manter a senha atual"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        minLength={6}
                      />
                      <p className="text-xs text-muted-foreground">
                        {tr("admin.users.fields.passwordHint", "Mínimo de 6 caracteres")}
                      </p>
                    </div>
                  )}
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
                    <Label htmlFor="roleGroup" className="cursor-pointer">{tr("admin.users.globalProfile", "Global Permission Profile")}</Label>
                    <Select
                      value={formData.roleId || "none"}
                      onValueChange={(value) => setFormData({ ...formData, roleId: value === "none" ? "" : value })}
                    >
                      <SelectTrigger id="roleGroup" className="cursor-pointer">
                        <SelectValue placeholder={tr("admin.users.selectProfile", "Select profile")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="cursor-pointer">{tr("admin.users.noProfile", "No profile")}</SelectItem>
                        {assignableRoleGroups.map((group) => (
                          <SelectItem key={group.id} value={String(group.id)} className="cursor-pointer">{group.name}</SelectItem>
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
                      className="cursor-pointer"
                    />
                    <Label htmlFor="isActive" className="cursor-pointer">{tr("admin.users.activeUser", "Active User")}</Label>
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
  );
}
