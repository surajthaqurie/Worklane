'use client';

import React, { useState, useEffect, useRef } from 'react';

export interface ContextMenuProps {
  children: React.ReactNode;
  menu: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function ContextMenu({
  children,
  menu,
  className = '',
  disabled = false,
}: ContextMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();

    const x = Math.min(e.clientX, window.innerWidth - 220);
    const y = Math.min(e.clientY, window.innerHeight - 250);

    setPosition({ x, y });
    setIsOpen(true);
  };

  useEffect(() => {
    const handleClose = () => setIsOpen(false);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('click', handleClose);
      document.addEventListener('contextmenu', handleClose);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('click', handleClose);
      document.removeEventListener('contextmenu', handleClose);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div onContextMenu={handleContextMenu} className={className}>
      {children}
      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          tabIndex={-1}
          style={{ top: `${position.y}px`, left: `${position.x}px` }}
          className="fixed z-[70] min-w-[180px] p-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] shadow-xl animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(false);
          }}
        >
          {menu}
        </div>
      )}
    </div>
  );
}
