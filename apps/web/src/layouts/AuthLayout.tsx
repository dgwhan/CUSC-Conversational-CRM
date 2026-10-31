import type { ReactNode } from 'react';

type AuthLayoutProps = {
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthLayout({ children, footer }: AuthLayoutProps) {
  return (
    <main className="grid min-h-svh place-items-center bg-slate-100 bg-[image:var(--gradient-background-login)] px-4 py-8 sm:px-8">
      <section className="w-full max-w-[548px] rounded-xl border border-slate-200/90 bg-white px-6 py-8 shadow-[0_8px_28px_rgba(20,38,63,0.08)] sm:px-10 sm:py-10 lg:px-12">
        <div className="mx-auto w-full max-w-[436px]">
          {children}
          {footer}
        </div>
      </section>
    </main>
  );
}
