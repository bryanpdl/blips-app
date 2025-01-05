import Link from 'next/link';
import React from 'react';

export function renderTextWithMentions(text: string, noLinks: boolean = false): React.ReactNode {
  const parts = text.split(/(@\w+)/g);
  return parts.map((part, index) => {
    if (part.startsWith('@')) {
      const username = part.slice(1); // Remove @ symbol
      if (noLinks) {
        return (
          <span key={index} className="text-blue-400">
            {part}
          </span>
        );
      }
      return (
        <Link
          key={index}
          href={`/profile/${username}`}
          className="text-blue-400 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </Link>
      );
    }
    return part;
  });
} 