'use client'

import { useEffect, useState, useTransition } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { createCustomerAdminAction, updateCustomerAction } from '@/lib/actions/customers'
import { lookupReceitaWSCnpjAction } from '@/lib/actions/receitaws'
import type { Admin } from '@/lib/actions/admins'
import type { Customer, PriceTable, PaymentMethod } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import CNPJInput from '@/components/form/CNPJInput'
import CellphoneInput from '@/components/form/CellphoneInput'
import AddressInput from '@/components/form/AddressInput'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const schema = z.object({
  customerType: z.enum(['WHOLESALE', 'RETAIL']).default('WHOLESALE'),
  retailGender: z.string().optional(),
  retailBirthDate: z.string().optional(),
  // Empresa
  cnpj: z.string().optional(),
  stateRegistration: z.string().optional(),
  companyName: z.string().optional(),
  tradeName: z.string().optional(),
  // Contato
  contactName: z.string().optional(),
  email: z.string().email('E-mail inválido'),
  phone: z.string().optional(),
  segment: z.string().optional(),
  // Endereço
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  zipCode: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  // Comercial
  priceTableId: z.string().optional(),
  assignedSellerId: z.string().optional(),
  paymentTerms: z.array(z.string()).optional(),
  passwordOtp: z.string().optional(),
}).superRefine((data, ctx) => {
  const digits = (data.cnpj || '').replace(/\D/g, '')

  if (!data.companyName?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: data.customerType === 'RETAIL' ? 'Nome é obrigatório' : 'Razão Social obrigatória',
      path: ['companyName'],
    })
  }

  if (data.customerType === 'WHOLESALE') {
    if (digits.length < 14) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CNPJ inválido (14 dígitos)',
        path: ['cnpj'],
      })
    }

    if (!data.contactName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Nome do contato obrigatório',
        path: ['contactName'],
      })
    }

    if (!data.phone || data.phone.replace(/\D/g, '').length < 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Telefone inválido',
        path: ['phone'],
      })
    }

    const requiredAddress: Array<keyof FormValues> = ['street', 'number', 'neighborhood', 'zipCode', 'city', 'state']
    for (const field of requiredAddress) {
      if (!data[field]?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Campo obrigatório',
          path: [field],
        })
      }
    }
  }

  if (data.customerType === 'RETAIL' && digits.length !== 11) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'CPF inválido (11 dígitos)',
      path: ['cnpj'],
    })
  }

  if (data.customerType === 'RETAIL') {
    const requiredRetailAddress: Array<keyof FormValues> = ['street', 'number', 'neighborhood', 'zipCode', 'city', 'state']
    for (const field of requiredRetailAddress) {
      if (!data[field]?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Campo obrigatório',
          path: [field],
        })
      }
    }
  }
})

type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  priceTables: PriceTable[]
  sellers: Admin[]
  mode?: 'create' | 'edit'
  customer?: Customer | null
  onCreated?: (id: string) => void
  onUpdated?: (id: string) => void
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'PIX', label: 'PIX' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'FATURADO', label: 'Faturado' },
  { value: 'CARTAO_EXTERNO', label: 'Cartão Externo' },
]

