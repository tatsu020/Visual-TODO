import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useHoverImage } from '../contexts/HoverImageContext';

const HoverImageOverlay: React.FC = () => {
  const { hoverImageState } = useHoverImage();

  // Calculate position for card expansion preferring left side of the card
  const position = useMemo(() => {
    const { cardRect } = hoverImageState;
    
    if (!cardRect) {
      // Fallback to viewport center
      return {
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)'
      };
    }

    // Assume in-card thumbnail is 64x64 at top-left; align vertically to its center
    const thumbnailSize = 64;
    const cardImageCenterY = cardRect.top + thumbnailSize / 2;

    const imageSize = 200; // Target expanded size (content box)
    const borderWidth = 3; // defined in style below
    const overlayTotalWidth = imageSize + borderWidth * 2; // border included
    const halfSize = imageSize / 2;
    const gap = 24; // gap used only for right-side fallback

    // Viewport measurements
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 20;

    // First choice: align the right edge of overlay with the right edge of the thumbnail
    // left = (thumbLeft + thumbWidth) - overlayTotalWidth
    let left = (cardRect.left + thumbnailSize) - overlayTotalWidth;
    let top = cardImageCenterY - halfSize;

    // If there isn't enough space on the left, try the right side of the card
    if (left < padding) {
      const rightCandidate = cardRect.right + gap;
      const fitsRight = rightCandidate + imageSize + padding <= viewportWidth;
      if (fitsRight) {
        left = rightCandidate;
      } else {
        // Final fallback: center over the thumbnail but stay within viewport
        const centerX = cardRect.left + 32; // thumbnail center X
        left = centerX - halfSize;
      }
    }

    // Clamp within viewport vertically and horizontally
    left = Math.max(padding, Math.min(left, viewportWidth - imageSize - padding));
    top = Math.max(padding, Math.min(top, viewportHeight - imageSize - padding));

    return {
      left: `${left}px`,
      top: `${top}px`,
      transform: 'none'
    };
  }, [hoverImageState.cardRect]);

  if (!hoverImageState.isVisible || !hoverImageState.imageUrl) return null;

  const overlayElement = (
    <div 
      className="hover-image-global-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 999999,
        pointerEvents: 'none',
        backgroundColor: 'transparent'
      }}
    >
      <img 
        src={hoverImageState.imageUrl}
        alt={`${hoverImageState.taskTitle}のイラスト（拡大）`}
        style={{
          position: 'absolute',
          ...position,
          width: '200px',
          height: '200px',
          borderRadius: '12px',
          objectFit: 'cover',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25), 0 8px 16px rgba(0, 0, 0, 0.15)',
          border: '3px solid rgba(255, 255, 255, 0.9)',
          transformOrigin: 'center center',
          animation: 'none'
        }}
        onError={(e) => {
          console.error('Hover image load error for task:', hoverImageState.taskTitle);
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    </div>
  );

  return createPortal(overlayElement, document.body);
};

export default HoverImageOverlay;