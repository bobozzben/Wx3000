import { useState, useEffect, useCallback } from 'react';
import type { MenuItem } from './menuConfig';

interface UseMenuKeyboardProps {
  menuData: MenuItem[];
  onSelectAction: (item: MenuItem) => void;
  enabled?: boolean;
}

export function useMenuKeyboard({
  menuData,
  onSelectAction,
  enabled = true,
}: UseMenuKeyboardProps) {
  const [level1Idx, setLevel1Idx] = useState<number>(0);
  const [level2Idx, setLevel2Idx] = useState<number | null>(null);
  const [level3Idx, setLevel3Idx] = useState<number | null>(null);

  // Current items at each tier
  const currentTier1Item = menuData[level1Idx] || null;
  const tier2Items = currentTier1Item?.children || [];
  const currentTier2Item = level2Idx !== null ? tier2Items[level2Idx] || null : null;
  const tier3Items = currentTier2Item?.children || [];
  const currentTier3Item = level3Idx !== null ? tier3Items[level3Idx] || null : null;

  // Active tier level: 1 = Top Category, 2 = Sub-item, 3 = Sub-sub-item
  const activeLevel = level3Idx !== null ? 3 : level2Idx !== null ? 2 : 1;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Ignore when typing inside input / textarea
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (targetTag === 'input' || targetTag === 'textarea') return;

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          if (activeLevel === 1) {
            setLevel1Idx((prev) => (prev < menuData.length - 1 ? prev + 1 : 0));
            setLevel2Idx(null);
            setLevel3Idx(null);
          } else if (activeLevel === 2) {
            setLevel2Idx((prev) =>
              prev !== null && prev < tier2Items.length - 1 ? prev + 1 : 0
            );
            setLevel3Idx(null);
          } else if (activeLevel === 3) {
            setLevel3Idx((prev) =>
              prev !== null && prev < tier3Items.length - 1 ? prev + 1 : 0
            );
          }
          break;
        }

        case 'ArrowUp': {
          e.preventDefault();
          if (activeLevel === 1) {
            setLevel1Idx((prev) => (prev > 0 ? prev - 1 : menuData.length - 1));
            setLevel2Idx(null);
            setLevel3Idx(null);
          } else if (activeLevel === 2) {
            setLevel2Idx((prev) =>
              prev !== null && prev > 0 ? prev - 1 : tier2Items.length - 1
            );
            setLevel3Idx(null);
          } else if (activeLevel === 3) {
            setLevel3Idx((prev) =>
              prev !== null && prev > 0 ? prev - 1 : tier3Items.length - 1
            );
          }
          break;
        }

        case 'ArrowRight': {
          e.preventDefault();
          if (activeLevel === 1 && currentTier1Item?.hasChildren && tier2Items.length > 0) {
            setLevel2Idx(0);
          } else if (activeLevel === 2 && currentTier2Item?.hasChildren && tier3Items.length > 0) {
            setLevel3Idx(0);
          }
          break;
        }

        case 'ArrowLeft': {
          e.preventDefault();
          if (activeLevel === 3) {
            setLevel3Idx(null);
          } else if (activeLevel === 2) {
            setLevel2Idx(null);
          }
          break;
        }

        case 'Enter': {
          e.preventDefault();
          if (activeLevel === 1) {
            if (currentTier1Item?.hasChildren && tier2Items.length > 0) {
              // Expand Tier 2
              setLevel2Idx(0);
            } else if (currentTier1Item) {
              // Leaf Tier 1 item → trigger action
              onSelectAction(currentTier1Item);
            }
          } else if (activeLevel === 2) {
            if (currentTier2Item?.hasChildren && tier3Items.length > 0) {
              // Expand Tier 3
              setLevel3Idx(0);
            } else if (currentTier2Item) {
              // Leaf Tier 2 item → trigger action
              onSelectAction(currentTier2Item);
            }
          } else if (activeLevel === 3 && currentTier3Item) {
            onSelectAction(currentTier3Item);
          }
          break;
        }

        case 'Escape': {
          e.preventDefault();
          if (activeLevel === 3) setLevel3Idx(null);
          else if (activeLevel === 2) setLevel2Idx(null);
          break;
        }

        // Number key shortcuts for Tier 1 categories
        default: {
          const num = parseInt(e.key, 10);
          if (num >= 1 && num <= menuData.length) {
            e.preventDefault();
            setLevel1Idx(num - 1);
            setLevel2Idx(null);
            setLevel3Idx(null);
          }
          break;
        }
      }
    },
    [
      enabled,
      activeLevel,
      menuData,
      tier2Items,
      tier3Items,
      currentTier1Item,
      currentTier2Item,
      currentTier3Item,
      onSelectAction,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return {
    level1Idx,
    level2Idx,
    level3Idx,
    activeLevel,
    currentTier1Item,
    currentTier2Item,
    currentTier3Item,
    setLevel1Idx,
    setLevel2Idx,
    setLevel3Idx,
  };
}
