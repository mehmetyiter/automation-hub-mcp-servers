import React from 'react';
import { motion } from 'framer-motion';
import { ChevronDownIcon } from 'lucide-react';
import { clsx } from 'clsx';

export interface TimeRangeSelectorProps {
  value: '1h' | '24h' | '7d' | '30d';
  onChange: (value: '1h' | '24h' | '7d' | '30d') => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'compact';
}

const timeRangeOptions = [
  { value: '1h' as const, label: 'Last Hour', shortLabel: '1H' },
  { value: '24h' as const, label: 'Last 24 Hours', shortLabel: '24H' },
  { value: '7d' as const, label: 'Last 7 Days', shortLabel: '7D' },
  { value: '30d' as const, label: 'Last 30 Days', shortLabel: '30D' }
];

export const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  size = 'md',
  variant = 'default'
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(
    timeRangeOptions.findIndex(option => option.value === value)
  );

  const selectedOption = timeRangeOptions[selectedIndex];

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-2',
    lg: 'text-base px-4 py-3'
  };

  const handleSelect = (option: typeof timeRangeOptions[0], index: number) => {
    setSelectedIndex(index);
    onChange(option.value);
    setIsOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;

    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        setIsOpen(!isOpen);
        break;
      case 'Escape':
        setIsOpen(false);
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (isOpen) {
          const nextIndex = (selectedIndex + 1) % timeRangeOptions.length;
          setSelectedIndex(nextIndex);
        } else {
          setIsOpen(true);
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (isOpen) {
          const prevIndex = selectedIndex === 0 ? timeRangeOptions.length - 1 : selectedIndex - 1;
          setSelectedIndex(prevIndex);
        } else {
          setIsOpen(true);
        }
        break;
    }
  };

  if (variant === 'compact') {
    return (
      <div className="flex bg-gray-100 rounded-lg p-1">
        {timeRangeOptions.map((option, index) => (
          <button
            key={option.value}
            onClick={() => handleSelect(option, index)}
            disabled={disabled}
            className={clsx(
              'px-3 py-1 text-xs font-medium rounded-md transition-all duration-200',
              selectedIndex === index
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {option.shortLabel}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={clsx(
          'inline-flex items-center justify-between bg-white border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200',
          sizeClasses[size],
          disabled && 'opacity-50 cursor-not-allowed',
          isOpen && 'ring-2 ring-blue-500 border-blue-500'
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby="time-range-label"
      >
        <span>{selectedOption.label}</span>
        <ChevronDownIcon 
          className={clsx(
            'ml-2 w-4 h-4 transition-transform duration-200',
            isOpen && 'transform rotate-180'
          )} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          
          {/* Menu */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.1 }}
            className="absolute right-0 z-20 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg"
            role="listbox"
            aria-labelledby="time-range-label"
          >
            <div className="py-1">
              {timeRangeOptions.map((option, index) => (
                <button
                  key={option.value}
                  onClick={() => handleSelect(option, index)}
                  className={clsx(
                    'w-full text-left px-4 py-2 text-sm transition-colors duration-150',
                    selectedIndex === index
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  )}
                  role="option"
                  aria-selected={selectedIndex === index}
                >
                  <div className="flex items-center justify-between">
                    <span>{option.label}</span>
                    {selectedIndex === index && (
                      <svg 
                        className="w-4 h-4 text-blue-600" 
                        fill="currentColor" 
                        viewBox="0 0 20 20"
                      >
                        <path 
                          fillRule="evenodd" 
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
                          clipRule="evenodd" 
                        />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
};

export default TimeRangeSelector;