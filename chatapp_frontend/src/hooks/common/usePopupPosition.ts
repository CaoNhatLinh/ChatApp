// src/hooks/common/usePopupPosition.ts
// Reusable hook for positioning context menus, emoji pickers, tooltips, etc.

import { useState, useEffect, useRef, useCallback } from 'react';

interface PopupDimensions {
    width: number;
    height: number;
}

interface PopupPosition {
    x: number;
    y: number;
}

const VIEWPORT_MARGIN = 10;

/** Clamp a popup position within viewport bounds */
function clampToViewport(
    x: number,
    y: number,
    dimensions: PopupDimensions
): PopupPosition {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let clampedX = x;
    let clampedY = y;

    if (clampedX + dimensions.width > viewportWidth - VIEWPORT_MARGIN) {
        clampedX = clampedX - dimensions.width;
    }
    if (clampedX < VIEWPORT_MARGIN) {
        clampedX = VIEWPORT_MARGIN;
    }
    if (clampedY + dimensions.height > viewportHeight - VIEWPORT_MARGIN) {
        clampedY = clampedY - dimensions.height;
    }
    if (clampedY < VIEWPORT_MARGIN) {
        clampedY = VIEWPORT_MARGIN;
    }

    return { x: clampedX, y: clampedY };
}

interface UsePopupPositionReturn {
    position: PopupPosition | null;
    ref: React.RefObject<HTMLDivElement | null>;
    open: (x: number, y: number, dimensions: PopupDimensions) => void;
    openFromElement: (element: HTMLElement, dimensions: PopupDimensions) => void;
    close: () => void;
    isOpen: boolean;
}

export function usePopupPosition(): UsePopupPositionReturn {
    const [position, setPosition] = useState<PopupPosition | null>(null);
    const ref = useRef<HTMLDivElement>(null);

    const open = useCallback((x: number, y: number, dimensions: PopupDimensions) => {
        setPosition(clampToViewport(x, y, dimensions));
    }, []);

    const openFromElement = useCallback((element: HTMLElement, dimensions: PopupDimensions) => {
        const rect = element.getBoundingClientRect();
        // Try placing below-left, then adjust if out of bounds
        let x = rect.left;
        const y = rect.bottom;

        // If it would go off-right, anchor to right edge
        if (x + dimensions.width > window.innerWidth - VIEWPORT_MARGIN) {
            x = rect.right - dimensions.width;
        }

        setPosition(clampToViewport(x, y, dimensions));
    }, []);

    const close = useCallback(() => { setPosition(null); }, []);

    // Close on click outside
    useEffect(() => {
        if (!position) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                close();
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') close();
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [position, close]);

    return {
        position,
        ref,
        open,
        openFromElement,
        close,
        isOpen: position !== null,
    };
}
