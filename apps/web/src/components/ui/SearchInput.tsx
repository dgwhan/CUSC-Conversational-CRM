import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Loader2 } from 'lucide-react';

export interface SearchInputProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onSearch?: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  isLoading?: boolean;
  disabled?: boolean;
  shortcutHint?: string; // e.g., "/" or "Ctrl+K"
  className?: string;
  inputClassName?: string;
  size?: 'sm' | 'md' | 'lg';
  autoFocus?: boolean;
}

/**
 * Global Standard Search Input Component for Conversational CRM
 * Consistent height, typography, clear action, debounce, and keyboard interaction.
 */
export const SearchInput: React.FC<SearchInputProps> = ({
  value: controlledValue,
  defaultValue = '',
  onChange,
  onSearch,
  placeholder = 'Tìm kiếm...',
  debounceMs = 0,
  isLoading = false,
  disabled = false,
  shortcutHint,
  className = '',
  inputClassName = '',
  size = 'md',
  autoFocus = false,
}) => {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const currentValue = isControlled ? controlledValue : internalValue;
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync internal value if controlled
  useEffect(() => {
    if (isControlled) {
      setInternalValue(controlledValue);
    }
  }, [isControlled, controlledValue]);

  // Debounced search trigger
  useEffect(() => {
    if (debounceMs <= 0 || !onSearch) return;

    const timer = setTimeout(() => {
      onSearch(currentValue);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [currentValue, debounceMs, onSearch]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    if (!isControlled) {
      setInternalValue(nextVal);
    }
    onChange?.(nextVal);
    if (debounceMs <= 0) {
      onSearch?.(nextVal);
    }
  };

  const handleClear = useCallback(() => {
    if (!isControlled) {
      setInternalValue('');
    }
    onChange?.('');
    onSearch?.('');
    inputRef.current?.focus();
  }, [isControlled, onChange, onSearch]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' && currentValue) {
      e.preventDefault();
      handleClear();
    }
    if (e.key === 'Enter') {
      onSearch?.(currentValue);
    }
  };

  // Keyboard shortcut listener (e.g., press "/" to focus search)
  useEffect(() => {
    if (!shortcutHint || disabled) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if already typing in an input/textarea
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if (shortcutHint === '/' && e.key === '/') {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (
        (shortcutHint === 'Ctrl+K' || shortcutHint === 'Cmd+K') &&
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === 'k'
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [shortcutHint, disabled]);

  const heightClasses: Record<string, string> = {
    sm: 'py-1 pl-8 pr-7 text-[12px] h-[30px]',
    md: 'py-1.5 pl-8 pr-8 text-xs h-[36px]',
    lg: 'py-2 pl-9 pr-9 text-sm h-[42px]',
  };

  const iconSizes: Record<string, number> = {
    sm: 13,
    md: 14,
    lg: 16,
  };

  return (
    <div className={`relative flex items-center w-full min-w-[200px] ${className}`}>
      {/* Search Icon */}
      <Search
        size={iconSizes[size] ?? 14}
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none shrink-0"
      />

      {/* Input Field */}
      <input
        ref={inputRef}
        type="text"
        value={currentValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        className={`w-full border border-slate-300 rounded-none bg-white text-slate-900 outline-none focus:border-blue-600 transition-colors shadow-none box-border placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed ${
          heightClasses[size] ?? heightClasses.md
        } ${inputClassName}`}
      />

      {/* Right Action: Loading Spinner OR Clear Button OR Shortcut Hint */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {isLoading && (
          <Loader2 size={13} className="animate-spin text-blue-600" />
        )}

        {!isLoading && currentValue && (
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            aria-label="Xóa nội dung tìm kiếm"
            className="text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer p-0.5 rounded-none flex items-center justify-center transition-colors"
          >
            <X size={13} />
          </button>
        )}

        {!isLoading && !currentValue && shortcutHint && (
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-400 bg-slate-100 border border-slate-200 rounded-none pointer-events-none">
            {shortcutHint}
          </kbd>
        )}
      </div>
    </div>
  );
};
