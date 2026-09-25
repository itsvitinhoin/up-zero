import { LoginForm } from '../../components/login-form'
import { configured, demoEnabled } from '../../lib/server'
export const dynamic = 'force-dynamic'
export default function LoginPage() { return <LoginForm demo={demoEnabled()} configured={configured()} /> }
