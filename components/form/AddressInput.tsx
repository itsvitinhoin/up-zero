"use client";

import { useState } from 'react'
import { PatternFormat } from 'react-number-format'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type ViaCEPResponse = {
  cep: string
  logradouro: string
  complemento: string
  unidade: string
  bairro: string
  localidade: string
  uf: string
  estado: string
  regiao: string
  ibge: string
  gia: string
  ddd: string
  siafi: string
  erro?: boolean
}

type AddressFields = {
  zip_code: string
  street_name: string
  house_number: string
  address_complement: string
  neighborhood: string
  city: string
  state: string
}

type Props = {
  values: AddressFields
  onChange: (field: keyof AddressFields, value: string) => void
  onBulkChange?: (fields: Partial<AddressFields>) => void
  errors?: Partial<Record<keyof AddressFields, string>>
}

const AddressInput = ({ values, onChange, onBulkChange, errors = {} }: Props) => {
  const [loading, setLoading] = useState(false)

  const fetchAddressByCEP = async (cep: string) => {
    const cleanCEP = cep.replace(/[^\d]/g, '')
    
    if (cleanCEP.length !== 8) return

    setLoading(true)

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`)

      if (!response.ok) {
        setLoading(false)
        return
      }

      const data: ViaCEPResponse = await response.json()

      if (data.erro) {
        // CEP not in ViaCEP database — let user fill in manually
        setLoading(false)
        return
      }

      const bulk: Partial<AddressFields> = {
        zip_code: cleanCEP,
        street_name: data.logradouro || '',
        neighborhood: data.bairro || '',
        city: data.localidade || '',
        state: data.uf || '',
        ...(data.complemento ? { address_complement: data.complemento } : {}),
      }

      if (onBulkChange) {
        onBulkChange(bulk)
      } else {
        Object.entries(bulk).forEach(([field, value]) =>
          onChange(field as keyof AddressFields, value as string)
        )
      }
    } catch (error) {
      console.error('Error fetching CEP:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCEPChange = (value: string) => {
    onChange('zip_code', value)
    
    // Search for address when ZIP code is complete
    const cleanCEP = value.replace(/[^\d]/g, '')
    if (cleanCEP.length === 8) {
      fetchAddressByCEP(value)
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-4">
      {/* CEP */}
      <div className="md:col-span-4 space-y-2">
        <Label htmlFor="zip_code">CEP</Label>
        <div className="relative">
          <PatternFormat
            value={values.zip_code ?? ''}
            format='#####-###'
            mask='_'
            allowEmptyFormatting={false}
            customInput={Input}
            onValueChange={(vals: any) => handleCEPChange(vals.value)}
            placeholder='_____-___'
            id="zip_code"
            className={errors.zip_code ? 'border-destructive' : ''}
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
        {errors.zip_code && (
          <p className="text-sm text-destructive">{errors.zip_code}</p>
        )}
      </div>

      {/* Street Name */}
      <div className="md:col-span-8 space-y-2">
        <Label htmlFor="street_name">Rua</Label>
        <Input
          id="street_name"
          value={values.street_name ?? ''}
          onChange={(e) => onChange('street_name', e.target.value)}
          placeholder='Rua, Avenida, etc.'
          className={errors.street_name ? 'border-destructive' : ''}
        />
        {errors.street_name && (
          <p className="text-sm text-destructive">{errors.street_name}</p>
        )}
      </div>

      {/* House Number */}
      <div className="md:col-span-3 space-y-2">
        <Label htmlFor="house_number">Número</Label>
        <Input
          id="house_number"
          value={values.house_number ?? ''}
          onChange={(e) => onChange('house_number', e.target.value)}
          placeholder='123'
          className={errors.house_number ? 'border-destructive' : ''}
        />
        {errors.house_number && (
          <p className="text-sm text-destructive">{errors.house_number}</p>
        )}
      </div>

      {/* Complement */}
      <div className="md:col-span-9 space-y-2">
        <Label htmlFor="address_complement">Complemento</Label>
        <Input
          id="address_complement"
          value={values.address_complement ?? ''}
          onChange={(e) => onChange('address_complement', e.target.value)}
          placeholder='Apt, Bloco, etc.'
          className={errors.address_complement ? 'border-destructive' : ''}
        />
        {errors.address_complement && (
          <p className="text-sm text-destructive">{errors.address_complement}</p>
        )}
      </div>

      {/* Neighborhood */}
      <div className="md:col-span-4 space-y-2">
        <Label htmlFor="neighborhood">Bairro</Label>
        <Input
          id="neighborhood"
          value={values.neighborhood ?? ''}
          onChange={(e) => onChange('neighborhood', e.target.value)}
          placeholder='Bairro'
          className={errors.neighborhood ? 'border-destructive' : ''}
        />
        {errors.neighborhood && (
          <p className="text-sm text-destructive">{errors.neighborhood}</p>
        )}
      </div>

      {/* City */}
      <div className="md:col-span-5 space-y-2">
        <Label htmlFor="city">Cidade</Label>
        <Input
          id="city"
          value={values.city ?? ''}
          onChange={(e) => onChange('city', e.target.value)}
          placeholder='Cidade'
          className={errors.city ? 'border-destructive' : ''}
        />
        {errors.city && (
          <p className="text-sm text-destructive">{errors.city}</p>
        )}
      </div>

      {/* State */}
      <div className="md:col-span-3 space-y-2">
        <Label htmlFor="state">Estado</Label>
        <Input
          id="state"
          value={values.state ?? ''}
          onChange={(e) => onChange('state', e.target.value.toUpperCase())}
          placeholder='SP'
          maxLength={2}
          className={errors.state ? 'border-destructive uppercase' : 'uppercase'}
        />
        {errors.state && (
          <p className="text-sm text-destructive">{errors.state}</p>
        )}
      </div>
    </div>
  )
}

export default AddressInput
