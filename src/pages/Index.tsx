import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Benefits from "@/components/Benefits";
import Services from "@/components/Services";
import HowItWorks from "@/components/HowItWorks";
import Testimonials from "@/components/Testimonials";
import Team from "@/components/Team";
import Pricing from "@/components/Pricing";
import Location from "@/components/Location";
import FAQ from "@/components/FAQ";
import ContactForm from "@/components/ContactForm";
import Footer from "@/components/Footer";
import WhatsAppFloat from "@/components/WhatsAppFloat";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero />
        <Benefits />
        <Services />
        <HowItWorks />
        <Testimonials />
        <Team />
        <Pricing />
        <Location />
        <FAQ />
        <ContactForm />
      </main>
      <Footer />
      <WhatsAppFloat />
      
      {/* JSON-LD Schema for Local Business */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            "name": "Prime F&H",
            "description": "Centro de entrenamiento y kinesiología en Puerto Montt. Entrenamientos efectivos en menos de 1 hora y rehabilitación basada en ejercicio.",
            "url": "https://primefh.cl",
            "telephone": "+56912345678",
            "address": {
              "@type": "PostalAddress",
              "streetAddress": "Av. Diego Portales 1234",
              "addressLocality": "Puerto Montt",
              "addressRegion": "Los Lagos",
              "addressCountry": "CL"
            },
            "geo": {
              "@type": "GeoCoordinates",
              "latitude": -41.4689,
              "longitude": -72.9424
            },
            "openingHours": [
              "Mo-Fr 06:00-22:00",
              "Sa 08:00-14:00"
            ],
            "priceRange": "$89990-$149990",
            "servedCuisine": [],
            "hasOfferCatalog": {
              "@type": "OfferCatalog",
              "name": "Servicios Prime F&H",
              "itemListElement": [
                {
                  "@type": "Offer",
                  "itemOffered": {
                    "@type": "Service",
                    "name": "Entrenamiento Semi-personalizado",
                    "description": "Entrenamientos efectivos de máximo 60 minutos"
                  }
                },
                {
                  "@type": "Offer", 
                  "itemOffered": {
                    "@type": "Service",
                    "name": "Kinesiología Deportiva",
                    "description": "Rehabilitación basada en ejercicio"
                  }
                }
              ]
            }
          })
        }}
      />
    </div>
  );
};

export default Index;
