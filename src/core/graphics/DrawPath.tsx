import React from 'react';

type Props = {
  d: string;
  progress: number;
  color?: string;
  width?: number;
  viewBox?: string;
  style?: React.CSSProperties;
};

export const DrawPath: React.FC<Props> = ({
  d,
  progress,
  color = '#efe7d4',
  width = 7,
  viewBox = '0 0 1000 1000',
  style,
}) => {
  const length = 2000;
  return (
    <svg viewBox={viewBox} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', ...style}}>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={length}
        strokeDashoffset={length * (1 - progress)}
      />
    </svg>
  );
};
