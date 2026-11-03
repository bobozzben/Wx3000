import React from 'react';

/** 欄位說明列 (VFP flddesc：黑底黃字，依目前欄位切換說明文字) */
export const FieldDescBar: React.FC<{ text: string }> = ({ text }) => (
  <div className="shrink-0 min-h-[30px] rounded bg-black px-3 py-1 font-mono text-sm font-bold text-yellow-300">{text || ' '}</div>
);
