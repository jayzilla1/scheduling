import { Suspense } from "react";
import { login } from "./actions";

const input =
  "w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none focus:border-(--accent)";

async function LoginForm({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <div className="mb-8">
        <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-(--accent) text-2xl text-(--on-accent)">
          ☀
        </span>
        <h1 className="text-3xl font-semibold leading-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted">Sign in to see who&apos;s working today.</p>
      </div>
      {error && (
        <p className="mb-4 rounded-2xl bg-rose-50 p-3 text-sm text-rose-800">Wrong email or password.</p>
      )}
      <form action={login} className="space-y-3">
        <input name="email" type="email" placeholder="Email" autoComplete="email" required className={input} />
        <input name="password" type="password" placeholder="Password" autoComplete="current-password" required className={input} />
        <button className="w-full rounded-2xl bg-(--accent) py-3 text-sm font-semibold text-(--on-accent) shadow-lg shadow-(--accent)/30">
          Sign in
        </button>
      </form>
    </main>
  );
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <Suspense>
      <LoginForm searchParams={props.searchParams} />
    </Suspense>
  );
}
