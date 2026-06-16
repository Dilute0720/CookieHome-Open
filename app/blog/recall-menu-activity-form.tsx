"use client";

import { Button } from "@/components/ui/button";

type RecallMenuActivityFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  postId: string;
};

export function RecallMenuActivityForm({ action, postId }: RecallMenuActivityFormProps) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm("确定要撤回这条菜单记录吗？对应菜品会重新回到待办菜单。")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="postId" value={postId} />
      <Button
        type="submit"
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs text-stone-500 hover:bg-amber-50 hover:text-amber-900"
      >
        撤回菜单
      </Button>
    </form>
  );
}
