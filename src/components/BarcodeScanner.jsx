import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, ZoomIn, AlertCircle, Loader2 } from 'lucide-react';
import jsQR from 'jsqr';

/**
 * BarcodeScanner
 * ──────────────
 * Escaner de código de barras y QR usando la cámara trasera.
 *
 * Props:
 *  - onDetected(code: string) → callback al detectar un código
 *  - onClose()               → callback para cerrar el scanner
 *  - isOpen: boolean
 */

// Intentar usar la API nativa BarcodeDetector (Chrome Android, Edge)
// En iOS Safari y Firefox no está disponible → fallback a jsQR
const hasNativeBarcodeDetector = () =>
    typeof window !== 'undefined' && 'BarcodeDetector' in window;

export default function BarcodeScanner({ isOpen, onClose, onDetected }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const animFrameRef = useRef(null);
    const detectorRef = useRef(null);

    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [lastCode, setLastCode] = useState(null);
    const [flashActive, setFlashActive] = useState(false);

    // ── Iniciar cámara ─────────────────────────────────────────────────
    const startCamera = useCallback(async () => {
        setError(null);
        setLoading(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: 'environment' }, // cámara trasera
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
                audio: false,
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }

            // Inicializar BarcodeDetector nativo si está disponible
            if (hasNativeBarcodeDetector()) {
                detectorRef.current = new window.BarcodeDetector({
                    formats: [
                        'ean_13', 'ean_8', 'code_39', 'code_128',
                        'qr_code', 'upc_a', 'upc_e', 'itf',
                    ],
                });
            }

            setLoading(false);
        } catch (err) {
            console.error('Camera error:', err);
            if (err.name === 'NotAllowedError') {
                setError('Permiso de cámara denegado. Por favor actívalo en la configuración del navegador.');
            } else if (err.name === 'NotFoundError') {
                setError('No se encontró ninguna cámara en este dispositivo.');
            } else {
                setError('No se pudo acceder a la cámara: ' + err.message);
            }
            setLoading(false);
        }
    }, []);

    // ── Detener cámara ─────────────────────────────────────────────────
    const stopCamera = useCallback(() => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (videoRef.current) videoRef.current.srcObject = null;
    }, []);

    // ── Bucle de escaneo ────────────────────────────────────────────────
    const scanLoop = useCallback(async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < 2) {
            animFrameRef.current = requestAnimationFrame(scanLoop);
            return;
        }

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        try {
            let detectedCode = null;

            if (detectorRef.current) {
                // --- BarcodeDetector nativo ---
                const barcodes = await detectorRef.current.detect(canvas);
                if (barcodes.length > 0) detectedCode = barcodes[0].rawValue;
            } else {
                // --- Fallback: jsQR solo para QR codes ---
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const result = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: 'dontInvert',
                });
                if (result) detectedCode = result.data;
            }

            if (detectedCode && detectedCode !== lastCode) {
                setLastCode(detectedCode);
                // Flash visual de éxito
                setFlashActive(true);
                setTimeout(() => setFlashActive(false), 300);

                // Vibración háptica (si el dispositivo lo soporta)
                if ('vibrate' in navigator) navigator.vibrate(80);

                // Notificar al padre y cerrar
                onDetected(detectedCode);
                stopCamera();
                onClose();
                return;
            }
        } catch (_) {
            // Ignorar errores de detección individuales
        }

        animFrameRef.current = requestAnimationFrame(scanLoop);
    }, [lastCode, onDetected, onClose, stopCamera]);

    // ── Efecto: montar/desmontar ────────────────────────────────────────
    useEffect(() => {
        if (isOpen) {
            setLastCode(null);
            startCamera().then(() => {
                animFrameRef.current = requestAnimationFrame(scanLoop);
            });
        } else {
            stopCamera();
        }
        return () => stopCamera();
    }, [isOpen]); // eslint-disable-line

    // Reiniciar scanLoop cuando termine de cargar
    useEffect(() => {
        if (!loading && isOpen && !error) {
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
            animFrameRef.current = requestAnimationFrame(scanLoop);
        }
    }, [loading, isOpen, error, scanLoop]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    key="scanner-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[9999] bg-black flex flex-col"
                    style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
                >
                    {/* Flash de éxito */}
                    <AnimatePresence>
                        {flashActive && (
                            <motion.div
                                key="flash"
                                initial={{ opacity: 0.8 }}
                                animate={{ opacity: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.3 }}
                                className="absolute inset-0 bg-white z-10 pointer-events-none"
                            />
                        )}
                    </AnimatePresence>

                    {/* Header */}
                    <div className="relative z-20 flex items-center justify-between px-5 py-4 bg-black/60 backdrop-blur-sm">
                        <div>
                            <p className="text-white font-bold text-base">Escanear código</p>
                            <p className="text-white/50 text-xs mt-0.5">
                                {hasNativeBarcodeDetector()
                                    ? 'Código de barras · QR · EAN · UPC'
                                    : 'Solo códigos QR (este navegador no soporta código de barras nativo)'}
                            </p>
                        </div>
                        <button
                            onClick={() => { stopCamera(); onClose(); }}
                            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all active:scale-95"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Visor de cámara */}
                    <div className="flex-1 relative overflow-hidden flex items-center justify-center">
                        {/* Video stream */}
                        <video
                            ref={videoRef}
                            className="absolute inset-0 w-full h-full object-cover"
                            playsInline
                            muted
                        />
                        {/* Canvas oculto para análisis */}
                        <canvas ref={canvasRef} className="hidden" />

                        {/* Overlay oscuro con ventana de escaneo */}
                        <div className="absolute inset-0 z-10 pointer-events-none">
                            {/* Máscara oscura alrededor del área de escaneo */}
                            <div className="absolute inset-0 bg-black/50" />

                            {/* Ventana transparente central */}
                            <div
                                className="absolute bg-transparent"
                                style={{
                                    top: '50%', left: '50%',
                                    width: '72%', maxWidth: '320px',
                                    aspectRatio: '1.6 / 1',
                                    transform: 'translate(-50%, -55%)',
                                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
                                    borderRadius: '16px',
                                }}
                            >
                                {/* Esquinas animadas */}
                                {[
                                    'top-0 left-0 border-t-3 border-l-3 rounded-tl-2xl',
                                    'top-0 right-0 border-t-3 border-r-3 rounded-tr-2xl',
                                    'bottom-0 left-0 border-b-3 border-l-3 rounded-bl-2xl',
                                    'bottom-0 right-0 border-b-3 border-r-3 rounded-br-2xl',
                                ].map((classes, i) => (
                                    <div
                                        key={i}
                                        className={`absolute w-7 h-7 border-primary-400 ${classes}`}
                                        style={{ borderWidth: '3px' }}
                                    />
                                ))}

                                {/* Línea de escaneo animada */}
                                <motion.div
                                    className="absolute left-1 right-1 h-0.5 bg-primary-400/80 rounded-full shadow-[0_0_8px_rgba(139,92,246,0.8)]"
                                    animate={{ top: ['8%', '88%', '8%'] }}
                                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                                />
                            </div>
                        </div>

                        {/* Estado: cargando */}
                        {loading && (
                            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 text-white">
                                <Loader2 size={40} className="animate-spin text-primary-400" />
                                <p className="text-sm font-medium opacity-70">Activando cámara...</p>
                            </div>
                        )}

                        {/* Estado: error */}
                        {error && (
                            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 px-8 text-center">
                                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                                    <AlertCircle size={32} className="text-red-400" />
                                </div>
                                <p className="text-white font-bold text-base">Error de cámara</p>
                                <p className="text-white/60 text-sm leading-relaxed">{error}</p>
                                <button
                                    onClick={startCamera}
                                    className="mt-2 px-6 py-3 bg-primary-600 text-white font-bold rounded-2xl text-sm active:scale-95 transition-all"
                                >
                                    Reintentar
                                </button>
                            </div>
                        )}

                        {/* Instrucción en la parte inferior del visor */}
                        {!loading && !error && (
                            <div
                                className="absolute z-20 left-0 right-0 flex justify-center"
                                style={{ top: '65%', transform: 'translateY(-50%)' }}
                            >
                                <div className="mt-40 flex items-center gap-2 px-4 py-2 bg-black/40 rounded-full backdrop-blur-sm">
                                    <ZoomIn size={14} className="text-primary-400" />
                                    <span className="text-white/70 text-xs font-medium">
                                        Apunta al código y mantén el pulso
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer con botón cancelar para iOS */}
                    <div className="z-20 flex justify-center px-5 py-4 bg-black/60 backdrop-blur-sm">
                        <button
                            onClick={() => { stopCamera(); onClose(); }}
                            className="w-full max-w-xs py-3.5 bg-white/10 hover:bg-white/20 text-white font-bold text-sm rounded-2xl transition-all active:scale-[0.98] border border-white/10"
                        >
                            Cancelar
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
