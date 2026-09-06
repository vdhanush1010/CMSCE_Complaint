import React from 'react';
import lotusLogo from '../../assets/cms_lotus_logo.jpg';

export default function CMSLotusLogo({ className = "w-12 h-12" }) {
  return (
    <img
      src={lotusLogo}
      alt="CMSCE Official Lotus Crest"
      className={`rounded-full object-cover shadow-sm ${className}`}
    />
  );
}
