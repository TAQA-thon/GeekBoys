import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import CalendarView from './CalendarView';
import WorkflowDashboard from './WorkflowDashboard';
import Analytics from './AnalyticsVisualization.js';
import ExcelFileUpload from './uploadfile.js';
import Dash from './view.js';
import ChatbotButton from './ChatbotButton'; 
import Review from './views.js'; 
import Model from './Model.js'
import AnalyticsReport from './AnalyticsReport';
import AdminDashboard from './AdminDashboard';



export default function Dashboard({ onLogout }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month');
  const [selectedDate, setSelectedDate] = useState(null);

  const [active, setActive] = useState('dashboard');

  // Example state to track if dashboard data changed (you can customize this)
  const [hasNewUpdates, setHasNewUpdates] = useState(false);

  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setUserRole(user.role);
      } catch {}
    }
  }, []);

  // Example: simulate data change notification when active view changes
  useEffect(() => {
    // For demo, mark new updates when switching to dashboard view
    if (active === 'dashboard') {
      setHasNewUpdates(true);
    }
  }, [active]);

  // Clear notification when chat opens
  const handleChatOpen = () => {
    setHasNewUpdates(false);
  };

  return (
    <div className="flex">
      <Sidebar active={active} setActive={setActive} userRole={userRole} />
      <div className="flex-1 ml-64 min-h-screen bg-gray-50">
        <TopBar onLogout={onLogout} />
        {active === 'dashboard' && <Dash />}
        {active === 'calendar' && <CalendarView />}
        {active === 'workflow' && <WorkflowDashboard />}
        {active === 'analytics' && <AnalyticsReport />}
        {active === 'import' && <ExcelFileUpload />}
        {active === 'review' && <Review />}
        {active === 'admin' && userRole === 'admin' && <AdminDashboard />}

        {/* {active === 'report' && <Report />} */}
        {/* {active=='model' && <Model />} */}
        {/* Add more views as needed */}
        <ChatbotButton onOpen={handleChatOpen} />
      </div>
    </div>
  );
}