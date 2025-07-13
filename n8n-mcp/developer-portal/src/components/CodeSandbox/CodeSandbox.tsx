import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import * as monaco from 'monaco-editor';
import './CodeSandbox.css';

interface CodeSandboxProps {
  initialCode: string;
  language: string;
  onChange?: (value: string) => void;
  onRun?: () => void;
  theme?: string;
  height?: string;
  readOnly?: boolean;
  options?: monaco.editor.IStandaloneEditorConstructionOptions;
}

export interface CodeSandboxRef {
  getValue: () => string;
  setValue: (value: string) => void;
  format: () => void;
  focus: () => void;
}

export const CodeSandbox = forwardRef<CodeSandboxRef, CodeSandboxProps>(({
  initialCode,
  language,
  onChange,
  onRun,
  theme = 'vs-dark',
  height = '400px',
  readOnly = false,
  options = {}
}, ref) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    getValue: () => editorRef.current?.getValue() || '',
    setValue: (value: string) => editorRef.current?.setValue(value),
    format: () => editorRef.current?.trigger('editor', 'editor.action.formatDocument', null),
    focus: () => editorRef.current?.focus()
  }));

  useEffect(() => {
    if (!containerRef.current) return;

    // Configure Monaco environment
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.Latest,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.CommonJS,
      noEmit: true,
      esModuleInterop: true,
      jsx: monaco.languages.typescript.JsxEmit.React,
      reactNamespace: 'React',
      allowJs: true,
      typeRoots: ['node_modules/@types']
    });

    // Add type definitions for n8n-MCP SDK
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      `
      declare module '@n8n-mcp/sdk' {
        export class N8nMcpClient {
          constructor(config: {
            apiKey: string;
            baseURL?: string;
            timeout?: number;
          });
          
          workflows: {
            list(params?: any): Promise<any>;
            get(id: string): Promise<any>;
            create(data: any): Promise<any>;
            update(id: string, data: any): Promise<any>;
            delete(id: string): Promise<void>;
            execute(id: string, data?: any): Promise<any>;
          };
          
          executions: {
            get(id: string): Promise<any>;
            list(workflowId: string, params?: any): Promise<any>;
          };
        }
        
        export class ApiError extends Error {
          status: number;
          code?: string;
        }
        
        export class ValidationError extends ApiError {
          details: any[];
        }
      }
      `,
      'file:///node_modules/@types/n8n-mcp-sdk/index.d.ts'
    );

    // Create editor
    const editor = monaco.editor.create(containerRef.current, {
      value: initialCode,
      language: language,
      theme: theme,
      readOnly: readOnly,
      automaticLayout: true,
      minimap: {
        enabled: false
      },
      fontSize: 14,
      lineNumbers: 'on',
      roundedSelection: false,
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      wrappingStrategy: 'advanced',
      glyphMargin: true,
      folding: true,
      lineDecorationsWidth: 5,
      lineNumbersMinChars: 3,
      renderLineHighlight: 'all',
      quickSuggestions: {
        other: true,
        comments: true,
        strings: true
      },
      parameterHints: {
        enabled: true
      },
      suggestOnTriggerCharacters: true,
      acceptSuggestionOnEnter: 'on',
      tabCompletion: 'on',
      wordBasedSuggestions: true,
      ...options
    });

    editorRef.current = editor;

    // Handle changes
    const changeDisposable = editor.onDidChangeModelContent(() => {
      if (onChange) {
        onChange(editor.getValue());
      }
    });

    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      if (onRun) {
        onRun();
      }
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      editor.trigger('editor', 'editor.action.formatDocument', null);
    });

    // Cleanup
    return () => {
      changeDisposable.dispose();
      editor.dispose();
    };
  }, []);

  // Update theme
  useEffect(() => {
    if (editorRef.current) {
      monaco.editor.setTheme(theme);
    }
  }, [theme]);

  // Update language
  useEffect(() => {
    if (editorRef.current && language) {
      const model = editorRef.current.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, language);
      }
    }
  }, [language]);

  // Update read-only state
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({ readOnly });
    }
  }, [readOnly]);

  return (
    <div className="code-sandbox">
      <div 
        ref={containerRef}
        className="monaco-container"
        style={{ height }}
      />
      {onRun && (
        <div className="code-sandbox-footer">
          <span className="keyboard-hint">
            Press <kbd>Ctrl</kbd>+<kbd>Enter</kbd> to run
          </span>
        </div>
      )}
    </div>
  );
});