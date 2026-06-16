"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, CalendarDays, Ellipsis, Image as ImageIcon, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { resolveStoredFileUrl } from "@/lib/storage-url";
import { groupTimelineEvents, type TimelineImage } from "@/lib/timeline";
import { deleteTimelineEvent, updateTimelineEvent } from "./actions";

export type TimelineEventView = {
  id: string;
  title: string;
  content: string;
  authorName: string;
  date: Date;
  dateLabel: string;
  dateInputValue: string;
  images: TimelineImage[];
  sourceBlogPostId: string | null;
  canDelete: boolean;
};

export function TimelineFeed({ events }: { events: TimelineEventView[] }) {
  const [visibleEvents, setVisibleEvents] = useState(events);
  const groups = groupTimelineEvents(visibleEvents);

  if (!visibleEvents.length) {
    return (
      <Card className="border-dashed bg-white/80 shadow-none">
        <CardContent className="p-6 text-sm leading-7 text-stone-500">
          还没有时间轴记忆。可以先记下第一次上线网站、一次旅行，或者一道终于做顺手的菜。
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-7">
      {groups.map((yearGroup) => (
        <section key={yearGroup.year} className="grid gap-4">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-amber-700" />
            <h2 className="text-2xl font-semibold text-stone-950">{yearGroup.year}</h2>
          </div>

          <div className="grid gap-5">
            {yearGroup.months.map((monthGroup) => (
              <div key={`${yearGroup.year}-${monthGroup.month}`} className="grid gap-3 sm:grid-cols-[72px_minmax(0,1fr)]">
                <div className="pt-1 text-sm font-medium text-stone-400">{monthGroup.monthLabel}</div>
                <div className="relative grid gap-3 border-l border-amber-100 pl-4">
                  {monthGroup.events.map((event) => (
                    <TimelineEventCard
                      key={event.id}
                      event={event}
                      onUpdated={(updatedEvent) =>
                        setVisibleEvents((current) => current.map((item) => (item.id === event.id ? { ...item, ...updatedEvent } : item)))
                      }
                      onDeleted={() => setVisibleEvents((current) => current.filter((item) => item.id !== event.id))}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TimelineEventCard({
  event,
  onUpdated,
  onDeleted,
}: {
  event: TimelineEventView;
  onUpdated: (event: Partial<TimelineEventView>) => void;
  onDeleted: () => void;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(event.title);
  const [editContent, setEditContent] = useState(event.content);
  const [editDate, setEditDate] = useState(event.dateInputValue);
  const [retainedImages, setRetainedImages] = useState(event.images.map((image) => image.url));
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [imageInputKey, setImageInputKey] = useState(0);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleEdit() {
    setError("");
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("title", editTitle);
        formData.set("content", editContent);
        formData.set("date", editDate);
        retainedImages.forEach((url) => formData.append("retainedImages", url));
        pendingImages.forEach((file) => formData.append("images", file));

        const result = await updateTimelineEvent(event.id, formData);

        if (result.ok && result.event) {
          onUpdated({
            title: result.event.title,
            content: result.event.content,
            date: new Date(result.event.date),
            dateLabel: result.event.dateLabel,
            dateInputValue: result.event.dateInputValue,
            images: result.event.images,
          });
          setRetainedImages(result.event.images.map((image) => image.url));
          setPendingImages([]);
          setImageInputKey((key) => key + 1);
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
        const result = await deleteTimelineEvent(event.id);
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

  function moveRetainedImage(url: string, direction: -1 | 1) {
    setRetainedImages((current) => {
      const index = current.indexOf(url);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;

      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  return (
    <Card className="relative border-stone-200/80 bg-white/95 shadow-sm">
      <span className="absolute -left-[21px] top-6 h-2.5 w-2.5 rounded-full bg-amber-300 ring-4 ring-[#fffaf3]" />
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-stone-400">
              <CalendarDays size={15} />
              <span>{event.dateLabel}</span>
              <span>·</span>
              <span>{event.authorName}</span>
            </div>
            <h3 className="text-lg font-semibold leading-7 text-stone-950">{event.title}</h3>
          </div>
          <div className="flex shrink-0 items-start gap-2">
            <Badge className="bg-amber-50 text-amber-900">{event.sourceBlogPostId ? "来自小记" : "记忆"}</Badge>
            {event.canDelete ? (
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
                      onClick={() => {
                        setEditing(true);
                        setEditTitle(event.title);
                        setEditContent(event.content);
                        setEditDate(event.dateInputValue);
                        setRetainedImages(event.images.map((image) => image.url));
                        setPendingImages([]);
                        setImageInputKey((key) => key + 1);
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
          <div className="mt-4 grid gap-3 rounded-lg bg-stone-50 p-3 ring-1 ring-stone-200">
            <label className="grid gap-1.5 text-sm font-medium text-stone-700">
              日期
              <Input type="date" value={editDate} onChange={(inputEvent) => setEditDate(inputEvent.target.value)} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-stone-700">
              标题
              <Input value={editTitle} onChange={(inputEvent) => setEditTitle(inputEvent.target.value)} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-stone-700">
              内容
              <Textarea value={editContent} onChange={(inputEvent) => setEditContent(inputEvent.target.value)} />
            </label>
            {event.images.length ? (
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-stone-700">照片顺序</div>
                  <div className="text-xs text-stone-400">移除后保存才会生效</div>
                </div>
                {retainedImages.length ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {retainedImages.map((url, index) => {
                      const image = event.images.find((item) => item.url === url);
                      if (!image) return null;

                      const src = resolveStoredFileUrl(image.url);

                      return src ? (
                        <div key={image.url} className="relative overflow-hidden rounded-lg bg-white ring-1 ring-stone-200">
                          <Image src={src} alt="时间轴照片" width={240} height={240} unoptimized className="aspect-square w-full object-cover" />
                          <div className="absolute inset-x-1 bottom-1 flex items-center justify-between gap-1">
                            <button
                              type="button"
                              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-stone-600 shadow-sm disabled:opacity-35"
                              aria-label="上移照片"
                              disabled={index === 0}
                              onClick={() => moveRetainedImage(image.url, -1)}
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              type="button"
                              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-stone-600 shadow-sm disabled:opacity-35"
                              aria-label="下移照片"
                              disabled={index === retainedImages.length - 1}
                              onClick={() => moveRetainedImage(image.url, 1)}
                            >
                              <ArrowDown size={14} />
                            </button>
                            <button
                              type="button"
                              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-rose-600 shadow-sm"
                              aria-label="移除照片"
                              onClick={() => setRetainedImages((current) => current.filter((item) => item !== image.url))}
                            >
                              <X size={14} />
                            </button>
                          </div>
                          <div className="absolute left-1 top-1 rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-stone-600 shadow-sm">
                            {index + 1}
                          </div>
                        </div>
                      ) : null;
                    })}
                  </div>
                ) : (
                  <p className="rounded-lg bg-white px-3 py-2 text-sm text-stone-500 ring-1 ring-stone-200">这条记忆的旧照片都会移除，可在下面重新追加。</p>
                )}
              </div>
            ) : null}
            <label className="grid gap-1.5 text-sm font-medium text-stone-700">
              追加照片
              <Input key={imageInputKey} type="file" accept="image/*" multiple onChange={(inputEvent) => setPendingImages(Array.from(inputEvent.target.files ?? []))} />
              <span className="text-xs font-normal leading-5 text-stone-400">每条记忆最多保留 4 张照片，总大小不超过 20MB。</span>
            </label>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  setEditTitle(event.title);
                  setEditContent(event.content);
                  setEditDate(event.dateInputValue);
                  setRetainedImages(event.images.map((image) => image.url));
                  setPendingImages([]);
                  setImageInputKey((key) => key + 1);
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
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-700">{event.content}</p>
            <TimelineImageGrid images={event.images} />
          </>
        )}

        {confirming ? (
          <div className="mt-4 rounded-lg bg-stone-50 p-3 ring-1 ring-stone-200">
            <p className="text-sm text-stone-700">确定要删除这条时间轴记忆吗？删除后不可恢复。</p>
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
      </CardContent>
    </Card>
  );
}

function TimelineImageGrid({ images }: { images: TimelineImage[] }) {
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
            alt="时间轴照片"
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
