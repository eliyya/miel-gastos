import Image from "next/image";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.totpEnabled ? "/" : "/totp/setup");
  return (
    <main className="min-h-svh bg-[#fef2e4] p-4 text-[#44240b] sm:p-8 lg:flex lg:items-center lg:justify-center lg:p-12">
      <div className="mx-auto grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-[#d8b583]/50 bg-[#fffcf7] shadow-xl shadow-[#44240b]/5 lg:grid-cols-2">
        <section className="relative flex flex-col justify-between overflow-hidden bg-background p-7 sm:p-10 lg:p-12">
          <div className="flex items-center gap-3">
            <Image src="/brand/mmdc-logo.svg" alt="" width={64} height={64} priority />
            <div><p className="font-semibold">Martín del Campo</p><p className="text-xs tracking-[0.18em] text-[#6b4a2b] uppercase">Miel de abeja</p></div>
          </div>
          <div className="relative z-10 mt-10 lg:mt-20">
            <p className="mb-4 text-xs font-semibold tracking-[0.2em] text-[#6b4a2b] uppercase">El cuidado está en los detalles</p>
            <h1 className="max-w-sm font-serif text-4xl leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">Todo en orden.<br /><span className="text-[#995c09]">Como en la colmena.</span></h1>
            <p className="mt-5 max-w-xs text-sm leading-7 text-[#6b4a2b]">Un espacio para cuidar las cuentas de lo que hacemos con tanto cariño.</p>
          </div>
          <Image src="/brand/mmdc-bee.png" alt="" width={503} height={312} style={{ width: 150, height: "auto" }} className="mt-8 hidden self-end lg:block" />
          <p className="relative mt-10 text-xs tracking-widest text-[#6b4a2b] uppercase lg:mt-20">Gastos y ventas · MMDC</p>
        </section>
        <section aria-labelledby="login-heading" className="px-7 py-10 sm:p-12 lg:px-14 lg:py-16">
          <div className="mb-7">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#d8b583]/60 px-3 py-1.5 text-xs text-[#6b4a2b]"><ShieldCheck className="size-3.5" aria-hidden="true" /> Acceso al equipo</div>
            <h2 id="login-heading" className="font-serif text-3xl tracking-tight sm:text-4xl">Qué gusto tenerte aquí</h2>
            <p className="mt-3 text-sm leading-6 text-[#6b4a2b]">Inicia sesión para administrar tus gastos y ventas.</p>
          </div>
          <LoginForm />
        </section>
      </div>
    </main>
  );
}
