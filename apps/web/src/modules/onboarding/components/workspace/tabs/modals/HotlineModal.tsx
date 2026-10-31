import React, { useState, useEffect } from 'react';
import { Phone, Check } from 'lucide-react';
import { Modal, Button } from '../../../../../../components/ui/index.js';
import { notify } from '../../../../../../components/feedback/toastEmitter.js';

export interface HotlineItem {
  id: string;
  workspaceId: string;
  phoneNumber: string;
  label: string;
  department: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  status: 'ACTIVE' | 'INACTIVE';
  workingHours?: string;
  isDefault?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HotlineModalProps {
  isOpen: boolean;
  onClose: () => void;
  hotline: HotlineItem | null;
  onSave: (data: {
    phoneNumber: string;
    label: string;
    department: string;
    assignedStaffName?: string;
    workingHours?: string;
    status: 'ACTIVE' | 'INACTIVE';
    isDefault: boolean;
    notes?: string;
  }) => Promise<void>;
}

const DEPARTMENTS = [
  'Tuyển sinh & Đào tạo',
  'Tư vấn khóa học công nghệ',
  'Chăm sóc học viên & Khách hàng',
  'Phòng Đào tạo học vụ',
  'Hỗ trợ kỹ thuật & Hệ thống',
  'Tiếp tân & Hành chính',
];

export const HotlineModal: React.FC<HotlineModalProps> = ({
  isOpen,
  onClose,
  hotline,
  onSave,
}) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [label, setLabel] = useState('');
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [workingHours, setWorkingHours] = useState('07:30 - 21:00');
  const [assignedStaffName, setAssignedStaffName] = useState('Tất cả tư vấn viên');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [isDefault, setIsDefault] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (hotline) {
      setPhoneNumber(hotline.phoneNumber || '');
      setLabel(hotline.label || '');
      setDepartment(hotline.department || DEPARTMENTS[0]);
      setWorkingHours(hotline.workingHours || '07:30 - 21:00');
      setAssignedStaffName(hotline.assignedStaffName || 'Tất cả tư vấn viên');
      setStatus(hotline.status || 'ACTIVE');
      setIsDefault(Boolean(hotline.isDefault));
      setNotes(hotline.notes || '');
    } else {
      setPhoneNumber('');
      setLabel('');
      setDepartment(DEPARTMENTS[0]);
      setWorkingHours('07:30 - 21:00');
      setAssignedStaffName('Tất cả tư vấn viên');
      setStatus('ACTIVE');
      setIsDefault(false);
      setNotes('');
    }
  }, [hotline, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) {
      notify.warning('Vui lòng nhập số điện thoại Hotline.');
      return;
    }
    if (!label.trim()) {
      notify.warning('Vui lòng nhập tên nhãn Hotline.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        phoneNumber: phoneNumber.trim(),
        label: label.trim(),
        department,
        workingHours: workingHours.trim() || '08:00 - 17:30',
        assignedStaffName: assignedStaffName.trim() || 'Tất cả tư vấn viên',
        status,
        isDefault,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch {
      // Error handled in parent/apiClient
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEditing = Boolean(hotline);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="flat"
      size="md"
      showCloseButton
      title={isEditing ? 'Chỉnh sửa số Hotline' : 'Thêm số Hotline mới'}
      description="Cấu hình đầu số tiếp nhận cuộc gọi, phân công trực ban và khung giờ hoạt động."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Số điện thoại Hotline <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="VD: 0292.3835.581 hoặc 1900.xxxx"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 shadow-xs box-border bg-white font-mono transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tên gọi / Nhãn nhận diện <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="VD: Hotline Tuyển sinh Aptech (Chính)"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 shadow-xs box-border bg-white transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Phòng ban phụ trách
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white text-slate-700 outline-none focus:border-blue-600 shadow-xs cursor-pointer box-border transition-all"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Khung giờ tiếp nhận cuộc gọi
            </label>
            <input
              type="text"
              value={workingHours}
              onChange={(e) => setWorkingHours(e.target.value)}
              placeholder="VD: 07:30 - 21:00 hoặc 24/7"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 shadow-xs box-border bg-white transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Đội ngũ trực ban
            </label>
            <input
              type="text"
              value={assignedStaffName}
              onChange={(e) => setAssignedStaffName(e.target.value)}
              placeholder="VD: Tất cả tư vấn viên, Trực ban cơ sở 1"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 shadow-xs box-border bg-white transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Trạng thái tiếp nhận
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white text-slate-700 outline-none focus:border-blue-600 shadow-xs cursor-pointer box-border transition-all"
            >
              <option value="ACTIVE">Đang nhận cuộc gọi (Sẵn sàng)</option>
              <option value="INACTIVE">Tạm dừng tiếp nhận</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Ghi chú / Kịch bản chào gọi
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ghi chú nghiệp vụ tiếp nhận cuộc gọi..."
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 shadow-xs box-border bg-white resize-y transition-all"
          />
        </div>

        <div className="pt-1">
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
            />
            <span className="font-medium">Đặt làm số Hotline chính của Không gian làm việc</span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
          >
            Hủy
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isSubmitting}
            icon={isEditing ? <Check size={14} /> : <Phone size={14} />}
          >
            {isSubmitting ? 'Đang lưu...' : isEditing ? 'Lưu thay đổi' : 'Thêm Hotline'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
