import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import clsx from 'clsx';

const variants = {
    initial: { opacity: 0, y: -20, scale: 0.9 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } }
};

const icons = {
    success: <CheckCircle className="w-5 h-5 text-emerald-500" />,
    error: <XCircle className="w-5 h-5 text-red-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />
};

const styles = {
    success: 'bg-white border-emerald-100 shadow-emerald-500/10',
    error: 'bg-white border-red-100 shadow-red-500/10',
    warning: 'bg-white border-amber-100 shadow-amber-500/10',
    info: 'bg-white border-blue-100 shadow-blue-500/10'
};

const Toast = ({ message, type = 'info', onClose }) => {
    return (
        <motion.div
            layout
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={clsx(
                "pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm min-w-[300px] max-w-md",
                styles[type]
            )}
        >
            <div className="flex-shrink-0">
                {icons[type]}
            </div>
            <p className="flex-1 text-sm font-medium text-slate-700">
                {message}
            </p>
            <button
                onClick={onClose}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
                <X size={14} />
            </button>
        </motion.div>
    );
};

export default Toast;
