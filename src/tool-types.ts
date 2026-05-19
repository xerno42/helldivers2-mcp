export interface ToolAnnotations {
  audience?: ('user' | 'assistant')[];
  priority?: number;
  lastModified?: string;
}

export interface ToolContent {
  type: 'text';
  text: string;
  annotations?: ToolAnnotations;
  _meta?: Record<string, unknown>;
}

export interface ToolResult {
  content: ToolContent[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
  annotations?: ToolAnnotations;
  _meta?: Record<string, unknown>;
}

export interface ToolDefinition {
  name: string;
  title?: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

export type ToolHandler = (args: Record<string, unknown>) => Promise<ToolResult>;

export interface Tool {
  definition: ToolDefinition;
  handler: ToolHandler;
}
