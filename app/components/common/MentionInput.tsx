'use client';

import React, { useRef, useEffect, forwardRef } from 'react';

interface MentionInputProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  className?: string;
}

const MentionInput = forwardRef<HTMLTextAreaElement, MentionInputProps>(
  ({ value, onChange, className = '', ...props }, ref) => {
    const overlayRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (ref && 'current' in ref && ref.current && overlayRef.current) {
        // Copy the textarea's scroll position to the overlay
        overlayRef.current.scrollTop = ref.current.scrollTop;
      }
    }, [value, ref]);

    // Function to highlight mentions in the overlay
    const getHighlightedText = () => {
      return value.replace(
        /(@\w+)/g,
        '<span class="text-blue-400">$1</span>'
      );
    };

    // Extract background color and border radius from className to apply to the container
    const bgClass = className.match(/bg-[^\s]*/)?.[0] || 'bg-gray-input';
    const roundedClass = className.match(/rounded[^\s]*/)?.[0] || '';

    // Remove padding, background, and border radius from the inner elements
    const innerClassName = className
      .replace(/\bp-\d+\b/g, '')
      .replace(/\bbg-[^\s]*\b/g, '')
      .replace(/\brounded[^\s]*\b/g, '')
      .replace(/\bring[^\s]*\b/g, '')
      .replace(/\bfocus:[^\s]*\b/g, '');

    return (
      <div ref={containerRef} className={`relative group ${bgClass} ${roundedClass} focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-0`}>
        <div
          ref={overlayRef}
          className={`${innerClassName} pointer-events-none absolute inset-0 p-3 whitespace-pre-wrap break-words`}
          dangerouslySetInnerHTML={{ __html: getHighlightedText() }}
        />
        <textarea
          ref={ref}
          value={value}
          onChange={onChange}
          className={`${innerClassName} bg-transparent caret-white p-3 w-full h-full focus:outline-none`}
          {...props}
        />
      </div>
    );
  }
);

MentionInput.displayName = 'MentionInput';

export default MentionInput; 