import { Button } from '../../../components/ui/Button.js';

type StaffPageProps = {
  onLogout: () => void;
};

export function StaffPage({ onLogout }: StaffPageProps) {
  return (
    <main className="grid min-h-svh place-items-center bg-bg-page px-4 font-sans text-text-primary">
      <section className="flex flex-col items-center gap-6">
        <h1 className="m-0 text-page-title font-semibold">hello staff</h1>
        <Button onClick={onLogout}>Đăng xuất</Button>
      </section>
    </main>
  );
}
