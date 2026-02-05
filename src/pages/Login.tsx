import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Mail, CreditCard, Eye, EyeOff, Loader2 } from 'lucide-react';
import logoImage from '@/assets/prime-fh-logo.png';

const Login = () => {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'email' | 'rut'>('email');

  // If already authenticated, redirect
  if (isAuthenticated && user) {
    const redirectPath = user.role === 'patient' ? '/app/dashboard' : '/app/admin';
    return <Navigate to={redirectPath} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!identifier.trim() || !password.trim()) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    setIsLoading(true);
    try {
      await login({ identifier: identifier.trim(), password });
      toast.success('Bienvenido a Prime F&H');
      // Navigation will happen via the redirect above on re-render
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Error al iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <img src={logoImage} alt="Prime F&H" className="h-16 w-auto" />
        </div>

        <Card className="border-border bg-card">
          <CardHeader className="text-center pb-4">
            <h1 className="text-2xl font-bold text-foreground">Iniciar Sesión</h1>
            <p className="text-sm text-muted-foreground">
              Accede a tu cuenta de Prime F&H
            </p>
          </CardHeader>

          <CardContent>
            <Tabs value={loginMethod} onValueChange={(v) => {
              setLoginMethod(v as 'email' | 'rut');
              setIdentifier('');
            }}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="email" className="gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </TabsTrigger>
                <TabsTrigger value="rut" className="gap-2">
                  <CreditCard className="h-4 w-4" />
                  RUT
                </TabsTrigger>
              </TabsList>

              <form onSubmit={handleSubmit} className="space-y-4">
                <TabsContent value="email" className="mt-0">
                  <div className="space-y-2">
                    <Label htmlFor="email">Correo electrónico</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="tu@correo.com"
                      value={loginMethod === 'email' ? identifier : ''}
                      onChange={(e) => setIdentifier(e.target.value)}
                      autoComplete="email"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="rut" className="mt-0">
                  <div className="space-y-2">
                    <Label htmlFor="rut">RUT</Label>
                    <Input
                      id="rut"
                      type="text"
                      placeholder="12.345.678-9"
                      value={loginMethod === 'rut' ? identifier : ''}
                      onChange={(e) => setIdentifier(e.target.value)}
                      autoComplete="username"
                    />
                  </div>
                </TabsContent>

                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Tu contraseña"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-secondary hover:bg-secondary/90"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Ingresando...
                    </>
                  ) : (
                    'Ingresar'
                  )}
                </Button>
              </form>
            </Tabs>

            <div className="mt-6 text-center">
              <button
                onClick={() => navigate('/')}
                className="text-sm text-muted-foreground hover:text-secondary transition-colors"
              >
                Volver al sitio
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
