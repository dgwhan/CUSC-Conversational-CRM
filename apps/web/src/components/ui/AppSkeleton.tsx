import React from 'react';

/**
 * Skeleton loading cao cấp mô phỏng cấu trúc giao diện CRM (Sidebar + Header + Dashboard/Inbox viewport)
 * Tối ưu hiệu năng: thuần CSS Tailwind animate-pulse, không re-render dư thừa.
 */
export const AppSkeleton: React.FC = () => {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans antialiased select-none animate-pulse">
      {/* 1. Sidebar Skeleton */}
      <aside className="hidden md:flex flex-col w-64 border-r border-slate-200 bg-white p-4 justify-between shrink-0">
        <div className="space-y-6">
          {/* Logo & Workspace Brand */}
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="w-9 h-9 rounded-xl bg-slate-200" />
            <div className="space-y-1.5 flex-1">
              <div className="h-4 w-28 bg-slate-200 rounded" />
              <div className="h-2.5 w-16 bg-slate-100 rounded" />
            </div>
          </div>

          {/* Navigation Items */}
          <div className="space-y-2 pt-2">
            {[
              { w: 'w-24', active: true },
              { w: 'w-28', active: false },
              { w: 'w-20', active: false },
              { w: 'w-32', active: false },
              { w: 'w-24', active: false },
            ].map((item, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${
                  item.active ? 'bg-blue-50/70 border border-blue-100/60' : 'bg-transparent'
                }`}
              >
                <div className={`w-5 h-5 rounded-md ${item.active ? 'bg-blue-200' : 'bg-slate-200'}`} />
                <div className={`h-3.5 ${item.w} ${item.active ? 'bg-blue-300/80' : 'bg-slate-200'} rounded`} />
              </div>
            ))}
          </div>
        </div>

        {/* Bottom User Profile */}
        <div className="flex items-center gap-3 p-2 border-t border-slate-100 pt-4">
          <div className="w-9 h-9 rounded-full bg-slate-200 shrink-0" />
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="h-3.5 w-24 bg-slate-200 rounded" />
            <div className="h-2.5 w-16 bg-slate-100 rounded" />
          </div>
        </div>
      </aside>

      {/* 2. Main Viewport Skeleton */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="h-7 w-32 bg-slate-200 rounded-lg" />
            <div className="hidden sm:block h-5 w-20 bg-slate-100 rounded-full" />
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:block h-8 w-48 bg-slate-100 rounded-lg" />
            <div className="w-8 h-8 rounded-lg bg-slate-100" />
            <div className="w-8 h-8 rounded-lg bg-slate-100" />
            <div className="h-7 w-20 rounded-full bg-slate-200" />
          </div>
        </header>

        {/* Content Body Area */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* KPI Stat Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-3 w-20 bg-slate-200 rounded" />
                  <div className="w-8 h-8 rounded-lg bg-slate-100" />
                </div>
                <div className="h-7 w-24 bg-slate-300/80 rounded" />
                <div className="h-2.5 w-32 bg-slate-100 rounded" />
              </div>
            ))}
          </div>

          {/* Main Dashboard / Table Grid Skeleton */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="space-y-1.5">
                <div className="h-4 w-36 bg-slate-200 rounded" />
                <div className="h-2.5 w-48 bg-slate-100 rounded" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-8 w-24 bg-slate-100 rounded-lg" />
                <div className="h-8 w-28 bg-blue-100 rounded-lg" />
              </div>
            </div>

            {/* List Row Skeletons */}
            <div className="space-y-3 pt-2">
              {[1, 2, 3, 4, 5].map((row) => (
                <div
                  key={row}
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-50 bg-slate-50/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0" />
                    <div className="space-y-1.5">
                      <div className="h-3.5 w-32 bg-slate-200 rounded" />
                      <div className="h-2.5 w-24 bg-slate-100 rounded" />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="h-5 w-20 bg-slate-200/80 rounded-full" />
                    <div className="h-3.5 w-16 bg-slate-200 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
