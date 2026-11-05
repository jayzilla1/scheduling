import { Suspense } from "react";
import { login } from "./actions";

async function LoginForm({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="mb-6 text-2xl font-bold">Sign in</h1>
      {error && <p className="mb-4 rounded bg-red-50 p-2 text-sm text-red-800">Wrong email or password.</p>}
      <form action={login} className="space-y-3">
        <input name="email" type="email" placeholder="Email" required className="w-full rounded border p-2" />
        <input name="password" type="password" placeholder="Password" required className="w-full rounded border p-2" />
        <button className="w-full rounded bg-black p-2 text-white">Sign in</button>
      </form>
    </main>
  );
}

export default function LoginPage(props: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <Suspense>
      <LoginForm {...props} />
    </Suspense>
  );
}
