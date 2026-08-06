"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";

import { createAgentTokenAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AgentTokenForm() {
  const [state, action, pending] = useActionState(createAgentTokenAction, null);

  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="tokenName">Nombre del token</Label>
        <Input
          id="tokenName"
          name="tokenName"
          placeholder="Agente de gastos"
          maxLength={80}
          required
        />
      </div>

      <Button type="submit" className="w-fit" disabled={pending}>
        <KeyRound />
        Generar token
      </Button>

      {state?.token ? (
        <div className="rounded-lg border bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">Token nuevo</p>
          <p className="mt-1 break-all font-mono text-sm">{state.token}</p>
        </div>
      ) : null}
    </form>
  );
}
