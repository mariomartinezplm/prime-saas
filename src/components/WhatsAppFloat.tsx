import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const WhatsAppFloat = () => {
  const whatsappUrl = "https://wa.me/56912345678?text=Hola! Me interesa conocer más sobre Prime F%26H.";

  return (
    <>
      {/* Mobile Floating Button */}
      <div className="fixed bottom-6 right-6 z-50 md:hidden">
        <Button
          onClick={() => window.open(whatsappUrl, '_blank')}
          className="gradient-cta text-white hover:scale-110 shadow-cta transition-smooth h-14 w-14 rounded-full p-0 animate-pulse hover:animate-none"
        >
          <MessageCircle className="w-6 h-6" />
        </Button>
      </div>

      {/* Desktop Floating Button */}
      <div className="hidden md:block fixed bottom-8 right-8 z-50">
        <Button
          onClick={() => window.open(whatsappUrl, '_blank')}
          variant="whatsapp"
          size="lg"
          className="shadow-2xl animate-pulse hover:animate-none"
        >
          <MessageCircle className="w-5 h-5" />
          ¡Agenda ahora!
        </Button>
      </div>
    </>
  );
};

export default WhatsAppFloat;