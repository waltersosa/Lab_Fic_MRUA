import React, { useRef, useEffect, useState } from 'react';
import { Camera, CameraOff, Video, VideoOff } from 'lucide-react';

interface CameraStreamProps {
  isActive?: boolean;
}

export function CameraStream({ isActive = true }: CameraStreamProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);

  const startCamera = async () => {
    try {
      setError(null);
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'environment' // Preferir cámara trasera en móviles
        },
        audio: false
      });

      setStream(mediaStream);
      setIsEnabled(true);
      setHasPermission(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error('Error al acceder a la cámara:', err);
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Permiso denegado. Por favor, permite el acceso a la cámara.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No se encontró ninguna cámara en el dispositivo.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('La cámara está siendo usada por otra aplicación.');
      } else {
        setError(`Error al iniciar cámara: ${err.message}`);
      }
      
      setIsEnabled(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsEnabled(false);
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  };

  const toggleCamera = () => {
    if (isEnabled) {
      stopCamera();
    } else {
      startCamera();
    }
  };

  // Limpiar stream al desmontar
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // Auto-iniciar si isActive es true
  useEffect(() => {
    if (isActive && !isEnabled && !hasPermission) {
      startCamera();
    }
  }, [isActive]);

  return (
    <div className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden">
      {/* Video Stream */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover ${isEnabled ? 'block' : 'hidden'}`}
      />

      {/* Placeholder cuando la cámara está apagada */}
      {!isEnabled && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
          <CameraOff className="w-16 h-16 text-gray-600 mb-4" />
          <p className="text-gray-400 text-center px-4">
            {error || 'Cámara desactivada'}
          </p>
          {error && (
            <p className="text-gray-500 text-xs mt-2 px-4 text-center max-w-md">
              Haz clic en el botón para activar la cámara
            </p>
          )}
        </div>
      )}

      {/* Error Message Overlay */}
      {error && isEnabled && (
        <div className="absolute top-4 left-4 right-4 bg-red-500/90 text-white px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Control Buttons */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
        <button
          onClick={toggleCamera}
          className={`${
            isEnabled 
              ? 'bg-red-600 hover:bg-red-700' 
              : 'bg-blue-600 hover:bg-blue-700'
          } text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 shadow-lg transition-colors`}
        >
          {isEnabled ? (
            <>
              <VideoOff className="w-4 h-4" />
              Detener
            </>
          ) : (
            <>
              <Video className="w-4 h-4" />
              Activar Cámara
            </>
          )}
        </button>
      </div>

      {/* Live Indicator */}
      {isEnabled && (
        <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 shadow-lg">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
          EN VIVO
        </div>
      )}
    </div>
  );
}
