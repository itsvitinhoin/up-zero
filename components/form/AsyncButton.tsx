"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

type AsyncButtonProps = {
  onClick?: () => Promise<void> | void | any
  children?: React.ReactNode
  className?: string
  onlyLoading?: boolean
  href?: string
  type?: "button" | "submit"
    form?: string
  icon?: any,
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
}

export function AsyncButton({
    onClick,
    children = null,
    className,
    onlyLoading,
    href,
    type = "button",
    form,
    icon = <></>,
    variant = "default"
}: AsyncButtonProps) 
{
    const [ loading, setLoading ] = useState(false)
    const router = useRouter()

    const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => 
    {
        if (type === "submit") return // deixa o <form> cuidar do submit normalmente

        e.preventDefault()
        setLoading(true)

        try 
        {
            if (href) 
            {
                router.push(href)
            }
            else if (onClick) 
            {
                await onClick() // chama o handleSubmit(onSubmit)
            }
        }
        catch (error) 
        {
            console.error(error)
        }
        finally 
        {
            setLoading(false)
        }
    }

    return (
        <Button
            className={`flex items-center justify-center gap-2 ${className}`}
            onClick={handleClick}
            disabled={loading}
            variant={variant}
            type={type}
            form={form}
        >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
            {(!onlyLoading || !loading) && children}
        </Button>
    )
}