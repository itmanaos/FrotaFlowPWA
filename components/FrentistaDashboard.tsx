
import React, { useState, useEffect, useRef } from 'react';
import { Camera, MapPin, Search, AlertCircle, Fuel, CheckCircle, Navigation, MessageSquare, X, QrCode, Zap, ZapOff, Loader2, Info, Truck, Activity, BadgeCheck, Droplets, AlertTriangle, Image as ImageIcon, Trash2, DollarSign } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { useAbastecimento } from '../hooks/useAbastecimento';
import { uploadPlatePhoto } from '../supabase';
import { RequisicaoAbastecimento } from '../types';

const FrentistaDashboard: React.FC<{ userId: string }> = ({ userId }) => {
  const { requests, completeAbastecimento } = useAbastecimento('frentista', userId);
  const [qrInput, setQrInput] = useState('');
  const [activeReq, setActiveReq] = useState<RequisicaoAbastecimento | null>(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'scan' | 'form' | 'success'>('scan');
  const [isScanning, setIsScanning] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isSuccessFlash, setIsSuccessFlash] = useState(false);
  
  // Form State
  const [placaConferida, setPlacaConferida] = useState('');
  const [odometro, setOdometro] = useState('');
  const [quantidadeFinal, setQuantidadeFinal] = useState('');
  const [valorTotal, setValorTotal] = useState('');
  const [tipoCombustivelAtendido, setTipoCombustivelAtendido] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  // Validação de Limite
  const volumeInformado = Number(quantidadeFinal) || 0;
  const volumeAutorizado = activeReq?.quantidade_solicitada || 0;
  const isOverLimit = volumeInformado > volumeAutorizado;

  useEffect(() => {
    if (isScanning && step === 'scan') {
      const html5QrCode = new Html5Qrcode("qr-reader");
      html5QrCodeRef.current = html5QrCode;

      const config = { fps: 15, qrbox: { width: 250, height: 250 } };

      html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          onScanSuccess(decodedText);
        },
        () => {} 
      ).catch(err => {
        console.error("Erro ao iniciar câmera:", err);
        setError("Não foi possível acessar a câmera. Verifique as permissões.");
        setIsScanning(false);
      });
    }

    return () => {
      stopScanner();
    };
  }, [isScanning, step]);

  const stopScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current = null;
      } catch (err) {
        console.error("Erro ao parar scanner:", err);
      }
    }
  };

  const onScanSuccess = async (decodedText: string) => {
    setIsScanning(false);
    await stopScanner();
    validateToken(decodedText);
  };

  const validateToken = (token: string) => {
    setIsValidating(true);
    setError('');

    setTimeout(() => {
      const found = requests.find(r => r.qr_code_token === token && r.status === 'autorizado');
      
      if (found) {
        setIsSuccessFlash(true);
        setTimeout(() => {
          setActiveReq(found);
          setPlacaConferida(found.veiculo?.placa || '');
          setTipoCombustivelAtendido(found.tipo_combustivel);
          setStep('form');
          setIsSuccessFlash(false);
          setIsValidating(false);
          captureLocation();
        }, 800);
      } else {
        setError('TOKEN INVÁLIDO OU EXPIRADO');
        setIsValidating(false);
        setIsScanning(false);
      }
    }, 600);
  };

  const handleManualSubmit = () => {
    if (!qrInput.trim()) return;
    validateToken(qrInput);
  };

  const captureLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }, () => {
        console.warn('Geolocation not allowed');
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReq || isOverLimit) return;
    
    setError('');
    setIsUploading(true);
    try {
      let uploadedPhotoUrl = '';
      if (photoFile) {
        uploadedPhotoUrl = await uploadPlatePhoto(photoFile);
      }

      const completionData = {
        requisicao_id: activeReq.id,
        frentista_id: userId,
        placa_conferida: placaConferida,
        foto_placa_url: uploadedPhotoUrl,
        odometro_bomba: Number(odometro),
        quantidade_final: Number(quantidadeFinal),
        valor_total: Number(valorTotal),
        tipo_combustivel_atendido: tipoCombustivelAtendido,
        geolocalizacao: location || { lat: 0, lng: 0 },
        data_hora: new Date().toISOString()
      };

      await completeAbastecimento(activeReq.id, completionData);
      setStep('success');
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar abastecimento.');
    } finally {
      setIsUploading(false);
    }
  };

  const reset = () => {
    setStep('scan');
    setActiveReq(null);
    setQrInput('');
    setOdometro('');
    setQuantidadeFinal('');
    setValorTotal('');
    setTipoCombustivelAtendido('');
    setPhotoFile(null);
    setPhotoPreview(null);
    setIsScanning(false);
    setError('');
  };

  if (step === 'success') {
    return (
      <div className="flex flex-col items-center justify-center space-y-6 py-12 px-4 text-center animate-in zoom-in-95 duration-300">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center shadow-lg shadow-green-100">
          <CheckCircle className="w-14 h-14 text-green-600" />
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-black text-gray-900">Finalizado!</h2>
          <p className="text-gray-500 font-medium">Registro enviado com sucesso para auditoria.</p>
        </div>
        <button 
          onClick={reset}
          className="w-full max-w-xs bg-blue-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-100 active:scale-95 transition"
        >
          Próximo Atendimento
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 px-2 pb-20">
      {step === 'scan' ? (
        <div className="space-y-6 max-w-md mx-auto">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-6 relative overflow-hidden">
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-gray-900 flex items-center">
                <QrCode className="w-6 h-6 mr-3 text-blue-600" />
                Validar Token
              </h2>
              <p className="text-sm text-gray-400 font-medium leading-relaxed">Escaneie o QR Code ou insira o código alfanumérico manualmente.</p>
            </div>
            
            <div className="space-y-6">
              {!isScanning ? (
                <button 
                  onClick={() => setIsScanning(true)}
                  disabled={isValidating}
                  className="w-full bg-blue-600 text-white py-8 rounded-3xl font-black text-lg flex flex-col items-center justify-center space-y-3 shadow-2xl shadow-blue-200 active:scale-95 transition disabled:opacity-50"
                >
                  {isValidating ? (
                    <Loader2 className="w-10 h-10 animate-spin" />
                  ) : (
                    <>
                      <Camera className="w-10 h-10" />
                      <span className="tracking-widest uppercase text-sm">Abrir Scanner de QR</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="relative aspect-square w-full bg-black rounded-[2rem] overflow-hidden shadow-2xl ring-4 ring-blue-600/20">
                  <div id="qr-reader" className="w-full h-full"></div>
                  
                  <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none p-12">
                     <div className="relative w-full h-full">
                        <div className="scanner-laser"></div>
                        <div className="scanner-corner sc-tl"></div>
                        <div className="scanner-corner sc-tr"></div>
                        <div className="scanner-corner sc-bl"></div>
                        <div className="scanner-corner sc-br"></div>
                     </div>
                  </div>

                  <div className="absolute bottom-6 left-0 right-0 flex justify-center z-40 space-x-4">
                     <button 
                      onClick={() => setIsScanning(false)}
                      className="bg-white/90 backdrop-blur px-6 py-3 rounded-2xl text-gray-900 font-black text-[10px] uppercase tracking-widest shadow-xl flex items-center"
                    >
                      <X className="w-4 h-4 mr-2" /> Fechar Câmera
                    </button>
                  </div>
                </div>
              )}

              {isSuccessFlash && (
                <div className="absolute inset-0 bg-green-500 z-[100] flex flex-col items-center justify-center text-white animate-in fade-in duration-200">
                  <CheckCircle className="w-20 h-20 mb-4 animate-in zoom-in duration-300" />
                  <p className="font-black uppercase tracking-[0.3em] text-sm">Token Validado!</p>
                </div>
              )}

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-100"></span></div>
                <div className="relative flex justify-center text-[10px] uppercase font-black tracking-[0.2em] text-gray-300">
                  <span className="bg-white px-4">Ou digite o código</span>
                </div>
              </div>

              <div className="flex space-x-3">
                <input 
                  type="text" 
                  placeholder="TOKEN-ABC"
                  className="flex-1 text-center text-xl font-mono font-black tracking-[0.3em] border-2 border-gray-100 rounded-2xl py-5 focus:border-blue-500 outline-none transition bg-gray-50/50"
                  value={qrInput}
                  onChange={(e) => setQrInput(e.target.value.toUpperCase())}
                />
                <button 
                  onClick={handleManualSubmit}
                  disabled={isValidating || !qrInput}
                  className="bg-blue-600 text-white p-5 rounded-2xl shadow-lg active:scale-90 transition disabled:opacity-30"
                >
                  {isValidating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Navigation className="w-6 h-6" />}
                </button>
              </div>

              {error && (
                <div className="flex items-center text-red-600 text-xs font-black bg-red-50 p-4 rounded-2xl border border-red-100 animate-shake">
                  <AlertCircle className="w-5 h-5 mr-3 shrink-0" />
                  <span className="uppercase tracking-wider">{error}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-500">
          {/* Cabeçalho de Dados Aprovados */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-5">
              <Fuel className="w-32 h-32" />
            </div>
            
            <div className="flex justify-between items-start">
               <div className="space-y-1">
                  <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Placa do Veículo</p>
                  <h3 className="text-3xl font-black text-gray-900 tracking-tighter">{activeReq?.veiculo?.placa}</h3>
                  <p className="text-xs font-bold text-gray-500">{activeReq?.veiculo?.modelo}</p>
               </div>
               <div className="bg-blue-600 text-white px-5 py-3 rounded-2xl shadow-lg shadow-blue-100 flex flex-col items-center">
                  <span className="text-[9px] font-black uppercase tracking-widest opacity-80">Limite</span>
                  <span className="text-xl font-black">{activeReq?.quantidade_solicitada}L</span>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center">
                  <Droplets className="w-3 h-3 mr-1.5" /> Solicitado
                </p>
                <p className="text-sm font-black text-gray-800">{activeReq?.tipo_combustivel}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center">
                  <Activity className="w-3 h-3 mr-1.5" /> Protocolo
                </p>
                <p className="text-sm font-black text-gray-800">#{activeReq?.id.slice(0, 8)}</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-100 space-y-10">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black text-gray-900 flex items-center">
                <BadgeCheck className="w-6 h-6 mr-3 text-blue-600" />
                Registrar Atendimento
              </h3>
              <button type="button" onClick={() => setStep('scan')} className="p-2 text-gray-300 hover:text-red-500 transition">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-10">
              {isOverLimit && (
                <div className="p-5 bg-red-600 text-white rounded-[1.5rem] flex items-center space-x-4 animate-in slide-in-from-top-4 duration-300 shadow-xl shadow-red-100">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest">Limite Excedido!</p>
                    <p className="text-xs font-bold opacity-90">O volume na bomba não pode ser maior que o autorizado ({activeReq?.quantidade_solicitada}L).</p>
                  </div>
                </div>
              )}

              {/* Seção de Captura de Foto */}
              <div className="space-y-4">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Foto da Placa (Opcional)</label>
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleFileChange}
                />
                
                {!photoPreview ? (
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full aspect-video bg-gray-50 border-4 border-dashed border-gray-200 rounded-[2rem] flex flex-col items-center justify-center space-y-4 text-gray-400 hover:bg-blue-50 hover:border-blue-200 transition group"
                  >
                    <div className="p-5 bg-white rounded-3xl shadow-sm border border-gray-100 group-hover:scale-110 transition">
                      <Camera className="w-10 h-10" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Toque para capturar foto</span>
                  </button>
                ) : (
                  <div className="relative aspect-video rounded-[2rem] overflow-hidden shadow-2xl border-4 border-white group">
                    <img src={photoPreview} alt="Preview da Placa" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center space-x-4 backdrop-blur-sm">
                      <button 
                        type="button" 
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-white p-4 rounded-2xl text-blue-600 shadow-lg active:scale-90 transition"
                      >
                        <Camera className="w-6 h-6" />
                      </button>
                      <button 
                        type="button" 
                        onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                        className="bg-white p-4 rounded-2xl text-red-600 shadow-lg active:scale-90 transition"
                      >
                        <Trash2 className="w-6 h-6" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <InputField 
                  label="Confirmar Placa" 
                  value={placaConferida} 
                  onChange={v => setPlacaConferida(v.toUpperCase())} 
                  placeholder="BRA-2E19"
                  required
                />
                <InputField 
                  label="KM do Veículo" 
                  value={odometro} 
                  onChange={setOdometro} 
                  type="number"
                  placeholder="000.000"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Combustível Atendido</label>
                  <select 
                    className="w-full bg-gray-50/50 border-2 border-gray-100 rounded-[1.5rem] px-6 py-5 font-black text-lg outline-none focus:border-blue-500 transition-all text-gray-900 appearance-none"
                    value={tipoCombustivelAtendido}
                    onChange={e => setTipoCombustivelAtendido(e.target.value)}
                  >
                    <option value="Diesel">Diesel</option>
                    <option value="Gasolina">Gasolina</option>
                    <option value="Etanol">Etanol</option>
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Valor Total ($)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                      type="number" 
                      step="0.01"
                      placeholder="0.00"
                      className="w-full bg-gray-50/50 border-2 border-gray-100 rounded-[1.5rem] pl-12 pr-6 py-5 font-black text-lg outline-none focus:border-blue-500 transition-all text-green-600"
                      value={valorTotal}
                      onChange={e => setValorTotal(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Volume Final Abastecido (L)</label>
                <div className="relative">
                  <div className={`absolute left-6 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-colors ${isOverLimit ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                    <Fuel className="w-6 h-6" />
                  </div>
                  <input 
                    type="number" 
                    step="0.01"
                    required
                    placeholder="0.00"
                    className={`w-full bg-gray-50/50 border-4 rounded-[2rem] pl-20 pr-6 py-6 font-black text-3xl outline-none transition-all ${
                      isOverLimit 
                      ? 'border-red-500 text-red-600 bg-red-50' 
                      : 'border-gray-100 text-blue-600 focus:border-blue-500 focus:bg-white'
                    }`}
                    value={quantidadeFinal}
                    onChange={e => setQuantidadeFinal(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-8">
                <div className={`p-6 rounded-[2rem] border transition-all flex items-center justify-between ${location ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                  <div className="flex items-center">
                     <MapPin className={`w-6 h-6 mr-4 ${location ? 'text-blue-600' : 'text-gray-400'}`} />
                     <div className="text-left">
                        <p className={`text-[10px] font-black uppercase tracking-widest ${location ? 'text-blue-600' : 'text-gray-400'}`}>Localização GPS</p>
                        <p className="text-xs font-bold text-gray-600">
                          {location ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` : 'Sincronizando...'}
                        </p>
                     </div>
                  </div>
                </div>

                {error && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center text-red-600 text-[10px] font-black uppercase">
                    <AlertCircle className="w-4 h-4 mr-2" /> {error}
                  </div>
                )}

                <div className="flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-4 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setStep('scan')}
                    className="flex-1 py-5 border-2 border-gray-100 rounded-3xl font-black text-[10px] uppercase tracking-widest text-gray-400 hover:bg-gray-50 transition active:scale-95"
                  >
                    Trocar Token
                  </button>
                  <button 
                    type="submit" 
                    disabled={isUploading || isOverLimit || !quantidadeFinal}
                    className={`flex-[2] py-5 rounded-3xl font-black text-sm uppercase tracking-widest shadow-2xl transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center space-x-3 ${
                      isOverLimit 
                      ? 'bg-gray-400 text-white cursor-not-allowed shadow-none' 
                      : 'bg-blue-600 text-white shadow-blue-100'
                    }`}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Fazendo Upload...</span>
                      </>
                    ) : (
                      <>
                        <BadgeCheck className="w-5 h-5" />
                        <span>{isOverLimit ? 'Volume Inválido' : 'Finalizar Atendimento'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

const InputField: React.FC<{ label: string, value: string, onChange: (v: string) => void, placeholder: string, type?: string, required?: boolean }> = ({ label, value, onChange, placeholder, type = "text", required }) => (
  <div className="space-y-3">
    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">{label}</label>
    <input 
      type={type} 
      required={required}
      placeholder={placeholder} 
      className="w-full bg-gray-50/50 border-2 border-gray-100 rounded-[1.5rem] px-6 py-5 font-black text-lg outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-gray-900" 
      value={value} 
      onChange={e => onChange(e.target.value)} 
    />
  </div>
);

export default FrentistaDashboard;
