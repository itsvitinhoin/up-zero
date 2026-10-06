export function localDateTimeToIso(value: string, timezone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Escolha uma data e horário válidos.')
  const desired = Date.parse(`${value}:00Z`)
  let actual = desired
  const formatter = new Intl.DateTimeFormat('sv-SE', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
  for (let attempt = 0; attempt < 3; attempt++) {
    const represented = Date.parse(`${formatter.format(new Date(actual)).replace(' ', 'T')}Z`)
    actual += desired - represented
  }
  if (formatter.format(new Date(actual)).slice(0, 16).replace(' ', 'T') !== value) throw new Error('Este horário não existe no fuso escolhido.')
  return new Date(actual).toISOString()
}
export function isoToLocalDateTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value)).replace(' ', 'T')
}
