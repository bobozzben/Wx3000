import React from 'react';
import { Wbase3025Transfer } from './Wbase3025Transfer';

/** 3-4-1 原媒體轉檔 (VFP wbase3025) */
export const Wbase3025_Media: React.FC<{ onClose: () => void }> = ({ onClose }) => <Wbase3025Transfer mode="media" onClose={onClose} />;

/** 3-4-2 網路申購轉檔 (VFP wbase3025n) */
export const Wbase3025_Net: React.FC<{ onClose: () => void }> = ({ onClose }) => <Wbase3025Transfer mode="net" onClose={onClose} />;

export { Wbase3025Transfer } from './Wbase3025Transfer';
