import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const WhatsAppFloat = () => {
  const whatsappUrl = "https://wa.me/56956286651?text=Hola%20quiero%20agendar";

  return (
    <>
      {/* Mobile Floating Button */}
      <div className="fixed bottom-6 right-6 z-50 md:hidden">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1, type: "spring", stiffness: 200 }}
        >
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <Button
              onClick={() => window.open(whatsappUrl, '_blank')}
              className="bg-[#25D366] hover:bg-[#20BD5C] text-white shadow-2xl h-16 w-16 rounded-full p-0 relative overflow-hidden"
            >
              {/* Ripple effect */}
              <motion.div
                className="absolute inset-0 bg-white/30 rounded-full"
                animate={{
                  scale: [0, 2],
                  opacity: [0.5, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeOut"
                }}
              />
              <MessageCircle className="w-7 h-7 relative z-10" />
            </Button>
          </motion.div>
        </motion.div>
      </div>

      {/* Desktop Floating Button */}
      <div className="hidden md:block fixed bottom-8 right-8 z-50">
        <motion.div
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 1.5, type: "spring", stiffness: 100 }}
        >
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              onClick={() => window.open(whatsappUrl, '_blank')}
              className="bg-[#25D366] hover:bg-[#20BD5C] text-white shadow-2xl px-6 py-6 text-lg font-semibold rounded-full relative overflow-hidden group"
            >
              {/* Shine effect */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full"
                animate={{ translateX: ["-100%", "200%"] }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  repeatDelay: 3,
                  ease: "easeInOut"
                }}
              />
              <div className="flex items-center gap-2 relative z-10">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{
                    duration: 0.5,
                    repeat: Infinity,
                    repeatDelay: 3,
                  }}
                >
                  <MessageCircle className="w-6 h-6" />
                </motion.div>
                ¡Agenda ahora!
              </div>
            </Button>
          </motion.div>

          {/* Attention indicator */}
          <motion.div
            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [1, 0.8, 1],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </motion.div>
      </div>
    </>
  );
};

export default WhatsAppFloat;