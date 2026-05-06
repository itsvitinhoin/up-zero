'use client'

import { startTransition, useActionState, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { adminStoreLoginAction } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const adminLoginSchema = z.object({
  email: z
    .string()
    .min(1, 'E-mail é obrigatório')
    .email('Digite um e-mail válido'),
  password: z
    .string()
    .min(1, 'Senha é obrigatória')
    .min(6, 'A senha deve ter no mínimo 6 caracteres'),
})

type AdminLoginFormData = z.infer<typeof adminLoginSchema>

export default function AdminLoginForm() {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(adminStoreLoginAction, null)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AdminLoginFormData>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
    mode: 'onSubmit',
  })

  // Navega para /admin quando login for bem-sucedido
  useEffect(() => {
    if (state?.success) {
      router.push('/')
      return
    }

    if (state?.error) {
      toast.error(state.error)
    }
  }, [state, router])

  const onSubmit = handleSubmit(data => {
    const formData = new FormData()

    formData.append('email', data.email)
    formData.append('password', data.password)

    startTransition(() => {
      formAction(formData)
    })
  })

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12">
            <Image
              src="/icon.png"
              alt="B2B"
              width={48}
              height={48}
              className="h-full w-full object-contain"
              priority
            />
          </div>
          <CardTitle className="text-lg font-medium">Admin</CardTitle>
          <CardDescription>Acesse o painel administrativo</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu-email@empresa.com"
                {...register('email')}
                autoComplete="email"
                aria-invalid={Boolean(errors.email)}
              />
              {errors.email && <p className="pl-1 text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="******"
                  {...register('password')}
                  autoComplete="current-password"
                  aria-invalid={Boolean(errors.password)}
                  className="h-10 pr-10 py-2 leading-normal placeholder:translate-y-0.5"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                  onClick={() => setShowPassword(prev => !prev)}
                  disabled={isPending}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              {errors.password && <p className="pl-1 text-xs text-destructive">{errors.password.message}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Entrar
            </Button>
          </form>

          <div className="mt-4 text-center text-xs text-muted-foreground">
            <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
              Privacy Policy
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
