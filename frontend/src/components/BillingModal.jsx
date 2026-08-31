import React from 'react';

export default function BillingModal({ isOpen, onClose }) {
  // CodeBase X-Ray on main branch is 100% Free and Open Source.
  // Subscription modals and price tiers are completely disabled.
  React.useEffect(() => {
    if (isOpen && onClose) {
      onClose();
    }
  }, [isOpen, onClose]);

  return null;
}


