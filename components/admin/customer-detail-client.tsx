'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getCustomerDetailAction, updateCustomerAction, approveCustomerAction, rejectCustomerAction } from '@/lib/actions/customers'
import { getAdminsAction } from '@/lib/actions/admins'
import { getPriceTablesAction } from '@/lib/actions/settings'
import { getOrdersAction } from '@/lib/actions/orders'
import { Customer, Order, PriceTable } from '@/lib/types'
import { Admin } from '@/lib/actions/admins'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AdminPage } from '@/components/admin/admin-mobile-ui'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import PercentageInput from '@/components/form/PercentageInput'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from '@/components/ui/input-otp'
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  User,
  Calendar,
  AlertCircle,
  Loader2,
  CheckCircle,
  XCircle,
  MapPin,
  ShoppingCart,
  History,
  ChevronDown,
  Check,
  Minus,
  Lock,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface CustomerDetailClientProps {
  customerId: string
}

const statusMap: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  PENDING: { label: 'Pendente', variant: 'secondary' },
  APPROVED: { label: 'Aprovado', variant: 'default' },
  REJECTED: { label: 'Rejeitado', variant: 'destructive' },
}

const orderStatusMap: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  PENDING: { label: 'Pendente', variant: 'secondary' },
  CONFIRMED: { label: 'Confirmado', variant: 'default' },
  PROCESSING: { label: 'Processando', variant: 'default' },
  INVOICED: { label: 'Faturado', variant: 'default' },
  SHIPPED: { label: 'Enviado', variant: 'outline' },
  DELIVERED: { label: 'Entregue', variant: 'outline' },
  CANCELLED: { label: 'Cancelado', variant: 'destructive' },
}

