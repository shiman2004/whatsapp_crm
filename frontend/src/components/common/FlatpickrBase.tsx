import React, { useEffect, useRef, useId } from 'react';
import flatpickr from 'flatpickr';
import type { Instance as FlatpickrInstance } from 'flatpickr/dist/types/instance';
import type { BaseOptions } from 'flatpickr/dist/types/options';
import { Calendar, Clock, CalendarDays, X } from 'lucide-react';

export type PickerType = 'datetime' | 'date' | 'time' | 'range';

export interface BasePickerProps {
  value?: string | Date | null;
  onChange?: (dateStr: string, dateObj?: Date) => void;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  clearable?: boolean;
  minDate?: string | Date;
  maxDate?: string | Date;
  minTime?: string;
  maxTime?: string;
  className?: string;
  inputClassName?: string;
  error?: string | boolean;
  id?: string;
  name?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
  options?: Partial<BaseOptions>;
}

export interface FlatpickrBaseProps extends BasePickerProps {
  pickerType: PickerType;
}

export const FlatpickrBase: React.FC<FlatpickrBaseProps> = ({
  pickerType,
  value,
  onChange,
  placeholder,
  disabled = false,
  readOnly = false,
  required = false,
  clearable = true,
  minDate,
  maxDate,
  minTime,
  maxTime,
  className = '',
  inputClassName = '',
  error,
  id,
  name,
  ariaLabel,
  autoFocus = false,
  options = {}
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const inputRef = useRef<HTMLInputElement>(null);
  const fpInstanceRef = useRef<FlatpickrInstance | null>(null);

  // Default formats and options per picker type
  const defaultOptions: Partial<BaseOptions> = {
    disableMobile: true,
    time_24hr: true,
    minuteIncrement: 1,
    allowInput: false,
    ...(() => {
      switch (pickerType) {
        case 'datetime':
          return {
            enableTime: true,
            noCalendar: false,
            dateFormat: 'Y-m-d H:i',
          };
        case 'date':
          return {
            enableTime: false,
            noCalendar: false,
            dateFormat: 'Y-m-d',
          };
        case 'time':
          return {
            enableTime: true,
            noCalendar: true,
            dateFormat: 'H:i',
          };
        case 'range':
          return {
            mode: 'range',
            enableTime: false,
            noCalendar: false,
            dateFormat: 'Y-m-d',
          };
      }
    })(),
    ...options
  };

  const defaultPlaceholder = (() => {
    if (placeholder) return placeholder;
    switch (pickerType) {
      case 'datetime':
        return 'YYYY-MM-DD HH:mm';
      case 'date':
        return 'YYYY-MM-DD';
      case 'time':
        return 'HH:mm';
      case 'range':
        return 'YYYY-MM-DD to YYYY-MM-DD';
    }
  })();

  // Initialize Flatpickr
  useEffect(() => {
    if (!inputRef.current) return;

    const fp = flatpickr(inputRef.current, {
      ...defaultOptions,
      defaultDate: value ? (value instanceof Date ? value : String(value)) : undefined,
      minDate: minDate ? (minDate instanceof Date ? minDate : String(minDate)) : undefined,
      maxDate: maxDate ? (maxDate instanceof Date ? maxDate : String(maxDate)) : undefined,
      minTime: minTime,
      maxTime: maxTime,
      onChange: (selectedDates, dateStr) => {
        if (onChange) {
          onChange(dateStr, selectedDates[0]);
        }
      }
    });

    fpInstanceRef.current = fp;

    return () => {
      fp.destroy();
      fpInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update value dynamically when prop changes
  useEffect(() => {
    const fp = fpInstanceRef.current;
    if (!fp) return;

    const currentFormatted = fp.input.value;
    const targetValue = value ? (value instanceof Date ? fp.formatDate(value, (fp.config.dateFormat as string) || 'Y-m-d') : String(value)) : '';

    if (targetValue !== currentFormatted) {
      if (!targetValue) {
        fp.clear(false);
      } else {
        fp.setDate(targetValue, false);
      }
    }
  }, [value]);

  // Update bounds if minDate / maxDate change
  useEffect(() => {
    const fp = fpInstanceRef.current;
    if (!fp) return;
    if (minDate !== undefined) {
      fp.set('minDate', minDate ? (minDate instanceof Date ? minDate : String(minDate)) : undefined);
    }
  }, [minDate]);

  useEffect(() => {
    const fp = fpInstanceRef.current;
    if (!fp) return;
    if (maxDate !== undefined) {
      fp.set('maxDate', maxDate ? (maxDate instanceof Date ? maxDate : String(maxDate)) : undefined);
    }
  }, [maxDate]);

  useEffect(() => {
    const fp = fpInstanceRef.current;
    if (!fp) return;
    if (minTime !== undefined) fp.set('minTime', minTime);
    if (maxTime !== undefined) fp.set('maxTime', maxTime);
  }, [minTime, maxTime]);

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (disabled || readOnly) return;
    if (fpInstanceRef.current) {
      fpInstanceRef.current.clear();
    }
    if (onChange) {
      onChange('', undefined);
    }
  };

  const hasValue = Boolean(value && String(value).trim() !== '');

  const IconComponent = (() => {
    switch (pickerType) {
      case 'time':
        return Clock;
      case 'range':
        return CalendarDays;
      default:
        return Calendar;
    }
  })();

  const isInvalid = Boolean(error);

  return (
    <div className={`relative flex items-center w-full group ${className}`}>
      <input
        ref={inputRef}
        id={inputId}
        name={name}
        type="text"
        placeholder={defaultPlaceholder}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        autoFocus={autoFocus}
        aria-label={ariaLabel || defaultPlaceholder}
        aria-invalid={isInvalid}
        className={`w-full transition-colors duration-150 rounded-xl border font-mono text-xs outline-none
          pl-3 pr-8 py-2
          bg-white text-slate-800 border-slate-300 placeholder:text-slate-400
          hover:border-slate-400 focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20
          dark:bg-slate-950 dark:text-slate-100 dark:border-slate-800 dark:placeholder:text-slate-500
          dark:hover:border-slate-700 dark:focus:border-teal-500 dark:focus:ring-teal-500/20
          ${isInvalid ? 'border-rose-500 dark:border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : ''}
          ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-900' : 'cursor-pointer'}
          ${inputClassName}
        `}
      />

      <div className="absolute right-2.5 flex items-center gap-1 pointer-events-none">
        {clearable && hasValue && !disabled && !readOnly && (
          <button
            type="button"
            tabIndex={-1}
            onClick={handleClear}
            className="p-0.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors pointer-events-auto"
            title="Clear selection"
            aria-label="Clear selection"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled || readOnly}
          onClick={() => fpInstanceRef.current?.open()}
          className="text-slate-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors pointer-events-auto cursor-pointer"
          aria-label="Open date picker"
        >
          <IconComponent className="w-4 h-4" />
        </button>
      </div>

      {typeof error === 'string' && error && (
        <span className="absolute -bottom-4 left-1 text-[10px] text-rose-500 font-sans">
          {error}
        </span>
      )}
    </div>
  );
};
