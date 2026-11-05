import React, { useState, useEffect } from 'react';
import {
  Clock,
  Save,
  Moon,
  Copy,
  Sparkles,
  Calendar,
  Tag as TagIcon,
  ShieldAlert,
} from 'lucide-react';
import type {
  WorkingHoursConfig,
  DayWorkingSchedule,
} from '../../workspaceConfig.types.js';
import { getDefaultWorkingHoursConfig } from '../../workspaceConfig.types.js';

export interface WorkingHoursTabProps {
  workingHours?: WorkingHoursConfig;
  isOwner: boolean;
  isLoading?: boolean;
  onSave: (config: WorkingHoursConfig) => void;
}

export const WorkingHoursTab: React.FC<WorkingHoursTabProps> = ({
  workingHours,
  isOwner,
  isLoading = false,
  onSave,
}) => {
  const [config, setConfig] = useState<WorkingHoursConfig>(() => {
    return workingHours || getDefaultWorkingHoursConfig();
  });

  // Đồng bộ lại khi prop workingHours từ cha thay đổi
  useEffect(() => {
    if (workingHours) {
      setConfig(workingHours);
    }
  }, [workingHours]);

  // Handler cập nhật trạng thái bật/tắt toàn bộ tính năng
  const handleToggleEnabled = () => {
    if (!isOwner) return;
    setConfig((prev) => ({
      ...prev,
      enabled: !prev.enabled,
    }));
  };

  // Handler cập nhật lịch làm việc của 1 ngày
  const handleUpdateSchedule = (
    dayOfWeek: number,
    field: keyof DayWorkingSchedule,
    value: any,
  ) => {
    if (!isOwner) return;
    setConfig((prev) => {
      const currentSchedules = Array.isArray(prev.schedules) ? [...prev.schedules] : [];
      const updated = currentSchedules.map((item) => {
        if (item.dayOfWeek === dayOfWeek) {
          return { ...item, [field]: value };
        }
        return item;
      });
      return { ...prev, schedules: updated };
    });
  };

  // Hành động nhanh: Đặt T2 - T6 từ 07:00 đến 17:00, T7 & CN nghỉ
  const applyPresetMondayToFriday = () => {
    if (!isOwner) return;
    setConfig((prev) => ({
      ...prev,
      schedules: [
        { dayOfWeek: 1, dayName: 'Thứ Hai', isOpen: true, openTime: '07:00', closeTime: '17:00' },
        { dayOfWeek: 2, dayName: 'Thứ Ba', isOpen: true, openTime: '07:00', closeTime: '17:00' },
        { dayOfWeek: 3, dayName: 'Thứ Tư', isOpen: true, openTime: '07:00', closeTime: '17:00' },
        { dayOfWeek: 4, dayName: 'Thứ Năm', isOpen: true, openTime: '07:00', closeTime: '17:00' },
        { dayOfWeek: 5, dayName: 'Thứ Sáu', isOpen: true, openTime: '07:00', closeTime: '17:00' },
        { dayOfWeek: 6, dayName: 'Thứ Bảy', isOpen: false, openTime: '07:00', closeTime: '12:00' },
        { dayOfWeek: 7, dayName: 'Chủ Nhật', isOpen: false, openTime: '07:00', closeTime: '12:00' },
      ],
      autoReplyMessage:
        'Cảm ơn bạn đã liên hệ! Hiện tại đang ngoài khung giờ làm việc của chúng tôi (Thứ 2 - Thứ 6: 07:00 - 17:00). Chúng tôi đã ghi nhận tin nhắn và tư vấn viên sẽ liên hệ lại với bạn ngay vào đầu giờ làm việc tiếp theo. Chúc bạn một ngày tốt lành!',
    }));
  };

  // Hành động nhanh: Đặt T2 - T7 từ 07:30 đến 17:30, CN nghỉ
  const applyPresetMondayToSaturday = () => {
    if (!isOwner) return;
    setConfig((prev) => ({
      ...prev,
      schedules: [
        { dayOfWeek: 1, dayName: 'Thứ Hai', isOpen: true, openTime: '07:30', closeTime: '17:30' },
        { dayOfWeek: 2, dayName: 'Thứ Ba', isOpen: true, openTime: '07:30', closeTime: '17:30' },
        { dayOfWeek: 3, dayName: 'Thứ Tư', isOpen: true, openTime: '07:30', closeTime: '17:30' },
        { dayOfWeek: 4, dayName: 'Thứ Năm', isOpen: true, openTime: '07:30', closeTime: '17:30' },
        { dayOfWeek: 5, dayName: 'Thứ Sáu', isOpen: true, openTime: '07:30', closeTime: '17:30' },
        { dayOfWeek: 6, dayName: 'Thứ Bảy', isOpen: true, openTime: '07:30', closeTime: '17:30' },
        { dayOfWeek: 7, dayName: 'Chủ Nhật', isOpen: false, openTime: '07:30', closeTime: '12:00' },
      ],
    }));
  };

  // Sao chép giờ của một ngày áp dụng cho tất cả các ngày đang bật làm việc
  const copyTimeToAllOpenDays = (openTime: string, closeTime: string) => {
    if (!isOwner) return;
    setConfig((prev) => ({
      ...prev,
      schedules: (prev.schedules || []).map((s) =>
        s.isOpen ? { ...s, openTime, closeTime } : s,
      ),
    }));
  };

  // Nạp câu mẫu trả lời tự động gợi ý
  const setSampleAutoReply = () => {
    if (!isOwner) return;
    setConfig((prev) => ({
      ...prev,
      autoReplyMessage:
        'Cảm ơn bạn đã nhắn tin cho chúng tôi! Hiện tại đang ngoài khung giờ tư vấn viên làm việc. Chúng tôi đã lưu lại thông tin và sẽ gọi điện/nhắn tin phản hồi bạn sớm nhất vào đầu ngày làm việc tiếp theo. Chúc bạn có những phút giây thư giãn tuyệt vời!',
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(config);
  };

  return (
    <div className="w-full">
      <div className="p-4 sm:p-5 bg-white rounded-xl border border-slate-200/80 shadow-2xs space-y-5 w-full">
        {/* 1. Header Card */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-600 shadow-2xs shrink-0">
              <Clock size={16} />
            </div>
            <div>
              <h4 className="m-0 text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span>Khung Giờ Làm Việc & Tự Động Trả Lời</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200/70 lowercase">
                  out of office
                </span>
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5 mb-0">
                Tự động gửi lời nhắn phản hồi khi khách nhắn tin ngoài giờ làm việc và đánh dấu hội thoại để nhân viên xử lý vào sáng hôm sau.
              </p>
            </div>
          </div>

          {/* Toggle Enabled */}
          <div className="flex items-center gap-2 shrink-0">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={handleToggleEnabled}
                disabled={!isOwner}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
            <span className="text-xs font-semibold text-slate-700 hidden sm:inline">
              {config.enabled ? 'Đang bật' : 'Tạm tắt'}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 2. Quick Preset Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50/80 rounded-xl border border-slate-200/80">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-slate-500 shrink-0" />
              <span className="text-xs font-semibold text-slate-700">Mẫu thiết lập nhanh:</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={applyPresetMondayToFriday}
                disabled={!isOwner}
                className="h-7 px-2.5 text-xs font-medium rounded-lg bg-white border border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 text-slate-700 transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1"
              >
                <Sparkles size={11} className="text-indigo-500" />
                <span>T2 - T6 (7h - 17h)</span>
              </button>
              <button
                type="button"
                onClick={applyPresetMondayToSaturday}
                disabled={!isOwner}
                className="h-7 px-2.5 text-xs font-medium rounded-lg bg-white border border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 text-slate-700 transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1"
              >
                <span>T2 - T7 (7h30 - 17h30)</span>
              </button>
            </div>
          </div>

          {/* 3. Bảng lịch làm việc 7 ngày trong tuần */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span>Lịch Làm Việc Theo Ngày Trong Tuần</span>
              </label>
              <span className="text-[11px] text-slate-500">Múi giờ: {config.timezone || 'Asia/Ho_Chi_Minh'} (UTC+7)</span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs divide-y divide-slate-100 bg-white">
              {(config.schedules || []).map((schedule) => {
                const isWorking = schedule.isOpen;
                return (
                  <div
                    key={schedule.dayOfWeek}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 transition-colors ${
                      isWorking ? 'bg-white hover:bg-slate-50/50' : 'bg-slate-50/60 text-slate-400'
                    }`}
                  >
                    {/* Ngày & Trạng thái mở cửa */}
                    <div className="flex items-center gap-3 min-w-[140px]">
                      <input
                        type="checkbox"
                        checked={schedule.isOpen}
                        onChange={(e) =>
                          handleUpdateSchedule(schedule.dayOfWeek, 'isOpen', e.target.checked)
                        }
                        disabled={!isOwner || !config.enabled}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                      />
                      <span className={`text-xs font-bold ${isWorking ? 'text-slate-800' : 'text-slate-400'}`}>
                        {schedule.dayName}
                      </span>
                      {isWorking ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.5 rounded leading-none">
                          Làm việc
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded leading-none">
                          Nghỉ
                        </span>
                      )}
                    </div>

                    {/* Khung giờ mở - đóng cửa */}
                    <div className="flex items-center gap-2 pl-7 sm:pl-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-500 font-medium">Từ</span>
                        <input
                          type="time"
                          value={schedule.openTime || '07:00'}
                          onChange={(e) =>
                            handleUpdateSchedule(schedule.dayOfWeek, 'openTime', e.target.value)
                          }
                          disabled={!isOwner || !isWorking || !config.enabled}
                          className="h-7 px-2 text-xs font-semibold text-slate-800 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 bg-white disabled:bg-slate-100 disabled:text-slate-400 shadow-2xs"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-500 font-medium">Đến</span>
                        <input
                          type="time"
                          value={schedule.closeTime || '17:00'}
                          onChange={(e) =>
                            handleUpdateSchedule(schedule.dayOfWeek, 'closeTime', e.target.value)
                          }
                          disabled={!isOwner || !isWorking || !config.enabled}
                          className="h-7 px-2 text-xs font-semibold text-slate-800 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 bg-white disabled:bg-slate-100 disabled:text-slate-400 shadow-2xs"
                        />
                      </div>

                      {isWorking && (
                        <button
                          type="button"
                          onClick={() => copyTimeToAllOpenDays(schedule.openTime, schedule.closeTime)}
                          disabled={!isOwner || !config.enabled}
                          title="Áp dụng khung giờ này cho toàn bộ các ngày làm việc khác"
                          className="h-7 px-2 text-[11px] font-medium text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded border border-transparent hover:border-indigo-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Copy size={11} />
                          <span className="hidden md:inline">Sao chép</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Lời nhắn tự động khi nhận tin ngoài giờ */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Moon size={13} className="text-amber-600" />
                <span>Nội Dung Lời Nhắn Tự Động Sau Giờ Làm Việc</span>
              </label>
              <button
                type="button"
                onClick={setSampleAutoReply}
                disabled={!isOwner}
                className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700 hover:underline cursor-pointer inline-flex items-center gap-1"
              >
                <Sparkles size={11} />
                <span>Điền câu mẫu chuẩn</span>
              </button>
            </div>
            <textarea
              rows={3}
              value={config.autoReplyMessage || ''}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, autoReplyMessage: e.target.value }))
              }
              disabled={!isOwner || !config.enabled}
              placeholder="VD: Cảm ơn bạn đã liên hệ! Hiện tại đang ngoài khung giờ làm việc..."
              className="w-full p-2.5 text-xs text-slate-800 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 bg-white disabled:bg-slate-50 disabled:text-slate-400 shadow-2xs"
            />
            <p className="text-[11px] text-slate-500">
              Tin nhắn này sẽ được tự động gửi ngay lập tức tới khách hàng trên kênh chat (Facebook Messenger, Zalo OA...) khi nhận được tin nhắn ngoài giờ.
            </p>
          </div>

          {/* 5. Cấu hình Tag đánh dấu & Chống spam Cooldown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Tag đánh dấu */}
            <div className="p-3 bg-amber-50/40 rounded-xl border border-amber-200/80 space-y-2">
              <div className="flex items-center gap-1.5">
                <TagIcon size={14} className="text-amber-700" />
                <label className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                  Nhãn (Tag) Đánh Dấu Hội Thoại
                </label>
              </div>
              <input
                type="text"
                value={config.outOfOfficeTag || 'HẸN TƯ VẤN SÁNG HÔM SAU'}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, outOfOfficeTag: e.target.value.trim() }))
                }
                disabled={!isOwner || !config.enabled}
                placeholder="VD: HẸN TƯ VẤN SÁNG HÔM SAU"
                className="w-full h-8 px-2.5 text-xs font-semibold text-slate-800 border border-amber-300 rounded-lg outline-none focus:border-amber-600 bg-white shadow-2xs"
              />
              <div className="flex items-center gap-2 text-[11px] text-amber-800">
                <span>Xem trước:</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded leading-none shadow-xs">
                  <Moon size={9} className="text-amber-700" />
                  <span>{config.outOfOfficeTag || 'HẸN TƯ VẤN SÁNG HÔM SAU'}</span>
                </span>
              </div>
              <p className="text-[11px] text-amber-700/90 leading-relaxed">
                Đoạn hội thoại sẽ tự động gắn nhãn này và hiển thị huy hiệu nổi bật trong Inbox để nhân viên ưu tiên lọc và gọi tư vấn vào sáng hôm sau.
              </p>
            </div>

            {/* Giãn cách chống spam (Cooldown) */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center gap-1.5">
                <ShieldAlert size={14} className="text-slate-700" />
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Thời Gian Chống Lặp Lại (Cooldown)
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="1440"
                  value={config.cooldownMinutes ?? 60}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      cooldownMinutes: Math.max(0, parseInt(e.target.value, 10) || 0),
                    }))
                  }
                  disabled={!isOwner || !config.enabled}
                  className="w-24 h-8 px-2.5 text-xs font-bold text-slate-800 border border-slate-300 rounded-lg outline-none focus:border-indigo-500 bg-white shadow-2xs"
                />
                <span className="text-xs font-medium text-slate-600">phút</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Nếu một khách hàng gửi liên tục nhiều tin nhắn trong đêm, hệ thống chỉ gửi 1 lời nhắn tự động duy nhất trong khoảng thời gian này (tránh làm phiền khách).
              </p>
            </div>
          </div>

          {/* 6. Nút Lưu Cấu Hình */}
          {isOwner && (
            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={isLoading}
                className="h-8 px-4 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white inline-flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
              >
                <Save size={13} />
                <span>Lưu Thiết Lập Khung Giờ</span>
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
