"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Ellipsis, Image as ImageIcon, MessageCircle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { resolveStoredFileUrl } from "@/lib/storage-url";
import type { BlogImage } from "@/lib/blog";
import { createBlogComment, createTimelineEventFromBlogMessage, deleteBlogMessage, updateBlogMessage } from "./actions";

export type JournalCommentView = {
  id: string;
  content: string;
  authorName: string;
  createdAtLabel: string;
};

export type JournalPostView = {
  id: string;
  title: string;
  content: string;
  images: BlogImage[];
  tags: string[];
  authorName: string;
  createdAtLabel: string;
  commentCount: number;
  canDelete: boolean;
  isFeaturedMemory: boolean;
  comments: JournalCommentView[];
};

export function BlogJournalFeed({ posts }: { posts: JournalPostView[] }) {
  const [visiblePosts, setVisiblePosts] = useState(posts);

  if (!visiblePosts.length) {
    return <p className="rounded-lg bg-white p-4 text-sm text-stone-500 ring-1 ring-stone-200">还没有小记。今天的一点点心情，也可以先放在这里。</p>;
  }

  return (
    <div className="space-y-4">
      {visiblePosts.map((post) => (
        <JournalPostCard key={post.id} post={post} onDeleted={() => setVisiblePosts((current) => current.filter((item) => item.id !== post.id))} />
      ))}
    </div>
  );
}

