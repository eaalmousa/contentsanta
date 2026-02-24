import React, { useState } from "react";

// Minimal SVG fallback as data URI (gray square with icon)
const FALLBACK_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150">
  <rect width="150" height="150" fill="#e5e7eb"/>
  <circle cx="75" cy="60" r="20" fill="#9ca3af"/>
  <path d="M 30 120 Q 75 90 120 120" stroke="#9ca3af" stroke-width="8" fill="none"/>
</svg>
`)}`;

interface SafeImgProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string | null;
  alt: string;
  fallback?: string;
}

/**
 * SafeImg component with automatic fallback for broken/missing images.
 * Prevents external placeholder dependencies and handles image load failures gracefully.
 */
export function SafeImg({ 
  src, 
  alt, 
  fallback = FALLBACK_DATA_URI,
  ...props 
}: SafeImgProps) {
  const [imgSrc, setImgSrc] = useState(src || fallback);
  
  const handleError = () => {
    // Prevent infinite loop if fallback also fails
    if (imgSrc !== fallback) {
      setImgSrc(fallback);
    }
  };

  return (
    <img 
      src={imgSrc} 
      alt={alt}
      onError={handleError}
      loading="lazy"
      referrerPolicy="no-referrer"
      {...props}
    />
  );
}
