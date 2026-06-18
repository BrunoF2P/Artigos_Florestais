import React, { useRef, useEffect, useCallback } from 'react';
import { Maximize2 } from 'lucide-react';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  className?: string;
  minHeight?: number;
  children?: React.ReactNode;
  onRender?: (canvas: HTMLCanvasElement) => void;
  chartKey?: string;
}

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  subtitle,
  className = '',
  minHeight = 200,
  children,
  onRender,
  chartKey,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && onRender) {
      onRender(canvasRef.current);
    }
  });

  return (
    <div className={`chart-card ${className}`}>
      <div className="chart-card-title">
        <div>
          <span>{title}</span>
          {subtitle && <span className="chart-card-subtitle">{subtitle}</span>}
        </div>
      </div>
      <div className="chart-container" style={{ minHeight }}>
        {children ?? (
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
        )}
      </div>
    </div>
  );
};
