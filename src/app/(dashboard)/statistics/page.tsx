import { redirect } from "next/navigation";

type Params = { start?: string | string[]; end?: string | string[]; group?: string | string[] };

export default async function StatisticsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const item of Array.isArray(value) ? value : value ? [value] : []) query.append(key, item);
  }
  redirect(query.size ? `/?${query}` : "/");
}
