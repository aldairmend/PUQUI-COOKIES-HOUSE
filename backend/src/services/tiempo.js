// RNF-12: fechas y turnos en hora local de Lima (UTC−5, sin horario de verano).
const ZONA = 'America/Lima';
const CORTE_TARDE = 16; // RN-04: el turno de tarde empieza a las 16:00.

function partesLima(fecha = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', weekday: 'short',
    }).formatToParts(fecha).map((x) => [x.type, x.value])
  );
  const dias = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    fecha: `${p.year}-${p.month}-${p.day}`,
    hora: `${p.hour}:${p.minute}`,
    horaNum: Number(p.hour),
    diaSemana: dias[p.weekday],
  };
}

const turnoDeHora = (hora) => (hora >= CORTE_TARDE ? 'tarde' : 'manana');
const franjaActual = (fecha = new Date()) => turnoDeHora(partesLima(fecha).horaNum);

module.exports = { ZONA, CORTE_TARDE, partesLima, turnoDeHora, franjaActual };
