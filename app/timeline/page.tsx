import { CalendarPlus, Heart, ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { formatDateInputValue, startOfLocalDay } from "@/lib/dates";
import { requireCurrentFamilyUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { formatTimelineEventDate, parseTimelineImages } from "@/lib/timeline";
import { createTimelineEvent, featureBlogPostAsTimelineEvent } from "./actions";
import { TimelineFeed, type TimelineEventView } from "./timeline-feed";

export const dynamic = "force-dynamic";

export default async function TimelinePage({ searchParams }: { searchParams?: Promise<{ imageError?: string }> }) {
  const params = await searchParams;
  const currentUser = await requireCurrentFamilyUser();
  const [events, featuredSources] = await Promise.all([
    prisma.timelineEvent.findMany({
      include: { author: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    prisma.timelineEvent.findMany({
      where: { sourceBlogPostId: { not: null } },
      select: { sourceBlogPostId: true },
    }),
  ]);
  const featuredSourceIds = featuredSources.map((event) => event.sourceBlogPostId).filter((id): id is string => Boolean(id));
  const latestJournalPosts = await prisma.blogPost.findMany({
    where: {
      kind: "MESSAGE",
      id: { notIn: featuredSourceIds },
      ...(currentUser.role === "ADMIN" ? {} : { authorId: currentUser.id }),
    },
    include: { author: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const timelineEvents: TimelineEventView[] = events.map((event) => ({
    id: event.id,
    title: event.title,
    content: event.content,
    authorName: event.author.name,
    date: event.date,
    dateLabel: formatTimelineEventDate(event.date),
    dateInputValue: formatDateInputValue(event.date),
    images: parseTimelineImages(event.images),
    sourceBlogPostId: event.sourceBlogPostId,
    canDelete: event.authorId === currentUser.id || currentUser.role === "ADMIN",
  }));

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-5 sm:py-8">
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-semibold text-stone-950">曲奇堡时间轴</h1>
          <Badge className="bg-amber-50 text-amber-900">精选档案</Badge>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
          时间轴只保存值得多年后再看的节点。日常先写在日记里，重要的再从小记沉淀到这里。
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
        <aside className="grid gap-4 lg:sticky lg:top-20">
          <details className="rounded-xl bg-white ring-1 ring-stone-200">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 marker:hidden">
              <div>
                <h2 className="text-lg font-semibold text-stone-950">补录重要记忆</h2>
                <p className="mt-1 text-sm text-stone-500">旅行、生日、第一次，这类节点放这里。</p>
              </div>
              <CalendarPlus size={20} className="text-amber-700" />
            </summary>
            <div className="border-t border-stone-100 p-4">
              <form action={createTimelineEvent} className="grid gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-stone-950">手动补一条档案</h3>
                    <p className="mt-1 text-sm text-stone-500">当前身份：{currentUser.name}</p>
                  </div>
                </div>

                <label className="grid gap-1.5 text-sm font-medium text-stone-700">
                  日期
                  <Input name="date" type="date" defaultValue={formatDateInputValue(startOfLocalDay(new Date()))} required />
                </label>

                <label className="grid gap-1.5 text-sm font-medium text-stone-700">
                  标题
                  <Input name="title" placeholder="比如：第一次上线曲奇堡" required />
                </label>

                <label className="grid gap-1.5 text-sm font-medium text-stone-700">
                  内容
                  <Textarea name="content" placeholder="写下发生了什么、谁在场、当时的感觉。" required />
                </label>

                <label className="grid gap-1.5 text-sm font-medium text-stone-700">
                  照片
                  <Input name="images" type="file" accept="image/*" multiple />
                  <span className="text-xs font-normal leading-5 text-stone-400">最多 4 张，总大小不超过 20MB，会自动压缩保存。</span>
                </label>

                {params?.imageError ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{params.imageError}</p> : null}

                <Button type="submit" className="mt-1">
                  留作重要记忆
                </Button>
              </form>
            </div>
          </details>

          <Card className="border-stone-200/80 bg-white/75 shadow-none">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <Heart size={16} className="text-rose-400" />
                <h2 className="text-base font-semibold text-stone-700">待整理的小记</h2>
              </div>
              {latestJournalPosts.length ? (
                <ol className="grid gap-3">
                  {latestJournalPosts.map((post) => (
                    <li key={post.id} className="border-b border-stone-100 pb-3 last:border-0 last:pb-0">
                      <p className="line-clamp-2 text-sm leading-6 text-stone-500">{post.content}</p>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs text-stone-400">{post.author.name}</div>
                        <form action={featureBlogPostAsTimelineEvent}>
                          <input type="hidden" name="postId" value={post.id} />
                          <Button type="submit" size="sm" variant="outline" className="h-8 px-2.5 text-xs">
                            设为记忆
                          </Button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="rounded-lg bg-stone-50 px-3 py-3 text-sm leading-6 text-stone-500">
                  暂时没有待整理的小记。可以先去日记里写下日常，之后再挑重要的留下来。
                </p>
              )}
            </CardContent>
          </Card>
        </aside>

        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ScrollText size={20} className="text-amber-700" />
              <h2 className="text-xl font-semibold text-stone-950">家里的时间线</h2>
            </div>
            <Badge className="bg-white text-stone-500 ring-1 ring-stone-200">{timelineEvents.length} 件事</Badge>
          </div>
          <TimelineFeed events={timelineEvents} />
        </section>
      </div>
    </main>
  );
}
