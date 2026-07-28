export function civilToday(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isCivilDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3]);
}

export function isMileage(value: string) {
  return /^\d+(\.\d{1,3})?$/.test(value.trim());
}

export function mileageToMilliMiles(value: string) {
  const [whole, fraction = ''] = value.trim().split('.');
  return (BigInt(whole) * 1_000n + BigInt(fraction.padEnd(3, '0'))).toString();
}

export function formatMilliMiles(value: string, groupThousands = false) {
  const milliMiles = BigInt(value);
  const whole = milliMiles / 1_000n;
  const fraction = (milliMiles % 1_000n).toString().padStart(3, '0').replace(/0+$/, '');
  const wholeText = groupThousands ? whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') : whole.toString();
  return `${wholeText}${fraction ? `.${fraction}` : ''}`;
}
