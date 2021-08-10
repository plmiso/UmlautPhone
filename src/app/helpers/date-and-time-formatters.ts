export const minutesDiff = (baseDate: Date, substractDate: Date) => {
  return millisToMinutesAndSeconds(
    baseDate.valueOf() - substractDate.valueOf()
  );
};
export const millisToMinutesAndSeconds = (millis: any) => {
  const minutes = Math.floor(millis / 60000);
  const seconds = +((millis % 60000) / 1000).toFixed(0);
  return seconds == 60
    ? minutes + 1 + ':00'
    : minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
};
