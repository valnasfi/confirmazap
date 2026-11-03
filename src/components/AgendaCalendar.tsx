import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

export default function AgendaCalendar({ events, onClick, slotMin = "08:00:00", slotMax = "19:00:00", hiddenDays = [0] }: { events: Record<string, unknown>[]; onClick: (id: string) => void; slotMin?: string; slotMax?: string; hiddenDays?: number[] }) {
  return (
    <FullCalendar
      plugins={[timeGridPlugin, interactionPlugin]}
      initialView="timeGridWeek"
      locale="pt-br"
      headerToolbar={{ left: "prev,next today", center: "title", right: "timeGridDay,timeGridWeek" }}
      slotMinTime={slotMin}
      slotMaxTime={slotMax}
      hiddenDays={hiddenDays}
      allDaySlot={false}
      height="auto"
      events={events}
      eventClick={(a: { event: { id: string } }) => onClick(a.event.id)}
    />
  );
}
