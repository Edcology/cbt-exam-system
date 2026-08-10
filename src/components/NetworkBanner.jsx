import React, { useState, useEffect } from 'react';
import { Wifi, Copy, Check, Server } from 'lucide-react';
import { apiRequest } from '../api';
import { copyText } from '../utils/copy';

export default function NetworkBanner() {
  const [networkInfo, setNetworkInfo] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiRequest('/network-info')
      .then(res => setNetworkInfo(res))
      .catch(err => console.error('Network info fetch error:', err));
  }, []);

  if (!networkInfo) return null;

  const handleCopy = (url) => {
    copyText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => console.error('Copy failed:', err));
  };

  return (
    <div className="bg-indigo-950/60 border-b border-indigo-500/20 px-4 py-2 text-xs md:text-sm flex flex-wrap items-center justify-between gap-2 text-indigo-200">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <Wifi className="w-4 h-4 text-emerald-400" />
        <span className="font-semibold text-white">Local Network Active:</span>
        {networkInfo.interfaces && networkInfo.interfaces.length > 0 ? (
          <span className="text-indigo-300 font-mono bg-indigo-900/50 px-2 py-0.5 rounded border border-indigo-700/50">
            {networkInfo.primary_url}
          </span>
        ) : (
          <span className="text-amber-300">Localhost Mode (Connect Wi-Fi for LAN access)</span>
        )}
      </div>

      {networkInfo.primary_url && (
        <button
          onClick={() => handleCopy(networkInfo.primary_url)}
          className="flex items-center gap-1 bg-indigo-600/40 hover:bg-indigo-600/70 border border-indigo-500/40 px-2.5 py-1 rounded text-white text-xs transition active:scale-95"
          title="Copy LAN Exam Link to share with students"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied Link!' : 'Copy LAN Link for Students'}</span>
        </button>
      )}
    </div>
  );
}
