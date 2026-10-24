"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import TempPasswordDialog from "@/components/ui/TempPasswordDialog";
import { useToast } from "@/components/ui/Toast";
import EmployeeForm from "@/components/employees/EmployeeForm";

export default function RegisterEmployee({ departments, designations, today }) {
  const router = useRouter();
  const { toast } = useToast();
  const [formKey, setFormKey] = useState(0);
  const [registered, setRegistered] = useState(null);

  function onSaved({ employee, tempPassword, linked }) {
    if (linked) {
      toast({
        title: `${employee.fullName} registered as ${employee.employeeCode}`,
        description: "Linked to their existing login; their password is unchanged.",
        tone: "success",
      });
      router.push(`/employees/${employee.id}`);
      return;
    }
    setRegistered({ employee, email: employee.email, tempPassword });
  }

  function registerAnother() {
    setRegistered(null);
    setFormKey((k) => k + 1);
  }

  return (
    <>
      <EmployeeForm
        key={formKey}
        departments={departments}
        designations={designations}
        today={today}
        onSaved={onSaved}
        onCancel={() => router.push("/employees")}
      />
      <TempPasswordDialog
        grant={registered}
        onClose={() => router.push(`/employees/${registered.employee.id}`)}
        title={registered ? `${registered.employee.fullName} is registered as ${registered.employee.employeeCode}` : ""}
        description="Give them this temporary password privately. It won't be shown again; they'll choose their own when they first sign in."
        footer={
          <>
            <Button onClick={registerAnother}>Register another</Button>
            <Button variant="primary" onClick={() => router.push(`/employees/${registered.employee.id}`)}>
              Open profile
            </Button>
          </>
        }
      />
    </>
  );
}
