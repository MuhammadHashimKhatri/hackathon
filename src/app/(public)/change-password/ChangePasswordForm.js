"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { changePasswordSchema, fieldErrorsOf } from "@/lib/validation/auth";
import { formStateFromError, postJson } from "@/lib/api";
import Button from "@/components/ui/Button";
import FormAlert from "@/components/ui/FormAlert";
import Input from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

export default function ChangePasswordForm() {
  const router = useRouter();
  const { toast } = useToast();

  const [state, formAction, pending] = useActionState(async (_prev, formData) => {
    const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

    const { currentPassword, newPassword } = parsed.data;
    const result = await postJson("/api/auth/change-password", { currentPassword, newPassword });
    if (!result.ok) return formStateFromError(result, "Changing your password isn't available yet.");

    toast({ title: "Password changed", tone: "success" });
    router.replace("/dashboard");
    return {};
  }, {});

  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <FormAlert>{state.formError}</FormAlert>
      <Input
        label="Current password"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        error={errors.currentPassword}
        required
      />
      <Input
        label="New password"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters."
        error={errors.newPassword}
        required
      />
      <Input
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword}
        required
      />
      <Button type="submit" variant="primary" loading={pending} className="mt-1 w-full">
        Change password
      </Button>
    </form>
  );
}
