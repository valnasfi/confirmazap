import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

export default function AgendaCalendar({ events, onClick }: { events: Record<string, unknown>[]; onClick: (id: string) => void }) {
  return (
    <FullCalendar
      plugins={[timeGridPlugin, interactionPlugin]}
      initialView="timeGridWeek"
      locale="pt-br"
      headerToolbar={{ left: "prev,next today", center: "title", right: "timeGridDay,timeGridWeek" }}
      slotMinTime="08:00:00"
      slotMaxTime="19:00:00"
      hiddenDays={[0]}
      allDaySlot={false}
      height="auto"
      events={events}
      eventClick={(a: { event: { id: string } }) => onClick(a.event.id)}
    />
  );
}
