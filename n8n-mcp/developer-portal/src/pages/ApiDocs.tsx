import React from 'react';
import { ApiExplorer } from '../components/ApiExplorer/ApiExplorer';
import './ApiDocs.css';

export const ApiDocs: React.FC = () => {
  return (
    <div className="api-docs-page">
      <ApiExplorer />
    </div>
  );
};