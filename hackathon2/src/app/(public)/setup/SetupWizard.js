"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/cn";
import { fieldErrorsOf, setupAdminEnvPasswordSchema, setupAdminSchema, setupCompanySchema } from "@/lib/validation/auth";
import { formStateFromError, postJson } from "@/lib/api";
import Button from "@/components/ui/Button";
import FormAlert from "@/components/ui/FormAlert";
import Input from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

const STEPS = ["Company", "Admin account"];

function StepIndicator({ step }) {
  return (
    <ol className="mb-5 flex gap-2" aria-label="Setup progress">
      {STEPS.map((label, i) => (
        <li key={label} className="flex flex-1 flex-col gap-1.5" aria-current={i === step ? "step" : undefined}>
          <span className={cn("h-1 rounded-full", i <= step ? "bg-accent" : "bg-surface-2")} />
          <span className={cn("text-[0.8125rem]", i === step ? "font-medium text-ink" : "text-muted")}>
            {i + 1}. {label}
          </span>
        </li>
      ))}
    </ol>
  );
}

// suggestedEmail / envPasswordAvailable come from ADMIN_EMAIL / ADMIN_PASSWORD on the server.
export default function SetupWizard({ suggestedEmail = null, envPasswordAvailable = false }) {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState({ companyName: "", adminEmail: suggestedEmail ?? "", adminPassword: "", confirmPassword: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [pending, startTransition] = useTransition();

  const bind = (name) => ({
    name,
    value: values[name],
    error: errors[name],
    onChange: (e) => setValues((v) => ({ ...v, [name]: e.target.value })),
  });

  function next(e) {
    e.preventDefault();
    const parsed = setupCompanySchema.safeParse(values);
    if (!parsed.success) return setErrors(fieldErrorsOf(parsed.error));
    setErrors({});
    setStep(1);
  }

  function submit(e) {
    e.preventDefault();
    setFormError(null);
    const company = setupCompanySchema.safeParse(values);
    const admin = (envPasswordAvailable ? setupAdminEnvPasswordSchema : setupAdminSchema).safeParse(values);
    if (!admin.success) return setErrors(fieldErrorsOf(admin.error));
    if (!company.success) return setStep(0);
    setErrors({});

    startTransition(async () => {
      const { companyName } = company.data;
      const { adminEmail, adminPassword } = admin.data;
      const result = await postJson("/api/setup", { companyName, adminEmail, adminPassword });
      if (!result.ok) {
        const state = formStateFromError(result, "The setup service isn't available yet.");
        setFormError(state.formError);
        setErrors(state.fieldErrors ?? {});
        return;
      }
      toast({ title: "Setup complete", description: "Log in with your admin account.", tone: "success" });
      router.replace("/login");
    });
  }

  return (
    <>
      <StepIndicator step={step} />
      {step === 0 ? (
        <form onSubmit={next} noValidate className="flex flex-col gap-4">
          <Input label="Company name" autoComplete="organization" required autoFocus {...bind("companyName")} />
          <Button type="submit" variant="primary" className="mt-1 w-full">
            Continue
          </Button>
        </form>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <FormAlert>{formError}</FormAlert>
          <Input label="Admin email" type="email" autoComplete="email" required autoFocus {...bind("adminEmail")} />
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            hint={
              envPasswordAvailable
                ? "Leave blank to use the password set in ADMIN_PASSWORD on the server."
                : "At least 8 characters."
            }
            required={!envPasswordAvailable}
            {...bind("adminPassword")}
          />
          <Input
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            required={!envPasswordAvailable}
            {...bind("confirmPassword")}
          />
          <div className="mt-1 flex gap-2">
            <Button icon={ArrowLeft} onClick={() => setStep(0)} disabled={pending}>
              Back
            </Button>
            <Button type="submit" variant="primary" loading={pending} className="flex-1">
              Finish setup
            </Button>
          </div>
        </form>
      )}
    </>
  );
}
