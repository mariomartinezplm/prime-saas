import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ContactForm = () => {
  const [formData, setFormData] = useState({
    nombre: "",
    telefono: "",
    objetivo: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Create WhatsApp message
    const message = `Hola! Me llamo ${formData.nombre}. 
Mi teléfono es ${formData.telefono}. 
Mi objetivo/situación es: ${formData.objetivo}

Me gustaría agendar una evaluación inicial.`;

    const whatsappUrl = `https://wa.me/56956286651?text=${encodeURIComponent(message)}`;
    
    // Open WhatsApp
    window.open(whatsappUrl, '_blank');
    
    // Show success message
    toast({
      title: "¡Formulario enviado!",
      description: "Te estamos redirigiendo a WhatsApp para confirmar tu cita.",
    });

    // Reset form
    setFormData({ nombre: "", telefono: "", objetivo: "" });
    setIsSubmitting(false);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isFormValid = formData.nombre && formData.telefono && formData.objetivo;

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold text-brand-primary mb-4">
            Agenda tu Evaluación Gratuita
          </h2>
            <p className="text-xl text-muted-foreground">
              Completa el formulario y te contactaremos por WhatsApp para coordinar tu cita
            </p>
          </div>

          <div className="bg-card rounded-2xl p-8 shadow-card">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="nombre" className="text-base font-semibold text-brand-primary">
                  Tu nombre completo *
                </Label>
                <Input
                  id="nombre"
                  type="text"
                  placeholder="Ej: María González"
                  value={formData.nombre}
                  onChange={(e) => handleInputChange("nombre", e.target.value)}
                  className="mt-2"
                  required
                />
              </div>

              <div>
                <Label htmlFor="telefono" className="text-base font-semibold text-brand-primary">
                  Teléfono / WhatsApp *
                </Label>
                <Input
                  id="telefono"
                  type="tel"
                  placeholder="Ej: +56 9 1234 5678"
                  value={formData.telefono}
                  onChange={(e) => handleInputChange("telefono", e.target.value)}
                  className="mt-2"
                  required
                />
              </div>

              <div>
                <Label htmlFor="objetivo" className="text-base font-semibold text-brand-primary">
                  ¿Cuál es tu objetivo principal o situación actual? *
                </Label>
                <Select onValueChange={(value) => handleInputChange("objetivo", value)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Selecciona la opción que más te represente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrenamiento-general">Entrenamiento general / Mejorar físico</SelectItem>
                    <SelectItem value="perder-peso">Bajar de peso / Tonificar</SelectItem>
                    <SelectItem value="ganar-fuerza">Ganar fuerza y masa muscular</SelectItem>
                    <SelectItem value="dolor-cronico">Tengo dolor crónico (espalda, cuello, etc.)</SelectItem>
                    <SelectItem value="lesion-deportiva">Lesión deportiva / Post-cirugía</SelectItem>
                    <SelectItem value="retorno-deporte">Quiero volver a mi deporte</SelectItem>
                    <SelectItem value="poco-tiempo">Tengo muy poco tiempo para entrenar</SelectItem>
                    <SelectItem value="otro">Otro (especificar en WhatsApp)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-brand-soft rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-brand-primary flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    <p className="font-semibold text-brand-primary mb-1">¿Qué pasa después?</p>
                    <ul className="space-y-1">
                      <li>• Te enviaremos un mensaje por WhatsApp</li>
                      <li>• Coordinaremos tu evaluación inicial gratuita</li>
                      <li>• Sin compromiso ni presión de venta</li>
                    </ul>
                  </div>
                </div>
              </div>

              <Button 
                type="submit"
                variant="whatsapp" 
                size="lg"
                className="w-full text-lg py-4"
                disabled={!isFormValid || isSubmitting}
              >
                <MessageCircle className="w-5 h-5" />
                {isSubmitting ? "Enviando..." : "Enviar y contactar por WhatsApp"}
              </Button>
            </form>
          </div>

          <div className="text-center mt-8">
            <p className="text-sm text-muted-foreground">
              También puedes escribirnos directamente al{" "}
              <a 
                href="https://wa.me/56956286651" 
                className="text-brand-primary font-semibold hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                +56 9 5628 6651
              </a>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContactForm;