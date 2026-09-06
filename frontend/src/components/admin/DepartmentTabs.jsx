import React from 'react';

export default function DepartmentTabs({ activeTab, setActiveTab }) {
  const tabs = [
    { id: 'ALL', label: 'All' },
    { id: 'CANTEEN', label: 'Canteen' },
    { id: 'TRANSPORT', label: 'Transport' },
    { id: 'HOSTEL', label: 'Hostel' },
    { id: 'HOSPITALITY', label: 'Hospitality' },
    { id: 'SPORTS', label: 'Sports' },
    { id: 'ACADEMIC', label: 'Academic' },
    { id: 'ANNOUNCEMENTS', label: 'Announcements' }
  ];

  return (
    <div className="border-b border-slate-200 bg-white max-w-[1600px] mx-auto px-6">
      <div className="flex space-x-8 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 text-sm font-semibold whitespace-nowrap border-b-2 transition-all cursor-pointer ${
                isActive
                  ? 'border-brand-green text-brand-green font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
