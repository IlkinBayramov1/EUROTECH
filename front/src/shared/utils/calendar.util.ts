/**
 * Calendar Integration Utility: Google Calendar & iCalendar (.ics) generator
 */

export interface CalendarEvent {
  title: string;
  description: string;
  location: string;
  startDate: Date;
  durationMinutes?: number;
}

function formatDateToIsoBasic(d: Date): string {
  return d.toISOString().replace(/-|:|\.\d+/g, '');
}

/**
 * Creates direct URL to add event to Google Calendar
 */
export function createGoogleCalendarUrl(event: CalendarEvent): string {
  const start = event.startDate;
  const end = new Date(start.getTime() + (event.durationMinutes || 60) * 60000);

  const startIso = formatDateToIsoBasic(start);
  const endIso = formatDateToIsoBasic(end);

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    details: event.description,
    location: event.location,
    dates: `${startIso}/${endIso}`,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Creates and triggers download of standard RFC 5545 .ics calendar pass
 */
export function downloadIcsFile(event: CalendarEvent, filename = 'eurotech_consular_appointment.ics'): void {
  const start = event.startDate;
  const end = new Date(start.getTime() + (event.durationMinutes || 60) * 60000);

  const startIso = formatDateToIsoBasic(start);
  const endIso = formatDateToIsoBasic(end);
  const nowIso = formatDateToIsoBasic(new Date());

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EuroTech Services//Consular Mobility Pass//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:eurotech-${Date.now()}@eurotech.services`,
    `DTSTAMP:${nowIso}`,
    `DTSTART:${startIso}`,
    `DTEND:${endIso}`,
    `SUMMARY:${event.title.replace(/\n/g, ' ')}`,
    `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`,
    `LOCATION:${event.location.replace(/\n/g, ' ')}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT24H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Consular Biometrics Appointment in 24 Hours',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
