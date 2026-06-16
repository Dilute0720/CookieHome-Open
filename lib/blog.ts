import { parseTimelineImages, stringifyTimelineImages, type TimelineImage } from "@/lib/timeline";

export type BlogImage = TimelineImage;

export function parseBlogImages(value: string | null | undefined): BlogImage[] {
  return parseTimelineImages(value);
}

export function stringifyBlogImages(images: BlogImage[]) {
  return stringifyTimelineImages(images);
}

export function parseBlogTags(value: string | null | undefined): string[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(String).map(normalizeBlogTag).filter(Boolean);
  } catch {
    return [];
  }
}

export function stringifyBlogTags(tags: string[]) {
  return JSON.stringify(normalizeBlogTags(tags));
}

export function getBlogTagsFromText(value: string | null | undefined) {
  return normalizeBlogTags(String(value ?? "").split(/[\s,，#]+/));
}

function normalizeBlogTags(tags: string[]) {
  return Array.from(new Set(tags.map(normalizeBlogTag).filter(Boolean))).slice(0, 8);
}

function normalizeBlogTag(value: string) {
  return value.trim().replace(/^#/, "");
}
