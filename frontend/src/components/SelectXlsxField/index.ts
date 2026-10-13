export * from './FormUtilSelectXlsxFieldsList';
import React, { useState, useCallback } from 'react';
import {
  FormUtilSelectXlsxFieldsList,
  parseXlsxConfigParams,
  type XlsxFieldItem,
  type XlsxSerializedConfig,
} from './FormUtilSelectXlsxFieldsList';

export interface UseSelectXlsxExportOptions {
  storageKey?: string;
  defaultVFieldList?: string;
  defaultVCaptionList?: string;
  defaultVDisplayFormat?: string;
  defaultVColorList?: string;
  fields: XlsxFieldItem[];
  onExport: (selectedFields: XlsxFieldItem[]) => void | Promise<void>;
}

/**
 * 通用 Hook: 供任何報表與列印畫面輕鬆掛載匯出欄位選擇器
 */
export function useSelectXlsxExport(options: UseSelectXlsxExportOptions) {
  const {
    storageKey = 'common_xlsx_export_config',
    defaultVFieldList,
    defaultVCaptionList,
    defaultVDisplayFormat,
    defaultVColorList,
    fields,
    onExport,
  } = options;

  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<XlsxSerializedConfig>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.vFieldList) return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse saved config from localStorage:', e);
    }
    return {
      vFieldList: defaultVFieldList || '',
      vCaptionList: defaultVCaptionList || '',
      vDisplayFormat: defaultVDisplayFormat || '',
      vColorList: defaultVColorList || '',
    };
  });

  const openSelector = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeSelector = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleConfirm = useCallback(
    async (selectedFields: XlsxFieldItem[], savedConfig?: XlsxSerializedConfig) => {
      if (savedConfig) {
        setConfig(savedConfig);
        try {
          localStorage.setItem(storageKey, JSON.stringify(savedConfig));
        } catch (e) {
          console.warn('Failed to save config to localStorage:', e);
        }
      }
      setIsOpen(false);
      await onExport(selectedFields.filter((f) => f.selected));
    },
    [onExport, storageKey]
  );

  const exportDirectly = useCallback(async () => {
    const configured = parseXlsxConfigParams(
      fields,
      config.vFieldList,
      config.vCaptionList,
      config.vDisplayFormat,
      config.vColorList
    );
    await onExport(configured.filter((f) => f.selected));
  }, [config, fields, onExport]);

  const renderModal = () =>
    React.createElement(FormUtilSelectXlsxFieldsList, {
      isOpen,
      fields,
      vFieldList: config.vFieldList,
      vCaptionList: config.vCaptionList,
      vDisplayFormat: config.vDisplayFormat,
      vColorList: config.vColorList,
      onConfirm: handleConfirm,
      onClose: closeSelector,
    });

  return {
    isOpen,
    openSelector,
    closeSelector,
    exportDirectly,
    renderModal,
    config,
  };
}
