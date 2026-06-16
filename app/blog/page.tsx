import { MessageCircle, ScrollText, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { parseBlogImages, parseBlogTags } from "@/lib/blog";
import { requireCurrentFamilyUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { createBlogMessage, recallMenuActivity } from "./actions";
import { BlogJournalFeed, type JournalPostView } from "./blog-journal-feed";
import { RecallMenuActivityForm } from "./recall-menu-activity-form";

export const dynamic = "force-dynamic";

export default async function BlogPage({ searchParams }: { searchParams?: Promise<{ imageError?: string }> }) {
  const params = await searchParams;
  const currentUser = await requireCurrentFamilyUser();
  const [messagePosts, activityPosts, featuredSources] = await Promise.all([
    prisma.blogPost.findMany({
      where: { kind: "MESSAGE" },
      include: {
        author: true,
        comments: {
          include: { author: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.blogPost.findMany({
      where: { kind: "AUTO_RECORD" },
      include: { author: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.timelineEvent.findMany({
      where: { sourceBlogPostId: { not: null } },
      select: { sourceBlogPostId: true },
    }),
  ]);
  const featuredSourceIds = new Set(featuredSources.map((event) => event.sourceBlogPostId).filter((id): id is string => Boolean(id)));

  const journalPosts: JournalPostView[] = messagePosts.map((post) => ({
    id: post.id,
    title: getJournalTitle(post.title, post.author.name),
    content: post.content,
    images: parseBlogImages(post.images),
    tags: parseBlogTags(post.tags),
    authorName: post.author.name,
    createdAtLabel: formatBlogDate(post.createdAt),
    commentCount: post.comments.length,
    canDelete: post.authorId === currentUser.id || currentUser.role === "ADMIN",
    isFeaturedMemory: featuredSourceIds.has(post.id),
    comments: post.comments.map((comment) => ({
      id: comment.id,
      content: comment.content,
      authorName: comment.author.name,
      createdAtLabel: formatBlogDate(comment.createdAt),
    })),
  }));

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-5 sm:py-8">
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-semibold text-stone-950">曲奇堡日记</h1>
          <Badge className="bg-amber-50 text-amber-900">日常流</Badge>
        </div>
        <p className="mt-2 text-sm tracking-wide text-stone-500">所思 所想 所行 所悟</p>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
          小记负责装下每天的生活和聊天，真正想长期保存的，再设为时间轴里的重要记忆。
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
        <div className="grid gap-5">
          <Card>
            <CardContent>
              <form action={createBlogMessage} className="grid gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-stone-950">今天想记点什么？</h2>
                    <p className="mt-1 text-sm text-stone-500">当前身份：{currentUser.name}</p>
                  </div>
                  <Badge className="bg-amber-50 text-amber-900">
                    <MessageCircle size={14} />
                    小记
                  </Badge>
                </div>
                <Textarea name="content" placeholder="比如：今天的空心菜炒得很好吃，明天想吃鸡蛋羹。" required />
                <label className="grid gap-1.5 text-sm font-medium text-stone-700">
                  标签
                  <Input name="tags" placeholder="比如：晚饭 长沙旅行 生日" />
                  <span className="text-xs font-normal leading-5 text-stone-400">用空格或逗号分隔，最多保留 8 个。</span>
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-stone-700">
                  照片
                  <Input name="images" type="file" accept="image/*" multiple />
                  <span className="text-xs font-normal leading-5 text-stone-400">最多 4 张，总大小不超过 20MB，会自动压缩保存。</span>
                </label>
                {params?.imageError ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{params.imageError}</p> : null}
                <div className="flex justify-end">
                  <Button type="submit">记下来</Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-amber-700" />
                <h2 className="text-xl font-semibold text-stone-950">最近的小记</h2>
              </div>
              <Badge className="bg-white text-stone-500 ring-1 ring-stone-200">{journalPosts.length} 条日常</Badge>
            </div>
            <BlogJournalFeed posts={journalPosts} />
          </section>
        </div>

        <aside className="lg:sticky lg:top-20">
          <Card className="border-stone-200/80 bg-white/75 shadow-none">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <ScrollText size={16} className="text-stone-400" />
                <h2 className="text-base font-semibold text-stone-700">最近的小动静</h2>
              </div>
              {activityPosts.length ? (
                <ol className="grid gap-3">
                  {activityPosts.map((post) => (
                    <li key={post.id} className="border-b border-stone-100 pb-3 last:border-0 last:pb-0">
                      <p className="text-sm leading-6 text-stone-500">{post.content}</p>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs text-stone-400">{formatBlogDate(post.createdAt)}</div>
                        {canRecallMenuActivity(post.id) ? <RecallMenuActivityForm action={recallMenuActivity} postId={post.id} /> : null}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="rounded-lg bg-stone-50 px-3 py-3 text-sm leading-6 text-stone-500">还没有小动静，点餐和做饭后会自动出现在这里。</p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}

function getJournalTitle(title: string, authorName: string) {
  return title.endsWith("的留言") ? `${authorName} 的小记` : title;
}

function formatBlogDate(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
  }).format(date);
}

function canRecallMenuActivity(id: string) {
  return /^auto-menu-\d{4}-\d{2}-\d{2}(?:-.+)?$/.test(id);
}
