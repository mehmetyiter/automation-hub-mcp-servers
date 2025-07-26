import React from 'react';

interface AIProviderIconProps {
  platform: string;
  className?: string;
}

export const AIProviderIcon: React.FC<AIProviderIconProps> = ({ platform, className = "w-5 h-5" }) => {
  if (platform === 'openai') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.975 5.975 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.77.77 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
      </svg>
    );
  } else if (platform === 'anthropic' || platform?.includes('claude')) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.549 6.02L12.197 18.5h-2.631l1.838-4.022h-5.24L10.188 5.5h2.712l-1.475 3.236h5.03c.394 0 .747.242.888.61a1.001 1.001 0 0 1-.03.998l-.764 1.676zm0 0" />
      </svg>
    );
  } else if (platform === 'google_ai' || platform === 'gemini') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none">
        <path d="M12 12L4 8V16L12 12Z" fill="#4285F4"/>
        <path d="M20 12L12 8V16L20 12Z" fill="#EA4335"/>
        <path d="M12 12L4 16V20C4 20 4 24 8 24H12V12Z" fill="#34A853"/>
        <path d="M12 12L20 16V20C20 20 20 24 16 24H12V12Z" fill="#FBBC04"/>
      </svg>
    );
  } else if (platform === 'deepseek') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
      </svg>
    );
  } else if (platform === 'groq') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 3v18h18V3H3zm16 16H5V5h14v14zm-7-2h2v-2h-2v2zm0-4h2V7h-2v6z"/>
      </svg>
    );
  } else if (platform === 'mistral') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M4 4h4v4H4V4zm0 6h4v4H4v-4zm0 6h4v4H4v-4zm6-12h4v4h-4V4zm0 6h4v4h-4v-4zm0 6h4v4h-4v-4zm6-12h4v4h-4V4zm0 6h4v4h-4v-4zm0 6h4v4h-4v-4z"/>
      </svg>
    );
  } else if (platform === 'cohere') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.19 0 2.34-.21 3.41-.6.3-.11.49-.4.49-.72 0-.43-.35-.78-.78-.78-.17 0-.33.06-.46.14-.85.3-1.74.46-2.66.46-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8c0 .92-.16 1.81-.46 2.66-.08.13-.14.29-.14.46 0 .43.35.78.78.78.32 0 .61-.19.72-.49.39-1.07.6-2.22.6-3.41 0-5.52-4.48-10-10-10z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    );
  } else if (platform === 'perplexity') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
      </svg>
    );
  } else if (platform === 'together') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
      </svg>
    );
  } else {
    // Default AI icon
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M21 11V9h-2c-.1-.7-.3-1.4-.6-2l1.4-1.4-1.4-1.4L17 5.6c-.6-.3-1.3-.5-2-.6V3h-2v2c-.7.1-1.4.3-2 .6L9.6 4.2 8.2 5.6 9.6 7c-.3.6-.5 1.3-.6 2H7v2h2c.1.7.3 1.4.6 2l-1.4 1.4 1.4 1.4L11 14.4c.6.3 1.3.5 2 .6V17h2v-2c.7-.1 1.4-.3 2-.6l1.4 1.4 1.4-1.4L18.4 13c.3-.6.5-1.3.6-2h2zM14 12c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
        <path d="M8 21v-2H4v-2h4v-2l3 3-3 3zm8-10v2h4v2h-4v2l-3-3 3-3z"/>
      </svg>
    );
  }
};

export default AIProviderIcon;