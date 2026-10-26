import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Check, Plus, Trash2, Package, DollarSign, Tag, Info } from 'lucide-react';
import type { ProductItemConfig } from '../../modules/workspace/workspaceConfig.types.js';

export interface AssignProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerName: string;
  productLabel: string;
  valueLabel: string;
  catalog: ProductItemConfig[];
  initialSelected?: string[];
  initialValue?: number;
  onSave: (selectedProducts: string[], estimatedValue: number) => void;
}

export const AssignProductModal: React.FC<AssignProductModalProps> = ({
  isOpen,
  onClose,
  customerName,
  productLabel,
  valueLabel,
  catalog,
  initialSelected = [],
  initialValue = 0,
  onSave,
}) => {
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [estimatedValue, setEstimatedValue] = useState<number>(initialValue);
  const [searchQuery, setSearchQuery] = useState('');
  const [customInput, setCustomInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Khởi tạo state khi mở modal hoặc thay đổi khách hàng
  useEffect(() => {
    if (isOpen) {
      setSelected(initialSelected || []);
      setEstimatedValue(initialValue || 0);
      setSearchQuery('');
      setCustomInput('');
      setSelectedCategory('ALL');
    }
  }, [isOpen, initialSelected, initialValue]);

  // Danh sách các danh mục sản phẩm duy nhất trong catalog
  const categories = useMemo(() => {
    const set = new Set<string>();
    catalog.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return Array.from(set);
  }, [catalog]);

  // Lọc sản phẩm theo tìm kiếm và danh mục
  const filteredCatalog = useMemo(() => {
    return catalog.filter((item) => {
      if (item.isActive === false) return false;
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchCategory = item.category?.toLowerCase().includes(q);
        const matchCode = item.code?.toLowerCase().includes(q);
        if (!matchName && !matchCategory && !matchCode) return false;
      }
      return true;
    });
  }, [catalog, selectedCategory, searchQuery]);

  // Format tiền tệ VNĐ
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  // Tính tổng giá trị mặc định từ các sản phẩm được chọn trong catalog
  const calculateTotalFromCatalog = (currentSelected: string[]): number => {
    return currentSelected.reduce((sum, itemName) => {
      const found = catalog.find((p) => p.name === itemName || p.id === itemName);
      return sum + (found?.defaultPrice || 0);
    }, 0);
  };

  // Toggle chọn hoặc bỏ chọn một sản phẩm từ catalog
  const handleToggleProduct = (productName: string) => {
    const isSelected = selected.includes(productName);
    let nextSelected: string[];
    if (isSelected) {
      nextSelected = selected.filter((name) => name !== productName);
    } else {
      nextSelected = [...selected, productName];
    }
    setSelected(nextSelected);

    // Tự động tính lại giá trị dự kiến từ danh mục
    const newTotal = calculateTotalFromCatalog(nextSelected);
    if (newTotal > 0 || nextSelected.length === 0) {
      setEstimatedValue(newTotal);
    }
  };

  // Thêm mục tùy chỉnh
  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const item = customInput.trim();
    if (!item) return;
    if (!selected.includes(item)) {
      setSelected([...selected, item]);
    }
    setCustomInput('');
  };

  // Xóa nhanh một mục khỏi danh sách đã chọn
  const handleRemoveSelected = (item: string) => {
    const nextSelected = selected.filter((name) => name !== item);
    setSelected(nextSelected);
    const newTotal = calculateTotalFromCatalog(nextSelected);
    if (newTotal > 0 || nextSelected.length === 0) {
      setEstimatedValue(newTotal);
    }
  };

  const handleSave = () => {
    onSave(selected, Number(estimatedValue) || 0);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: '#e0f2fe',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Package size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: '#0f172a' }}>
                Gán {productLabel}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748b' }}>
                Khách hàng: <strong style={{ color: '#0284c7' }}>{customerName}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Đóng"
          >
            <X size={20} />
          </button>
        </div>

        {/* Thân Modal */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {/* Thanh tìm kiếm & lọc danh mục */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
            <div
              style={{
                position: 'relative',
                flex: 1,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Search
                size={16}
                style={{ position: 'absolute', left: '12px', color: '#94a3b8' }}
              />
              <input
                type="text"
                placeholder={`Tìm kiếm trong danh mục ${productLabel.toLowerCase()}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  outline: 'none',
                  background: '#f8fafc',
                }}
              />
            </div>

            {categories.length > 0 && (
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  outline: 'none',
                  background: '#ffffff',
                  minWidth: '140px',
                  cursor: 'pointer',
                }}
              >
                <option value="ALL">Tất cả nhóm</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Danh sách mục từ Catalog */}
          <div style={{ marginBottom: '18px' }}>
            <div
              style={{
                fontSize: '12.5px',
                fontWeight: 600,
                color: '#475569',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>DANH MỤC CẤU HÌNH DOANH NGHIỆP ({filteredCatalog.length})</span>
              <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                Đã chọn: <strong style={{ color: '#0284c7' }}>{selected.length}</strong>
              </span>
            </div>

            {filteredCatalog.length === 0 ? (
              <div
                style={{
                  padding: '24px',
                  textAlign: 'center',
                  background: '#f8fafc',
                  borderRadius: '10px',
                  border: '1px dashed #cbd5e1',
                  color: '#64748b',
                  fontSize: '13px',
                }}
              >
                Không tìm thấy {productLabel.toLowerCase()} nào phù hợp với từ khóa.
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '10px',
                  maxHeight: '230px',
                  overflowY: 'auto',
                  paddingRight: '4px',
                }}
              >
                {filteredCatalog.map((prod) => {
                  const isChecked = selected.includes(prod.name);
                  return (
                    <div
                      key={prod.id}
                      onClick={() => handleToggleProduct(prod.name)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: `1.5px solid ${isChecked ? '#0284c7' : '#e2e8f0'}`,
                        background: isChecked ? '#f0f9ff' : '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '4px',
                          border: `1.5px solid ${isChecked ? '#0284c7' : '#cbd5e1'}`,
                          background: isChecked ? '#0284c7' : '#ffffff',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginTop: '2px',
                          flexShrink: 0,
                        }}
                      >
                        {isChecked && <Check size={13} strokeWidth={3} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '13px',
                            fontWeight: 600,
                            color: isChecked ? '#0369a1' : '#1e293b',
                            lineHeight: 1.3,
                            marginBottom: '4px',
                          }}
                        >
                          {prod.name}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '6px',
                            fontSize: '11px',
                          }}
                        >
                          {prod.category && (
                            <span
                              style={{
                                background: '#f1f5f9',
                                color: '#475569',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontWeight: 500,
                              }}
                            >
                              {prod.category}
                            </span>
                          )}
                          <span style={{ color: '#059669', fontWeight: 600 }}>
                            {formatCurrency(prod.defaultPrice)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Form thêm mục tùy chỉnh ngoài danh mục */}
          <form
            onSubmit={handleAddCustom}
            style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '18px',
              alignItems: 'center',
            }}
          >
            <input
              type="text"
              placeholder={`Hoặc nhập ${productLabel.toLowerCase()} khác nếu có...`}
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px dashed #cbd5e1',
                fontSize: '13px',
                outline: 'none',
                background: '#ffffff',
              }}
            />
            <button
              type="submit"
              disabled={!customInput.trim()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '8px 14px',
                borderRadius: '8px',
                background: '#f1f5f9',
                color: '#334155',
                border: '1px solid #cbd5e1',
                fontSize: '12.5px',
                fontWeight: 500,
                cursor: customInput.trim() ? 'pointer' : 'not-allowed',
                opacity: customInput.trim() ? 1 : 0.6,
              }}
            >
              <Plus size={14} />
              <span>Thêm nhanh</span>
            </button>
          </form>

          {/* Các mục đã chọn */}
          {selected.length > 0 && (
            <div style={{ marginBottom: '18px' }}>
              <div
                style={{
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: '#475569',
                  marginBottom: '8px',
                }}
              >
                CÁC MỤC ĐÃ GÁN CHO KHÁCH HÀNG:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {selected.map((item) => {
                  const prod = catalog.find((p) => p.name === item);
                  return (
                    <div
                      key={item}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: '#e0f2fe',
                        color: '#0369a1',
                        border: '1px solid #bae6fd',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '12px',
                        fontWeight: 500,
                      }}
                    >
                      <span>{item}</span>
                      {prod?.defaultPrice ? (
                        <span style={{ fontSize: '10.5px', color: '#0284c7' }}>
                          ({formatCurrency(prod.defaultPrice)})
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleRemoveSelected(item)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#0284c7',
                          cursor: 'pointer',
                          padding: '0 2px',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        title="Xóa mục này"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Giá trị dự kiến / Học phí / Giao dịch */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <DollarSign size={15} color="#059669" />
                <span>{valueLabel}</span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: '#64748b' }}>
                Tự động tính từ danh mục hoặc tùy chỉnh số tiền theo thực tế tư vấn
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="number"
                step="500000"
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(Number(e.target.value) || 0)}
                style={{
                  width: '160px',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#0f172a',
                  textAlign: 'right',
                  outline: 'none',
                }}
              />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>VNĐ</span>
            </div>
          </div>
        </div>

        {/* Footer Modal */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
            background: '#f8fafc',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="crm-btn crm-btn-secondary"
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              fontSize: '13.5px',
              cursor: 'pointer',
            }}
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSave}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 20px',
              borderRadius: '8px',
              background: '#0284c7',
              color: '#ffffff',
              border: 'none',
              fontSize: '13.5px',
              fontWeight: 500,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            <Check size={16} />
            <span>Xác nhận Gán</span>
          </button>
        </div>
      </div>
    </div>
  );
};
