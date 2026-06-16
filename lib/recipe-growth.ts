export type JournalEntryLike = {
  content: string;
  createdAt: Date;
};

export function formatJournalDate(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function buildCookingJournalPrompt(dishName: string) {
  return `今天做${dishName}有什么调整？比如火候、调味、替代食材。`;
}

export function getLatestJournalEntry<T extends JournalEntryLike>(entries: T[]) {
  return [...entries].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;
}

export function sortJournalEntries<T extends JournalEntryLike>(entries: T[]) {
  return [...entries].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}
