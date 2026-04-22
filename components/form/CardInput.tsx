import { useMemo } from 'react'
import { PatternFormat } from 'react-number-format'
import FormInput from '@/components/form/FormInput'
import CPFInput from '@/components/form/CPFInput'

const CustomTextField = FormInput

type CardFields = {
  card_holder_name: string
  card_holder_cpf: string
  card_number: string
  card_exp_month: string
  card_exp_year: string
  card_cvv: string
  card_installments: string
}

type Props = {
  values: CardFields
  onChange: (field: keyof CardFields, value: string) => void
  errors?: Partial<Record<keyof CardFields, string>>
}

const buildMonths = () =>
  Array.from({ length: 12 }, (_, i) => {
    const value = String(i + 1).padStart(2, '0')
    return { value, label: value }
  })

const buildYears = () => {
  const year = new Date().getFullYear()
  return Array.from({ length: 12 }, (_, i) => {
    const value = String(year + i)
    return { value, label: value }
  })
}

const buildInstallments = () =>
  Array.from({ length: 12 }, (_, i) => {
    const value = String(i + 1)
    return { value, label: value }
  })

const CardInput = ({ values, onChange, errors = {} }: Props) => {
  const months = useMemo(buildMonths, [])
  const years = useMemo(buildYears, [])
  const installments = useMemo(buildInstallments, [])

  return (
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
      <div>
        <CustomTextField
          value={values.card_holder_name ?? ''}
          onChange={(e) => onChange('card_holder_name', e.target.value)}
          label='Nome no cartão *'
          placeholder='Nome como está no cartão'
          size='small'
          fullWidth
          error={!!errors.card_holder_name}
          helperText={errors.card_holder_name}
        />
      </div>

      <div>
        <CPFInput
          value={values.card_holder_cpf ?? ''}
          onChange={(val) => onChange('card_holder_cpf', val)}
          label='CPF do titular *'
          placeholder='___.___.___-__'
          fullWidth
          error={!!errors.card_holder_cpf}
          helperText={errors.card_holder_cpf}
        />
      </div>

      <div>
        <PatternFormat
          value={values.card_number ?? ''}
          format='#### #### #### ####'
          mask='_'
          allowEmptyFormatting={false}
          customInput={CustomTextField}
          onValueChange={(vals: any) => onChange('card_number', vals.value)}
          label='Número do cartão *'
          placeholder='0000 0000 0000 0000'
          size='small'
          fullWidth
          error={!!errors.card_number}
          helperText={errors.card_number}
        />
      </div>

      <div>
        <p className='mb-1 text-sm text-muted-foreground'>
          Validade *
        </p>
        <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
          <div>
            <CustomTextField
              select
              fullWidth
              value={values.card_exp_month ?? ''}
              onChange={(e) => onChange('card_exp_month', e.target.value)}
              placeholder='Mês'
              size='small'
              error={!!errors.card_exp_month}
              helperText={errors.card_exp_month}
            >
              <option value=''>Mês</option>
              {months.map(month => (
                <option key={month.value} value={month.value}>{month.label}</option>
              ))}
            </CustomTextField>
          </div>

          <div>
            <CustomTextField
              select
              fullWidth
              value={values.card_exp_year ?? ''}
              onChange={(e) => onChange('card_exp_year', e.target.value)}
              placeholder='Ano'
              size='small'
              error={!!errors.card_exp_year}
              helperText={errors.card_exp_year}
            >
              <option value=''>Ano</option>
              {years.map(year => (
                <option key={year.value} value={year.value}>{year.label}</option>
              ))}
            </CustomTextField>
          </div>
        </div>
      </div>

      <div>
        <CustomTextField
          value={values.card_cvv ?? ''}
          onChange={(e) => onChange('card_cvv', e.target.value.replace(/\D/g, '').slice(0, 4))}
          label='CVV *'
          placeholder='123'
          size='small'
          fullWidth
          error={!!errors.card_cvv}
          helperText={errors.card_cvv}
        />
      </div>

      <div>
        <CustomTextField
          select
          fullWidth
          value={values.card_installments ?? ''}
          onChange={(e) => onChange('card_installments', e.target.value)}
          label='Parcelas *'
          size='small'
          error={!!errors.card_installments}
          helperText={errors.card_installments}
        >
          <option value=''>Parcelas</option>
          {installments.map(item => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </CustomTextField>
      </div>
    </div>
  )
}

export default CardInput
