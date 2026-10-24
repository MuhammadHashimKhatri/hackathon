"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { announcementSchema } from "@/lib/validation/dashboard";
import { fieldErrorsOf } from "@/lib/validation/auth";
import { formStateFromError, postJson } from "@/lib/api";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormAlert from "@/components/ui/FormAlert";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";

export default function PostAnnouncement() {
  const router = useRouter();
  const { toast } = useToast();
  const [state, setState] = useState({});
  const [pending, startTransition] = useTransition();

  function onSubmit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const parsed = announcementSchema.safeParse({ title: String(data.get("title") ?? ""), body: String(data.get("body") ?? "") });
    if (!parsed.success) {
      setState({ fieldErrors: fieldErrorsOf(parsed.error) });
      return;
    }
    startTransition(async () => {
      const result = await postJson("/api/announcements", parsed.data);
      if (!result.ok) {
        setState(formStateFromError(result, "Posting isn't available right now."));
        return;
      }
      form.reset();
      setState({});
      toast({ tone: "success", title: "Announcement posted", description: "Everyone gets a notification." });
      router.refresh();
    });
  }

  return (
    <Card title="Post an announcement">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormAlert>{state.formError}</FormAlert>
        <Input label="Title" name="title" required error={state.fieldErrors?.title} />
        <Textarea label="Message" name="body" rows={5} required error={state.fieldErrors?.body} />
        <div className="flex justify-end">
          <Button type="submit" variant="primary" icon={Send} loading={pending}>
            Post
          </Button>
        </div>
      </form>
    </Card>
  );
}
