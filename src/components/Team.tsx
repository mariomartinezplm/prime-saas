import teamKinesiologo from "@/assets/team-kinesiologo.jpg";
import teamTrainer from "@/assets/team-trainer.jpg";
import teamCoordinator from "@/assets/team-coordinator.jpg";

const Team = () => {
  const team = [
    {
      name: "Dr. Carlos Mendoza",
      role: "Kinesiólogo",
      image: teamKinesiologo,
      description: "Evaluación, rehabilitación basada en ejercicio, retorno deportivo. Especialista en lesiones deportivas.",
      credentials: "Kinesiólogo UC • Magíster en Medicina Deportiva"
    },
    {
      name: "María González",
      role: "Entrenadora",
      image: teamTrainer,
      description: "Programación de fuerza y acondicionamiento en menos de 60 minutos. Experta en optimización de tiempo.",
      credentials: "Educadora Física UACh • Cert. Strength & Conditioning"
    },
    {
      name: "Sofía Torres",
      role: "Coordinación",
      image: teamCoordinator,
      description: "Agenda, recordatorios, soporte a clientes. Tu primer contacto para resolver cualquier consulta.",
      credentials: "Administración de Empresas • Especialista en Atención al Cliente"
    }
  ];

  return (
    <section id="equipo" className="py-20 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-brand-dark mb-4">
            Nuestro Equipo
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Profesionales especializados comprometidos con tu bienestar y resultados
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {team.map((member, index) => (
            <div key={index} className="bg-card rounded-2xl p-8 text-center shadow-card hover:shadow-lg transition-smooth">
              <div className="relative mb-6">
                <img 
                  src={member.image}
                  alt={`${member.name} - ${member.role}`}
                  className="w-32 h-32 rounded-full mx-auto object-cover border-4 border-brand-soft"
                />
                <div className="absolute inset-0 rounded-full bg-gradient-to-t from-brand-primary/20 to-transparent"></div>
              </div>
              
              <h3 className="text-xl font-bold text-brand-dark mb-2">
                {member.name}
              </h3>
              
              <div className="bg-brand-soft rounded-lg px-4 py-2 inline-block mb-4">
                <span className="text-brand-primary font-semibold">
                  {member.role}
                </span>
              </div>
              
              <p className="text-muted-foreground mb-4 leading-relaxed">
                {member.description}
              </p>
              
              <div className="text-xs text-muted-foreground border-t border-border pt-4">
                {member.credentials}
              </div>
            </div>
          ))}
        </div>

        {/* Team Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-16 bg-brand-soft rounded-2xl p-8">
          <div className="text-center">
            <div className="text-3xl font-bold text-brand-primary mb-2">15+</div>
            <div className="text-sm text-muted-foreground">Años experiencia combinada</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-brand-primary mb-2">500+</div>
            <div className="text-sm text-muted-foreground">Clientes atendidos</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-brand-primary mb-2">95%</div>
            <div className="text-sm text-muted-foreground">Tasa de éxito</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-brand-primary mb-2">24/7</div>
            <div className="text-sm text-muted-foreground">Soporte WhatsApp</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Team;