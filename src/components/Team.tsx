import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import teamKinesiologo from "@/assets/team-kinesiologo.jpg";
import teamTrainer from "@/assets/team-trainer.jpg";
import teamCoordinator from "@/assets/team-coordinator.jpg";

const Team = () => {
  const [hoveredMember, setHoveredMember] = useState<number | null>(null);

  const team = [
    {
      name: "",
      role: "Kinesiólogo",
      specialty: "Rehabilitación",
      image: teamKinesiologo,
      description: "",
      credentials: ""
    },
    {
      name: "", 
      role: "Kinesiólogo",
      specialty: "Entrenamiento Terapéutico",
      image: teamTrainer,
      description: "",
      credentials: ""
    },
    {
      name: "",
      role: "Kinesiólogo", 
      specialty: "Kinesiología Deportiva",
      image: teamCoordinator,
      description: "",
      credentials: ""
    }
  ];

  const handleBookWithProfessional = () => {
    const whatsappUrl = "https://wa.me/56956286651?text=Hola%20quiero%20agendar";
    window.open(whatsappUrl, '_blank');
  };

  return (
    <section id="equipo" className="py-24 bg-brand-tertiary">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-brand-primary mb-6">
            Nuestro Equipo Experto
          </h2>
          <p className="text-xl text-brand-primary/80 max-w-3xl mx-auto leading-relaxed">
            Conoce a nuestros profesionales dedicados a tu salud, recuperación y máximo rendimiento
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-8 max-w-7xl mx-auto">
          {team.map((member, index) => (
            <div 
              key={index}
              className="relative group bg-white rounded-3xl p-8 text-center shadow-card hover:shadow-elevated transition-all duration-300 transform hover:-translate-y-2"
              onMouseEnter={() => setHoveredMember(index)}
              onMouseLeave={() => setHoveredMember(null)}
            >
              <div className="relative mb-6">
                <div className="w-32 h-32 mx-auto relative overflow-hidden rounded-full border-4 border-brand-secondary/20">
                  <img 
                    src={member.image}
                    alt={`${member.name} - ${member.role}`}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>
              </div>
              
              <h3 className="text-xl font-bold text-brand-primary mb-2">
                {member.name}
              </h3>
              
              <div className="bg-brand-secondary/10 rounded-xl px-4 py-2 inline-block mb-3">
                <span className="text-brand-secondary font-semibold text-sm">
                  {member.role}
                </span>
              </div>

              <div className="text-brand-secondary font-medium text-sm mb-4">
                {member.specialty}
              </div>
              
              <p className="text-brand-primary/70 mb-4 leading-relaxed text-sm">
                {member.description}
              </p>
              
              <div className="text-xs text-brand-primary/60 border-t border-brand-primary/10 pt-4 mb-4">
                {member.credentials}
              </div>

              {/* Hover Button */}
              <div className={`transition-all duration-300 ${
                hoveredMember === index 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-4'
              }`}>
                <Button
                  onClick={() => handleBookWithProfessional()}
                  className="w-full bg-brand-secondary hover:bg-brand-secondary/90 text-white"
                  size="sm"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Reservar
                </Button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};

export default Team;