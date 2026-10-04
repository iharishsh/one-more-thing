export default function LoginLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading log in">
      <div className="space-y-2">
        <div className="h-8 w-28 rounded-md bg-muted" />
        <div className="h-4 w-full max-w-sm rounded-md bg-muted" />
      </div>
      <div className="space-y-3">
        <div className="h-11 w-full rounded-full bg-muted" />
        <div className="h-11 w-full rounded-full bg-muted" />
        <div className="h-12 w-full rounded-full bg-muted" />
      </div>
    </div>
  );
}
