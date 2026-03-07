import { useState } from 'react';
import type { ContextMenuItem } from '../../components/ui/ContextMenu';

export const useContextMenu = () => {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: ContextMenuItem[];
  } | null>(null);

  const openContextMenu = (
    event: React.MouseEvent,
    items: ContextMenuItem[]
  ) => {
    event.preventDefault();
    event.stopPropagation();
    
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      items,
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  return {
    contextMenu,
    openContextMenu,
    closeContextMenu,
  };
};