function JournalPostCard({ post, onDeleted }: { post: JournalPostView; onDeleted: () => void }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(post.content);
  const [editContent, setEditContent] = useState(post.content);
  const [comments, setComments] = useState(post.comments);
  const [commentContent, setCommentContent] = useState("");
  const [commentError, setCommentError] = useState("");
  const [error, setError] = useState("");
  const [timelineMessage, setTimelineMessage] = useState("");
  const [isFeaturedMemory, setIsFeaturedMemory] = useState(post.isFeaturedMemory);
  const [isPending, startTransition] = useTransition();

  function handleEdit() {
    setError("");
    startTransition(async () => {
      try {
        const result = await updateBlogMessage(post.id, editContent);
        if (result.ok) {
          setContent(result.content ?? editContent.trim());
          setEditing(false);
          router.refresh();
          return;
        }
        setError(result.error ?? "保存失败，请稍后再试。");
      } catch {
        setError("保存失败，请稍后再试。");
      }
    });
  }

  function handleDelete() {
    setError("");
    startTransition(async () => {
      try {
        const result = await deleteBlogMessage(post.id);
        if (result.ok) {
          onDeleted();
          router.refresh();
          return;
        }
        setError(result.error ?? "删除失败，请稍后再试。");
        setConfirming(false);
      } catch {
        setError("删除失败，请稍后再试。");
        setConfirming(false);
      }
    });
  }

  function handleAddToTimeline() {
    setError("");
    setTimelineMessage("");
    startTransition(async () => {
      try {
        const result = await createTimelineEventFromBlogMessage(post.id);
        if (result.ok) {
          setIsFeaturedMemory(true);
          setTimelineMessage(result.message ?? "已经设为重要记忆。");
          router.refresh();
          return;
        }
        setError(result.error ?? "加入时间轴失败，请稍后再试。");
      } catch {
        setError("加入时间轴失败，请稍后再试。");
      }
    });
  }

  function handleComment() {
    setCommentError("");
    startTransition(async () => {
      try {
        const result = await createBlogComment(post.id, commentContent);
        if (result.ok && result.comment) {
          setComments((current) => [...current, result.comment]);
          setCommentContent("");
          router.refresh();
          return;
        }
        setCommentError(result.error ?? "评论失败，请稍后再试。");
      } catch {
        setCommentError("评论失败，请稍后再试。");
      }
    });
  }

  return (
    <Card>
      <CardContent className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-xl font-semibold leading-7 text-stone-950">{post.title}</h3>
            <div className="mt-1 text-sm text-stone-400">
              {post.authorName} · {post.createdAtLabel} · {comments.length} 条评论
            </div>
          </div>
          <div className="flex shrink-0 items-start gap-2">
            <Badge className="bg-amber-50 text-amber-900">
              <MessageCircle size={14} />
              小记
            </Badge>
            {post.canDelete ? (
              <div className="relative">
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-stone-400 hover:bg-stone-50 hover:text-stone-700"
                  aria-label="更多操作"
                  onClick={() => {
                    setMenuOpen((value) => !value);
                    setConfirming(false);
                    setError("");
                  }}
                >
                  <Ellipsis size={18} />
                </button>
                {menuOpen ? (
                  <div className="absolute right-0 top-9 z-10 w-32 rounded-lg bg-white p-1 text-sm shadow-lg ring-1 ring-stone-200">
                    <button
                      type="button"
                      className="w-full rounded-md px-3 py-2 text-left text-stone-700 hover:bg-stone-50"
                      disabled={isFeaturedMemory}
                      onClick={() => {
                        setMenuOpen(false);
                        setConfirming(false);
                        handleAddToTimeline();
                      }}
                    >
                      {isFeaturedMemory ? "已是重要记忆" : "设为重要记忆"}
                    </button>
                    <button
                      type="button"
                      className="w-full rounded-md px-3 py-2 text-left text-stone-700 hover:bg-stone-50"
                      onClick={() => {
                        setEditing(true);
                        setEditContent(content);
                        setMenuOpen(false);
                        setConfirming(false);
                        setError("");
                      }}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className="w-full rounded-md px-3 py-2 text-left text-stone-700 hover:bg-stone-50"
                      onClick={() => {
                        setConfirming(true);
                        setMenuOpen(false);
                      }}
                    >
                      删除
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {editing ? (
          <div className="mt-4 grid gap-3">
            <Textarea value={editContent} onChange={(event) => setEditContent(event.target.value)} aria-label="编辑小记内容" />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  setEditContent(content);
                  setError("");
                }}
                disabled={isPending}
              >
                取消
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={handleEdit} disabled={isPending}>
                {isPending ? "保存中" : "保存修改"}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-4 whitespace-pre-wrap text-base leading-8 text-stone-700">{content}</p>
            <BlogImageGrid images={post.images} />
            {post.tags.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-stone-50 px-2.5 py-1 text-xs text-stone-500 ring-1 ring-stone-200">
                    #{tag}
                  </span>
                ))}
              </div>
            ) : null}
          </>
        )}

        {confirming ? (
          <div className="mt-4 rounded-lg bg-stone-50 p-3 ring-1 ring-stone-200">
            <p className="text-sm text-stone-700">确定要删除这条小记吗？删除后不可恢复。</p>
            <div className="mt-3 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={isPending}>
                取消
              </Button>
              <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={isPending}>
                {isPending ? "删除中" : "确认删除"}
              </Button>
            </div>
          </div>
        ) : null}

        {error ? <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        {isFeaturedMemory && !timelineMessage ? (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-sm text-amber-900">
            <Sparkles size={14} />
            已收藏到时间轴
          </p>
        ) : null}
        {timelineMessage ? (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-sm text-amber-900">
            <Sparkles size={14} />
            {timelineMessage}
          </p>
        ) : null}

        <div className="mt-5 border-t border-stone-100 pt-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h4 className="text-sm font-medium text-stone-700">评论楼</h4>
            <span className="text-xs text-stone-400">{comments.length} 层</span>
          </div>
          {comments.length ? (
            <ol className="grid gap-2">
              {comments.map((comment, index) => (
                <li key={comment.id} className="rounded-lg bg-stone-50 px-3 py-2">
                  <div className="text-xs text-stone-400">
                    {index + 1}楼 · {comment.authorName} · {comment.createdAtLabel}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-stone-700">{comment.content}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-500">还没有评论，来盖第一层楼吧。</p>
          )}
          <div className="mt-3 grid gap-2">
            <Textarea
              value={commentContent}
              onChange={(event) => setCommentContent(event.target.value)}
              placeholder="写一条回应，比如：这个我也想吃。"
              aria-label="写评论"
              className="min-h-20"
            />
            <div className="flex justify-end">
              <Button type="button" variant="outline" size="sm" onClick={handleComment} disabled={isPending || !commentContent.trim()}>
                {isPending ? "发布中" : "盖一层"}
              </Button>
            </div>
            {commentError ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{commentError}</p> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BlogImageGrid({ images }: { images: BlogImage[] }) {
  const resolvedImages = images
    .map((image) => ({ ...image, url: resolveStoredFileUrl(image.url) }))
    .filter((image): image is { url: string } => Boolean(image.url));

  if (!resolvedImages.length) return null;

  return (
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {resolvedImages.map((image, index) => (
        <a
          key={`${image.url}-${index}`}
          href={image.url}
          target="_blank"
          rel="noreferrer"
          className="group relative overflow-hidden rounded-lg bg-stone-100 ring-1 ring-stone-200"
        >
          <Image
            src={image.url}
            alt="小记照片"
            width={420}
            height={420}
            unoptimized
            className="aspect-square w-full object-cover transition-transform group-hover:scale-[1.02]"
          />
          <span className="absolute bottom-2 right-2 rounded-full bg-white/90 p-1.5 text-stone-500 shadow-sm">
            <ImageIcon size={14} />
          </span>
        </a>
      ))}
    </div>
  );
}
