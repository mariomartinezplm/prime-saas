import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      closeButton
      visibleToasts={3}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-popover group-[.toaster]:text-popover-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton: "group-[.toast]:bg-popover group-[.toast]:text-muted-foreground group-[.toast]:border-border",
          // El color del estado va en el borde y el icono; el texto sigue siendo legible
          success: "group-[.toaster]:border-success/50 [&_[data-icon]]:text-success",
          error: "group-[.toaster]:border-destructive/50 [&_[data-icon]]:text-destructive",
          warning: "group-[.toaster]:border-warning/50 [&_[data-icon]]:text-warning",
          info: "group-[.toaster]:border-info/50 [&_[data-icon]]:text-info",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
