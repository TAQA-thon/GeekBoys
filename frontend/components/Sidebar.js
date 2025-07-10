import React from 'react';
import { 
  BarChart3, 
  Calendar, 
  Workflow,
  FileText,          // Report (not used currently)
  PieChart,          // Analytics & Visualizations
  Upload,            // Import
  Eye,               // Review
  Settings           // Admin
} from 'lucide-react';

export default function Sidebar({ active, setActive, userRole }) {
  const menuItems = [
    { icon: BarChart3, label: 'Dashboard', key: 'dashboard' },
    { icon: Calendar, label: 'Calendar', key: 'calendar' },
    { icon: Workflow, label: 'Systems', key: 'workflow' },
    { icon: PieChart, label: 'Analytics & Visualizations', key: 'analytics' },
    { icon: Upload, label: 'Import', key: 'import' },
    { icon: Eye, label: 'Review', key: 'review' },
  ];

  if (userRole === 'admin') {
    menuItems.push({ icon: Settings, label: 'Admin', key: 'admin' });
  }

  return (
    <aside className="fixed top-0 left-0 h-screen w-64 bg-white shadow-lg z-40 flex flex-col">
      <div className="flex justify-center items-center p-6 border-b border-gray-200">
        <img 
          src="/logo.png" 
          alt="Company Logo" 
          className="w-24 h-24 object-contain rounded" 
          loading="lazy"
        />
      </div>

      <nav className="flex-1 p-4 overflow-y-auto" aria-label="Main navigation">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4 select-none">Menu</div>
        <ul className="space-y-1">
          {menuItems.map(({ icon: Icon, label, key }) => {
            const isActive = active === key;
            return (
              <li key={key}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setActive(key)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActive(key);
                    }
                  }}
                  className={`flex items-center p-3 rounded-lg cursor-pointer select-none transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isActive
                      ? 'bg-blue-50 text-blue-600 font-semibold'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0 transition-colors duration-200" />
                  <span className="ml-3 text-sm">{label}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </nav>

      <footer className="p-4 border-t border-gray-200 text-center text-gray-500 text-xs select-none">
        {menuItems.find(i => i.key === active)?.label || ''}
      </footer>
    </aside>
  );
}