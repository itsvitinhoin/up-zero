import Link from 'next/link'
import { Button } from '@/components/ui/button'
export default function NotFound() { return <div className="grid min-h-[60vh] place-content-center gap-4 text-center"><h1 className="text-xl font-semibold">Página não encontrada</h1><Button asChild><Link href="/lojas">Ver lojas</Link></Button></div> }