function SixDigitPinInput({
  value,
  onChange,
  autoFocus = false,
}: {
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
}) {
  const digits = value.replace(/\D/g, '').slice(0, 6).split('')

  const updateDigit = (index: number, nextDigit: string) => {
    const next = [...Array(6)].map((_, i) => digits[i] || '')
    next[index] = nextDigit
    onChange(next.join(''))
  }

  return (
    <div className="grid w-full grid-cols-6 gap-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <input
          key={index}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          autoFocus={autoFocus && index === 0}
          value={digits[index] || ''}
          onChange={(e) => {
            const nextDigit = e.target.value.replace(/\D/g, '').slice(-1)
            updateDigit(index, nextDigit)

            if (nextDigit && index < 5) {
              const nextInput = e.currentTarget.nextElementSibling as HTMLInputElement | null
              nextInput?.focus()
              nextInput?.select()
            }
          }}
          onKeyDown={(e) => {
            const target = e.currentTarget
            if (/^\d$/.test(e.key)) {
              e.preventDefault()
              updateDigit(index, e.key)
              if (index < 5) {
                const nextInput = target.nextElementSibling as HTMLInputElement | null
                nextInput?.focus()
                nextInput?.select()
              }
              return
            }

            if (e.key === 'Backspace' && !target.value && index > 0) {
              const prevInput = target.previousElementSibling as HTMLInputElement | null
              prevInput?.focus()
              prevInput?.select()
            }

            if (e.key === 'ArrowLeft' && index > 0) {
              const prevInput = target.previousElementSibling as HTMLInputElement | null
              prevInput?.focus()
              prevInput?.select()
            }

            if (e.key === 'ArrowRight' && index < 5) {
              const nextInput = target.nextElementSibling as HTMLInputElement | null
              nextInput?.focus()
              nextInput?.select()
            }
          }}
          onFocus={(e) => {
            e.currentTarget.select()
          }}
          className="w-full aspect-square rounded-lg border border-gray-300 bg-white text-center text-xl md:text-2xl text-gray-900 outline-none focus:border-gray-300 focus:ring-0 cursor-pointer"
          aria-label={`Dígito ${index + 1} da senha`}
        />
      ))}
    </div>
  )
}

