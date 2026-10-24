"use client";

import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import Button from "@/components/ui/Button";
import FormAlert from "@/components/ui/FormAlert";
import Input from "@/components/ui/Input";

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(login, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <FormAlert>{state.formError}</FormAlert>
      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email}
        error={errors.email}
        required
      />
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        error={errors.password}
        required
      />
      <Button type="submit" variant="primary" loading={pending} className="mt-1 w-full">
        Log in
      </Button>
    </form>
  );
}
