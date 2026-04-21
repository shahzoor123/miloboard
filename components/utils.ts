export const HOUR_HEIGHT = 80;

export const getTopFromTime = (date: string | Date): number => {
  const d = new Date(date);
  return (d.getHours() + d.getMinutes() / 60) * HOUR_HEIGHT;
};

export const getHeightFromTime = (
  start: string,
  end: string
): number => {
  const diff =
    (new Date(end).getTime() -
      new Date(start).getTime()) /
    (1000 * 60 * 60);

  return diff * HOUR_HEIGHT;
};

export const pixelsToTime = (top: number) => {
  const totalHours = top / HOUR_HEIGHT;
  const hours = Math.floor(totalHours);
  const minutes = Math.round((totalHours - hours) * 60);

  return { hours, minutes };
};