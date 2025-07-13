import React, { useState } from 'react';
import './SDKGenerator.css';

export const SDKGenerator: React.FC = () => {
  const [selectedLanguage, setSelectedLanguage] = useState('typescript');
  const [sdkOptions, setSdkOptions] = useState({
    includeExamples: true,
    includeTests: true,
    includeTypes: true,
    customPackageName: ''
  });

  const languages = [
    { id: 'typescript', name: 'TypeScript', icon: '🟦' },
    { id: 'javascript', name: 'JavaScript', icon: '🟨' },
    { id: 'python', name: 'Python', icon: '🐍' },
    { id: 'go', name: 'Go', icon: '🐹' },
    { id: 'java', name: 'Java', icon: '☕' },
    { id: 'csharp', name: 'C#', icon: '🟣' },
    { id: 'ruby', name: 'Ruby', icon: '💎' },
    { id: 'php', name: 'PHP', icon: '🐘' }
  ];

  const handleGenerate = () => {
    console.log('Generating SDK for', selectedLanguage, 'with options:', sdkOptions);
    // Implementation would call the SDK generator API
  };

  return (
    <div className="sdk-generator-page">
      <div className="sdk-header">
        <h1>SDK Generator</h1>
        <p>Generate a custom SDK for your preferred programming language</p>
      </div>

      <div className="sdk-content">
        <div className="language-selection">
          <h2>Select Language</h2>
          <div className="language-grid">
            {languages.map(lang => (
              <button
                key={lang.id}
                className={`language-option ${selectedLanguage === lang.id ? 'selected' : ''}`}
                onClick={() => setSelectedLanguage(lang.id)}
              >
                <span className="language-icon">{lang.icon}</span>
                <span className="language-name">{lang.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="sdk-options">
          <h2>SDK Options</h2>
          <div className="options-list">
            <label className="option-item">
              <input
                type="checkbox"
                checked={sdkOptions.includeExamples}
                onChange={(e) => setSdkOptions({...sdkOptions, includeExamples: e.target.checked})}
              />
              <span>Include code examples</span>
            </label>
            
            <label className="option-item">
              <input
                type="checkbox"
                checked={sdkOptions.includeTests}
                onChange={(e) => setSdkOptions({...sdkOptions, includeTests: e.target.checked})}
              />
              <span>Include unit tests</span>
            </label>
            
            <label className="option-item">
              <input
                type="checkbox"
                checked={sdkOptions.includeTypes}
                onChange={(e) => setSdkOptions({...sdkOptions, includeTypes: e.target.checked})}
              />
              <span>Include type definitions</span>
            </label>

            <div className="option-item">
              <label htmlFor="package-name">Custom package name (optional)</label>
              <input
                id="package-name"
                type="text"
                value={sdkOptions.customPackageName}
                onChange={(e) => setSdkOptions({...sdkOptions, customPackageName: e.target.value})}
                placeholder={`n8n-mcp-${selectedLanguage}`}
              />
            </div>
          </div>
        </div>

        <button className="generate-btn" onClick={handleGenerate}>
          Generate SDK
        </button>
      </div>
    </div>
  );
};