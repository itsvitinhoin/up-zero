import type { StoreProfileConfig } from "@/lib/actions/settings";
import type { FiscalOperationNature } from "@/lib/actions/fiscal";
import type { AdminUserOption } from "@/lib/actions/branches";
import type { WmsLocation, WmsWarehouse } from "@/lib/actions/wms";
import type { Permission, RoleGroup } from "@/lib/permissions";
import type { SiteSettings, Category, User, Branch } from "@/lib/types";

export type RoleWithPermissions = {
  role: RoleGroup;
  permissions: Permission[];
  permission_count: number;
};

export type SettingsPageKey =
  | "general"
  | "permissions"
  | "b2b"
  | "appearance"
  | "payments"
  | "shipping"
  | "marketing"
  | "domain"
  | "billing"
  | "stock"
  | "stock-warehouses"
  | "stock-locations"
  | "integrations"
  | "erp"
  | "fiscal"
  | "branches";

export interface AdminSettingsPageClientProps {
  locale?: string;
  currentPage: SettingsPageKey;
  initialSettings: SiteSettings | null;
  initialCategories: Category[];
  initialStoreProfile: StoreProfileConfig | null;
  initialSellerUsers: User[];
  initialFiscalNatures: FiscalOperationNature[];
  initialBranches: Branch[];
  initialBranchAdmins: AdminUserOption[];
  initialWmsWarehouses: WmsWarehouse[];
  initialWmsLocations: WmsLocation[];
  initialWmsLoadError?: string | null;
  initialPermissions: Permission[];
  initialRoleGroups: RoleGroup[];
  initialSelectedRoleDetails: RoleWithPermissions | null;
}
