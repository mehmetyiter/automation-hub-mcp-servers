import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { ApiDocs } from './pages/ApiDocs';
import { Tutorials } from './pages/Tutorials';
import { SDKGenerator } from './pages/SDKGenerator';
import { Playground } from './pages/Playground';
import { Support } from './pages/Support';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import './App.css';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/api-docs" element={<ApiDocs />} />
              <Route path="/tutorials" element={<Tutorials />} />
              <Route path="/sdk-generator" element={<SDKGenerator />} />
              <Route path="/playground" element={<Playground />} />
              <Route path="/support" element={<Support />} />
            </Routes>
          </Layout>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;