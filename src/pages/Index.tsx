import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Benefits from "@/components/Benefits";
import Services from "@/components/Services";
import HowItWorks from "@/components/HowItWorks";
import Testimonials from "@/components/Testimonials";
import Team from "@/components/Team";
import Partnerships from "@/components/Partnerships";
import Pricing from "@/components/Pricing";
import Location from "@/components/Location";
import FAQ from "@/components/FAQ";
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
        
        <ScrollAnimatedSection delay={0.3}>
          <Testimonials />
        </ScrollAnimatedSection>
        
        <ScrollAnimatedSection delay={0.1}>
          <Team />
        </ScrollAnimatedSection>
        
        <ScrollAnimatedSection delay={0.2}>
          <Partnerships />
        </ScrollAnimatedSection>
        
        <ScrollAnimatedSection delay={0.1}>
          <Pricing />
        </ScrollAnimatedSection>
        
        <ScrollAnimatedSection delay={0.2}>
          <Location />
        </ScrollAnimatedSection>
        
        <ScrollAnimatedSection delay={0.3}>
          <FAQ />
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
            "description": "Physiotherapy and semi-personalized training center in Puerto Montt. Effective workouts in less than 1 hour and exercise-based rehabilitation.",
            "url": "https://primefitandhealth.cl",
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
              "name": "Prime Fit & Health Services",
              "itemListElement": [
                {
                  "@type": "Offer",
                  "itemOffered": {
                    "@type": "Service",
                    "name": "Semi-personalized Training",
                    "description": "Effective workouts of maximum 60 minutes"
                  }
                },
                {
                  "@type": "Offer", 
                  "itemOffered": {
                    "@type": "Service",
                    "name": "Sports Physiotherapy",
                    "description": "Exercise-based rehabilitation"
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
