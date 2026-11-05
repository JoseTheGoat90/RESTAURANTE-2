/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useData } from '../context/DataContext.tsx';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const NotificationBanner: React.FC = () => {
  const { notification, clearNotification } = useData();

  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
          className={`w-full py-2.5 px-4 z-50 transition-colors shadow-xs ${
            notification.ok
              ? 'bg-emerald-600 text-white'
              : 'bg-rose-600 text-white'
          }`}
          role="alert"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold">
            <div className="flex items-center gap-2">
              {notification.ok ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{notification.mensaje}</span>
            </div>

            <button
              onClick={clearNotification}
              className="p-1 rounded hover:bg-black/10 transition-colors cursor-pointer shrink-0"
              aria-label="Cerrar notificación"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
