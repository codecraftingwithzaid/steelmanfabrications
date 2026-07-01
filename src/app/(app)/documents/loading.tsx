import { Card, Skeleton } from "@/components/ui/misc";
import { Spinner } from "@/components/ui/spinner";

export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Spinner className="size-4" />
        <h1 className="text-lg font-semibold text-muted-foreground">
          Loading documents…
        </h1>
      </div>
      <Card className="overflow-hidden">
        <div className="flex gap-2 border-b border-border p-3">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-3 py-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
