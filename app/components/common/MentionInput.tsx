'use client';

import React, { useRef, useEffect, forwardRef } from 'react';

interface MentionInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  maxLength?: number;
}

const MentionInput = forwardRef<HTMLTextAreaElement, MentionInputProps>(({
  value,
  onChange,
  placeholder,
  className = '',
  maxLength,
}, ref) => {
  const overlayRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="relative">
      <div
        ref={overlayRef}
        className={`${className} pointer-events-none absolute inset-0 whitespace-pre-wrap break-words`}
        dangerouslySetInnerHTML={{ __html: getHighlightedText() }}
      />
      <textarea
        ref={ref}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        maxLength={maxLength}
        className={`${className} bg-transparent`}
        style={{ caretColor: 'white' }}
      />
    </div>
  );
});

MentionInput.displayName = 'MentionInput';

export default MentionInput; 