export function NewCustomerDialog({
  open,
  onOpenChange,
  priceTables,
  sellers,
  mode = 'create',
  customer,
  onCreated,
  onUpdated,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<'empresa' | 'contato' | 'endereco' | 'comercial' | 'senha'>('empresa')
  const [receitawsLoading, setReceitawsLoading] = useState(false)
  const [lastReceitaWSCnpj, setLastReceitaWSCnpj] = useState('')

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      customerType: 'WHOLESALE',
      paymentTerms: [],
      cnpj: '',
      phone: '',
      zipCode: '',
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      passwordOtp: '',
    },
  })

  const paymentTerms = watch('paymentTerms') ?? []
  const customerType = watch('customerType')
  const watchCnpj = watch('cnpj') || ''

  useEffect(() => {
    const digits = watchCnpj.replace(/\D/g, '')

    if (!open || mode !== 'create' || customerType !== 'WHOLESALE') {
      return
    }

    if (digits.length !== 14) {
      if (lastReceitaWSCnpj) {
        setLastReceitaWSCnpj('')
      }
      return
    }

    if (digits === lastReceitaWSCnpj) {
      return
    }

    let cancelled = false
    setReceitawsLoading(true)

    void lookupReceitaWSCnpjAction(digits)
      .then((result) => {
        if (cancelled) return

        if (!result.success || !result.data) {
          if (result.error) {
            toast.error(result.error)
          }
          return
        }

        const data = result.data
        setValue('companyName', data.companyName || '', { shouldDirty: true, shouldValidate: true })
        setValue('tradeName', data.tradeName || data.companyName || '', { shouldDirty: true, shouldValidate: true })
        setValue('stateRegistration', data.stateRegistration || '', { shouldDirty: true, shouldValidate: true })
        setValue('segment', data.segment || '', { shouldDirty: true, shouldValidate: true })
        setValue('zipCode', data.zipCode || '', { shouldDirty: true, shouldValidate: true })
        setValue('street', data.street || '', { shouldDirty: true, shouldValidate: true })
        setValue('number', data.number || '', { shouldDirty: true, shouldValidate: true })
        setValue('complement', data.complement || '', { shouldDirty: true, shouldValidate: true })
        setValue('neighborhood', data.neighborhood || '', { shouldDirty: true, shouldValidate: true })
        setValue('city', data.city || '', { shouldDirty: true, shouldValidate: true })
        setValue('state', data.state || '', { shouldDirty: true, shouldValidate: true })
        if (data.phone) {
          setValue('phone', data.phone, { shouldDirty: true, shouldValidate: true })
        }
        if (data.email) {
          setValue('email', data.email, { shouldDirty: true, shouldValidate: true })
        }
        setLastReceitaWSCnpj(digits)
      })
      .finally(() => {
        if (!cancelled) {
          setReceitawsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [open, mode, customerType, watchCnpj, lastReceitaWSCnpj, setValue])

  useEffect(() => {
    if (customerType === 'RETAIL' && (activeTab === 'contato' || activeTab === 'comercial')) {
      setActiveTab('empresa')
    }
  }, [activeTab, customerType])

  useEffect(() => {
    if (!open) return

    if (mode === 'edit' && customer) {
      reset({
        customerType: customer.customerType || 'WHOLESALE',
        cnpj: customer.cnpj || '',
        stateRegistration: customer.stateRegistration || '',
        companyName: customer.companyName || '',
        tradeName: customer.tradeName || '',
        contactName: customer.contactName || '',
        email: customer.email || '',
        phone: customer.phone || '',
        segment: customer.segment || '',
        zipCode: customer.zipCode || '',
        street: customer.street || '',
        number: customer.number || '',
        complement: customer.complement || '',
        neighborhood: customer.neighborhood || '',
        city: customer.city || '',
        state: customer.state || '',
        priceTableId: customer.priceTableId || '',
        assignedSellerId: customer.assignedSellerId || '',
        paymentTerms: customer.paymentTerms || [],
        passwordOtp: '',
      })
    } else if (mode === 'create') {
      reset({
        customerType: 'WHOLESALE',
        paymentTerms: [],
        cnpj: '',
        phone: '',
        zipCode: '',
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        state: '',
        passwordOtp: '',
      })
    }
  }, [open, mode, customer, reset])

  function togglePaymentMethod(method: PaymentMethod) {
    const current = watch('paymentTerms') ?? []
    if (current.includes(method)) {
      setValue('paymentTerms', current.filter((m) => m !== method), { shouldDirty: true })
    } else {
      setValue('paymentTerms', [...current, method], { shouldDirty: true })
    }
  }

  function onSubmit(data: FormValues) {
    startTransition(async () => {
      if (mode === 'edit' && customer) {
        const passwordOtp = (data.passwordOtp || '').trim()
        const hasPasswordChange = passwordOtp.length > 0

        if (hasPasswordChange) {
          if (!/^\d{6}$/.test(passwordOtp)) {
            toast.error('A nova senha deve ter 6 dígitos numéricos')
            return
          }
        }

        const fd = new FormData()
        fd.set('companyName', data.companyName || '')
        fd.set('tradeName', data.tradeName || data.companyName || '')
        fd.set('cnpj', data.cnpj || '')
        fd.set('stateRegistration', data.stateRegistration || '')
        fd.set('contactName', data.contactName || '')
        fd.set('email', data.email || '')
        fd.set('phone', data.phone || '')
        fd.set('segment', data.segment || '')
        fd.set('zipCode', data.zipCode || '')
        fd.set('street', data.street || '')
        fd.set('number', data.number || '')
        fd.set('complement', data.complement || '')
        fd.set('neighborhood', data.neighborhood || '')
        fd.set('city', data.city || '')
        fd.set('state', data.state || '')
        fd.set('priceTableId', data.priceTableId || 'default')
        fd.set('assignedSellerId', data.assignedSellerId || 'default')
        fd.set('paymentTerms', JSON.stringify(data.paymentTerms || []))
        if (hasPasswordChange) {
          fd.set('password', passwordOtp)
        }

        const result = await updateCustomerAction(customer.id, fd)

        if (!result.success) {
          toast.error(result.error ?? 'Erro ao atualizar cliente')
          return
        }

        onOpenChange(false)
        onUpdated?.(customer.id)
        router.refresh()
      } else {
        const result = await createCustomerAdminAction({
          customer_type: data.customerType,
          retail_name: data.companyName,
          retail_cpf: data.cnpj,
          retail_gender: data.retailGender || undefined,
          retail_birth_date: data.retailBirthDate || undefined,
          retail_address_zip: data.zipCode,
          retail_address_street: data.street,
          retail_address_number: data.number,
          retail_address_complement: data.complement || undefined,
          retail_address_neighborhood: data.neighborhood,
          retail_address_city: data.city,
          retail_address_state: data.state,
          company_name: data.companyName,
          trade_name: data.tradeName || data.companyName,
          cnpj: data.cnpj,
          state_registration: data.stateRegistration || undefined,
          segment: data.segment || undefined,
          contact_name: data.contactName,
          email: data.email,
          phone: data.phone || undefined,
          address_zip: data.zipCode,
          address_street: data.street,
          address_number: data.number,
          address_complement: data.complement || undefined,
          address_neighborhood: data.neighborhood,
          address_city: data.city,
          address_state: data.state,
          price_table_id: data.priceTableId || undefined,
          assigned_seller_id: data.assignedSellerId || undefined,
          payment_terms: data.paymentTerms,
        })

        if (!result.success) {
          toast.error(result.error ?? 'Erro ao criar cliente')
          return
        }

        reset()
        onOpenChange(false)
        if (data.customerType === 'RETAIL') {
          router.push('/customers')
          router.refresh()
        } else if (onCreated) {
          onCreated(result.data!.id)
        } else {
          router.push(`/customers/${result.data!.id}`)
        }
      }
    })
  }

  function FieldError({ name }: { name: keyof FormValues }) {
    const msg = errors[name]?.message
    if (!msg) return null
    return <p className="text-xs text-rose-600 mt-1">{msg}</p>
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
          <DialogDescription>
            {mode === 'edit'
              ? 'Edite os dados do cliente. Os campos marcados com * são obrigatórios.'
              : 'Adicione um novo cliente manualmente. Os campos marcados com * são obrigatórios.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="mb-4 space-y-2">
            <Label>Tipo de Cliente</Label>
            <Controller
              control={control}
              name="customerType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    disabled={mode === 'edit'}
                    className={mode === 'edit' ? '' : 'cursor-pointer'}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RETAIL" className="cursor-pointer">Varejo</SelectItem>
                    <SelectItem value="WHOLESALE" className="cursor-pointer">Atacado</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'empresa' | 'contato' | 'endereco' | 'comercial' | 'senha')} className="w-full">
            <TabsList className={customerType === 'RETAIL' ? `grid w-full ${mode === 'edit' ? 'grid-cols-3' : 'grid-cols-2'}` : `grid w-full ${mode === 'edit' ? 'grid-cols-5' : 'grid-cols-4'}`}>
              <TabsTrigger value="empresa" className="cursor-pointer">{customerType === 'RETAIL' ? 'Cliente' : 'Empresa'}</TabsTrigger>
              {customerType === 'WHOLESALE' && <TabsTrigger value="contato" className="cursor-pointer">Contato</TabsTrigger>}
              {customerType === 'WHOLESALE' && <TabsTrigger value="endereco" className="cursor-pointer">Endereço</TabsTrigger>}
              {customerType === 'WHOLESALE' && <TabsTrigger value="comercial" className="cursor-pointer">Comercial</TabsTrigger>}
              {customerType === 'RETAIL' && <TabsTrigger value="endereco" className="cursor-pointer">Endereço</TabsTrigger>}
              {mode === 'edit' && <TabsTrigger value="senha" className="cursor-pointer">Senha</TabsTrigger>}
            </TabsList>

            {/* ── EMPRESA ── */}
            <TabsContent value="empresa" className="space-y-4 mt-4">
              {customerType === 'WHOLESALE' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Controller
                      control={control}
                      name="cnpj"
                      render={({ field }) => (
                        <div className="space-y-1">
                          <CNPJInput
                            label="CNPJ *"
                            value={field.value || ''}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            error={!!errors.cnpj}
                            helperText={errors.cnpj?.message as string | undefined}
                            fullWidth
                          />
                          {receitawsLoading && (
                            <p className="text-xs text-muted-foreground">Consultando ReceitaWS...</p>
                          )}
                        </div>
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Inscrição Estadual</Label>
                    <Input {...register('stateRegistration')} placeholder="Isento ou número" />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>CPF *</Label>
                  <Input {...register('cnpj')} placeholder="000.000.000-00" />
                  <FieldError name="cnpj" />
                </div>
              )}
              <div className="space-y-2">
                <Label>{customerType === 'RETAIL' ? 'Nome Completo *' : 'Razão Social *'}</Label>
                <Input {...register('companyName')} placeholder={customerType === 'RETAIL' ? 'Nome completo do cliente' : 'Nome registrado da empresa'} />
                <FieldError name="companyName" />
              </div>

              {customerType === 'RETAIL' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Gênero</Label>
                      <Controller
                        control={control}
                        name="retailGender"
                        render={({ field }) => (
                          <Select
                            value={field.value || '__none__'}
                            onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}
                          >
                            <SelectTrigger className="cursor-pointer">
                              <SelectValue placeholder="Não informado" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__" className="cursor-pointer">Não informado</SelectItem>
                              <SelectItem value="female" className="cursor-pointer">Feminino</SelectItem>
                              <SelectItem value="male" className="cursor-pointer">Masculino</SelectItem>
                              <SelectItem value="other" className="cursor-pointer">Outro</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Data de Nascimento</Label>
                      <Input type="date" {...register('retailBirthDate')} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>E-mail *</Label>
                      <Input type="email" {...register('email')} placeholder="email@cliente.com" />
                      <FieldError name="email" />
                    </div>
                    <div className="space-y-2">
                      <Controller
                        control={control}
                        name="phone"
                        render={({ field }) => (
                          <CellphoneInput
                            label="Telefone"
                            value={field.value || ''}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            error={!!errors.phone}
                            helperText={errors.phone?.message as string | undefined}
                            fullWidth
                          />
                        )}
                      />
                    </div>
                  </div>
                </>
              )}

              {customerType === 'WHOLESALE' && (
                <div className="space-y-2">
                  <Label>Nome Fantasia</Label>
                  <Input {...register('tradeName')} placeholder="Nome comercial" />
                </div>
              )}
            </TabsContent>

            {/* ── CONTATO ── */}
            {customerType === 'WHOLESALE' && (
            <TabsContent value="contato" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Nome do Contato *</Label>
                <Input {...register('contactName')} placeholder="Nome completo" />
                <FieldError name="contactName" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>E-mail *</Label>
                  <Input type="email" {...register('email')} placeholder="email@empresa.com" />
                  <FieldError name="email" />
                </div>
                <div className="space-y-2">
                  <Controller
                    control={control}
                    name="phone"
                    render={({ field }) => (
                      <CellphoneInput
                        label="Telefone *"
                        value={field.value || ''}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                        error={!!errors.phone}
                        helperText={errors.phone?.message as string | undefined}
                        fullWidth
                      />
                    )}
                  />
                </div>
              </div>
              {customerType === 'WHOLESALE' && (
                <div className="space-y-2">
                  <Label>Segmento</Label>
                  <Input {...register('segment')} placeholder="Ex: Moda Feminina, Multimarcas" />
                </div>
              )}
            </TabsContent>
            )}

            {/* ── ENDEREÇO ── */}
            {(customerType === 'WHOLESALE' || customerType === 'RETAIL') && (
            <TabsContent value="endereco" className="space-y-4 mt-4">
              <AddressInput
                values={{
                  zip_code: watch('zipCode') || '',
                  street_name: watch('street') || '',
                  house_number: watch('number') || '',
                  address_complement: watch('complement') || '',
                  neighborhood: watch('neighborhood') || '',
                  city: watch('city') || '',
                  state: watch('state') || '',
                }}
                onChange={(field, value) => {
                  const fieldMap: Record<string, keyof FormValues> = {
                    zip_code: 'zipCode',
                    street_name: 'street',
                    house_number: 'number',
                    address_complement: 'complement',
                    neighborhood: 'neighborhood',
                    city: 'city',
                    state: 'state',
                  }

                  const formField = fieldMap[field]
                  if (!formField) return
                  setValue(formField, value, { shouldDirty: true, shouldValidate: true })
                }}
                errors={{
                  zip_code: errors.zipCode?.message as string | undefined,
                  street_name: errors.street?.message as string | undefined,
                  house_number: errors.number?.message as string | undefined,
                  address_complement: errors.complement?.message as string | undefined,
                  neighborhood: errors.neighborhood?.message as string | undefined,
                  city: errors.city?.message as string | undefined,
                  state: errors.state?.message as string | undefined,
                }}
              />
            </TabsContent>
            )}

            {/* ── COMERCIAL ── */}
            {customerType === 'WHOLESALE' && (
            <TabsContent value="comercial" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Regra de Preço</Label>
                <Controller
                  control={control}
                  name="priceTableId"
                  render={({ field }) => (
                    <Select
                      value={field.value || '__none__'}
                      onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}
                    >
                      <SelectTrigger className="cursor-pointer">
                        <SelectValue placeholder="Preço base (padrão)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__" className="cursor-pointer">Preço base (padrão)</SelectItem>
                        {priceTables.map((pt) => (
                          <SelectItem key={pt.id} value={pt.id} className="cursor-pointer">{pt.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label>Vendedora Responsável</Label>
                <Controller
                  control={control}
                  name="assignedSellerId"
                  render={({ field }) => (
                    <Select
                      value={field.value || '__none__'}
                      onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}
                    >
                      <SelectTrigger className="cursor-pointer">
                        <SelectValue placeholder="Nenhuma" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__" className="cursor-pointer">Nenhuma</SelectItem>
                        {sellers.map((s) => (
                          <SelectItem key={s.id} value={String(s.id)} className="cursor-pointer">{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label>Formas de Pagamento Habilitadas</Label>
                <div className="space-y-2">
                  {PAYMENT_METHODS.map(({ value, label }) => (
                    <div key={value} className="flex items-center gap-2">
                      <Checkbox
                        id={`pay-${value}`}
                        className="cursor-pointer"
                        checked={paymentTerms.includes(value)}
                        onCheckedChange={() => togglePaymentMethod(value)}
                      />
                      <Label htmlFor={`pay-${value}`} className="font-normal cursor-pointer">
                        {label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
            )}

            {mode === 'edit' && (
            <TabsContent value="senha" className="space-y-4 mt-4">
              <div className="rounded-md border p-4 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Defina uma nova senha numérica de 6 dígitos. Se deixar em branco, a senha atual será mantida.
                </p>

                <div className="space-y-2">
                  <Label>Nova Senha (6 dígitos)</Label>
                  <Controller
                    control={control}
                    name="passwordOtp"
                    render={({ field }) => (
                      <SixDigitPinInput
                        value={field.value || ''}
                        onChange={field.onChange}
                        autoFocus
                      />
                    )}
                  />
                  <p className="text-xs text-muted-foreground">Digite os 6 dígitos da nova senha</p>
                </div>
              </div>
            </TabsContent>
            )}
          </Tabs>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="cursor-pointer">
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending} className="cursor-pointer disabled:cursor-not-allowed">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'edit' ? 'Salvar Alterações' : 'Cadastrar Cliente'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
