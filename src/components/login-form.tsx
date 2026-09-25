"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { loginAction } from "@/app/actions";
import type { LoginState } from "@/lib/login-state";

const inputClass = "h-12 w-full rounded-xl border border-[#d8b583] bg-white px-3.5 text-base text-[#42220c] outline-none transition placeholder:text-[#947453] focus:border-[#995c09] focus:ring-3 focus:ring-[#e5950e]/20 aria-invalid:border-red-600 aria-invalid:ring-red-600/15 disabled:opacity-60";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const [values, setValues] = useState({ email: "", password: "", totpCode: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const alertRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.error) alertRef.current?.focus();
  }, [state]);
  function update(field: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }
  return (
    <form action={action} noValidate aria-busy={pending} className="grid gap-5">
      {state.error && !pending && (
        <div ref={alertRef} role="alert" tabIndex={-1} className="flex gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm leading-6 text-red-800 outline-none focus:ring-2 focus:ring-red-300">
          <AlertCircle className="mt-1 size-4 shrink-0" aria-hidden="true" /><p>{state.error}</p>
        </div>
      )}
      <div className="grid gap-2">
        <label htmlFor="email" className="text-sm font-medium">Correo electrónico</label>
        <input id="email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required disabled={pending} value={values.email} onChange={(e) => update("email", e.target.value)} placeholder="tu@correo.com" className={inputClass} aria-invalid={!!state.fields?.email} aria-describedby={state.fields?.email ? "email-error" : undefined} />
        {state.fields?.email && <p id="email-error" className="text-sm text-red-800">{state.fields.email}</p>}
      </div>
      <div className="grid gap-2">
        <label htmlFor="password" className="text-sm font-medium">Contraseña</label>
        <div className="relative">
          <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required disabled={pending} value={values.password} onChange={(e) => update("password", e.target.value)} onKeyUp={(e) => setCapsLock(e.getModifierState("CapsLock"))} onKeyDown={(e) => setCapsLock(e.getModifierState("CapsLock"))} onBlur={() => setCapsLock(false)} placeholder="Tu contraseña" className={`${inputClass} pr-12`} aria-invalid={!!state.fields?.password} aria-describedby={[state.fields?.password ? "password-error" : "", capsLock ? "caps-lock" : ""].filter(Boolean).join(" ") || undefined} />
          <button type="button" disabled={pending} onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={showPassword} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-[#6b4a2b] outline-none hover:text-[#42220c] focus-visible:ring-2 focus-visible:ring-[#995c09]">
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {state.fields?.password && <p id="password-error" className="text-sm text-red-800">{state.fields.password}</p>}
        {capsLock && <p id="caps-lock" role="status" className="text-sm text-[#995c09]">Tienes activadas las mayúsculas.</p>}
      </div>
      <div className="grid gap-2">
        <label htmlFor="totpCode" className="text-sm font-medium">Código de autenticación</label>
        <input id="totpCode" name="totpCode" inputMode="numeric" autoComplete="one-time-code" disabled={pending} value={values.totpCode} onChange={(e) => update("totpCode", e.target.value.replace(/\s/g, ""))} placeholder="000000" className={`${inputClass} tracking-[0.3em] placeholder:tracking-[0.3em]`} aria-invalid={!!state.fields?.totpCode} aria-describedby={`totp-help${state.fields?.totpCode ? " totp-error" : ""}`} />
        <p id="totp-help" className="text-xs leading-5 text-[#6b4a2b]">Los 6 dígitos de tu app de autenticación. Si es tu primer acceso, déjalo vacío; lo configurarás al entrar.</p>
        {state.fields?.totpCode && <p id="totp-error" className="text-sm text-red-800">{state.fields.totpCode}</p>}
      </div>
      <button type="submit" disabled={pending} className="mt-1 flex min-h-12 items-center justify-center gap-3 rounded-xl bg-[#42220c] px-5 py-3 text-sm font-semibold text-[#fff8ed] transition hover:bg-[#633811] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#995c09] disabled:cursor-wait disabled:opacity-70">
        {pending ? <><LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" /> Verificando acceso…</> : <>Iniciar sesión <ArrowRight className="size-4" aria-hidden="true" /></>}
      </button>
      <p role="status" aria-live="polite" className="sr-only">{pending ? "Verificando tus datos. Espera un momento." : ""}</p>
      <p className="border-t border-[#d8b583]/40 pt-5 text-center text-xs leading-5 text-[#6b4a2b]">¿Necesitas acceso o ayuda para entrar?<br />Contacta a quien administra las cuentas de MMDC.</p>
    </form>
  );
}
