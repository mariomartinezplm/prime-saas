import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, MessageCircle, Sparkles, ShieldCheck, Dumbbell, Activity } from 'lucide-react';
import { toast } from 'sonner';

const plans = [
  {
    id: 'kine-10',
    name: 'Kinesiología - 10 Sesiones',
    price: '$200.000',
    description: 'Rehabilitación completa y personalizada',
    features: [
      'Evaluación inicial incluida',
      '10 sesiones de tratamiento',
      'Atención en grupos reducidos',
      'Duración 60 minutos',
      'Reembolsable con Isapre'
    ],
    icon: Activity,
    popular: false,
    color: 'border-teal-200 hover:border-teal-500',
    btnColor: 'bg-teal-600 hover:bg-teal-700'
  },
  {
    id: 'training-2x',
    name: 'Entrenamiento 2x',
    price: '$89.990',
    period: '/mes',
    description: 'Mantente activo y saludable',
    features: [
      '2 sesiones por semana',
      'Plan personalizado',
      'Grupos reducidos (max 4)',
      'Acompañamiento presencial'
    ],
    icon: Dumbbell,
    popular: true,
    color: 'border-blue-200 hover:border-blue-500',
    btnColor: 'bg-blue-600 hover:bg-blue-700'
  },
  {
    id: 'training-3x',
    name: 'Entrenamiento 3x',
    price: '$129.990',
    period: '/mes',
    description: 'Máximos resultados',
    features: [
      '3 sesiones por semana',
      'Plan personalizado',
      'Grupos reducidos (max 4)',
      'Acompañamiento presencial'
    ],
    icon: Sparkles,
    popular: false,
    color: 'border-purple-200 hover:border-purple-500',
    btnColor: 'bg-purple-600 hover:bg-purple-700'
  }
];

const Subscription = () => {
  const [loading, setLoading] = useState<string | null>(null);

  const handleSubscribe = (planId: string, planName: string) => {
    setLoading(planId);
    // Simulate processing
    setTimeout(() => {
      const message = `Hola! Estoy interesado en contratar el plan: ${planName}`;
      const whatsappUrl = `https://wa.me/56956286651?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
      setLoading(null);
      toast.success('Te redirigiremos a WhatsApp para finalizar tu inscripción');
    }, 800);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Elige tu Plan
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Invierte en tu salud con nuestros planes flexibles. Sin contratos a largo plazo, cancela cuando quieras.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 pt-4">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={`relative flex flex-col transition-all duration-300 border-2 hover:shadow-xl ${plan.color} ${plan.popular ? 'scale-105 shadow-lg border-blue-500' : ''}`}
          >
            {plan.popular && (
              <div className="absolute -top-4 left-0 right-0 flex justify-center">
                <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  MÁS POPULAR
                </span>
              </div>
            )}

            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg bg-secondary/20`}>
                  <plan.icon className="w-6 h-6 text-foreground" />
                </div>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
              </div>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>

            <CardContent className="flex-1">
              <div className="mb-6">
                <span className="text-4xl font-bold">{plan.price}</span>
                {plan.period && <span className="text-muted-foreground">{plan.period}</span>}
              </div>

              <ul className="space-y-3">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>

            <CardFooter>
              <Button
                className={`w-full ${plan.btnColor} text-white`}
                size="lg"
                onClick={() => handleSubscribe(plan.id, plan.name)}
                disabled={loading === plan.id}
              >
                {loading === plan.id ? (
                  <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Contratar Plan
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="mt-12 bg-secondary/10 rounded-2xl p-8">
        <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
          <div className="p-4 bg-background rounded-full shadow-sm">
            <ShieldCheck className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-2">Garantía de Satisfacción</h3>
            <p className="text-muted-foreground">
              Todos nuestros planes incluyen una evaluación inicial gratuita. Si no estás satisfecho con tu primera sesión, te devolvemos el dinero o ajustamos el plan a tus necesidades.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Subscription;
