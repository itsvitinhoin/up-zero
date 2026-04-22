"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreVertical, Trash2, ExternalLink, LayoutTemplate, Settings2, FileText } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import {
  createInstitutionalPageAction,
  deleteInstitutionalPageAction,
  updateInstitutionalPageAction,
} from "@/lib/actions/pages";
import { tAdmin } from "@/lib/i18n/admin";
import type { InstitutionalPage } from "@/lib/types";

interface Props {
  storeId: number;
  initialPages: InstitutionalPage[];
  locale?: string;
}

type DialogMode = "create" | "edit" | "delete" | null;

export default function AdminInstitutionalPagesClient({ storeId, initialPages, locale }: Props) {
  const router = useRouter();
  const [isBusy, setIsBusy] = useState(false);
  const [pages, setPages] = useState<InstitutionalPage[]>(initialPages);

  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selectedPage, setSelectedPage] = useState<InstitutionalPage | null>(null);

  const [formTitle, setFormTitle] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const tr = (key: string, fallback: string) => tAdmin(locale, key, fallback);

  function generateSlug(title: string) {
    return title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function openCreate() {
    setFormTitle("");
    setFormSlug("");
    setFormIsActive(true);
    setSelectedPage(null);
    setDialogMode("create");
  }

  function openEdit(page: InstitutionalPage) {
    setFormTitle(page.title);
    setFormSlug(page.slug);
    setFormIsActive(page.is_active);
    setSelectedPage(page);
    setDialogMode("edit");
  }

  function openDelete(page: InstitutionalPage) {
    setSelectedPage(page);
    setDialogMode("delete");
  }

  async function handleCreate() {
    if (!formTitle.trim() || !formSlug.trim()) {
      toast.error(tr("admin.institutionalPages.validation.titleAndSlug", "Fill title and slug"));
      return;
    }
    setIsBusy(true);
    const result = await createInstitutionalPageAction({
      storeId, title: formTitle, slug: formSlug, meta: {}, isActive: formIsActive,
    });
    if (result.success && result.data) {
      toast.success(tr("admin.institutionalPages.toast.created", "Page created! Redirecting to the builder..."));
      setDialogMode(null);
      router.push(`/pages/institutional/${result.data.id}`);
    } else {
      toast.error(result.error || tr("admin.institutionalPages.toast.errorCreate", "Error creating page"));
      setIsBusy(false);
    }
  }

  async function handleEdit() {
    if (!selectedPage || !formTitle.trim() || !formSlug.trim()) {
      toast.error(tr("admin.institutionalPages.validation.titleAndSlug", "Fill title and slug"));
      return;
    }
    setIsBusy(true);
    const result = await updateInstitutionalPageAction(selectedPage.id, {
      title: formTitle,
      slug: formSlug,
      isActive: formIsActive,
    });
    if (result.success && result.data) {
      toast.success(tr("admin.institutionalPages.toast.updated", "Page updated!"));
      setPages(prev => prev.map(p => p.id === selectedPage.id ? result.data! : p));
      setDialogMode(null);
    } else {
      toast.error(result.error || tr("admin.institutionalPages.toast.errorUpdate", "Error updating page"));
    }
    setIsBusy(false);
  }

  async function handleDelete() {
    if (!selectedPage) return;
    setIsBusy(true);
    const result = await deleteInstitutionalPageAction(selectedPage.id);
    if (result.success) {
      toast.success(tr("admin.institutionalPages.toast.deleted", "Page deleted!"));
      setPages(prev => prev.filter(p => p.id !== selectedPage.id));
      setDialogMode(null);
      setSelectedPage(null);
    } else {
      toast.error(result.error || tr("admin.institutionalPages.toast.errorDelete", "Error deleting page"));
    }
    setIsBusy(false);
  }

  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-foreground">{tr("admin.institutionalPages.title", "Institutional Pages")}</h1>
          <p className="text-sm text-muted-foreground">
            {pages.length} {pages.length === 1
              ? tr("admin.institutionalPages.count.singular", "page registered")
              : tr("admin.institutionalPages.count.plural", "pages registered")}
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {tr("admin.institutionalPages.new", "New Page")}
        </Button>
      </div>

      {/* Table */}
      <Card className="rounded-xl border border-border/20 shadow-none overflow-hidden p-0">
        {pages.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            {tr("admin.institutionalPages.empty", "No pages created yet")}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tr("admin.institutionalPages.table.title", "Title")}</TableHead>
                <TableHead>{tr("admin.institutionalPages.table.url", "URL")}</TableHead>
                <TableHead>{tr("admin.institutionalPages.table.status", "Status")}</TableHead>
                <TableHead>{tr("admin.institutionalPages.table.createdAt", "Created at")}</TableHead>
                <TableHead className="w-48 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages.map((page) => (
                <TableRow key={page.id}>
                  <TableCell className="font-medium">{page.title}</TableCell>
                  <TableCell className="text-muted-foreground text-sm font-mono">/p/{page.slug}</TableCell>
                  <TableCell>
                    {page.is_active ? (
                      <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">{tr("admin.institutionalPages.status.published", "Published")}</Badge>
                    ) : (
                      <Badge variant="secondary">{tr("admin.institutionalPages.status.hidden", "Hidden")}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {page.created_at ? new Date(page.created_at).toLocaleDateString(locale || "pt-BR") : "—"}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()} className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/p/${page.slug}`} target="_blank">
                          <ExternalLink className="mr-1.5 h-4 w-4" />
                          {tr("admin.institutionalPages.viewInStore", "View in Store")}
                        </Link>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/pages/institutional/${page.id}`}>
                              <LayoutTemplate className="mr-2 h-4 w-4" />
                              {tr("admin.institutionalPages.visualBuilder", "Visual Builder")}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(page)}>
                            <Settings2 className="mr-2 h-4 w-4" />
                            {tr("admin.institutionalPages.editInfo", "Edit Information")}
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/p/${page.slug}`} target="_blank">
                              <ExternalLink className="mr-2 h-4 w-4" />
                              {tr("admin.institutionalPages.viewInStore", "View in Store")}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => openDelete(page)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {tr("admin.institutionalPages.delete", "Delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Create Dialog */}
      <Dialog open={dialogMode === "create"} onOpenChange={(o) => !o && setDialogMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("admin.institutionalPages.new", "New Page")}</DialogTitle>
            <DialogDescription>
              {tr("admin.institutionalPages.createDescription", "Provide the basic data. The content will be edited in the Visual Builder.")}
            </DialogDescription>
          </DialogHeader>
          <PageForm
            title={formTitle} slug={formSlug} isActive={formIsActive}
            onTitleChange={(t) => { setFormTitle(t); setFormSlug(generateSlug(t)); }}
            onSlugChange={setFormSlug}
            onIsActiveChange={setFormIsActive}
            locale={locale}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)} disabled={isBusy}>{tr("admin.common.cancel", "Cancel")}</Button>
            <Button onClick={handleCreate} disabled={isBusy}>
              {isBusy
                ? tr("admin.institutionalPages.creating", "Creating...")
                : tr("admin.institutionalPages.createAndGoBuilder", "Create and Go to Builder")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={dialogMode === "edit"} onOpenChange={(o) => !o && setDialogMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("admin.institutionalPages.editInfo", "Edit Information")}</DialogTitle>
            <DialogDescription>
              {tr("admin.institutionalPages.editDescriptionPrefix", "Change the title, slug or visibility of page")}&nbsp;&quot;{selectedPage?.title}&quot;.
            </DialogDescription>
          </DialogHeader>
          <PageForm
            title={formTitle} slug={formSlug} isActive={formIsActive}
            onTitleChange={setFormTitle}
            onSlugChange={setFormSlug}
            onIsActiveChange={setFormIsActive}
            locale={locale}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)} disabled={isBusy}>{tr("admin.common.cancel", "Cancel")}</Button>
            <Button onClick={handleEdit} disabled={isBusy}>
              {isBusy ? tr("admin.common.saving", "Saving...") : tr("admin.users.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={dialogMode === "delete"} onOpenChange={(o) => !o && setDialogMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("admin.institutionalPages.deleteTitle", "Delete Page")}</DialogTitle>
            <DialogDescription>
              {tr("admin.institutionalPages.deleteDescriptionPrefix", "Are you sure you want to delete")}&nbsp;&quot;{selectedPage?.title}&quot;? {tr("admin.institutionalPages.deleteDescriptionSuffix", "This action cannot be undone.")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)}>{tr("admin.common.cancel", "Cancel")}</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isBusy}>
              {isBusy ? tr("admin.institutionalPages.deleting", "Deleting...") : tr("admin.institutionalPages.delete", "Delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Shared form component ───────────────────────────────────────────────────

function PageForm({
  title, slug, isActive,
  onTitleChange, onSlugChange, onIsActiveChange, locale,
}: {
  title: string; slug: string; isActive: boolean;
  onTitleChange: (v: string) => void;
  onSlugChange: (v: string) => void;
  onIsActiveChange: (v: boolean) => void;
  locale?: string;
}) {
  const tr = (key: string, fallback: string) => tAdmin(locale, key, fallback);

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label>{tr("admin.institutionalPages.fields.title", "Title")}</Label>
        <Input value={title} onChange={(e) => onTitleChange(e.target.value)} placeholder={tr("admin.institutionalPages.fields.titlePlaceholder", "Ex: About Us")} />
      </div>
      <div className="space-y-2">
        <Label>{tr("admin.institutionalPages.fields.slug", "Slug (URL)")}</Label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground shrink-0">/p/</span>
          <Input value={slug} onChange={(e) => onSlugChange(e.target.value)} placeholder={tr("admin.institutionalPages.fields.slugPlaceholder", "about-us")} />
        </div>
        <p className="text-xs text-muted-foreground">{tr("admin.institutionalPages.fields.finalUrl", "Final URL")}: /p/{slug || "slug"}</p>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <Label>{tr("admin.institutionalPages.fields.visible", "Visible to the public")}</Label>
          <p className="text-xs text-muted-foreground">{tr("admin.institutionalPages.fields.visibleHelp", "The page appears in the store")}</p>
        </div>
        <Switch checked={isActive} onCheckedChange={onIsActiveChange} />
      </div>
    </div>
  );
}
