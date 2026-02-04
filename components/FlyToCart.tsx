"use client";
import Image from 'next/image';
import { useEffect, useState } from 'react';

interface FlyToCartProps {
  startPos: { x: number; y: number };
  image: string;
  onComplete: () => void;
}

export default function FlyToCart({ startPos, image, onComplete }: FlyToCartProps) {
  const [style, setStyle] = useState({
    left: startPos.x,
    top: startPos.y,
    opacity: 1,
    scale: 1,
    transform: 'translate(-50%, -50%)',
  });

  useEffect(() => {
    const cartIcon = document.querySelector('.cart-icon-target');
    const rect = cartIcon?.getBoundingClientRect();
    const targetX = rect ? rect.left + rect.width / 2 : window.innerWidth - 50;
    const targetY = rect ? rect.top + rect.height / 2 : 50;

    const timer = setTimeout(() => {
      setStyle({
        left: targetX,
        top: targetY,
        opacity: 0,
        scale: 0.1,
        transform: 'translate(-50%, -50%) rotate(360deg)',
      });
    }, 50);

    const endTimer = setTimeout(onComplete, 800);
    return () => { clearTimeout(timer); clearTimeout(endTimer); };
  }, [onComplete]);

  return (
    <div 
      className="fixed z-[100] pointer-events-none transition-all duration-700 ease-in-out"
      style={{
        ...style,
        width: '60px',
        height: '60px',
      }}
    >
      <Image src={image} alt="" width={60} height={60} className="w-full h-full object-cover rounded-full border-2 border-[#FBBE01] shadow-2xl" unoptimized />
    </div>
  );
}