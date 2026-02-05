import { Calendar } from '@/components/ui/calendar';
import { es } from 'date-fns/locale';

interface CalendarViewProps {
  selectedDate: Date | undefined;
  onSelect: (date: Date | undefined) => void;
  disabledDate?: (date: Date) => boolean;
}

const CalendarView = ({ selectedDate, onSelect, disabledDate }: CalendarViewProps) => {
  return (
    <Calendar
      mode="single"
      selected={selectedDate}
      onSelect={onSelect}
      locale={es}
      disabled={(date) => {
        // Disable past dates
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (date < today) return true;
        // Disable weekends
        const day = date.getDay();
        if (day === 0 || day === 6) return true;
        // Custom disabled check
        if (disabledDate) return disabledDate(date);
        return false;
      }}
      className="rounded-md border"
    />
  );
};

export default CalendarView;
