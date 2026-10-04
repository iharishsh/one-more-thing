export default function SignupLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading sign up">
      <div className="space-y-2">
        <div className="h-8 w-32 rounded-md bg-muted" />
        <div className="h-4 w-full max-w-sm rounded-md bg-muted" />
      </div>
      <div className="space-y-3">
        <div className="h-11 w-full rounded-full bg-muted" />
        <div className="h-11 w-full rounded-full bg-muted" />
        <div className="h-11 w-full rounded-full bg-muted" />
        <div className="h-12 w-full rounded-full bg-muted" />
      </div>
    </div>
  );
}
