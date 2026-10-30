import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventInput, EventClickArg } from "@fullcalendar/core";

export default function AgendaCalendar({ events, onClick }: { events: EventInput[]; onClick: (id: string) => void }) {
  return (
    <FullCalendar
      plugins={[timeGridPlugin, interactionPlugin]}
      initialView="timeGridWeek"
      locale="pt-br"
      headerToolbar={{ left: "prev,next today", center: "title", right: "timeGridDay,timeGridWeek" }}
      buttonText={{ today: "Hoje", day: "Dia", week: "Semana" }}
      slotMinTime="08:00:00"
      slotMaxTime="19:00:00"
      hiddenDays={[0]}
      allDaySlot={false}
      height="auto"
      events={events}
      eventClick={(a: EventClickArg) => onClick(a.event.id)}
    />
  );
}
