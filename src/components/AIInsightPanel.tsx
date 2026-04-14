import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAIAnalysis } from '../hooks/useAIAnalysis';
import { MarkdownText } from './ui/MarkdownText';

type AnalyzeMode = 'session' | 'sleep' | 'wellness' | 'sport' | 'monthly' | 'daily';

interface AIInsightPanelProps {
  mode: AnalyzeMode;
  payload?: Record<string, string>;
  title?: string;
  chatContext?: string;
}

export const AIInsightPanel: React.FC<AIInsightPanelProps> = ({
  mode,
  payload = {},
  title,
  chatContext,
}) => {
  const { content, loading, error, cached, generatedAt, generate, stop } = useAIAnalysis(mode, payload);
  const navigate = useNavigate();

  const handleAskMore = () => {
    navigate('/coach', {
      state: {
        preseeded: true,
        context: chatContext || `Analysis ${mode}`,
        aiResponse: content,
      },
    });
  };

  // Idle state
  if (!content && !loading && !error) {
    return (
      <button
        onClick={() => generate()}
        className="w-full bg-surface-low hover:bg-surface rounded-xl p-4 lg:p-5 text-left transition-colors group"
      >
        <div className="flex items-center gap-3">
          <span className="text-primary text-lg">◈</span>
          <div className="flex-1">
            <p className="font-label text-label-sm text-primary tracking-widest uppercase">
              {title || 'DRIFT AI'}
            </p>
            <p className="font-label text-label-sm text-on-surface-variant mt-0.5 group-hover:text-on-surface transition-colors">
              Analyze with AI
            </p>
          </div>
          <span className="text-on-surface-variant group-hover:text-primary transition-colors">→</span>
        </div>
      </button>
    );
  }

  return (
    <div className="bg-surface-low rounded-xl p-4 lg:p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-primary text-lg">◈</span>
          <p className="font-label text-label-sm text-primary tracking-widest uppercase">
            {title || 'DRIFT AI'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {cached && generatedAt && (
            <span className="font-label text-[10px] text-on-surface-variant opacity-60">
              cached
            </span>
          )}
          {loading && (
            <button
              onClick={stop}
              className="font-label text-label-sm text-on-surface-variant hover:text-on-surface transition-colors"
            >
              ■ Stop
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-3">
          <p className="font-label text-label-sm text-red-400 mb-2">{error}</p>
          <button
            onClick={() => generate()}
            className="font-label text-label-sm text-primary hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Content */}
      {content && (
        <div className="text-on-surface-variant text-sm leading-relaxed">
          <MarkdownText text={content} />
          {loading && (
            <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5 align-middle rounded-sm" />
          )}
        </div>
      )}

      {/* Loading without content yet */}
      {loading && !content && (
        <div className="flex items-center gap-2 text-on-surface-variant">
          <span className="inline-block w-1.5 h-4 bg-primary animate-pulse rounded-sm" />
          <span className="font-label text-label-sm">Analyzing...</span>
        </div>
      )}

      {/* Actions (only when done) */}
      {content && !loading && (
        <div className="flex items-center gap-3 mt-4 pt-3 border-t border-outline-variant/20">
          <button
            onClick={handleAskMore}
            className="font-label text-label-sm text-primary hover:underline"
          >
            Ask more →
          </button>
          <button
            onClick={() => generate(true)}
            className="font-label text-label-sm text-on-surface-variant hover:text-on-surface transition-colors"
          >
            ↻ Regenerate
          </button>
        </div>
      )}
    </div>
  );
};
