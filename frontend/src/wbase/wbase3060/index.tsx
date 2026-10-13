import React, { useState } from 'react';
import { Wbase3060_01 } from './wbase3060_01';
import { Wbase3060_02 } from './wbase3060_02';

interface Wbase3060Props {
  onBackToMenu?: () => void;
  onClose?: () => void;
}

export const Wbase3060: React.FC<Wbase3060Props> = ({ onBackToMenu, onClose }) => {
  const [step, setStep] = useState<'01' | '02'>('01');
  const [currentParams, setCurrentParams] = useState<{
    period: string;
    times: string;
    sortOrder: '1' | '2' | '3';
  }>({
    period: '11505-06',
    times: '1',
    sortOrder: '1',
  });

  const handleClose = () => {
    if (onBackToMenu) {
      onBackToMenu();
    } else if (onClose) {
      onClose();
    }
  };

  const handleConfirm01 = (params: {
    period: string;
    times: string;
    sortOrder: '1' | '2' | '3';
  }) => {
    setCurrentParams(params);
    setStep('02');
  };

  if (step === '01') {
    return (
      <Wbase3060_01
        onConfirm={handleConfirm01}
        onClose={handleClose}
      />
    );
  }

  return (
    <Wbase3060_02
      period={currentParams.period}
      times={currentParams.times}
      sortOrder={currentParams.sortOrder}
      onBackToSele={() => setStep('01')}
      onBackToMenu={handleClose}
      onBack={() => setStep('01')}
    />
  );
};

export const Wbase3060Page = Wbase3060;
export { Wbase3060_01 } from './wbase3060_01';
export { Wbase3060_02 } from './wbase3060_02';
export default Wbase3060;