export function CustomerDetailClient({ customerId }: CustomerDetailClientProps) {
  const router = useRouter()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [passwordOtp, setPasswordOtp] = useState('')
  const [passwordOtpConfirm, setPasswordOtpConfirm] = useState('')
  const [priceTables, setPriceTables] = useState<PriceTable[]>([])
  const [admins, setAdmins] = useState<Admin[]>([])

  const customerStatusBadgeClass = (status: string) => {
    if (status === 'APPROVED') return 'bg-emerald-50 text-emerald-600 border border-emerald-100'
    if (status === 'PENDING') return 'bg-amber-50 text-amber-600 border border-amber-100'
    if (status === 'REJECTED') return 'bg-rose-50 text-rose-600 border border-rose-100'
    return 'bg-muted/60 text-muted-foreground border border-border/60'
  }

  const orderStatusBadgeClass = (status: string) => {
    if (status === 'DELIVERED' || status === 'CONFIRMED') return 'bg-emerald-50 text-emerald-600 border border-emerald-100'
    if (status === 'PENDING') return 'bg-amber-50 text-amber-600 border border-amber-100'
    if (status === 'PROCESSING' || status === 'SHIPPED') return 'bg-sky-50 text-sky-600 border border-sky-100'
    if (status === 'CANCELLED') return 'bg-rose-50 text-rose-600 border border-rose-100'
    return 'bg-muted/60 text-muted-foreground border border-border/60'
  }

  const [formData, setFormData] = useState({
    contactName: '',
    email: '',
    phone: '',
    companyName: '',
    cnpj: '',
    street: '',
    number: '',
    neighborhood: '',
    city: '',
    state: '',
    zipCode: '',
    priceTableId: '',
    extraDiscountPct: '',
    assignedSellerId: '',
  })

  useEffect(() => {
    const fetchCustomer = async () => {
      setLoading(true)
      setError(null)
      const [result, ordersResult, priceTablesResult, adminsResult] = await Promise.all([
        getCustomerDetailAction(customerId),
        getOrdersAction({ customerId }),
        getPriceTablesAction(),
        getAdminsAction(),
      ])

      if (result.success && result.data) {
        const customer = result.data as Customer
        setCustomer(customer)
        setFormData({
          contactName: customer.contactName || '',
          email: customer.email || '',
          phone: customer.phone || '',
          companyName: customer.companyName || '',
          cnpj: customer.cnpj || '',
          street: customer.street || '',
          number: customer.number || '',
          neighborhood: customer.neighborhood || '',
          city: customer.city || '',
          state: customer.state || '',
          zipCode: customer.zipCode || '',
          priceTableId: customer.priceTableId || '',
          extraDiscountPct:
            typeof customer.extraDiscountPct === 'number' ? String(customer.extraDiscountPct) : '',
          assignedSellerId: customer.assignedSellerId || '',
        })
      } else {
        setError(result.error || 'Erro ao carregar cliente')
      }

      if (priceTablesResult.success && priceTablesResult.data) {
        setPriceTables(priceTablesResult.data)
      }

      if (adminsResult.success && adminsResult.data) {
        setAdmins(adminsResult.data)
      }

      if (ordersResult.success && ordersResult.data) {
        const sortedOrders = [...ordersResult.data].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        setOrders(sortedOrders)
      } else {
        setOrders([])
      }

      setLoading(false)
    }

    fetchCustomer()
  }, [customerId])

  const handleSave = async () => {
    const passwordValue = passwordOtp.trim()
    const passwordConfirmValue = passwordOtpConfirm.trim()
    const hasPasswordChange = passwordValue.length > 0 || passwordConfirmValue.length > 0

    if (hasPasswordChange) {
      if (passwordValue.length !== 6 || passwordConfirmValue.length !== 6) {
        setError('A nova senha deve ter 6 digitos em ambos os campos.')
        return
      }

      if (passwordValue !== passwordConfirmValue) {
        setError('As senhas OTP nao conferem.')
        return
      }
    }

    setIsSaving(true)
    setError(null)
    
    const formDataObj = new FormData()
    Object.entries(formData).forEach(([key, value]) => {
      formDataObj.append(key, value)
    })
    if (hasPasswordChange) {
      formDataObj.append('password', passwordValue)
    }

    const result = await updateCustomerAction(customerId, formDataObj)

    if (result.success && result.data) {
      setCustomer(result.data as unknown as Customer)
      setShowEditDialog(false)
      setPasswordOtp('')
      setPasswordOtpConfirm('')
    } else {
      setError(result.error || 'Erro ao salvar cliente')
    }
    setIsSaving(false)
  }

  const handleApprove = async () => {
    setIsSaving(true)
    setError(null)
    const result = await approveCustomerAction(customerId)

    if (result.success && result.data) {
      setCustomer(result.data as unknown as Customer)
    } else {
      setError(result.error || 'Erro ao aprovar cliente')
    }
    setIsSaving(false)
  }

  const handleReject = async () => {
    setIsSaving(true)
    setError(null)
    const result = await rejectCustomerAction(customerId)

    if (result.success && result.data) {
      setCustomer(result.data as unknown as Customer)
    } else {
      setError(result.error || 'Erro ao rejeitar cliente')
    }
    setIsSaving(false)
  }

  const handleSellerChange = async (sellerId: string) => {
    const fd = new FormData()
    fd.append('assignedSellerId', sellerId)
    const result = await updateCustomerAction(customerId, fd)
    if (result.success && result.data) {
      setCustomer(result.data as unknown as Customer)
      setFormData((prev) => ({ ...prev, assignedSellerId: sellerId }))
    }
  }

  const getInitials = (name: string) =>
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0].toUpperCase())
      .join('')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="space-y-4">
        <Button asChild variant="outline">
          <Link href="/customers">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Link>
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || 'Cliente não encontrado'}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <AdminPage>
      {/* Header with back button, title and actions */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button asChild variant="ghost" size="icon" className="mt-1 cursor-pointer">
            <Link href="/customers">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-medium text-foreground flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {customer.companyName}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{customer.contactName}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2 justify-end">
          {/* Status badge */}
          <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium ${customerStatusBadgeClass(customer.status)}`}>
            {statusMap[customer.status]?.label ?? customer.status}
          </span>

          {/* Seller picker */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 cursor-pointer">
                <User className="w-4 h-4 text-muted-foreground" />
                <span>{customer.assignedSellerName ?? 'Nenhuma'}</span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="text-muted-foreground font-normal">Vendedora responsavel</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-3 cursor-pointer"
                onSelect={() => handleSellerChange('')}
              >
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Minus className="w-3 h-3 text-muted-foreground" />
                </div>
                <span className="flex-1">Nenhuma</span>
                {!customer.assignedSellerId && <Check className="w-4 h-4" />}
              </DropdownMenuItem>
              {admins.map((admin) => (
                <DropdownMenuItem
                  key={admin.id}
                  className="gap-3 cursor-pointer"
                  onSelect={() => handleSellerChange(String(admin.id))}
                >
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-semibold text-foreground">
                    {getInitials(admin.name)}
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-sm font-medium">{admin.name}</span>
                    <span className="text-xs text-muted-foreground truncate">{admin.email}</span>
                  </div>
                  {customer.assignedSellerId === String(admin.id) && <Check className="w-4 h-4 shrink-0" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {customer.status === 'PENDING' && (
            <>
              <Button onClick={handleReject} variant="outline" disabled={isSaving} className="cursor-pointer">
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <XCircle className="w-4 h-4 mr-2" />
                Rejeitar
              </Button>
              <Button onClick={handleApprove} disabled={isSaving} className="cursor-pointer">
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <CheckCircle className="w-4 h-4 mr-2" />
                Aprovar
              </Button>
            </>
          )}
          <Dialog
            open={showEditDialog}
            onOpenChange={(open) => {
              setShowEditDialog(open)
              if (!open) {
                setPasswordOtp('')
                setPasswordOtpConfirm('')
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline" className="cursor-pointer">Editar</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Editar Cliente</DialogTitle>
                <DialogDescription>
                  Atualize as informações do cliente
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="dados" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="dados">Dados Cadastrais</TabsTrigger>
                  <TabsTrigger value="senha">Senha</TabsTrigger>
                </TabsList>

                <TabsContent value="dados" className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="contactName">Nome do Contato</Label>
                      <Input
                        id="contactName"
                        value={formData.contactName}
                        onChange={(e) =>
                          setFormData({ ...formData, contactName: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Telefone</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="companyName">Empresa</Label>
                      <Input
                        id="companyName"
                        value={formData.companyName}
                        onChange={(e) =>
                          setFormData({ ...formData, companyName: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="cnpj">CNPJ</Label>
                      <Input
                        id="cnpj"
                        value={formData.cnpj}
                        onChange={(e) =>
                          setFormData({ ...formData, cnpj: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2 border-t pt-4">
                    <h3 className="font-medium">Endereço</h3>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label htmlFor="street">Rua</Label>
                        <Input
                          id="street"
                          value={formData.street}
                          onChange={(e) =>
                            setFormData({ ...formData, street: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="number">Número</Label>
                        <Input
                          id="number"
                          value={formData.number}
                          onChange={(e) =>
                            setFormData({ ...formData, number: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="zipCode">CEP</Label>
                        <Input
                          id="zipCode"
                          value={formData.zipCode}
                          onChange={(e) =>
                            setFormData({ ...formData, zipCode: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="neighborhood">Bairro</Label>
                        <Input
                          id="neighborhood"
                          value={formData.neighborhood}
                          onChange={(e) =>
                            setFormData({ ...formData, neighborhood: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="city">Cidade</Label>
                        <Input
                          id="city"
                          value={formData.city}
                          onChange={(e) =>
                            setFormData({ ...formData, city: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div className="max-w-xs">
                      <Label htmlFor="state">Estado</Label>
                      <Input
                        id="state"
                        value={formData.state}
                        onChange={(e) =>
                          setFormData({ ...formData, state: e.target.value })
                        }
                        maxLength={2}
                      />
                    </div>
                  </div>

                  <div className="space-y-2 border-t pt-4">
                    <h3 className="font-medium">Gerenciamento do Cliente</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="assignedSellerId">Vendedora Responsável</Label>
                        <Select
                          value={formData.assignedSellerId || 'none'}
                          onValueChange={(value) =>
                            setFormData({ ...formData, assignedSellerId: value === 'none' ? '' : value })
                          }
                        >
                          <SelectTrigger id="assignedSellerId">
                            <SelectValue placeholder="Sem vendedora atribuída" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sem vendedora atribuída</SelectItem>
                            {admins.map((admin) => (
                              <SelectItem key={admin.id} value={String(admin.id)}>
                                {admin.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 border-t pt-4">
                    <h3 className="font-medium">Precificação do Cliente</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="priceTableId">Regra de Preço</Label>
                        <Select
                          value={formData.priceTableId || 'none'}
                          onValueChange={(value) =>
                            setFormData({ ...formData, priceTableId: value === 'none' ? '' : value })
                          }
                        >
                          <SelectTrigger id="priceTableId">
                            <SelectValue placeholder="Usar tabela padrão da loja" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Usar tabela padrão da loja</SelectItem>
                            {priceTables.map((table) => (
                              <SelectItem key={table.id} value={table.id}>
                                {table.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="extraDiscountPct">Desconto Extra (%)</Label>
                        <PercentageInput
                          value={formData.extraDiscountPct ? Number(formData.extraDiscountPct) / 100 : null}
                          onChange={(value) =>
                            setFormData({
                              ...formData,
                              extraDiscountPct: value == null ? '' : String(value * 100),
                            })
                          }
                          min={0}
                          max={100}
                          placeholder="0,00"
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="senha" className="space-y-4 pt-4">
                  <div className="rounded-md border p-4 space-y-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Lock className="h-4 w-4" />
                      Troca de Senha via OTP
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Informe uma senha numerica de 6 digitos. Se deixar em branco, a senha atual sera mantida.
                    </p>

                    <div className="space-y-2">
                      <Label>Nova Senha (6 dígitos)</Label>
                      <InputOTP
                        maxLength={6}
                        value={passwordOtp}
                        onChange={(value) => setPasswordOtp(value.replace(/\D/g, '').slice(0, 6))}
                        containerClassName="justify-start"
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                        </InputOTPGroup>
                        <InputOTPSeparator />
                        <InputOTPGroup>
                          <InputOTPSlot index={3} />
                          <InputOTPSlot index={4} />
                          <InputOTPSlot index={5} />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>

                    <div className="space-y-2">
                      <Label>Confirmar Nova Senha</Label>
                      <InputOTP
                        maxLength={6}
                        value={passwordOtpConfirm}
                        onChange={(value) => setPasswordOtpConfirm(value.replace(/\D/g, '').slice(0, 6))}
                        containerClassName="justify-start"
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                        </InputOTPGroup>
                        <InputOTPSeparator />
                        <InputOTPGroup>
                          <InputOTPSlot index={3} />
                          <InputOTPSlot index={4} />
                          <InputOTPSlot index={5} />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowEditDialog(false)} className="cursor-pointer">
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={isSaving} className="cursor-pointer">
                  {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs defaultValue="info" className="w-full">
        <TabsList className="rounded-xl border border-border/20 bg-card p-1 mb-2">
          <TabsTrigger
            value="info"
            className="rounded-lg px-4 py-2 text-muted-foreground data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
          >
            Informações
          </TabsTrigger>
          <TabsTrigger
            value="orders"
            className="rounded-lg px-4 py-2 text-muted-foreground data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
          >
            Pedidos
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="rounded-lg px-4 py-2 text-muted-foreground data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
          >
            Histórico
          </TabsTrigger>
        </TabsList>

        {/* Info Tab */}
        <TabsContent value="info" className="space-y-6">
          {/* Info Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Status Card */}
            <Card className="rounded-xl border-border/20 shadow-none">
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <p className="text-[11px] font-medium tracking-wide text-muted-foreground/90 uppercase">Status</p>
                  <Badge variant="outline" className={customerStatusBadgeClass(customer.status)}>
                    {statusMap[customer.status]?.label || customer.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Created Date Card */}
            <Card className="rounded-xl border-border/20 shadow-none">
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <p className="text-[11px] font-medium tracking-wide text-muted-foreground/90 uppercase">Criado em</p>
                  </div>
                  <p className="text-base font-semibold">
                    {new Date(customer.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Updated Date Card */}
            <Card className="rounded-xl border-border/20 shadow-none">
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <p className="text-[11px] font-medium tracking-wide text-muted-foreground/90 uppercase">Atualizado em</p>
                  </div>
                  <p className="text-base font-semibold">
                    {new Date(customer.updatedAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Contact Information Card */}
          <Card className="rounded-xl border-border/20 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <User className="h-5 w-5" />
                Informações de Contato
              </CardTitle>
            </CardHeader>
            <CardContent className="border-t border-border/20 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">Nome</p>
                  <p className="text-base font-semibold">{customer.contactName}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Email</p>
                  </div>
                  <p className="text-base font-semibold">{customer.email}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Telefone</p>
                  </div>
                  <p className="text-base font-semibold">{customer.phone}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Company Information Card */}
          <Card className="rounded-xl border-border/20 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Building2 className="h-5 w-5" />
                Informações da Empresa
              </CardTitle>
            </CardHeader>
            <CardContent className="border-t border-border/20 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">Empresa</p>
                  <p className="text-base font-semibold">{customer.companyName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">CNPJ</p>
                  <p className="text-base font-semibold">{customer.cnpj}</p>
                </div>
                {customer.stateRegistration && (
                  <div className="md:col-span-2">
                    <p className="text-sm text-muted-foreground">Inscrição Estadual</p>
                    <p className="text-base font-semibold">{customer.stateRegistration}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/20 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Building2 className="h-5 w-5" />
                Precificação
              </CardTitle>
            </CardHeader>
            <CardContent className="border-t border-border/20 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">Regra de Preço</p>
                  <p className="text-base font-semibold">
                    {priceTables.find((t) => t.id === customer.priceTableId)?.name || 'Padrão da loja'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Desconto Extra</p>
                  <p className="text-base font-semibold">
                    {typeof customer.extraDiscountPct === 'number'
                      ? `${customer.extraDiscountPct.toFixed(2)}%`
                      : '0,00%'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Address Card */}
          <Card className="rounded-xl border-border/20 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <MapPin className="h-5 w-5" />
                Endereço
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 border-t border-border/20 pt-6">
              <p>
                <span className="font-medium">{customer.street}, {customer.number}</span>
                {customer.complement && <span> - {customer.complement}</span>}
              </p>
              <p>{customer.neighborhood}</p>
              <p className="font-medium">{customer.city} / {customer.state}</p>
              <p className="text-muted-foreground">CEP: {customer.zipCode}</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders">
          <Card className="rounded-xl border-border/20 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <ShoppingCart className="h-5 w-5" />
                Pedidos do Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="border-t border-border/20 pt-6">
              {orders.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Ainda sem pedidos cadastrados
                </p>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => {
                    const status = orderStatusMap[order.status] || {
                      label: order.status,
                      variant: 'secondary' as const,
                    }

                    return (
                      <Link
                        key={order.id}
                        href={`/orders/${order.id}`}
                        className="flex items-center justify-between rounded-xl border border-border/20 p-3 hover:bg-muted/50"
                      >
                        <div className="space-y-1">
                          <p className="font-medium">Pedido #{String(order.id).slice(-6)}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="font-semibold">
                            {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            }).format(order.total || 0)}
                          </p>
                          <Badge variant="outline" className={orderStatusBadgeClass(order.status)}>{status.label}</Badge>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card className="rounded-xl border-border/20 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <History className="h-5 w-5" />
                Histórico de Alterações
              </CardTitle>
            </CardHeader>
            <CardContent className="border-t border-border/20 pt-6">
              <p className="text-center text-muted-foreground py-8">
                Nenhuma alteração registrada
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Floating approve / reject — only for pending customers */}
      {customer.status === 'PENDING' && (
        <div className="print:hidden fixed bottom-[88px] md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3">
          <Button
            onClick={handleReject}
            disabled={isSaving}
            variant="outline"
            className="h-14 px-6 rounded-full bg-background hover:bg-muted shadow-[0_4px_24px_rgba(0,0,0,0.15)] text-sm font-semibold gap-2 border-border/60"
          >
            {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <XCircle className="h-5 w-5 text-rose-500" />}
            Rejeitar
          </Button>
          <Button
            onClick={handleApprove}
            disabled={isSaving}
            className="h-14 px-6 rounded-full bg-emerald-600 hover:bg-emerald-700 shadow-[0_4px_24px_rgba(5,150,105,0.35)] text-sm font-semibold gap-2"
          >
            {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
            Aprovar
          </Button>
        </div>
      )}
    </AdminPage>
  )
}
