import type { ReactNode } from 'react';

type AuthLayoutProps = {
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthLayout({ children, footer }: AuthLayoutProps) {
  return (
    <main className="grid min-h-svh place-items-center bg-[image:var(--gradient-background-login)] px-4 py-8 sm:px-8">
      <section className="w-full max-w-[var(--auth-card-max-width)] rounded-card bg-bg-surface px-6 py-8 shadow-card sm:px-10 sm:py-10 lg:px-14">
        <div className="mx-auto w-full max-w-[var(--auth-content-max-width)]">
          {children}
          {footer}
        </div>
      </section>
    </main>
  );
}
