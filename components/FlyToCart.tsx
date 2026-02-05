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
    const targetX = rect ? rect.left + rect.width / 2 : (typeof window !== "undefined" ? window.innerWidth - 50 : 0);
    const targetY = rect ? rect.top + rect.height / 2 : 50;

    // Trigger animation immediately with requestAnimationFrame for better performance
    const frameId = requestAnimationFrame(() => {
      setStyle({
        left: targetX,
        top: targetY,
        opacity: 0,
        scale: 0.1,
        transform: 'translate(-50%, -50%) rotate(360deg)',
      });
    });

    // Faster animation: reduced from 800ms to 600ms
    const endTimer = setTimeout(onComplete, 600);
    return () => { cancelAnimationFrame(frameId); clearTimeout(endTimer); };
  }, [onComplete]);

  return (
    <div 
      className="fixed z-[100] pointer-events-none transition-all duration-600 ease-out"
      style={{
        ...style,
        width: '60px',
        height: '60px',
        willChange: 'transform, opacity',
      }}
    >
      <Image src={image} alt="" width={60} height={60} className="w-full h-full object-cover rounded-full border-2 border-[#FBBE01] shadow-2xl" unoptimized />
    </div>
  );
}