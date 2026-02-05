import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Benefits from "@/components/Benefits";
import Services from "@/components/Services";
import HowItWorks from "@/components/HowItWorks";
import Team from "@/components/Team";
import Partnerships from "@/components/Partnerships";
import InsuranceBenefits from "@/components/InsuranceBenefits";
import Pricing from "@/components/Pricing";
import Location from "@/components/Location";
import ContactForm from "@/components/ContactForm";
import Footer from "@/components/Footer";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import ScrollAnimatedSection from "@/components/ScrollAnimatedSection";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero />

        <ScrollAnimatedSection>
          <Benefits />
        </ScrollAnimatedSection>

        <ScrollAnimatedSection delay={0.1}>
          <Services />
        </ScrollAnimatedSection>

        <ScrollAnimatedSection delay={0.2}>
          <HowItWorks />
        </ScrollAnimatedSection>

        <ScrollAnimatedSection delay={0.1}>
          <Team />
        </ScrollAnimatedSection>

        <ScrollAnimatedSection delay={0.2}>
          <Partnerships />
        </ScrollAnimatedSection>

        <InsuranceBenefits />

        <ScrollAnimatedSection delay={0.1}>
          <Pricing />
        </ScrollAnimatedSection>

        <ScrollAnimatedSection delay={0.2}>
          <Location />
        </ScrollAnimatedSection>

        <ScrollAnimatedSection delay={0.1}>
          <ContactForm />
        </ScrollAnimatedSection>
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
            "name": "Prime Fit & Health",
            "description": "Kinesiología y entrenamiento personalizado en Puerto Montt. Entrenamientos efectivos en menos de 1 hora y rehabilitación basada en ejercicio.",
            "url": "https://primefitandhealth.cl",
            "telephone": "+56956286651",
            "address": {
              "@type": "PostalAddress",
              "streetAddress": "Avenida Volcán Puntiagudo 100, Mall La Paloma",
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
              "Mo-Fr 07:00-21:00",
              "Sa 09:00-13:00"
            ],
            "priceRange": "$89990-$149990",
            "servedCuisine": [],
            "hasOfferCatalog": {
              "@type": "OfferCatalog",
              "name": "Prime Fit & Health Services",
              "itemListElement": [
                {
                  "@type": "Offer",
                  "itemOffered": {
                    "@type": "Service",
                    "name": "Entrenamiento Personalizado",
                    "description": "Entrenamientos efectivos de máximo 60 minutos"
                  }
                },
                {
                  "@type": "Offer",
                  "itemOffered": {
                    "@type": "Service",
                    "name": "Kinesiología",
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
