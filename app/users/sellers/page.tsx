"use client";

import React from "react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Switch } from "@/components/ui/switch";
import { Plus, MoreHorizontal, Search, Pencil, UserX, Users, Key, Phone } from "lucide-react";
import { getUsersAction, createUserAction, updateUserAction, toggleUserActiveAction, getSellerProfiles, createSellerProfile, updateSellerProfile } from "@/lib/actions/settings";
import type { User, SellerProfile } from "@/lib/types";

// Wrapper functions to convert objects to FormData for actions
async function getUsers() {
  return getUsersAction({ role: 'SELLER' });
}

async function createUser(data: { name: string; email: string; password: string; role: string }) {
  const formData = new FormData();
  formData.append('name', data.name);
  formData.append('email', data.email);
  formData.append('password', data.password);
  formData.append('role', data.role);
  return createUserAction(formData);
}

async function updateUser(id: string, data: { name: string; email: string; isActive: boolean }) {
  const formData = new FormData();
  formData.append('name', data.name);
  formData.append('email', data.email);
  formData.append('isActive', String(data.isActive));
  return updateUserAction(id, formData);
}

export default function AdminSellersPage() {
  const [sellers, setSellers] = useState<(User & { profile?: SellerProfile })[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    isActive: true,
  });

  useEffect(() => {
    loadSellers();
  }, []);

  async function loadSellers() {
    setIsLoading(true);
    const [usersResult, profilesResult] = await Promise.all([
      getUsers(),
      getSellerProfiles(),
    ]);
    
    if (usersResult.success && usersResult.data) {
      const sellerUsers = usersResult.data.filter((u) => u.role === "SELLER");
      const profiles = profilesResult.success ? profilesResult.data || [] : [];
      
      const sellersWithProfiles = sellerUsers.map((user) => ({
        ...user,
        profile: profiles.find((p) => p.userId === user.id),
      }));
      
      setSellers(sellersWithProfiles);
    }
    setIsLoading(false);
  }

  function openCreateDialog() {
    setEditingUser(null);
    setFormData({
      name: "",
      email: "",
      password: "",
      phone: "",
      isActive: true,
    });
    setIsDialogOpen(true);
  }

  function openEditDialog(user: User & { profile?: SellerProfile }) {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: "",
      phone: user.profile?.phone || "",
      isActive: user.isActive,
    });
    setIsDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (editingUser) {
      await updateUser(editingUser.id, {
        name: formData.name,
        email: formData.email,
        isActive: formData.isActive,
      });
      
      const existingSeller = sellers.find((s) => s.id === editingUser.id);
      if (existingSeller?.profile) {
        await updateSellerProfile(existingSeller.profile.id, { phone: formData.phone });
      } else {
        await createSellerProfile({ userId: editingUser.id, phone: formData.phone });
      }
    } else {
      const result = await createUser({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: "SELLER",
      });
      
      if (result.success && result.data) {
        await createSellerProfile({ userId: result.data.id, phone: formData.phone });
      }
    }
    
    setIsDialogOpen(false);
    loadSellers();
  }

  async function handleToggleStatus(id: string) {
    await toggleUserActiveAction(id);
    loadSellers();
  }

  const filteredSellers = sellers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Vendedoras
          </h1>
          <p className="text-sm text-muted-foreground">Gerencie a equipe de vendas</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Vendedora
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingUser ? "Editar Vendedora" : "Nova Vendedora"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              {!editingUser && (
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
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

              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>

              {editingUser && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  />
                  <Label htmlFor="isActive">Ativa</Label>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingUser ? "Salvar" : "Criar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar vendedoras..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendedora</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12.5" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filteredSellers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <Users className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">Nenhuma vendedora encontrada</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredSellers.map((seller) => (
                <TableRow key={seller.id}>
                  <TableCell className="font-medium">{seller.name}</TableCell>
                  <TableCell className="text-muted-foreground">{seller.email}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {seller.profile?.phone || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={seller.isActive ? "default" : "destructive"}>
                      {seller.isActive ? "Ativa" : "Inativa"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(seller)} className="cursor-pointer">
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleStatus(seller.id)} className="cursor-pointer">
                          <UserX className="mr-2 h-4 w-4" />
                          {seller.isActive ? "Desativar" : "Ativar"}
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
