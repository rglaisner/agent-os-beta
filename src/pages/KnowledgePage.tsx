import React from 'react';
import KnowledgeBase from '../components/KnowledgeBase';
import { useStore } from '../store';

const KnowledgePage = () => {
  const { backendUrl } = useStore();

  return (
    <main className="container mx-auto p-4 flex flex-col gap-6 flex-1 overflow-hidden">
      <div className="flex-1 flex flex-col gap-4 h-full overflow-hidden">
        <KnowledgeBase backendUrl={backendUrl} />
      </div>
    </main>
  );
};

export default KnowledgePage;
