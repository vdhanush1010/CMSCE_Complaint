import React from 'react';
import logoSvg from '../../assets/logo.svg';

export default function Logo({ className = "w-10 h-10" }) {
  return (
    <img 
      src={logoSvg} 
      alt="CMSCE Lotus Logo" 
      className={`${className} object-contain flex-shrink-0`}
    />
  );
}
