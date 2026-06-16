export type TimelineEventInput = {
  date: Date;
};

export type TimelineImage = {
  url: string;
};

export type TimelineMonthGroup<T extends TimelineEventInput> = {
  month: number;
  monthLabel: string;
  events: T[];
};

export type TimelineYearGroup<T extends TimelineEventInput> = {
  year: number;
  months: TimelineMonthGroup<T>[];
};

export function groupTimelineEvents<T extends TimelineEventInput>(events: T[]): TimelineYearGroup<T>[] {
  const years = new Map<number, Map<number, T[]>>();

  for (const event of events) {
    const year = event.date.getFullYear();
    const month = event.date.getMonth() + 1;

    if (!years.has(year)) years.set(year, new Map());
    const months = years.get(year);
    if (!months?.has(month)) months?.set(month, []);
    months?.get(month)?.push(event);
  }

  return Array.from(years.entries())
    .sort(([yearA], [yearB]) => yearB - yearA)
    .map(([year, months]) => ({
      year,
      months: Array.from(months.entries())
        .sort(([monthA], [monthB]) => monthB - monthA)
        .map(([month, monthEvents]) => ({
          month,
          monthLabel: `${month}月`,
          events: [...monthEvents].sort((eventA, eventB) => eventB.date.getTime() - eventA.date.getTime()),
        })),
    }));
}

export function formatTimelineEventDate(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
  }).format(date);
}

export function parseTimelineImages(value: string | null | undefined): TimelineImage[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => {
        if (typeof item === "string") return { url: item };
        if (item && typeof item === "object" && typeof item.url === "string") return { url: item.url };
        return null;
      })
      .filter((item): item is TimelineImage => Boolean(item?.url));
  } catch {
    return [];
  }
}

export function stringifyTimelineImages(images: TimelineImage[]) {
  return JSON.stringify(images.filter((image) => image.url).map((image) => ({ url: image.url })));
}
