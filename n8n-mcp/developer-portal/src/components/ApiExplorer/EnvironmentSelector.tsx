import React from 'react';
import './EnvironmentSelector.css';

interface Environment {
  value: string;
  label: string;
  url: string;
  description: string;
}

interface EnvironmentSelectorProps {
  value: string;
  onChange: (value: string) => void;
  options: Environment[];
}

export const EnvironmentSelector: React.FC<EnvironmentSelectorProps> = ({
  value,
  onChange,
  options
}) => {
  const selectedEnv = options.find(opt => opt.value === value);

  return (
    <div className="environment-selector">
      <label htmlFor="environment-select">Environment</label>
      <div className="select-wrapper">
        <select
          id="environment-select"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="environment-select"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="environment-status">
          <span className={`status-indicator status-${value}`}></span>
        </div>
      </div>
      
      {selectedEnv && (
        <div className="environment-info">
          <div className="environment-url">{selectedEnv.url}</div>
          <div className="environment-description">{selectedEnv.description}</div>
        </div>
      )}
    </div>
  );
};