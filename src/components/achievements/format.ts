import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export const formatDay = (iso: string) => format(parseISO(iso), "d 'de' MMMM 'de' yyyy", { locale: es });
export const formatNumber = (n: number) => n.toLocaleString('es-CL', { maximumFractionDigits: 1 });
