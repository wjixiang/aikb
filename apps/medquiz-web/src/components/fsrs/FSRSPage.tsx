import { useState } from 'react';
import dynamic from 'next/dynamic';
import SubscriptionTable from './SubscriptionTable';

const FSRSReviewModal = dynamic(() => import('./FSRSReviewModal'), {
  ssr: false,
});

export default function FSRSPage() {
  const [selectedCollectionId, setSelectedCollectionId] = useState<
    string | null
  >(null);
  const [isTableExpanded, setIsTableExpanded] = useState(true);

  const handleSelectCollection = (collectionId: string) => {
    setSelectedCollectionId(collectionId);
    setIsTableExpanded(false);
  };

  return (
    <div>
      <SubscriptionTable
        isExpanded={isTableExpanded}
        onSelectCollection={handleSelectCollection}
      />
      {selectedCollectionId && (
        <FSRSReviewModal
          open={!!selectedCollectionId}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedCollectionId(null);
              setIsTableExpanded(true);
            }
          }}
          collectionId={selectedCollectionId}
        />
      )}
    </div>
  );
}
