import React, { useState } from 'react';
import { Wbase3020_01 } from './wbase3020_01';
import { Wbase3020_02 } from './wbase3020_02';
import { useWbase3020 } from './useWbase3020';

interface Wbase3020PageProps {
  onBackToMenu?: () => void;
}

export const Wbase3020Page: React.FC<Wbase3020PageProps> = ({ onBackToMenu }) => {
  const [step, setStep] = useState<'01' | '02'>('01');
  const setSearchParams = useWbase3020((state) => state.setSearchParams);

  const handleConfirmSele = (params: {
    period: string;
    times: string;
    inputMode: string;
    inputCondition: string;
  }) => {
    setSearchParams(params);
    setStep('02');
  };

  const handleBackToSele = () => {
    setStep('01');
  };

  if (step === '01') {
    return (
      <Wbase3020_01
        onConfirm={handleConfirmSele}
        onClose={() => {
          if (onBackToMenu) onBackToMenu();
        }}
      />
    );
  }

  return (
    <Wbase3020_02
      onBackToSele={handleBackToSele}
      onBackToMenu={onBackToMenu}
    />
  );
};

export default Wbase3020Page;
