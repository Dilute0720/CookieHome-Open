"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formatDateInputValue, parseDateInputValue } from "@/lib/dates";
import { requireCurrentFamilyUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { fileStorage, ImageUploadError } from "@/lib/storage";
import { formatTimelineEventDate, parseTimelineImages, stringifyTimelineImages, type TimelineImage } from "@/lib/timeline";
import { createTimelineEventFromBlogMessage } from "@/app/blog/actions";

const maxTimelineImages = 4;
const maxTimelineUploadBytes = 20 * 1024 * 1024;

function getTimelineImageFiles(formData: FormData) {
  return formData.getAll("images").filter((value): value is File => value instanceof File && value.size > 0);
}

async function saveTimelineImages(files: File[]) {
  if (!files.length) return { images: [] as TimelineImage[], error: null };
  if (files.length > maxTimelineImages) return { images: [] as TimelineImage[], error: `一次最多上传 ${maxTimelineImages} 张照片。` };

  const totalBytes = files.reduce((total, file) => total + file.size, 0);
  if (totalBytes > maxTimelineUploadBytes) {
    return { images: [] as TimelineImage[], error: "照片总大小不能超过 20MB，请少选几张或先压缩后上传。" };
  }

  try {
    const images = await Promise.all(files.map(async (file) => ({ url: (await fileStorage.save(file, "timeline")).url })));
    return { images, error: null };
  } catch (error) {
    if (error instanceof ImageUploadError) {
      return { images: [] as TimelineImage[], error: error.message };
    }

    throw error;
  }
}

function redirectToTimelineImageError(message: string) {
  const params = new URLSearchParams({ imageError: message });
  redirect(`/timeline?${params.toString()}`);
}

export async function createTimelineEvent(formData: FormData) {
  const user = await requireCurrentFamilyUser();
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const date = parseDateInputValue(formData.get("date")) ?? new Date();

  if (!title || !content) return;
  const imageResult = await saveTimelineImages(getTimelineImageFiles(formData));
  if (imageResult.error) redirectToTimelineImageError(imageResult.error);

  await prisma.timelineEvent.create({
    data: {
      authorId: user.id,
      title,
      content,
      date,
      images: stringifyTimelineImages(imageResult.images),
    },
  });

  revalidatePath("/");
  revalidatePath("/timeline");
  redirect("/timeline");
}

export async function featureBlogPostAsTimelineEvent(formData: FormData) {
  const postId = String(formData.get("postId") ?? "").trim();
  if (!postId) return;

  await createTimelineEventFromBlogMessage(postId);
}

export async function deleteTimelineEvent(eventId: string) {
  const user = await requireCurrentFamilyUser();
  const event = await prisma.timelineEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      authorId: true,
    },
  });

  if (!event) return { ok: false, error: "这条记忆已经不存在。" };
  if (event.authorId !== user.id && user.role !== "ADMIN") {
    return { ok: false, error: "只能删除自己记录的记忆。" };
  }

  await prisma.timelineEvent.delete({ where: { id: event.id } });
  revalidatePath("/timeline");

  return { ok: true };
}

export async function updateTimelineEvent(eventId: string, formData: FormData) {
  const user = await requireCurrentFamilyUser();
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const date = parseDateInputValue(formData.get("date"));

  if (!title) return { ok: false, error: "记忆标题不能为空。" };
  if (!content) return { ok: false, error: "记忆内容不能为空。" };
  if (!date) return { ok: false, error: "请选择有效日期。" };

  const event = await prisma.timelineEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      authorId: true,
      images: true,
    },
  });

  if (!event) return { ok: false, error: "这条记忆已经不存在。" };
  if (event.authorId !== user.id && user.role !== "ADMIN") {
    return { ok: false, error: "只能编辑自己记录的记忆。" };
  }

  const retainedImageUrls = formData
    .getAll("retainedImages")
    .map(String)
    .map((value) => value.trim())
    .filter(Boolean);
  const currentImages = parseTimelineImages(event.images);
  const retainedImages = retainedImageUrls
    .map((url) => currentImages.find((image) => image.url === url))
    .filter((image): image is TimelineImage => Boolean(image));
  const remainingSlots = maxTimelineImages - retainedImages.length;
  const imageFiles = getTimelineImageFiles(formData);

  if (imageFiles.length > remainingSlots) {
    return { ok: false, error: `这条记忆最多保留 ${maxTimelineImages} 张照片。` };
  }

  const imageResult = await saveTimelineImages(imageFiles);
  if (imageResult.error) return { ok: false, error: imageResult.error };
  const images = [...retainedImages, ...imageResult.images];

  const updated = await prisma.timelineEvent.update({
    where: { id: event.id },
    data: {
      title,
      content,
      date,
      images: stringifyTimelineImages(images),
    },
  });

  revalidatePath("/timeline");

  return {
    ok: true,
    event: {
      title: updated.title,
      content: updated.content,
      date: updated.date.toISOString(),
      dateLabel: formatTimelineEventDate(updated.date),
      dateInputValue: formatDateInputValue(updated.date),
      images: parseTimelineImages(updated.images),
    },
  };
}
