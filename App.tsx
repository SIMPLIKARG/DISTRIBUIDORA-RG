import React from 'react';
import { useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import ChatBot from './components/ChatBot';
import ClientsManager from './components/ClientsManager';
import RoutesManager from './components/RoutesManager';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'chatbot':
        return <ChatBot />;
      case 'clients':
        return <ClientsManager />;
      case 'routes':
        return <RoutesManager />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderContent()}
    </Layout>
  );
}

export default App;
