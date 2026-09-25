import Image from "next/image";

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed bg-background px-6 py-9 text-center">
    <Image src="/brand/mmdc-bee.png" alt="" width={503} height={312} style={{ width: 112, height: "auto" }} className="mb-5" />
    <p className="font-medium">{title}</p><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
  </div>;
}
