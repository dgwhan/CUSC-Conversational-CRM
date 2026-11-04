import React, { useMemo } from 'react';
import { UserCheck, ChevronDown, Lock } from 'lucide-react';
import type { AssignedStaff } from '../../../types.js';

export interface AssignedAgentSectionProps {
  assignedStaff?: AssignedStaff | null;
  staffList?: AssignedStaff[];
  onAssignStaff?: (staffId: string) => void;
  isOwner?: boolean;
}

export const AssignedAgentSection: React.FC<AssignedAgentSectionProps> = ({
  assignedStaff,
  staffList = [],
  onAssignStaff,
  isOwner = true,
}) => {
  // Đảm bảo nhân sự đang được phân công luôn xuất hiện trong danh sách lựa chọn
  const mergedStaffList = useMemo(() => {
    const list = [...staffList];
    if (assignedStaff?.id && !list.some((s) => s.id === assignedStaff.id)) {
      list.unshift(assignedStaff);
    }
    return list;
  }, [staffList, assignedStaff]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!isOwner) return;
    const nextStaffId = e.target.value;
    if (onAssignStaff) {
      onAssignStaff(nextStaffId);
    }
  };

  return (
    <div className="p-4 bg-white space-y-2 border-b border-slate-100">
      <div className="flex items-center justify-between">
        <label
          htmlFor="assigned-staff-select"
          className="m-0 text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
        >
          <UserCheck size={14} className="text-slate-500 shrink-0" />
          <span>Nhân Sự Phụ Trách</span>
        </label>

        {assignedStaff ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Đã phân công
          </span>
        ) : (
          <span className="text-[11px] font-medium text-slate-400 italic">
            Chưa phân công
          </span>
        )}
      </div>

      <div className="relative">
        <select
          id="assigned-staff-select"
          value={assignedStaff?.id || ''}
          onChange={handleChange}
          disabled={!isOwner}
          className={`w-full h-9 pl-3 pr-8 text-xs font-semibold text-slate-800 border rounded-lg transition-colors appearance-none ${
            !isOwner
              ? 'bg-slate-100/80 border-slate-200 cursor-not-allowed opacity-90 text-slate-600'
              : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 cursor-pointer'
          }`}
        >
          <option value="">-- Chưa phân công nhân sự --</option>
          {mergedStaffList.map((st) => (
            <option key={st.id} value={st.id}>
              {st.name} {st.role ? `(${st.role})` : ''}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
          {!isOwner ? <Lock size={13} className="text-slate-400" /> : <ChevronDown size={14} />}
        </div>
      </div>
      {!isOwner && (
        <p className="text-[11px] text-slate-400 italic m-0">
          Chỉ Quản lý (Owner) mới có quyền phân công nhân sự.
        </p>
      )}
    </div>
  );
};
