import { motion } from "framer-motion";
import { Shield, BadgeCheck, Wallet, Heart } from "lucide-react";

const InsuranceBenefits = () => {
    const benefits = [
        {
            icon: Shield,
            title: "Reembolso Isapres",
            description: "Reembolsable según tu plan de salud"
        },
        {
            icon: Wallet,
            title: "Precios Fonasa",
            description: "Tarifas especiales y accesibles para afiliados"
        },
        {
            icon: BadgeCheck,
            title: "Boletas Electrónicas",
            description: "Documentación inmediata para tu reembolso"
        },
        {
            icon: Heart,
            title: "Sin Listas de Espera",
            description: "Atención rápida cuando más lo necesitas"
        }
    ];

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.15
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 30 },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                type: "spring" as const,
                stiffness: 100,
                damping: 12
            }
        }
    };

    return (
        <section className="py-20 bg-gradient-to-br from-brand-primary via-brand-primary to-brand-dark relative overflow-hidden">
            {/* Animated background elements */}
            <motion.div
                className="absolute top-10 left-10 w-72 h-72 bg-white/5 rounded-full blur-3xl"
                animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.3, 0.5, 0.3],
                }}
                transition={{
                    duration: 8,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
            />
            <motion.div
                className="absolute bottom-10 right-10 w-96 h-96 bg-brand-secondary/10 rounded-full blur-3xl"
                animate={{
                    scale: [1.2, 1, 1.2],
                    opacity: [0.2, 0.4, 0.2],
                }}
                transition={{
                    duration: 10,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
            />

            <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <motion.div
                    className="text-center mb-16"
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                >
                    <motion.span
                        className="inline-block bg-brand-secondary/20 text-brand-secondary px-4 py-2 rounded-full text-sm font-semibold mb-6"
                        initial={{ opacity: 0, scale: 0.8 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 }}
                    >
                        💰 Tu Salud No Tiene Por Qué Ser Cara
                    </motion.span>

                    <h2 className="text-3xl lg:text-5xl font-bold text-white mb-6 leading-tight">
                        Recupera Tu Inversión en{" "}
                        <span className="text-brand-secondary">Salud</span>
                    </h2>

                    <p className="text-xl text-white/80 max-w-3xl mx-auto leading-relaxed">
                        Todos nuestros servicios de kinesiología son <strong className="text-white">reembolsables con Isapres</strong>.
                        Además, ofrecemos <strong className="text-white">precios especiales para Fonasa</strong> porque
                        creemos que cuidar tu cuerpo debe ser accesible para todos.
                    </p>
                </motion.div>

                <motion.div
                    className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6"
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-50px" }}
                >
                    {benefits.map((benefit, index) => (
                        <motion.div
                            key={index}
                            variants={itemVariants}
                            whileHover={{
                                scale: 1.05,
                                y: -8,
                                transition: { type: "spring", stiffness: 400 }
                            }}
                            className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-colors duration-300 cursor-default"
                        >
                            <motion.div
                                className="bg-brand-secondary/20 rounded-xl p-4 w-fit mb-4"
                                whileHover={{ rotate: [0, -10, 10, 0] }}
                                transition={{ duration: 0.5 }}
                            >
                                <benefit.icon className="w-8 h-8 text-brand-secondary" />
                            </motion.div>
                            <h3 className="text-lg font-bold text-white mb-2">
                                {benefit.title}
                            </h3>
                            <p className="text-white/70 text-sm leading-relaxed">
                                {benefit.description}
                            </p>
                        </motion.div>
                    ))}
                </motion.div>

                <motion.div
                    className="mt-12 text-center"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.6 }}
                >
                    <p className="text-white/60 text-sm">
                        * Los reembolsos dependen de tu plan de salud específico. Consulta con tu Isapre para más detalles.
                    </p>
                </motion.div>
            </div>
        </section>
    );
};

export default InsuranceBenefits;
