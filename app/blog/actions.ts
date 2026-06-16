"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getBlogTagsFromText, parseBlogImages, stringifyBlogImages, stringifyBlogTags, type BlogImage } from "@/lib/blog";
import { getTodoMenuDate, startOfLocalDay } from "@/lib/dates";
import { requireCurrentFamilyUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { fileStorage, ImageUploadError } from "@/lib/storage";

const maxBlogImages = 4;
const maxBlogUploadBytes = 20 * 1024 * 1024;
const menuActivityIdPattern = /^auto-menu-(\d{4}-\d{2}-\d{2})(?:-(.+))?$/;

function getBlogImageFiles(formData: FormData) {
  return formData.getAll("images").filter((value): value is File => value instanceof File && value.size > 0);
}

async function saveBlogImages(files: File[]) {
  if (!files.length) return { images: [] as BlogImage[], error: null };
  if (files.length > maxBlogImages) return { images: [] as BlogImage[], error: `一次最多上传 ${maxBlogImages} 张照片。` };

  const totalBytes = files.reduce((total, file) => total + file.size, 0);
  if (totalBytes > maxBlogUploadBytes) {
    return { images: [] as BlogImage[], error: "照片总大小不能超过 20MB，请少选几张或先压缩后上传。" };
  }

  try {
    const images = await Promise.all(files.map(async (file) => ({ url: (await fileStorage.save(file, "blog")).url })));
    return { images, error: null };
  } catch (error) {
    if (error instanceof ImageUploadError) {
      return { images: [] as BlogImage[], error: error.message };
    }

    throw error;
  }
}

function redirectToBlogImageError(message: string) {
  const params = new URLSearchParams({ imageError: message });
  redirect(`/blog?${params.toString()}`);
}

export async function createBlogMessage(formData: FormData) {
  const user = await requireCurrentFamilyUser();
  const content = String(formData.get("content") ?? "").trim();
  if (!content) return;
  const imageResult = await saveBlogImages(getBlogImageFiles(formData));
  if (imageResult.error) redirectToBlogImageError(imageResult.error);

  await prisma.blogPost.create({
    data: {
      authorId: user.id,
      title: `${user.name} 的留言`,
      content,
      kind: "MESSAGE",
      images: stringifyBlogImages(imageResult.images),
      tags: stringifyBlogTags(getBlogTagsFromText(String(formData.get("tags") ?? ""))),
    },
  });

  revalidatePath("/");
  revalidatePath("/blog");
  redirect("/blog");
}

export async function updateBlogMessage(postId: string, content: string) {
  const user = await requireCurrentFamilyUser();
  const nextContent = content.trim();
  if (!nextContent) return { ok: false, error: "小记内容不能为空。" };

  const post = await prisma.blogPost.findUnique({
    where: { id: postId },
    select: {
      id: true,
      authorId: true,
      kind: true,
    },
  });

  if (!post) return { ok: false, error: "这条小记已经不存在。" };
  if (post.kind !== "MESSAGE") return { ok: false, error: "系统记录不能在这里编辑。" };
  if (post.authorId !== user.id && user.role !== "ADMIN") {
    return { ok: false, error: "只能编辑自己写的小记。" };
  }

  await prisma.blogPost.update({
    where: { id: post.id },
    data: { content: nextContent },
  });

  revalidatePath("/");
  revalidatePath("/blog");

  return { ok: true, content: nextContent };
}

export async function deleteBlogMessage(postId: string) {
  const user = await requireCurrentFamilyUser();
  const post = await prisma.blogPost.findUnique({
    where: { id: postId },
    select: {
      id: true,
      authorId: true,
      kind: true,
    },
  });

  if (!post) return { ok: false, error: "这条小记已经不存在。" };
  if (post.kind !== "MESSAGE") return { ok: false, error: "系统记录不能在这里删除。" };
  if (post.authorId !== user.id && user.role !== "ADMIN") {
    return { ok: false, error: "只能删除自己写的小记。" };
  }

  await prisma.$transaction([
    prisma.timelineEvent.updateMany({
      where: { sourceBlogPostId: post.id },
      data: { sourceBlogPostId: null },
    }),
    prisma.blogPost.delete({ where: { id: post.id } }),
  ]);
  revalidatePath("/");
  revalidatePath("/blog");
  revalidatePath("/timeline");

  return { ok: true };
}

export async function createBlogComment(postId: string, content: string) {
  const user = await requireCurrentFamilyUser();
  const nextContent = content.trim();
  if (!nextContent) return { ok: false, error: "评论内容不能为空。" };

  const post = await prisma.blogPost.findUnique({
    where: { id: postId },
    select: {
      id: true,
      kind: true,
    },
  });

  if (!post) return { ok: false, error: "这条小记已经不存在。" };
  if (post.kind !== "MESSAGE") return { ok: false, error: "只能在小记下评论。" };

  const comment = await prisma.comment.create({
    data: {
      postId: post.id,
      authorId: user.id,
      content: nextContent,
    },
    include: {
      author: true,
    },
  });

  revalidatePath("/");
  revalidatePath("/blog");

  return {
    ok: true,
    comment: {
      id: comment.id,
      content: comment.content,
      authorName: comment.author.name,
      createdAtLabel: formatActionDate(comment.createdAt),
    },
  };
}

export async function createTimelineEventFromBlogMessage(postId: string) {
  const user = await requireCurrentFamilyUser();
  const post = await prisma.blogPost.findUnique({
    where: { id: postId },
    include: { author: true },
  });

  if (!post) return { ok: false, error: "这条小记已经不存在。" };
  if (post.kind !== "MESSAGE") return { ok: false, error: "只有小记可以沉淀到时间轴。" };
  if (post.authorId !== user.id && user.role !== "ADMIN") {
    return { ok: false, error: "只能把自己写的小记放进时间轴。" };
  }

  const existingEvent = await prisma.timelineEvent.findUnique({
    where: { sourceBlogPostId: post.id },
    select: { id: true },
  });

  if (existingEvent) {
    return { ok: true, eventId: existingEvent.id, message: "这条小记已经是重要记忆了。" };
  }

  const event = await prisma.timelineEvent.create({
    data: {
      authorId: post.authorId,
      title: getTimelineTitleFromPost(post.title, post.author.name),
      content: post.content,
      date: startOfLocalDay(post.createdAt),
      images: stringifyBlogImages(parseBlogImages(post.images)),
      sourceBlogPostId: post.id,
    },
  });

  revalidatePath("/blog");
  revalidatePath("/timeline");

  return { ok: true, eventId: event.id, message: "已经设为重要记忆。" };
}

export async function recallMenuActivity(formData: FormData) {
  await requireCurrentFamilyUser();

  const postId = String(formData.get("postId") ?? "").trim();
  const match = postId.match(menuActivityIdPattern);
  if (!match) return;

  const [, dateText, dishId] = match;
  const targetDate = getTodoMenuDate(dateText);
  const post = await prisma.blogPost.findUnique({
    where: { id: postId },
    select: { id: true, kind: true },
  });

  if (!post || post.kind !== "AUTO_RECORD") return;

  const completedItems = await prisma.orderItem.findMany({
    where: {
      status: "COMPLETED",
      ...(dishId ? { dishId } : {}),
      order: { targetDate },
    },
    select: { dishId: true },
  });
  const affectedDishIds = Array.from(new Set(completedItems.map((item) => item.dishId)));

  await prisma.$transaction([
    prisma.orderItem.updateMany({
      where: {
        status: "COMPLETED",
        ...(dishId ? { dishId } : {}),
        order: { targetDate },
      },
      data: {
        status: "ACTIVE",
        completedAt: null,
        completedById: null,
      },
    }),
    prisma.tomorrowMenu.upsert({
      where: { targetDate },
      update: {
        status: "PENDING",
        completedAt: null,
        cookedById: null,
      },
      create: {
        targetDate,
        status: "PENDING",
      },
    }),
    prisma.blogPost.delete({ where: { id: post.id } }),
  ]);

  revalidatePath("/");
  revalidatePath("/blog");
  revalidatePath("/menu/tomorrow");
  revalidatePath("/menu/shopping-list");
  revalidatePath("/inventory");
  revalidatePath("/menu/dishes");
  for (const affectedDishId of affectedDishIds) revalidatePath(`/menu/dishes/${affectedDishId}`);
}

function formatActionDate(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
  }).format(date);
}

function getTimelineTitleFromPost(title: string, authorName: string) {
  return title.endsWith("的留言") ? `${authorName} 的小记` : title;
}
