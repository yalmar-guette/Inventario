import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Smartphone } from 'lucide-react';

/**
 * InstallPrompt — Banner PWA para invitar al usuario a instalar la app.
 *
 * - En Android/Chrome: captura el evento beforeinstallprompt y muestra
 *   un banner custom con un botón de instalación directa.
 * - En iOS/Safari: muestra instrucciones de cómo usar "Añadir a inicio".
 * - Se oculta automáticamente si ya fue instalada (standalone) o si el
 *   usuario la descartó (se persiste en localStorage 7 días).
 */

const DISMISS_KEY = 'pwa_install_dismissed';
const DISMISS_DAYS = 7;

function wasRecentlyDismissed() {
  try {
    const ts = localStorage.getItem(DISMISS_KEY);
    if (!ts) return false;
    const elapsed = Date.now() - parseInt(ts, 10);
    return elapsed < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode() {
  return (
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  );
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showAndroid, setShowAndroid] = useState(false);
  const [showIOS, setShowIOS] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Si ya está instalada o fue descartada, no mostrar nada
    if (isInStandaloneMode() || wasRecentlyDismissed()) return;

    if (isIOS()) {
      // iOS: mostrar instrucciones manuales con un pequeño delay
      const t = setTimeout(() => setShowIOS(true), 3000);
      return () => clearTimeout(t);
    }

    // Android/Desktop Chrome: capturar el evento nativo
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShowAndroid(true), 2000);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Si ya se instaló desde el banner nativo, ocultar
    window.addEventListener('appinstalled', () => {
      setShowAndroid(false);
      setDeferredPrompt(null);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowAndroid(false);
      }
    } catch (err) {
      console.error('Install error:', err);
    } finally {
      setInstalling(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = (type) => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    if (type === 'android') setShowAndroid(false);
    if (type === 'ios') setShowIOS(false);
  };

  return (
    <>
      {/* ─── Banner Android / Chrome ─────────────────────────────────── */}
      <AnimatePresence>
        {showAndroid && (
          <motion.div
            key="android-banner"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-4 left-4 right-4 z-[9998] max-w-sm mx-auto"
            role="dialog"
            aria-label="Instalar aplicación"
          >
            <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-primary-900/20 border border-slate-200/60 dark:border-slate-700/60 overflow-hidden">
              {/* Barra de acento superior */}
              <div className="h-1 w-full bg-gradient-to-r from-primary-500 via-primary-600 to-primary-700" />

              <div className="p-5">
                {/* Header */}
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center shadow-lg shadow-primary-900/30 flex-shrink-0">
                    <img
                      src="/icons/icon-72x72.png"
                      alt="App icon"
                      className="w-10 h-10 rounded-xl"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.innerHTML =
                          '<span class="text-white text-xl font-black">GI</span>';
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 dark:text-white text-base">
                      Gestión de Inventario
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Instala la app para acceso rápido sin abrir el navegador.
                    </p>
                  </div>
                  <button
                    onClick={() => handleDismiss('android')}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex-shrink-0"
                    aria-label="Cerrar"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Botón de instalación */}
                <button
                  onClick={handleInstall}
                  disabled={installing}
                  className="mt-4 w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-semibold rounded-2xl shadow-md shadow-primary-900/30 transition-all active:scale-[0.98] disabled:opacity-60"
                >
                  <Download size={18} />
                  {installing ? 'Instalando...' : 'Añadir a la pantalla de inicio'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Instrucciones iOS / Safari ──────────────────────────────── */}
      <AnimatePresence>
        {showIOS && (
          <motion.div
            key="ios-banner"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-4 left-4 right-4 z-[9998] max-w-sm mx-auto"
            role="dialog"
            aria-label="Instrucciones de instalación iOS"
          >
            <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-primary-900/20 border border-slate-200/60 dark:border-slate-700/60 overflow-hidden">
              {/* Barra de acento */}
              <div className="h-1 w-full bg-gradient-to-r from-primary-500 via-primary-600 to-primary-700" />

              <div className="p-5">
                {/* Header */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center shadow-md flex-shrink-0">
                    <Smartphone size={20} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-slate-900 dark:text-white text-sm">
                      Instalar en iPhone / iPad
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Sigue estos pasos desde Safari:
                    </p>
                  </div>
                  <button
                    onClick={() => handleDismiss('ios')}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex-shrink-0"
                    aria-label="Cerrar"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Pasos */}
                <ol className="space-y-2.5">
                  {[
                    { step: '1', text: 'Toca el botón Compartir', emoji: '⬆️' },
                    { step: '2', text: 'Selecciona "En el inicio"', emoji: '➕' },
                    { step: '3', text: 'Pulsa "Añadir"', emoji: '✅' },
                  ].map(({ step, text, emoji }) => (
                    <li key={step} className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {step}
                      </span>
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        {emoji} {text}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
