import type { Config } from "tailwindcss";

export default {
  darkMode: 'class',
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'], // Quiet Luxury: For headings
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        coral: {
          DEFAULT: "hsl(var(--coral))",
          foreground: "hsl(var(--coral-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        brand: {
          primary: "hsl(var(--brand-primary))",
          secondary: "hsl(var(--brand-secondary))",
          tertiary: "hsl(var(--brand-tertiary))",
          light: "hsl(var(--brand-light))",
          dark: "hsl(var(--brand-dark))",
        },
        "landing-dark": "hsl(var(--landing-dark))",
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "fade-in-up": {
          from: {
            opacity: "0",
            transform: "translateY(30px)",
          },
          to: {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        "slide-left": {
          from: {
            transform: "translateX(0%)",
          },
          to: {
            transform: "translateX(-100%)",
          },
        },
        // Fase 2A.2 — movimiento del dashboard (ver tokens --motion-* en index.css)
        // Barra de progreso: se descubre de izquierda a derecha hasta su valor real (solo recorte, sin layout)
        "meter-fill": {
          from: { clipPath: "inset(0 100% 0 0 round 9999px)" },
          to: { clipPath: "inset(0 0 0 0 round 9999px)" },
        },
        // Anillo de progreso: el trazo crece desde vacío hasta su valor real (solo stroke-dashoffset, sin layout)
        "ring-fill": {
          from: { strokeDashoffset: "var(--ring-c)" },
        },
        // El contenido real reemplaza a su esqueleto: fundido corto, sin desplazamiento
        "content-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        // Una fila de «Para hoy» entra o sale: se despliega/pliega su alto y se desvanece
        "row-in": {
          from: { gridTemplateRows: "0fr", opacity: "0" },
          to: { gridTemplateRows: "1fr", opacity: "1" },
        },
        "row-out": {
          from: { gridTemplateRows: "1fr", opacity: "1" },
          to: { gridTemplateRows: "0fr", opacity: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in-up": "fade-in-up 0.8s ease-out",
        "slide-left": "slide-left 20s linear infinite",
        "meter-fill": "meter-fill var(--motion-slow) var(--motion-ease-out) backwards",
        "ring-fill": "ring-fill var(--motion-slow) var(--motion-ease-out) backwards",
        "content-in": "content-in var(--motion-fast) var(--motion-ease-out) backwards",
        "row-in": "row-in var(--motion-base) var(--motion-ease-standard) backwards",
        "row-out": "row-out var(--motion-base) var(--motion-ease-standard) forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
