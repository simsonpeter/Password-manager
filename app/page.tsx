import Link from "next/link";
import { LockKeyhole, ShieldCheck, Smartphone } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-canvas">
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10">
              <LockKeyhole className="h-5 w-5" />
            </span>
            <span className="text-lg font-semibold">AccessVault</span>
          </div>
          <div className="flex gap-2">
            <Link href="/login" className="inline-flex h-11 items-center rounded-lg px-4 text-sm font-semibold text-white">Sign in</Link>
            <Link href="/register" className="inline-flex h-11 items-center rounded-lg bg-white px-4 text-sm font-semibold text-navy">Create account</Link>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-6 pb-16 pt-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-100">For delivery teams</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">Client access codes, encrypted before they leave the browser.</h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-200">
            Keep port, garage, key safe, warehouse, and door codes with the right client and location. Search the directory, reveal a code, and copy it.
          </p>
        </div>
      </header>
      <section className="mx-auto grid max-w-6xl gap-4 px-6 py-10 md:grid-cols-3">
        {[
          { icon: ShieldCheck, title: "Separate vault passphrase", body: "Your account password signs you in. A different passphrase encrypts the codes. The passphrase is never stored." },
          { icon: LockKeyhole, title: "Hidden until you reveal them", body: "Codes stay masked. Reveal and copy are explicit actions, and the vault locks after inactivity." },
          { icon: Smartphone, title: "Installable", body: "Add AccessVault to a phone or computer. Reading and saving codes still needs a secure connection." },
        ].map((item) => (
          <article key={item.title} className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <item.icon className="h-6 w-6 text-teal" />
            <h2 className="mt-3 text-lg font-semibold">{item.title}</h2>
            <p className="mt-2 text-sm text-muted">{item.body}</p>
          </article>
        ))}
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
          <h2 className="font-semibold">If you lose the vault passphrase and the recovery key</h2>
          <p className="mt-2 text-sm">The codes cannot be recovered. AccessVault does not keep a server-side master key, and Supabase cannot decrypt the secrets. Metadata such as client names and addresses is stored for search and is visible to your signed-in account.</p>
        </div>
      </section>
    </main>
  );
}
