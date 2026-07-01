import { Card, Skeleton } from "@/components/ui/misc";
import { Spinner } from "@/components/ui/spinner";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Spinner className="size-4" />
        <h1 className="text-lg font-semibold text-muted-foreground">
          Loading dashboard…
        </h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-7 w-32" />
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-4">
          <Skeleton className="mb-3 h-4 w-56" />
          <Skeleton className="h-64 w-full" />
        </Card>
        <Card className="p-4">
          <Skeleton className="mb-3 h-4 w-32" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
